from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASETS = (
    {
        "slug": "xuedengyue/ednetkt1",
        "file": "content/drive/MyDrive/EdNET-KT1/processed_data_03.csv",
        "destination": ROOT / "data/raw/ednet-kt1",
        # Keep the 1 GB archive compressed. Preparation streams the CSV from it,
        # avoiding a second 3.86 GB copy on developer laptops.
        "unzip": False,
    },
)


def main() -> None:
    runtime_config = ROOT / ".runtime/kaggle"
    runtime_config.mkdir(parents=True, exist_ok=True)
    environment = {
        **os.environ,
        "KAGGLE_CONFIG_DIR": str(runtime_config),
    }
    for dataset in DATASETS:
        destination = dataset["destination"]
        destination.mkdir(parents=True, exist_ok=True)
        command = [
            str(Path(sys.executable).with_name("kaggle")),
            "datasets",
            "download",
            "-d",
            dataset["slug"],
            "-f",
            dataset["file"],
            "-p",
            str(destination),
        ]
        if dataset["unzip"]:
            command.append("--unzip")
        subprocess.run(command, check=True, env=environment)


if __name__ == "__main__":
    main()
