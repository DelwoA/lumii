from __future__ import annotations

import argparse
import copy
import json
import math
import random
import sys
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from scipy.optimize import minimize_scalar
from torch import nn
from torch.utils.data import DataLoader

from lumii_mastery.bkt import fit_bkt, predict_dataset
from lumii_mastery.config import TrainingConfig, load_config
from lumii_mastery.data.sequences import KnowledgeSequenceDataset, load_sequence_dataset
from lumii_mastery.features import (
    ATTEMPT_SCALE,
    ELAPSED_SCALE_SECONDS,
    FEATURE_NAMES,
    GAP_SCALE_SECONDS,
)
from lumii_mastery.metrics import classification_metrics
from lumii_mastery.model import CalibratedInferenceModel, TemporalMasteryNet

MODEL_VERSION = "temporal-gru-v1"


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)


def _loader(dataset: KnowledgeSequenceDataset, batch_size: int, shuffle: bool) -> DataLoader:
    return DataLoader(dataset, batch_size=batch_size, shuffle=shuffle, num_workers=0)


def _collect_logits(
    model: TemporalMasteryNet, dataset: KnowledgeSequenceDataset, batch_size: int
) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    logits: list[np.ndarray] = []
    labels: list[np.ndarray] = []
    with torch.inference_mode():
        for features, lengths, target in _loader(dataset, batch_size, False):
            logits.append(model(features, lengths).cpu().numpy())
            labels.append(target.cpu().numpy())
    return np.concatenate(logits), np.concatenate(labels).astype(np.float64)


def _temperature(logits: np.ndarray, labels: np.ndarray) -> float:
    def objective(log_temperature: float) -> float:
        temperature = math.exp(log_temperature)
        probabilities = 1 / (1 + np.exp(-np.clip(logits / temperature, -30, 30)))
        probabilities = np.clip(probabilities, 1e-7, 1 - 1e-7)
        return float(
            -np.mean(labels * np.log(probabilities) + (1 - labels) * np.log(1 - probabilities))
        )

    result = minimize_scalar(objective, bounds=(-3, 3), method="bounded")
    return float(math.exp(result.x))


def _train_model(
    config: TrainingConfig,
    train: KnowledgeSequenceDataset,
    validation: KnowledgeSequenceDataset,
) -> tuple[TemporalMasteryNet, list[dict[str, float]]]:
    model = TemporalMasteryNet(
        input_size=len(FEATURE_NAMES),
        hidden_size=config.hidden_size,
        layers=config.layers,
        dropout=config.dropout,
    )
    optimizer = torch.optim.AdamW(
        model.parameters(), lr=config.learning_rate, weight_decay=config.weight_decay
    )
    criterion = nn.BCEWithLogitsLoss()
    best_state = copy.deepcopy(model.state_dict())
    best_loss = float("inf")
    stale_epochs = 0
    history: list[dict[str, float]] = []

    for epoch in range(1, config.epochs + 1):
        model.train()
        training_losses: list[float] = []
        for features, lengths, target in _loader(train, config.batch_size, True):
            optimizer.zero_grad(set_to_none=True)
            loss = criterion(model(features, lengths), target)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            training_losses.append(float(loss.detach()))

        validation_logits, validation_labels = _collect_logits(model, validation, config.batch_size)
        validation_probabilities = 1 / (1 + np.exp(-np.clip(validation_logits, -30, 30)))
        validation_loss = float(
            classification_metrics(validation_labels, validation_probabilities)["log_loss"]
        )
        history.append(
            {
                "epoch": float(epoch),
                "train_loss": float(np.mean(training_losses)),
                "validation_log_loss": validation_loss,
            }
        )
        print(
            f"epoch={epoch} train_loss={np.mean(training_losses):.5f} "
            f"validation_log_loss={validation_loss:.5f}",
            file=sys.stderr,
            flush=True,
        )
        if validation_loss < best_loss - 1e-4:
            best_loss = validation_loss
            best_state = copy.deepcopy(model.state_dict())
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= config.patience:
                break

    model.load_state_dict(best_state)
    return model, history


def _export_and_verify(
    model: TemporalMasteryNet,
    temperature: float,
    destination: Path,
    sequence_length: int,
) -> float:
    inference_model = CalibratedInferenceModel(model, temperature).eval()
    # Production inference is one student-concept sequence per request. A static
    # batch of one avoids the ONNX GRU variable-batch hidden-state ambiguity and
    # gives ONNX Runtime a smaller graph to optimize.
    example_features = torch.zeros((1, sequence_length, len(FEATURE_NAMES)), dtype=torch.float32)
    example_lengths = torch.tensor([sequence_length], dtype=torch.int64)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # PyTorch 2.13's dynamo exporter decomposes GRU to a higher-order while-loop
    # and can stall. The established exporter emits the standard ONNX GRU op,
    # which ONNX Runtime optimizes directly and which we verify numerically below.
    torch.onnx.export(
        inference_model,
        (example_features, example_lengths),
        destination,
        input_names=["features", "lengths"],
        output_names=["next_correct_probability"],
        dynamo=False,
        opset_version=18,
    )
    expected = inference_model(example_features, example_lengths).detach().numpy()
    session = ort.InferenceSession(str(destination), providers=["CPUExecutionProvider"])
    actual = session.run(
        None,
        {"features": example_features.numpy(), "lengths": example_lengths.numpy()},
    )[0]
    difference = float(np.max(np.abs(expected - actual)))
    if difference > 1e-5:
        raise ValueError(f"ONNX verification failed: maximum absolute error {difference}")
    return difference


