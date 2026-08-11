from __future__ import annotations

import argparse
import copy
import csv
import json
import random
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import polars as pl
import pykt.datasets.data_loader as pykt_data_loader
import torch
from pykt.datasets.data_loader import KTDataset
from pykt.models import init_model
from pykt.models.train_model import model_forward
from sklearn.metrics import roc_auc_score
from torch.nn.functional import one_hot
from torch.utils.data import DataLoader

from lumii_mastery.metrics import classification_metrics

MODEL_CONFIGS: dict[str, dict[str, Any]] = {
    "dkt": {"emb_size": 128, "dropout": 0.2},
    "sakt": {
        "seq_len": 100,
        "emb_size": 128,
        "num_attn_heads": 8,
        "dropout": 0.2,
        "num_en": 2,
    },
    "akt": {
        "d_model": 128,
        "n_blocks": 2,
        "dropout": 0.2,
        "d_ff": 256,
        "kq_same": 1,
        "final_fc_dim": 256,
        "num_attn_heads": 8,
        "separate_qa": False,
        "l2": 1e-5,
    },
    "saint": {
        "seq_len": 100,
        "emb_size": 128,
        "num_attn_heads": 8,
        "dropout": 0.2,
        "n_blocks": 2,
    },
}


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)


def _device() -> torch.device:
    return torch.device("cuda" if torch.cuda.is_available() else "cpu")


def _portable_pykt_tensors() -> None:
    """Fix pyKT's CUDA tensor aliases so its loader also works on CPU runners."""
    if not torch.cuda.is_available():
        pykt_data_loader.LongTensor = torch.LongTensor
        pykt_data_loader.FloatTensor = torch.FloatTensor


def _padded(values: list[int], sequence_length: int) -> list[int]:
    return values + [-1] * (sequence_length - len(values))


