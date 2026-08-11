from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import random
import sys
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
import torch
import yaml
from scipy.optimize import minimize_scalar
from torch import nn
from torch.utils.data import DataLoader

from lumii_mastery.data.transfer_sequences import (
    TRANSFER_FEATURE_COUNT,
    TRANSFER_FEATURE_NAMES,
    TransferSequenceDataset,
    load_transfer_sequence_dataset,
)
from lumii_mastery.metrics import (
    classification_metrics,
    cluster_bootstrap_confidence_intervals,
)
from lumii_mastery.model import CalibratedInferenceModel, TransferMasteryNet

MODEL_VERSION = "transfer-attention-v2"


def _seed_everything(seed: int) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.use_deterministic_algorithms(True, warn_only=True)
    torch.backends.cudnn.benchmark = False


def _device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _loader(
    dataset: TransferSequenceDataset,
    batch_size: int,
    shuffle: bool,
    seed: int,
) -> DataLoader:
    return DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=shuffle,
        num_workers=0,
        generator=torch.Generator().manual_seed(seed),
    )


def _collect_logits(
    model: TransferMasteryNet,
    dataset: TransferSequenceDataset,
    batch_size: int,
    device: torch.device,
    seed: int,
) -> tuple[np.ndarray, np.ndarray]:
    model.eval()
    logits: list[np.ndarray] = []
    labels: list[np.ndarray] = []
    with torch.inference_mode():
        for features, lengths, target in _loader(dataset, batch_size, False, seed):
            logits.append(model(features.to(device), lengths.to(device)).float().cpu().numpy())
            labels.append(target.numpy())
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


def _accuracy_threshold(labels: np.ndarray, probabilities: np.ndarray) -> float:
    thresholds = np.linspace(0.2, 0.8, 601)
    accuracies = np.asarray(
        [np.mean((probabilities >= threshold) == labels) for threshold in thresholds]
    )
    best = np.flatnonzero(accuracies == accuracies.max())
    closest_to_default = best[np.argmin(np.abs(thresholds[best] - 0.5))]
    return float(thresholds[closest_to_default])


def _portable_baselines(
    dataset: TransferSequenceDataset, global_probability: float
) -> dict[str, np.ndarray]:
    bkt = np.zeros(len(dataset), dtype=np.float64)
    combined = np.zeros(len(dataset), dtype=np.float64)
    for index in range(len(dataset)):
        features, length_tensor, _ = dataset[index]
        length = int(length_tensor)
        row = features[length - 1].numpy()
        bkt[index] = float(row[10])
        combined[index] = float(row[12])
    return {
        "global_mean": np.full(len(dataset), global_probability),
        "bkt_state": bkt,
        "student_plus_difficulty": combined,
    }


def _train_model(
    model: TransferMasteryNet,
    train: TransferSequenceDataset,
    validation: TransferSequenceDataset,
    raw: dict[str, Any],
    device: torch.device,
    seed: int,
) -> tuple[TransferMasteryNet, list[dict[str, float]]]:
    config = raw["model"]
    batch_size = int(config["batch_size"])
    model.to(device)
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=float(config["learning_rate"]),
        weight_decay=float(config["weight_decay"]),
    )
    criterion = nn.BCEWithLogitsLoss()
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")
    best_state = copy.deepcopy(model.state_dict())
    best_loss = float("inf")
    stale_epochs = 0
    history: list[dict[str, float]] = []

    for epoch in range(1, int(config["epochs"]) + 1):
        started = time.perf_counter()
        model.train()
        losses: list[float] = []
        for features, lengths, target in _loader(train, batch_size, True, seed + epoch):
            features = features.to(device)
            lengths = lengths.to(device)
            target = target.to(device)
            optimizer.zero_grad(set_to_none=True)
            with torch.autocast(
                device_type=device.type,
                dtype=torch.float16,
                enabled=device.type == "cuda",
            ):
                loss = criterion(model(features, lengths), target)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            scaler.step(optimizer)
            scaler.update()
            losses.append(float(loss.detach()))

        validation_logits, validation_labels = _collect_logits(
            model, validation, batch_size, device, seed
        )
        validation_probabilities = 1 / (1 + np.exp(-np.clip(validation_logits, -30, 30)))
        metrics = classification_metrics(validation_labels, validation_probabilities)
        validation_loss = float(metrics["log_loss"])
        entry = {
            "epoch": float(epoch),
            "train_loss": float(np.mean(losses)),
            "validation_log_loss": validation_loss,
            "validation_roc_auc": float(metrics["roc_auc"]),
            "seconds": time.perf_counter() - started,
        }
        history.append(entry)
        print(
            f"epoch={epoch} train_loss={entry['train_loss']:.5f} "
            f"validation_log_loss={validation_loss:.5f} "
            f"validation_auc={entry['validation_roc_auc']:.5f} "
            f"seconds={entry['seconds']:.1f}",
            file=sys.stderr,
            flush=True,
        )
        if validation_loss < best_loss - 1e-4:
            best_loss = validation_loss
            best_state = copy.deepcopy(model.state_dict())
            stale_epochs = 0
        else:
            stale_epochs += 1
            if stale_epochs >= int(config["patience"]):
                break

    model.load_state_dict(best_state)
    return model, history


