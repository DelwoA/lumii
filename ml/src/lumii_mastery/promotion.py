from __future__ import annotations

import hashlib
import json
import os
import shutil
from datetime import UTC, datetime
from pathlib import Path


def promote(candidate: Path, champion: Path) -> dict[str, object]:
    metadata_path = candidate / "metadata.json"
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("promote_deep") is not True:
        failed = [
            name for name, passed in metadata.get("promotion_checks", {}).items() if not passed
        ]
        raise ValueError(f"Candidate did not pass promotion gates: {failed}")
    source = candidate / str(metadata["artifact_filename"])
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    if digest != metadata.get("onnx_sha256"):
        raise ValueError("Candidate ONNX hash does not match its signed metadata")

    champion.mkdir(parents=True, exist_ok=True)
    artifact_destination = champion / "temporal_mastery.onnx"
    metadata_destination = champion / "metadata.json"
    temporary_artifact = champion / ".temporal_mastery.onnx.tmp"
    temporary_metadata = champion / ".metadata.json.tmp"
    champion_metadata = {
        **metadata,
        "artifact_filename": "temporal_mastery.onnx",
        "promoted_at": datetime.now(UTC).isoformat(),
    }
    shutil.copyfile(source, temporary_artifact)
    temporary_metadata.write_text(json.dumps(champion_metadata, indent=2), encoding="utf-8")
    os.replace(temporary_artifact, artifact_destination)
    os.replace(temporary_metadata, metadata_destination)
    return champion_metadata
