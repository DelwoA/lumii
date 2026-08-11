import json
from pathlib import Path

import pytest

from lumii_mastery.promotion import promote


def test_promotion_rejects_candidate_that_failed_gates(tmp_path: Path) -> None:
    candidate = tmp_path / "candidate"
    candidate.mkdir()
    (candidate / "metadata.json").write_text(
        json.dumps(
            {
                "promote_deep": False,
                "promotion_checks": {"roc_auc": False},
                "artifact_filename": "candidate.onnx",
            }
        ),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="roc_auc"):
        promote(candidate, tmp_path / "champion")
