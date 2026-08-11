from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass(frozen=True)
class TrainingConfig:
    seed: int
    sequence_length: int
    hidden_size: int
    layers: int
    dropout: float
    batch_size: int
    learning_rate: float
    epochs: int
    patience: int
    weight_decay: float
    max_sequences_per_split: int
    processed_path: Path
    artifact_directory: Path
    report_directory: Path


def load_config(path: Path) -> tuple[dict[str, Any], TrainingConfig]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    root = path.resolve().parents[1]
    config = TrainingConfig(
        seed=int(raw["seed"]),
        sequence_length=int(raw["features"]["sequence_length"]),
        hidden_size=int(raw["model"]["hidden_size"]),
        layers=int(raw["model"]["layers"]),
        dropout=float(raw["model"]["dropout"]),
        batch_size=int(raw["model"]["batch_size"]),
        learning_rate=float(raw["model"]["learning_rate"]),
        epochs=int(raw["model"]["epochs"]),
        patience=int(raw["model"]["patience"]),
        weight_decay=float(raw["model"]["weight_decay"]),
        max_sequences_per_split=int(raw["model"]["max_sequences_per_split"]),
        processed_path=root / raw["dataset"]["processed_path"],
        artifact_directory=root / raw["artifacts"]["directory"],
        report_directory=root / raw["artifacts"]["report_directory"],
    )
    return raw, config
