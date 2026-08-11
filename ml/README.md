# LUMII mastery ML

This directory contains the reproducible, non-LLM knowledge-tracing workbench.
The web application records private per-question attempts; this pipeline trains
only on public research datasets and exports a compact model for local server
inference.

## Data

- Primary: the flattened EdNet-KT1 mirror (`xuedengyue/ednetkt1`, version 1,
  `processed_data_03.csv`). Kaggle labels the mirror CC BY 4.0; because its card
  is sparse, retain the official EdNet citation and treat the upstream
  CC BY-NC research restriction as authoritative unless provenance is cleared.
- Planned external validation: ASSISTments SkillBuilder
  (`nicolaswattiez/skillbuilder-data-2009-2010` on Kaggle).
- Raw and processed data are intentionally excluded from Git.

Authentication uses `KAGGLE_API_TOKEN`. The official Kaggle MCP was also used
to verify the dataset card, version, files, schema summary, and a ranged sample.
The downloader keeps the 1 GB zip compressed; preparation streams the 3.86 GB
CSV from the archive.

Run:

```bash
uv sync --group dev
uv run python scripts/download_datasets.py
uv run lumii-prepare --config configs/ednet.yaml
uv run lumii-train --config configs/ednet.yaml
uv run lumii-train-transfer --config configs/transfer.yaml
uv run lumii-tune-transfer --config configs/transfer.yaml --trials 12
uv run lumii-benchmark-pykt \
  --source data/processed/ednet_single_skill.parquet \
  --work-directory data/benchmark/pykt
uv run pytest
```

The split is by student, not rows: 70% train, 15% validation, 15% untouched
test. Interaction order is preserved. Accuracy is reported, but champion
selection also requires ROC-AUC, log loss, Brier score, and calibration.

There are two deliberately separate evaluation tracks:

- `production_transfer` uses only features LUMII can reproduce for new,
  generated questions and custom knowledge components. It is the only track
  eligible for ONNX promotion.
- `item_aware_benchmark_only` compares DKT, SAKT, AKT, and SAINT with stable
  EdNet question/skill identifiers through pyKT. It measures research-model
  headroom but cannot be deployed for LUMII's previously unseen questions.

Candidates are written under `artifacts/candidates/`. The promotion helper
refuses to overwrite the champion unless every configured gate passed and the
ONNX checksum matches metadata:

```bash
uv run python scripts/promote_candidate.py \
  --candidate artifacts/candidates/transfer-attention-v2 \
  --champion artifacts/champion
```

Only questions with one skill label enter the concept-level model. Copying one
binary outcome onto every tag of a multi-skill question would create ambiguous
supervision. The application follows the same invariant: each generated quiz
question is validated against one confirmed knowledge component.
