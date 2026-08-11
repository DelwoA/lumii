import numpy as np

from lumii_mastery.metrics import (
    classification_metrics,
    cluster_bootstrap_confidence_intervals,
)


def test_classification_metrics_accepts_validation_selected_threshold() -> None:
    labels = np.asarray([0, 0, 1, 1])
    probabilities = np.asarray([0.2, 0.4, 0.45, 0.8])
    assert classification_metrics(labels, probabilities)["accuracy"] == 0.75
    assert classification_metrics(labels, probabilities, threshold=0.425)["accuracy"] == 1.0


def test_cluster_bootstrap_returns_ordered_intervals() -> None:
    labels = np.asarray([0, 1, 0, 1, 0, 1, 1, 0], dtype=np.float64)
    probabilities = np.asarray([0.1, 0.8, 0.3, 0.9, 0.4, 0.7, 0.6, 0.2])
    students = np.asarray(["a", "a", "b", "b", "c", "c", "d", "d"])
    intervals = cluster_bootstrap_confidence_intervals(
        labels,
        probabilities,
        students,
        seed=42,
        repetitions=20,
    )
    assert intervals["accuracy"]["lower_95"] <= intervals["accuracy"]["upper_95"]
    assert 0 <= intervals["roc_auc"]["lower_95"] <= 1
