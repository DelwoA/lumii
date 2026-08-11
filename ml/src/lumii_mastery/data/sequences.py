from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import polars as pl
import torch
from torch.utils.data import Dataset

from lumii_mastery.features import FEATURE_NAMES, interaction_features


@dataclass(frozen=True)
class InteractionGroup:
    correct: np.ndarray
    features: np.ndarray


class KnowledgeSequenceDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    def __init__(
        self,
        groups: list[InteractionGroup],
        examples: list[tuple[int, int]],
        sequence_length: int,
    ) -> None:
        self.groups = groups
        self.examples = examples
        self.sequence_length = sequence_length

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        group_index, target_index = self.examples[index]
        group = self.groups[group_index]
        history = group.features[max(0, target_index - self.sequence_length) : target_index]
        length = history.shape[0]
        padded = np.zeros((self.sequence_length, len(FEATURE_NAMES)), dtype=np.float32)
        padded[:length] = history
        return (
            torch.from_numpy(padded),
            torch.tensor(length, dtype=torch.int64),
            torch.tensor(float(group.correct[target_index]), dtype=torch.float32),
        )

    def bkt_targets(self) -> np.ndarray:
        return np.asarray(
            [self.groups[group].correct[target] for group, target in self.examples],
            dtype=np.float64,
        )


def load_sequence_dataset(
    path: Path,
    split: str,
    sequence_length: int,
    max_examples: int,
    seed: int,
) -> KnowledgeSequenceDataset:
    frame = (
        pl.scan_parquet(path)
        .filter(pl.col("split") == split)
        .sort(["user_id", "concept_id", "timestamp", "question_id"])
        .group_by(["user_id", "concept_id"], maintain_order=True)
        .agg("correct", "elapsed_sec", "gap_sec", "attempt_index")
        .collect()
    )
    groups: list[InteractionGroup] = []
    examples: list[tuple[int, int]] = []
    for row in frame.iter_rows(named=True):
        correct = np.asarray(row["correct"], dtype=np.int8)
        if correct.size < 2:
            continue
        features = interaction_features(
            correct,
            np.asarray(row["elapsed_sec"], dtype=np.float32),
            np.asarray(row["gap_sec"], dtype=np.float32),
            np.asarray(row["attempt_index"], dtype=np.float32),
        )
        group_index = len(groups)
        groups.append(InteractionGroup(correct=correct, features=features))
        examples.extend((group_index, target) for target in range(1, correct.size))

    rng = np.random.default_rng(seed)
    rng.shuffle(examples)
    if len(examples) > max_examples:
        examples = examples[:max_examples]
    if not examples:
        raise ValueError(f"No next-response examples were available in the {split} split")
    return KnowledgeSequenceDataset(groups, examples, sequence_length)
