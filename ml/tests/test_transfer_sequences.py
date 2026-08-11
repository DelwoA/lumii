from pathlib import Path

import polars as pl

from lumii_mastery.data.transfer_sequences import (
    TRANSFER_FEATURE_COUNT,
    load_transfer_sequence_dataset,
)


def test_transfer_dataset_uses_full_history_and_portable_difficulty(tmp_path: Path) -> None:
    rows = []
    for split, user in (("train", "train-user"), ("test", "test-user")):
        for index in range(6):
            rows.append(
                {
                    "user_id": user,
                    "concept_id": f"concept-{index % 2}",
                    "question_id": f"question-{index % 3}",
                    "timestamp": 1_000 + index * 1_000,
                    "elapsed_sec": 10.0 + index,
                    "correct": index % 3 != 0,
                    "split": split,
                }
            )
    path = tmp_path / "sample.parquet"
    pl.DataFrame(rows).write_parquet(path)

    dataset = load_transfer_sequence_dataset(
        path,
        "test",
        sequence_length=8,
        max_examples=20,
        seed=42,
    )
    features, length, label = dataset[0]
    assert features.shape == (8, TRANSFER_FEATURE_COUNT)
    assert 3 <= int(length) <= 5
    assert float(label) in {0.0, 1.0}
    assert set(features[: int(length), 9].tolist()) <= {0.25, 0.5, 0.75}
    assert 0 < float(features[int(length) - 1, 12]) < 1
