from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path
from typing import Any

import numpy as np
import optuna
import yaml

from lumii_mastery.data.transfer_sequences import (
    TRANSFER_FEATURE_COUNT,
    load_transfer_sequence_dataset,
)
from lumii_mastery.metrics import classification_metrics
from lumii_mastery.model import TransferMasteryNet
from lumii_mastery.training_transfer import (
    _collect_logits,
    _device,
    _seed_everything,
    _train_model,
)


def tune(
    config_path: Path,
    *,
    trials: int,
    max_sequences: int,
    epochs: int,
) -> dict[str, Any]:
    raw = yaml.safe_load(config_path.read_text(encoding="utf-8"))
    root = config_path.resolve().parents[1]
    seed = int(raw["seed"])
    sequence_length = int(raw["features"]["sequence_length"])
    minimum_history = int(raw["features"]["minimum_history"])
    processed_path = root / raw["dataset"]["processed_path"]
    datasets = {
        split: load_transfer_sequence_dataset(
            processed_path,
            split,
            sequence_length,
            max_sequences,
            seed + offset,
            minimum_history=minimum_history,
        )
        for offset, split in enumerate(("train", "validation"))
    }
    device = _device()

    def objective(trial: optuna.Trial) -> float:
        trial_seed = seed + trial.number
        _seed_everything(trial_seed)
        hidden_size = trial.suggest_categorical("hidden_size", [32, 64, 96])
        model = TransferMasteryNet(
            input_size=TRANSFER_FEATURE_COUNT,
            hidden_size=hidden_size,
            layers=trial.suggest_int("layers", 1, 3),
            heads=trial.suggest_categorical("heads", [2, 4, 8]),
            dropout=trial.suggest_float("dropout", 0.05, 0.25),
            maximum_sequence_length=sequence_length,
        )
        trial_config = copy.deepcopy(raw)
        trial_config["model"].update(
            {
                "batch_size": trial.suggest_categorical("batch_size", [128, 256, 512]),
                "learning_rate": trial.suggest_float("learning_rate", 2e-4, 2e-3, log=True),
                "weight_decay": trial.suggest_float("weight_decay", 1e-6, 1e-3, log=True),
                "epochs": epochs,
                "patience": 2,
            }
        )
        model, history = _train_model(
            model,
            datasets["train"],
            datasets["validation"],
            trial_config,
            device,
            trial_seed,
        )
        logits, labels = _collect_logits(
            model,
            datasets["validation"],
            int(trial_config["model"]["batch_size"]),
            device,
            trial_seed,
        )
        probabilities = 1 / (1 + np.exp(-np.clip(logits, -30, 30)))
        metrics = classification_metrics(labels, probabilities)
        trial.set_user_attr("roc_auc", metrics["roc_auc"])
        trial.set_user_attr("accuracy", metrics["accuracy"])
        trial.set_user_attr("history", history)
        return float(metrics["log_loss"])

    study = optuna.create_study(
        direction="minimize",
        sampler=optuna.samplers.TPESampler(seed=seed),
    )
    study.optimize(objective, n_trials=trials)
    result = {
        "best_validation_log_loss": study.best_value,
        "best_parameters": study.best_params,
        "best_validation_roc_auc": study.best_trial.user_attrs["roc_auc"],
        "best_validation_accuracy": study.best_trial.user_attrs["accuracy"],
        "trials": [
            {
                "number": trial.number,
                "value": trial.value,
                "parameters": trial.params,
                "user_attributes": trial.user_attrs,
            }
            for trial in study.trials
        ],
        "max_sequences_per_split": max_sequences,
        "epochs_per_trial": epochs,
        "device": device.type,
        "seed": seed,
    }
    output = root / "reports/generated/transfer-attention-v2/tuning.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--trials", type=int, default=12)
    parser.add_argument("--max-sequences", type=int, default=100_000)
    parser.add_argument("--epochs", type=int, default=4)
    args = parser.parse_args()
    print(
        json.dumps(
            tune(
                args.config,
                trials=args.trials,
                max_sequences=args.max_sequences,
                epochs=args.epochs,
            ),
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