def train(
    config_path: Path,
    *,
    max_sequences: int | None = None,
    epochs: int | None = None,
) -> dict[str, object]:
    raw, config = load_config(config_path)
    config = replace(
        config,
        max_sequences_per_split=max_sequences or config.max_sequences_per_split,
        epochs=epochs or config.epochs,
    )
    _seed_everything(config.seed)
    print("loading train sequences", file=sys.stderr, flush=True)
    train_data = load_sequence_dataset(
        config.processed_path,
        "train",
        config.sequence_length,
        config.max_sequences_per_split,
        config.seed,
    )
    print(f"train_examples={len(train_data)}", file=sys.stderr, flush=True)
    print("loading validation sequences", file=sys.stderr, flush=True)
    validation_data = load_sequence_dataset(
        config.processed_path,
        "validation",
        config.sequence_length,
        config.max_sequences_per_split,
        config.seed + 1,
    )
    print(f"validation_examples={len(validation_data)}", file=sys.stderr, flush=True)
    print("loading test sequences", file=sys.stderr, flush=True)
    test_data = load_sequence_dataset(
        config.processed_path,
        "test",
        config.sequence_length,
        config.max_sequences_per_split,
        config.seed + 2,
    )
    print(f"test_examples={len(test_data)}", file=sys.stderr, flush=True)

    print("fitting BKT baseline", file=sys.stderr, flush=True)
    bkt_parameters = fit_bkt(train_data)
    print("training temporal GRU", file=sys.stderr, flush=True)
    model, history = _train_model(config, train_data, validation_data)
    validation_logits, validation_labels = _collect_logits(
        model, validation_data, config.batch_size
    )
    temperature = _temperature(validation_logits, validation_labels)
    test_logits, test_labels = _collect_logits(model, test_data, config.batch_size)
    deep_probabilities = 1 / (1 + np.exp(-np.clip(test_logits / temperature, -30, 30)))
    bkt_probabilities = predict_dataset(test_data, bkt_parameters)
    global_probability = float(train_data.bkt_targets().mean())
    metrics = {
        "deep_calibrated": classification_metrics(test_labels, deep_probabilities),
        "bkt_fitted": classification_metrics(test_labels, bkt_probabilities),
        "global_mean": classification_metrics(
            test_labels, np.full(test_labels.shape, global_probability)
        ),
    }
    selection = raw["selection"]
    deep = metrics["deep_calibrated"]
    bkt = metrics["bkt_fitted"]
    checks = {
        "minimum_test_examples": deep["examples"] >= selection["minimum_test_examples"],
        "calibration": deep["ece_15"] <= selection["maximum_ece"],
        "auc_improvement": (not selection["require_auc_improvement"])
        or deep["roc_auc"] > bkt["roc_auc"],
        "log_loss_improvement": (not selection["require_log_loss_improvement"])
        or deep["log_loss"] < bkt["log_loss"],
    }
    promote_deep = all(checks.values())

    artifact_directory = config.artifact_directory
    artifact_directory.mkdir(parents=True, exist_ok=True)
    onnx_path = artifact_directory / "temporal_mastery.onnx"
    onnx_difference = _export_and_verify(model, temperature, onnx_path, config.sequence_length)
    metadata = {
        "model_version": MODEL_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "sequence_length": config.sequence_length,
        "feature_names": FEATURE_NAMES,
        "normalization": {
            "elapsed_scale_seconds": ELAPSED_SCALE_SECONDS,
            "gap_scale_seconds": GAP_SCALE_SECONDS,
            "attempt_scale": ATTEMPT_SCALE,
        },
        "temperature": temperature,
        "bkt_parameters": bkt_parameters.to_dict(),
        "metrics": metrics,
        "promotion_checks": checks,
        "promote_deep": promote_deep,
        "production_recommendation": "deep_with_bkt_fallback" if promote_deep else "bkt_only",
        "onnx_max_absolute_error": onnx_difference,
        "training_history": history,
        "dataset_examples": {
            "train": len(train_data),
            "validation": len(validation_data),
            "test": len(test_data),
        },
    }
    (artifact_directory / "metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    config.report_directory.mkdir(parents=True, exist_ok=True)
    (config.report_directory / "evaluation.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--max-sequences", type=int, default=None)
    parser.add_argument("--epochs", type=int, default=None)
    args = parser.parse_args()
    print(
        json.dumps(
            train(args.config, max_sequences=args.max_sequences, epochs=args.epochs),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
