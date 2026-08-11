from __future__ import annotations

from dataclasses import asdict, dataclass

import numpy as np
from scipy.optimize import minimize

from lumii_mastery.data.sequences import KnowledgeSequenceDataset


@dataclass(frozen=True)
class BktParameters:
    prior: float = 0.2
    learn: float = 0.15
    forget: float = 0.02
    guess: float = 0.2
    slip: float = 0.1

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


def probability_correct(mastery: float, parameters: BktParameters) -> float:
    return mastery * (1 - parameters.slip) + (1 - mastery) * parameters.guess


def update(mastery: float, correct: int, parameters: BktParameters) -> float:
    p_correct = probability_correct(mastery, parameters)
    denominator = p_correct if correct else 1 - p_correct
    numerator = mastery * ((1 - parameters.slip) if correct else parameters.slip)
    posterior = numerator / max(denominator, 1e-9)
    return posterior * (1 - parameters.forget) + (1 - posterior) * parameters.learn


def predict_dataset(dataset: KnowledgeSequenceDataset, parameters: BktParameters) -> np.ndarray:
    group_predictions: list[np.ndarray] = []
    for group in dataset.groups:
        predictions = np.zeros(group.correct.size, dtype=np.float64)
        mastery = parameters.prior
        for index, response in enumerate(group.correct):
            predictions[index] = probability_correct(mastery, parameters)
            mastery = update(mastery, int(response), parameters)
        group_predictions.append(predictions)
    return np.asarray(
        [group_predictions[group][target] for group, target in dataset.examples],
        dtype=np.float64,
    )


def fit_bkt(
    dataset: KnowledgeSequenceDataset,
    max_examples: int = 50_000,
    max_history: int = 50,
) -> BktParameters:
    examples = dataset.examples[:max_examples]
    histories = np.zeros((len(examples), max_history), dtype=np.float64)
    lengths = np.zeros(len(examples), dtype=np.int32)
    labels = np.zeros(len(examples), dtype=np.float64)
    for row, (group_index, target) in enumerate(examples):
        group = dataset.groups[group_index]
        history = group.correct[max(0, target - max_history) : target]
        histories[row, : history.size] = history
        lengths[row] = history.size
        labels[row] = group.correct[target]

    def objective(values: np.ndarray) -> float:
        parameters = BktParameters(*values.tolist())
        mastery = np.full(len(examples), parameters.prior, dtype=np.float64)
        for index in range(max_history):
            response = histories[:, index]
            valid = index < lengths
            predicted = mastery * (1 - parameters.slip) + (1 - mastery) * parameters.guess
            denominator = np.where(response == 1, predicted, 1 - predicted)
            numerator = mastery * np.where(response == 1, 1 - parameters.slip, parameters.slip)
            posterior = numerator / np.clip(denominator, 1e-9, None)
            updated = posterior * (1 - parameters.forget) + (1 - posterior) * parameters.learn
            mastery = np.where(valid, updated, mastery)
        probability = np.clip(
            mastery * (1 - parameters.slip) + (1 - mastery) * parameters.guess,
            1e-7,
            1 - 1e-7,
        )
        return float(
            -np.mean(labels * np.log(probability) + (1 - labels) * np.log(1 - probability))
        )

    result = minimize(
        objective,
        x0=np.asarray([0.2, 0.15, 0.02, 0.2, 0.1]),
        method="L-BFGS-B",
        # The application generates four-option questions. Effective guessing
        # may exceed random chance after answer elimination, but values near
        # 0.5 make mastery non-identifiable and are not defensible here.
        bounds=[(0.01, 0.8), (0.001, 0.6), (0.0, 0.2), (0.10, 0.35), (0.01, 0.35)],
        options={"maxiter": 40},
    )
    return BktParameters(*result.x.tolist())