def prepare_pykt_csv(
    source: Path,
    destination: Path,
    *,
    sequence_length: int,
    max_interactions_per_split: int,
    seed: int,
) -> dict[str, int]:
    scan = pl.scan_parquet(source)
    identifiers = scan.select("question_id", "concept_id").collect()
    question_map = {
        value: index for index, value in enumerate(identifiers["question_id"].unique().sort())
    }
    concept_map = {
        value: index for index, value in enumerate(identifiers["concept_id"].unique().sort())
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    split_folds = {"train": 0, "validation": 1, "test": -1}
    sequence_counts: dict[str, int] = {}
    interaction_counts: dict[str, int] = {}
    with destination.open("w", encoding="utf-8", newline="") as output:
        writer = csv.DictWriter(
            output,
            fieldnames=[
                "fold",
                "uid",
                "questions",
                "concepts",
                "responses",
                "timestamps",
                "usetimes",
                "selectmasks",
            ],
        )
        writer.writeheader()
        for split, fold in split_folds.items():
            frame = (
                scan.filter(pl.col("split") == split)
                .with_columns(pl.col("user_id").hash(seed).alias("_student_order"))
                .sort(["_student_order", "user_id", "timestamp", "question_id"])
                .head(max_interactions_per_split)
                .group_by("user_id", maintain_order=True)
                .agg(
                    "question_id",
                    "concept_id",
                    "correct",
                    "timestamp",
                    "elapsed_sec",
                )
                .collect()
            )
            sequences = 0
            interactions = 0
            for row in frame.iter_rows(named=True):
                size = len(row["correct"])
                if size < 2:
                    continue
                start = 0
                while start < size - 1:
                    stop = min(start + sequence_length, size)
                    questions = [question_map[value] for value in row["question_id"][start:stop]]
                    concepts = [concept_map[value] for value in row["concept_id"][start:stop]]
                    responses = [int(value) for value in row["correct"][start:stop]]
                    timestamps = [int(value) for value in row["timestamp"][start:stop]]
                    use_times = [
                        int(max(float(value), 0) * 1_000)
                        for value in row["elapsed_sec"][start:stop]
                    ]
                    length = len(responses)
                    if length < 2:
                        break
                    writer.writerow(
                        {
                            "fold": fold,
                            "uid": row["user_id"],
                            "questions": ",".join(map(str, _padded(questions, sequence_length))),
                            "concepts": ",".join(map(str, _padded(concepts, sequence_length))),
                            "responses": ",".join(map(str, _padded(responses, sequence_length))),
                            "timestamps": ",".join(map(str, _padded(timestamps, sequence_length))),
                            "usetimes": ",".join(map(str, _padded(use_times, sequence_length))),
                            "selectmasks": ",".join(
                                map(str, [1] * length + [-1] * (sequence_length - length))
                            ),
                        }
                    )
                    sequences += 1
                    interactions += length - 1
                    if stop == size:
                        break
                    start = stop - 1
            sequence_counts[split] = sequences
            interaction_counts[split] = interactions
    return {
        "num_questions": len(question_map),
        "num_concepts": len(concept_map),
        **{f"{split}_sequences": value for split, value in sequence_counts.items()},
        **{f"{split}_evaluated_interactions": value for split, value in interaction_counts.items()},
    }


def _move(data: dict[str, torch.Tensor], device: torch.device) -> dict[str, torch.Tensor]:
    return {key: value.to(device) for key, value in data.items()}


def _predict(
    model: torch.nn.Module,
    loader: DataLoader,
    model_name: str,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray]:
    labels: list[np.ndarray] = []
    probabilities: list[np.ndarray] = []
    model.eval()
    with torch.inference_mode():
        for batch in loader:
            data = _move(batch, device)
            q = data["qseqs"]
            c = data["cseqs"]
            r = data["rseqs"]
            q_shift = data["shft_qseqs"]
            c_shift = data["shft_cseqs"]
            r_shift = data["shft_rseqs"]
            mask = data["smasks"]
            complete_q = torch.cat((q[:, :1], q_shift), dim=1)
            complete_c = torch.cat((c[:, :1], c_shift), dim=1)
            complete_r = torch.cat((r[:, :1], r_shift), dim=1)
            if model_name == "dkt":
                prediction = model(c.long(), r.long())
                prediction = (prediction * one_hot(c_shift.long(), model.num_c)).sum(-1)
            elif model_name == "sakt":
                prediction = model(c.long(), r.long(), c_shift.long())
            elif model_name == "akt":
                prediction, _ = model(complete_c.long(), complete_r.long(), complete_q.long())
                prediction = prediction[:, 1:]
            elif model_name == "saint":
                prediction = model(complete_q.long(), complete_c.long(), r.long())[:, 1:]
            else:
                raise ValueError(f"Unsupported benchmark model: {model_name}")
            probabilities.append(torch.masked_select(prediction, mask).cpu().numpy())
            labels.append(torch.masked_select(r_shift, mask).cpu().numpy())
    return np.concatenate(labels).astype(np.float64), np.concatenate(probabilities)


def _fit_model(
    model_name: str,
    model: torch.nn.Module,
    train_loader: DataLoader,
    validation_loader: DataLoader,
    device: torch.device,
    *,
    epochs: int,
    learning_rate: float,
    patience: int,
) -> tuple[torch.nn.Module, list[dict[str, float]]]:
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-5)
    best_auc = -1.0
    best_state = copy.deepcopy(model.state_dict())
    stale = 0
    history: list[dict[str, float]] = []
    for epoch in range(1, epochs + 1):
        started = time.perf_counter()
        model.train()
        losses: list[float] = []
        for batch in train_loader:
            optimizer.zero_grad(set_to_none=True)
            loss = model_forward(model, _move(batch, device))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            losses.append(float(loss.detach().cpu()))
        labels, probabilities = _predict(model, validation_loader, model_name, device)
        validation_auc = float(roc_auc_score(labels, probabilities))
        entry = {
            "epoch": float(epoch),
            "train_loss": float(np.mean(losses)),
            "validation_roc_auc": validation_auc,
            "seconds": time.perf_counter() - started,
        }
        history.append(entry)
        print(
            f"model={model_name} epoch={epoch} train_loss={entry['train_loss']:.5f} "
            f"validation_auc={validation_auc:.5f} seconds={entry['seconds']:.1f}",
            flush=True,
        )
        if validation_auc > best_auc + 1e-4:
            best_auc = validation_auc
            best_state = copy.deepcopy(model.state_dict())
            stale = 0
        else:
            stale += 1
            if stale >= patience:
                break
    model.load_state_dict(best_state)
    return model, history


