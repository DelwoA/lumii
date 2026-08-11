from __future__ import annotations

import argparse
import hashlib
import json
import zipfile
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import BinaryIO

import polars as pl
import pyarrow as pa
import pyarrow.csv as arrow_csv

from lumii_mastery.config import load_config
from lumii_mastery.data.split import student_split

REQUIRED_COLUMNS = {
    "timestamp",
    "problem_id",
    "time_taken",
    "student_id",
    "skill_id",
    "correct",
}


@contextmanager
def _open_flattened_ednet(raw_dir: Path) -> Iterator[BinaryIO | Path]:
    csv_files = list(raw_dir.rglob("processed_data_03.csv"))
    if csv_files:
        yield csv_files[0]
        return

    archives = list(raw_dir.rglob("*.zip"))
    if not archives:
        raise FileNotFoundError(
            "processed_data_03.csv or its Kaggle zip archive was not found; "
            "run scripts/download_datasets.py first"
        )
    with zipfile.ZipFile(archives[0]) as archive:
        members = [name for name in archive.namelist() if name.endswith("processed_data_03.csv")]
        if len(members) != 1:
            raise ValueError(f"Expected one processed_data_03.csv, found {len(members)}")
        with archive.open(members[0]) as stream:
            yield stream


def _read_raw(raw_dir: Path, max_rows: int | None) -> pl.DataFrame:
    with _open_flattened_ednet(raw_dir) as source:
        reader = arrow_csv.open_csv(
            source,
            read_options=arrow_csv.ReadOptions(block_size=8 * 1024 * 1024, use_threads=True),
            parse_options=arrow_csv.ParseOptions(delimiter=","),
            convert_options=arrow_csv.ConvertOptions(
                include_columns=sorted(REQUIRED_COLUMNS),
                null_values=["", "null", "None", "nan"],
                strings_can_be_null=True,
            ),
        )
        batches: list[pa.RecordBatch] = []
        rows = 0
        for batch in reader:
            if max_rows is not None and rows + batch.num_rows > max_rows:
                batch = batch.slice(0, max_rows - rows)
            batches.append(batch)
            rows += batch.num_rows
            if max_rows is not None and rows >= max_rows:
                break
        if not batches:
            raise ValueError("The EdNet CSV did not contain any data rows")
        return pl.from_arrow(pa.Table.from_batches(batches))


def _split_lookup(student_ids: pl.Series, train: float, validation: float) -> pl.DataFrame:
    unique = student_ids.cast(pl.String).unique().to_list()
    return pl.DataFrame(
        {
            "user_id": unique,
            "split": [student_split(value, train=train, validation=validation) for value in unique],
        }
    )


