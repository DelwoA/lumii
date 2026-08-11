from __future__ import annotations

import math

import numpy as np

FEATURE_NAMES = (
    "previous_correct",
    "elapsed_log_scaled",
    "gap_log_scaled",
    "attempt_log_scaled",
    "running_accuracy",
)

ELAPSED_SCALE_SECONDS = 3600.0
GAP_SCALE_SECONDS = 30.0 * 24.0 * 3600.0
ATTEMPT_SCALE = 100.0


def interaction_features(
    correct: np.ndarray,
    elapsed_sec: np.ndarray,
    gap_sec: np.ndarray,
    attempt_index: np.ndarray,
) -> np.ndarray:
    """Build transferable, concept-agnostic temporal features for one sequence."""
    correct_f = correct.astype(np.float32)
    running_accuracy = np.cumsum(correct_f) / (np.arange(correct_f.size) + 1)
    return np.column_stack(
        (
            correct_f,
            np.clip(np.log1p(elapsed_sec) / math.log1p(ELAPSED_SCALE_SECONDS), 0, 1),
            np.clip(np.log1p(gap_sec) / math.log1p(GAP_SCALE_SECONDS), 0, 1),
            np.clip(np.log1p(attempt_index) / math.log1p(ATTEMPT_SCALE), 0, 1),
            running_accuracy,
        )
    ).astype(np.float32)
