from __future__ import annotations

import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import polars as pl
import torch
from torch.utils.data import Dataset

from lumii_mastery.bkt import BktParameters, probability_correct, update

TRANSFER_FEATURE_NAMES = (
    "previous_correct",
    "elapsed_log_scaled",
    "global_gap_log_scaled",
    "global_attempt_log_scaled",
    "global_running_accuracy",
    "concept_attempt_log_scaled",
    "concept_running_accuracy",
    "previous_item_difficulty",
    "same_as_target_concept",
    "target_item_difficulty",
    "target_concept_mastery",
    "target_concept_evidence_log_scaled",
    "portable_baseline_probability",
)

TRANSFER_FEATURE_COUNT = len(TRANSFER_FEATURE_NAMES)
ELAPSED_SCALE_SECONDS = 3_600.0
GAP_SCALE_SECONDS = 30.0 * 24.0 * 3_600.0
ATTEMPT_SCALE = 100.0
DIFFICULTY_SMOOTHING = 20.0
EASY_CORRECT_RATE = 0.72
HARD_CORRECT_RATE = 0.52


def _log_scale(values: np.ndarray, scale: float) -> np.ndarray:
    return np.clip(np.log1p(np.maximum(values, 0)) / math.log1p(scale), 0, 1)


def _difficulty_value(probability_correct_value: np.ndarray) -> np.ndarray:
    """Map train-only empirical correctness to LUMII's portable three-level scale."""
    return np.where(
        probability_correct_value >= EASY_CORRECT_RATE,
        0.25,
        np.where(probability_correct_value <= HARD_CORRECT_RATE, 0.75, 0.5),
    ).astype(np.float32)


@dataclass(frozen=True)
class TransferInteractionGroup:
    user_id: str
    concept_ids: np.ndarray
    correct: np.ndarray
    elapsed_sec: np.ndarray
    timestamp: np.ndarray
    item_difficulty: np.ndarray
    global_gap_sec: np.ndarray
    global_running_accuracy: np.ndarray
    concept_attempt_before: np.ndarray
    concept_running_accuracy: np.ndarray
    concept_bkt_probability_before: np.ndarray
    concept_evidence_before: np.ndarray