def prepare_ednet(
    raw_dir: Path,
    output: Path,
    *,
    max_rows: int | None,
    train_fraction: float,
    validation_fraction: float,
    elapsed_quantiles: tuple[float, float],
    gap_quantiles: tuple[float, float],
) -> dict[str, object]:
    raw = _read_raw(raw_dir, max_rows)
    missing = REQUIRED_COLUMNS - set(raw.columns)
    if missing:
        raise ValueError(f"EdNet mirror is missing required columns: {sorted(missing)}")

    initial_rows = raw.height
    data = (
        raw.select(
            pl.col("student_id").cast(pl.String, strict=False).alias("user_id"),
            pl.col("skill_id").cast(pl.String, strict=False).alias("concept_id"),
            pl.col("problem_id").cast(pl.String, strict=False).alias("question_id"),
            pl.col("timestamp").cast(pl.Int64, strict=False),
            pl.col("time_taken").cast(pl.Float64, strict=False).alias("elapsed_sec"),
            pl.col("correct").cast(pl.Int8, strict=False),
        )
        .drop_nulls()
        .filter(
            pl.col("correct").is_in([0, 1])
            & (pl.col("timestamp") > 0)
            & (pl.col("elapsed_sec") >= 0)
            & (pl.col("concept_id").str.len_chars() > 0)
            & pl.col("concept_id").str.contains(";").not_()
        )
        .unique(subset=["user_id", "question_id", "timestamp"], keep="first")
        .sort(["user_id", "concept_id", "timestamp", "question_id"])
    )

    split_lookup = _split_lookup(data["user_id"], train_fraction, validation_fraction)
    data = data.join(split_lookup, on="user_id", how="left", validate="m:1").with_columns(
        pl.col("timestamp")
        .diff()
        .over(["user_id", "concept_id"])
        .fill_null(0)
        .clip(lower_bound=0)
        .cast(pl.Float64)
        .alias("gap_sec"),
        pl.int_range(0, pl.len())
        .over(["user_id", "concept_id"])
        .cast(pl.Int32)
        .alias("attempt_index"),
    )

    train = data.filter(pl.col("split") == "train")
    if train.is_empty():
        raise ValueError("The deterministic split produced no training rows")
    elapsed_bounds = (
        train["elapsed_sec"].quantile(elapsed_quantiles[0]),
        train["elapsed_sec"].quantile(elapsed_quantiles[1]),
    )
    gap_bounds = (
        train["gap_sec"].quantile(gap_quantiles[0]),
        train["gap_sec"].quantile(gap_quantiles[1]),
    )
    if any(value is None for value in (*elapsed_bounds, *gap_bounds)):
        raise ValueError("Could not calculate outlier bounds from training data")

    data = data.with_columns(
        pl.col("elapsed_sec").clip(*elapsed_bounds).cast(pl.Float32),
        pl.col("gap_sec").clip(*gap_bounds).cast(pl.Float32),
    )
    if data.null_count().sum_horizontal().item() != 0:
        raise ValueError("Final validation failed: processed data still contains missing values")
    if set(data["split"].unique()) - {"train", "validation", "test"}:
        raise ValueError("Final validation failed: unknown split label")

    output.parent.mkdir(parents=True, exist_ok=True)
    data.write_parquet(output, compression="zstd", statistics=True)
    return {
        "raw_rows_read": initial_rows,
        "rows": data.height,
        "removed_rows": initial_rows - data.height,
        "students": data["user_id"].n_unique(),
        "concepts": data["concept_id"].n_unique(),
        "correct_rate": float(data["correct"].mean()),
        "single_skill_only": True,
        "split_rows": data.group_by("split").len().sort("split").to_dicts(),
        "outlier_bounds_fitted_on_train": {
            "elapsed_sec": list(elapsed_bounds),
            "gap_sec": list(gap_bounds),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--max-rows", type=int, default=None)
    args = parser.parse_args()
    raw, config = load_config(args.config)
    root = args.config.resolve().parents[1]
    dataset = raw["dataset"]
    split = raw["split"]
    features = raw["features"]
    configured_max_rows = dataset.get("max_rows")
    max_rows = args.max_rows if args.max_rows is not None else configured_max_rows
    stats = prepare_ednet(
        root / dataset["raw_dir"],
        config.processed_path,
        max_rows=max_rows,
        train_fraction=float(split["train"]),
        validation_fraction=float(split["validation"]),
        elapsed_quantiles=tuple(features["elapsed_quantiles"]),
        gap_quantiles=tuple(features["gap_quantiles"]),
    )
    digest = hashlib.sha256(config.processed_path.read_bytes()).hexdigest()
    manifest = {
        "dataset": dataset["name"],
        "kaggle_slug": dataset["kaggle_slug"],
        "kaggle_file": dataset["kaggle_file"],
        "kaggle_version": dataset["kaggle_version"],
        "license_on_kaggle": dataset["license_on_kaggle"],
        "provenance_note": dataset["provenance_note"],
        "processed_sha256": digest,
        "split_seed": raw["seed"],
        "split": split,
        **stats,
    }
    manifest_path = root / dataset["manifest_path"]
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
