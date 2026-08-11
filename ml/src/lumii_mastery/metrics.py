from __future__ import annotations

from itertools import pairwise

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    balanced_accuracy_score,
    brier_score_loss,
    f1_score,
    log_loss,
    precision_score,
    recall_score,
    roc_auc_score,
)


def expected_calibration_error(
    labels: np.ndarray, probabilities: np.ndarray, bins: int = 15
) -> float:
    edges = np.linspace(0, 1, bins + 1)
    error = 0.0
    for lower, upper in pairwise(edges):
        mask = (probabilities >= lower) & (
            probabilities <= upper if upper == 1 else probabilities < upper
        )
        if mask.any():
            error += mask.mean() * abs(labels[mask].mean() - probabilities[mask].mean())
    return float(error)


def classification_metrics(
    labels: np.ndarray,
    probabilities: np.ndarray,
    *,
    threshold: float = 0.5,
) -> dict[str, float | int]:
    probabilities = np.clip(probabilities.astype(np.float64), 1e-7, 1 - 1e-7)
    predicted = (probabilities >= threshold).astype(np.int8)
    auc = (
        float(roc_auc_score(labels, probabilities)) if np.unique(labels).size > 1 else float("nan")
    )
    return {
        "examples": int(labels.size),
        "accuracy": float(accuracy_score(labels, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(labels, predicted)),
        "precision": float(precision_score(labels, predicted, zero_division=0)),
        "recall": float(recall_score(labels, predicted, zero_division=0)),
        "f1": float(f1_score(labels, predicted, zero_division=0)),
        "roc_auc": auc,
        "pr_auc": float(average_precision_score(labels, probabilities)),
        "log_loss": float(log_loss(labels, probabilities, labels=[0, 1])),
        "brier": float(brier_score_loss(labels, probabilities)),
        "ece_15": expected_calibration_error(labels, probabilities),
    }


def cluster_bootstrap_confidence_intervals(
    labels: np.ndarray,
    probabilities: np.ndarray,
    cluster_ids: np.ndarray,
    *,
    seed: int,
    repetitions: int = 200,
    maximum_examples: int = 100_000,
    threshold: float = 0.5,
) -> dict[str, dict[str, float]]:
    """Estimate 95% intervals while resampling whole students, not individual rows."""
    if not (labels.size == probabilities.size == cluster_ids.size):
        raise ValueError("Labels, probabilities, and cluster IDs must have equal lengths")
    rng = np.random.default_rng(seed)
    _, inverse = np.unique(cluster_ids, return_inverse=True)
    order = np.argsort(inverse, kind="stable")
    boundaries = np.flatnonzero(np.diff(inverse[order])) + 1
    groups = [group for group in np.split(order, boundaries) if group.size]
    rng.shuffle(groups)
    selected: list[np.ndarray] = []
    selected_examples = 0
    for group in groups:
        if selected and selected_examples + group.size > maximum_examples:
            break
        selected.append(group)
        selected_examples += group.size
    if len(selected) < 2:
        raise ValueError("At least two student clusters are required for confidence intervals")

    samples: dict[str, list[float]] = {
        "accuracy": [],
        "roc_auc": [],
        "log_loss": [],
        "brier": [],
        "ece_15": [],
    }
    for _ in range(repetitions):
        chosen = rng.integers(0, len(selected), size=len(selected))
        indexes = np.concatenate([selected[index] for index in chosen])
        metrics = classification_metrics(
            labels[indexes], probabilities[indexes], threshold=threshold
        )
        for name in tuple(samples):
            samples[name].append(float(metrics[name]))
    return {
        name: {
            "lower_95": float(np.nanquantile(values, 0.025)),
            "upper_95": float(np.nanquantile(values, 0.975)),
        }
        for name, values in samples.items()
    }