def benchmark(
    source: Path,
    work_directory: Path,
    *,
    models: list[str],
    sequence_length: int,
    max_interactions_per_split: int,
    epochs: int,
    batch_size: int,
    seed: int,
) -> dict[str, Any]:
    _seed_everything(seed)
    _portable_pykt_tensors()
    device = _device()
    csv_path = work_directory / "ednet_student_isolated.csv"
    dataset_metadata = prepare_pykt_csv(
        source,
        csv_path,
        sequence_length=sequence_length,
        max_interactions_per_split=max_interactions_per_split,
        seed=seed,
    )
    datasets = {
        "train": KTDataset(str(csv_path), ["questions", "concepts"], {0}),
        "validation": KTDataset(str(csv_path), ["questions", "concepts"], {1}),
        "test": KTDataset(str(csv_path), ["questions", "concepts"], {-1}),
    }
    loaders = {
        name: DataLoader(
            dataset,
            batch_size=batch_size,
            shuffle=name == "train",
            generator=torch.Generator().manual_seed(seed),
        )
        for name, dataset in datasets.items()
    }
    data_config = {
        "num_q": dataset_metadata["num_questions"],
        "num_c": dataset_metadata["num_concepts"],
        "emb_path": "",
    }
    results: dict[str, Any] = {}
    for model_name in models:
        if model_name not in MODEL_CONFIGS:
            raise ValueError(f"Unsupported model {model_name}; choose from {sorted(MODEL_CONFIGS)}")
        config = copy.deepcopy(MODEL_CONFIGS[model_name])
        if "seq_len" in config:
            config["seq_len"] = sequence_length
        model = init_model(model_name, config, data_config, "qid")
        if model is None:
            raise RuntimeError(f"pyKT could not initialize {model_name}")
        model, history = _fit_model(
            model_name,
            model,
            loaders["train"],
            loaders["validation"],
            device,
            epochs=epochs,
            learning_rate=1e-3,
            patience=3,
        )
        labels, probabilities = _predict(model, loaders["test"], model_name, device)
        results[model_name] = {
            "metrics": classification_metrics(labels, probabilities),
            "history": history,
            "parameters": sum(parameter.numel() for parameter in model.parameters()),
        }
    report = {
        "created_at": datetime.now(UTC).isoformat(),
        "evaluation_track": "item_aware_benchmark_only",
        "production_portable": False,
        "student_isolated_splits": True,
        "device": device.type,
        "dataset": dataset_metadata,
        "results": results,
        "seed": seed,
    }
    work_directory.mkdir(parents=True, exist_ok=True)
    (work_directory / "benchmark.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--work-directory", type=Path, required=True)
    parser.add_argument(
        "--models",
        nargs="+",
        choices=sorted(MODEL_CONFIGS),
        default=["dkt", "sakt", "akt", "saint"],
    )
    parser.add_argument("--sequence-length", type=int, default=100)
    parser.add_argument("--max-interactions-per-split", type=int, default=1_500_000)
    parser.add_argument("--epochs", type=int, default=12)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--seed", type=int, default=20260811)
    args = parser.parse_args()
    print(
        json.dumps(
            benchmark(
                args.source,
                args.work_directory,
                models=args.models,
                sequence_length=args.sequence_length,
                max_interactions_per_split=args.max_interactions_per_split,
                epochs=args.epochs,
                batch_size=args.batch_size,
                seed=args.seed,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
