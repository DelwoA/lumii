# LUMII mastery model card

## Current production decision

Production uses `bkt-ednet-pooled-v2`. The latest deep candidate,
`transfer-attention-v2`, is retained for research but is **not promoted** because
it missed the predeclared 0.72 accuracy and 0.78 ROC-AUC gates. The legacy ONNX
artifact also has `promote_deep=false` under the stricter policy, so enabling the
environment flag cannot accidentally serve it.

This is an intentional reliability decision, not a failed application feature.
BKT supplies the interpretable mastery state and next-correct probability; the
deep pipeline, versioned feature builder, ONNX runtime, and fallback path remain
ready for a future candidate that passes every gate.

## Intended use

- Near-real-time, per-student mastery and next-medium-question probability for
  confirmed knowledge components.
- Mastery heatmap, trend, and weakest-component study recommendation.
- Low-stakes study support only. Predictions are not grades, diagnoses,
  admissions decisions, or proof of ability.

## Data and leakage controls

- Kaggle dataset: `xuedengyue/ednetkt1`, version 1,
  `processed_data_03.csv`.
- Kaggle labels the mirror CC BY 4.0. Because its card is sparse, retain the
  official EdNet citation and upstream non-commercial research restriction
  until provenance is independently cleared.
- Raw bounded sample: 8,000,000 chronological interactions.
- Clean single-skill interactions: 3,958,510.
- Students: 62,100; EdNet skills: 77.
- Missing/invalid values, duplicates, and multi-skill labels were removed.
- Deterministic student split: 70% train, 15% validation, 15% untouched test.
  No learner appears in multiple splits.
- Outlier limits and question-difficulty statistics use training students only.
  Training-row difficulty uses leave-one-out correctness to avoid target leakage.
- Checkpoint, temperature, and the 0.498 classification threshold were selected
  on validation students. The final test was evaluated once.

## Production-transfer candidate

The candidate never consumes public question or skill embeddings. Its 100-step,
13-feature sequence contains correctness, response time, global gap/attempt,
global and per-concept running accuracy, historical and target three-level
difficulty, target matching, BKT state/evidence, and a leakage-safe portable
prior. A three-layer, 64-unit residual Transformer learns a correction to that
prior. Optuna selected its heads, dropout, learning rate, weight decay, and batch
size in a separate validation screen.

Training used 50,000 sequences, calibration used 50,000 validation sequences,
and evaluation used 50,000 untouched test sequences from the prepared sample.

| Held-out metric   | Deep calibrated |     BKT | Portable student+difficulty |
| ----------------- | --------------: | ------: | --------------------------: |
| Accuracy          |         0.68486 | 0.61838 |                     0.65208 |
| Balanced accuracy |         0.63694 | 0.51252 |                     0.65598 |
| ROC-AUC           |         0.72097 | 0.59300 |                     0.71114 |
| PR-AUC            |         0.79653 | 0.69659 |                     0.78842 |
| Log loss          |         0.59266 | 0.65619 |                     0.63911 |
| Brier score       |         0.20345 | 0.23199 |                     0.22140 |
| ECE (15 bins)     |         0.00986 | 0.03409 |                     0.11610 |

Student-cluster bootstrap 95% intervals were 0.6783–0.6922 for accuracy and
0.7143–0.7270 for ROC-AUC. The model passed minimum-size, calibration, log-loss,
and ONNX-parity checks. It failed accuracy and ROC-AUC. PyTorch and ONNX Runtime
matched with maximum absolute error `3.38e-8`.

## Architecture comparison

A 100,000-interaction, five-epoch CPU pyKT screen was kept separate from the
production-transfer evaluation:

| Benchmark model | Accuracy | ROC-AUC |
| --------------- | -------: | ------: |
| DKT             |  0.63210 | 0.62028 |
| AKT             |  0.63587 | 0.62422 |
| SAINT           |  0.63624 | 0.61007 |

These are pipeline screens, not literature-scale reproductions. They show that
architecture names alone do not yield an 85% score. Item-aware models require
substantially more GPU training and stable item IDs; LUMII-generated questions
do not have transferable EdNet IDs, so this track cannot select production.

## Serving and reliability

- Offline tools: Python 3.12, PyTorch, pyKT, Optuna, Polars, and ONNX Runtime.
- Web runtime: `onnxruntime-node`, CPU provider, cached session, traced artifact.
- Feature metadata selects the matching TypeScript builder. Unknown schemas do
  not run.
- `MASTERY_DEEP_MODEL_ENABLED=true` is necessary but not sufficient; metadata
  must also contain `promote_deep=true`.
- A disabled flag, rejected metadata, fewer than three attempts, missing target,
  missing/corrupt artifact, runtime exception, or invalid probability uses BKT.
- The encrypted server token—not client-submitted question content—controls
  scoring and stored question metadata.

## Limitations and next evidence

The final interval demonstrates that more epochs alone are unlikely to reach
the agreed gate. The main missing signal is reliable item difficulty for unseen
generated questions. The next defensible iteration is to collect consented
LUMII outcomes, audit generated-question difficulty against observed response
rates, add an external-domain holdout, and retrain a versioned candidate. Never
train on personal material or question text without a separate privacy decision.

See `reports/generated/transfer-attention-v2/evaluation.json` for exact metrics,
`tuning.json` for the search, and `reports/screenshots/` for the verified visual
evidence.