def _export_and_verify(
    model: TransferMasteryNet,
    temperature: float,
    destination: Path,
    sequence_length: int,
) -> float:
    cpu_model = model.to("cpu").eval()
    inference_model = CalibratedInferenceModel(cpu_model, temperature).eval()
    example_features = torch.zeros(
        (1, sequence_length, TRANSFER_FEATURE_COUNT), dtype=torch.float32
    )
    example_lengths = torch.tensor([sequence_length], dtype=torch.int64)
    destination.parent.mkdir(parents=True, exist_ok=True)
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
) -> dict[str, Any]:
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    root = config_path.resolve().parents[1]
    if max_sequences is not None:
        raw["model"]["max_sequences_per_split"] = max_sequences
    if epochs is not None:
        raw["model"]["epochs"] = epochs
    seed = int(raw["seed"])
    _seed_everything(seed)
    device = _device()
    sequence_length = int(raw["features"]["sequence_length"])
    maximum = int(raw["model"]["max_sequences_per_split"])
    minimum_history = int(raw["features"]["minimum_history"])
    processed_path = root / raw["dataset"]["processed_path"]
    print(f"device={device.type}", file=sys.stderr, flush=True)

    datasets = {
        split: load_transfer_sequence_dataset(
            processed_path,
            split,
            sequence_length,
            maximum,
            seed + offset,
            minimum_history=minimum_history,
        )
        for offset, split in enumerate(("train", "validation", "test"))
    }
    for split, dataset in datasets.items():
        print(f"{split}_examples={len(dataset)}", file=sys.stderr, flush=True)

    model = TransferMasteryNet(
        input_size=TRANSFER_FEATURE_COUNT,
        hidden_size=int(raw["model"]["hidden_size"]),
        layers=int(raw["model"]["layers"]),
        heads=int(raw["model"]["heads"]),
        dropout=float(raw["model"]["dropout"]),
        maximum_sequence_length=sequence_length,
    )
    model, history = _train_model(
        model, datasets["train"], datasets["validation"], raw, device, seed
    )
    validation_logits, validation_labels = _collect_logits(
        model,
        datasets["validation"],
        int(raw["model"]["batch_size"]),
        device,
        seed,
    )
    temperature = _temperature(validation_logits, validation_labels)
    validation_probabilities = 1 / (1 + np.exp(-np.clip(validation_logits / temperature, -30, 30)))
    decision_threshold = _accuracy_threshold(validation_labels, validation_probabilities)
    test_logits, test_labels = _collect_logits(
        model,
        datasets["test"],
        int(raw["model"]["batch_size"]),
        device,
        seed,
    )
    deep_probabilities = 1 / (1 + np.exp(-np.clip(test_logits / temperature, -30, 30)))
    global_probability = float(datasets["train"].global_probability)
    baseline_probabilities = _portable_baselines(datasets["test"], global_probability)
    metrics = {
        "deep_calibrated": classification_metrics(
            test_labels,
            deep_probabilities,
            threshold=decision_threshold,
        ),
        **{
            name: classification_metrics(test_labels, values)
            for name, values in baseline_probabilities.items()
        },
    }
    confidence_intervals = cluster_bootstrap_confidence_intervals(
        test_labels,
        deep_probabilities,
        datasets["test"].student_ids(),
        seed=seed + 100,
        threshold=decision_threshold,
    )
    deep = metrics["deep_calibrated"]
    strongest_baseline_log_loss = min(
        float(value["log_loss"]) for name, value in metrics.items() if name != "deep_calibrated"
    )
    selection = raw["selection"]
    checks = {
        "minimum_test_examples": int(deep["examples"]) >= int(selection["minimum_test_examples"]),
        "accuracy": float(deep["accuracy"]) >= float(selection["minimum_accuracy"]),
        "roc_auc": float(deep["roc_auc"]) >= float(selection["minimum_roc_auc"]),
        "calibration": float(deep["ece_15"]) <= float(selection["maximum_ece"]),
        "log_loss_improvement": (
            not bool(selection["require_log_loss_improvement"])
            or float(deep["log_loss"]) < strongest_baseline_log_loss
        ),
    }
    promote_deep = all(checks.values())

    artifact_directory = root / raw["artifacts"]["candidate_directory"]
    onnx_path = artifact_directory / "transfer_mastery.onnx"
    onnx_difference = _export_and_verify(model, temperature, onnx_path, sequence_length)
    artifact_hash = hashlib.sha256(onnx_path.read_bytes()).hexdigest()
    metadata: dict[str, Any] = {
        "model_version": MODEL_VERSION,
        "created_at": datetime.now(UTC).isoformat(),
        "evaluation_track": "production_transfer",
        "depends_on_public_item_ids": False,
        "sequence_length": sequence_length,
        "feature_names": TRANSFER_FEATURE_NAMES,
        "feature_schema_version": "portable-transfer-v2",
        "artifact_filename": "transfer_mastery.onnx",
        "temperature": temperature,
        "decision_threshold": decision_threshold,
        "training_global_probability": global_probability,
        "metrics": metrics,
        "deep_confidence_intervals": confidence_intervals,
        "promotion_checks": checks,
        "promote_deep": promote_deep,
        "production_recommendation": ("deep_with_bkt_fallback" if promote_deep else "bkt_only"),
        "onnx_sha256": artifact_hash,
        "onnx_max_absolute_error": onnx_difference,
        "training_history": history,
        "dataset_examples": {split: len(dataset) for split, dataset in datasets.items()},
        "device": device.type,
        "seed": seed,
    }
    artifact_directory.mkdir(parents=True, exist_ok=True)
    (artifact_directory / "metadata.json").write_text(
        json.dumps(metadata, indent=2), encoding="utf-8"
    )
    report_directory = root / raw["artifacts"]["report_directory"]
    report_directory.mkdir(parents=True, exist_ok=True)
    (report_directory / "evaluation.json").write_text(
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
            train(
                args.config,
                max_sequences=args.max_sequences,
                epochs=args.epochs,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