def _precompute_group_features(
    concept_ids: np.ndarray,
    correct: np.ndarray,
    timestamp: np.ndarray,
    parameters: BktParameters,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    global_gap_sec = np.maximum(
        np.diff(timestamp, prepend=timestamp[0]).astype(np.float64) / 1_000.0,
        0,
    )
    global_running_accuracy = np.cumsum(correct, dtype=np.float32) / np.arange(1, correct.size + 1)
    concept_attempt_before = np.zeros(correct.size, dtype=np.float32)
    concept_running_accuracy = np.zeros(correct.size, dtype=np.float32)
    concept_bkt_probability_before = np.zeros(correct.size, dtype=np.float32)
    concept_evidence_before = np.zeros(correct.size, dtype=np.float32)
    counts: dict[str, int] = {}
    successes: dict[str, int] = {}
    mastery: dict[str, float] = {}
    for position, raw_concept in enumerate(concept_ids):
        concept = str(raw_concept)
        previous_count = counts.get(concept, 0)
        previous_successes = successes.get(concept, 0)
        current_mastery = mastery.get(concept, parameters.prior)
        concept_attempt_before[position] = previous_count
        concept_evidence_before[position] = previous_count
        concept_bkt_probability_before[position] = probability_correct(current_mastery, parameters)
        next_count = previous_count + 1
        next_successes = previous_successes + int(correct[position])
        concept_running_accuracy[position] = next_successes / next_count
        counts[concept] = next_count
        successes[concept] = next_successes
        mastery[concept] = update(current_mastery, int(correct[position]), parameters)
    return (
        global_gap_sec,
        global_running_accuracy.astype(np.float32),
        concept_attempt_before,
        concept_running_accuracy,
        concept_bkt_probability_before,
        concept_evidence_before,
    )


class TransferSequenceDataset(Dataset[tuple[torch.Tensor, torch.Tensor, torch.Tensor]]):
    def __init__(
        self,
        groups: list[TransferInteractionGroup],
        examples: list[tuple[int, int]],
        sequence_length: int,
        global_probability: float,
        bkt_parameters: BktParameters | None = None,
    ) -> None:
        self.groups = groups
        self.examples = examples
        self.sequence_length = sequence_length
        self.global_probability = global_probability
        self.bkt_parameters = bkt_parameters or BktParameters(
            prior=0.7571719352777952,
            learn=0.07395798983169082,
            forget=0.012125785317259273,
            guess=0.35,
            slip=0.28956306650520824,
        )

    def __len__(self) -> int:
        return len(self.examples)

    def labels(self) -> np.ndarray:
        return np.asarray(
            [self.groups[group].correct[target] for group, target in self.examples],
            dtype=np.float64,
        )

    def student_ids(self) -> np.ndarray:
        return np.asarray(
            [self.groups[group].user_id for group, _ in self.examples],
            dtype=object,
        )

    def __getitem__(self, index: int) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        group_index, target_index = self.examples[index]
        group = self.groups[group_index]
        start = max(0, target_index - self.sequence_length)
        history_indices = np.arange(start, target_index)
        length = history_indices.size
        target_concept = group.concept_ids[target_index]

        selected = history_indices
        student_probability = float(
            np.clip(group.global_running_accuracy[target_index - 1], 0.05, 0.95)
        )
        item_probability = float(np.clip(1 - group.item_difficulty[target_index], 0.05, 0.95))
        global_probability = float(np.clip(self.global_probability, 0.05, 0.95))
        portable_baseline_logit = (
            math.log(student_probability / (1 - student_probability))
            + math.log(item_probability / (1 - item_probability))
            - math.log(global_probability / (1 - global_probability))
        )
        portable_baseline_probability = 1 / (1 + math.exp(-portable_baseline_logit))
        features = np.column_stack(
            (
                group.correct[selected].astype(np.float32),
                _log_scale(group.elapsed_sec[selected], ELAPSED_SCALE_SECONDS),
                _log_scale(group.global_gap_sec[selected], GAP_SCALE_SECONDS),
                _log_scale(selected.astype(np.float32), ATTEMPT_SCALE),
                group.global_running_accuracy[selected],
                _log_scale(group.concept_attempt_before[selected], ATTEMPT_SCALE),
                group.concept_running_accuracy[selected],
                group.item_difficulty[selected],
                (group.concept_ids[selected] == target_concept).astype(np.float32),
                np.full(length, group.item_difficulty[target_index], dtype=np.float32),
                np.full(
                    length,
                    group.concept_bkt_probability_before[target_index],
                    dtype=np.float32,
                ),
                np.full(
                    length,
                    _log_scale(
                        np.asarray([group.concept_evidence_before[target_index]]),
                        ATTEMPT_SCALE,
                    )[0],
                    dtype=np.float32,
                ),
                np.full(
                    length,
                    portable_baseline_probability,
                    dtype=np.float32,
                ),
            )
        ).astype(np.float32)
        padded = np.zeros((self.sequence_length, TRANSFER_FEATURE_COUNT), dtype=np.float32)
        padded[:length] = features
        return (
            torch.from_numpy(padded),
            torch.tensor(length, dtype=torch.int64),
            torch.tensor(float(group.correct[target_index]), dtype=torch.float32),
        )


def _question_difficulty(frame: pl.LazyFrame) -> tuple[pl.DataFrame, float]:
    train = frame.filter(pl.col("split") == "train")
    global_probability = float(train.select(pl.col("correct").mean()).collect().item())
    question_stats = (
        train.group_by("question_id")
        .agg(
            pl.len().alias("difficulty_count"),
            pl.col("correct").sum().alias("difficulty_successes"),
        )
        .collect()
    )
    return question_stats, global_probability


def load_transfer_sequence_dataset(
    path: Path,
    split: str,
    sequence_length: int,
    max_examples: int,
    seed: int,
    *,
    minimum_history: int = 3,
) -> TransferSequenceDataset:
    scan = pl.scan_parquet(path)
    question_stats, global_probability = _question_difficulty(scan)
    frame = (
        scan.filter(pl.col("split") == split)
        .join(question_stats.lazy(), on="question_id", how="left")
        .with_columns(
            pl.col("difficulty_count").fill_null(0),
            pl.col("difficulty_successes").fill_null(0),
        )
        .with_columns(
            (
                (
                    pl.col("difficulty_successes")
                    - pl.when(pl.lit(split == "train")).then(pl.col("correct")).otherwise(0)
                    + DIFFICULTY_SMOOTHING * global_probability
                )
                / (
                    pl.col("difficulty_count")
                    - (1 if split == "train" else 0)
                    + DIFFICULTY_SMOOTHING
                )
            ).alias("item_probability_correct")
        )
        .sort(["user_id", "timestamp", "question_id"])
        .group_by("user_id", maintain_order=True)
        .agg(
            "concept_id",
            "correct",
            "elapsed_sec",
            "timestamp",
            "item_probability_correct",
        )
        .collect()
    )

    groups: list[TransferInteractionGroup] = []
    examples: list[tuple[int, int]] = []
    parameters = BktParameters(
        prior=0.7571719352777952,
        learn=0.07395798983169082,
        forget=0.012125785317259273,
        guess=0.35,
        slip=0.28956306650520824,
    )
    for row in frame.iter_rows(named=True):
        correct = np.asarray(row["correct"], dtype=np.int8)
        if correct.size <= minimum_history:
            continue
        item_probability = np.asarray(row["item_probability_correct"], dtype=np.float32)
        concept_ids = np.asarray(row["concept_id"], dtype=str)
        timestamp = np.asarray(row["timestamp"], dtype=np.int64)
        (
            global_gap_sec,
            global_running_accuracy,
            concept_attempt_before,
            concept_running_accuracy,
            concept_bkt_probability_before,
            concept_evidence_before,
        ) = _precompute_group_features(concept_ids, correct, timestamp, parameters)
        group_index = len(groups)
        groups.append(
            TransferInteractionGroup(
                user_id=str(row["user_id"]),
                concept_ids=concept_ids,
                correct=correct,
                elapsed_sec=np.asarray(row["elapsed_sec"], dtype=np.float32),
                timestamp=timestamp,
                item_difficulty=_difficulty_value(item_probability),
                global_gap_sec=global_gap_sec,
                global_running_accuracy=global_running_accuracy,
                concept_attempt_before=concept_attempt_before,
                concept_running_accuracy=concept_running_accuracy,
                concept_bkt_probability_before=concept_bkt_probability_before,
                concept_evidence_before=concept_evidence_before,
            )
        )
        examples.extend((group_index, target) for target in range(minimum_history, correct.size))

    rng = np.random.default_rng(seed)
    rng.shuffle(examples)
    if len(examples) > max_examples:
        examples = examples[:max_examples]
    if not examples:
        raise ValueError(f"No transfer examples were available in the {split} split")
    return TransferSequenceDataset(
        groups,
        examples,
        sequence_length,
        global_probability,
        parameters,
    )
