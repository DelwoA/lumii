# Mastery accuracy audit

## Why 85% is not an industry norm

Next-response knowledge tracing is a noisy probabilistic forecasting problem,
not ordinary image classification. A student may guess, misread, disengage, or
learn between attempts; question quality and difficulty also vary. Accuracy is
therefore strongly affected by the dataset's correct-answer base rate and the
chosen decision threshold. On LUMII's prepared EdNet sample, always predicting
"correct" already produces roughly 62% accuracy while providing no useful
ranking signal.

Industry-quality evaluation must consequently report at least ROC-AUC, PR-AUC,
log loss, Brier score, calibration, and a confidence interval alongside
accuracy. It must also split by student and select every preprocessing rule,
checkpoint, calibration value, and classification threshold without looking at
the final test students.

As a useful external reference, the item-aware SAINT+ EdNet result commonly
cited for this task is about 72.5% accuracy and 0.791 ROC-AUC—not 85% accuracy.
See the [SAINT+ paper](https://arxiv.org/abs/2012.12442) and the
[EdNet paper](https://arxiv.org/abs/1912.03072).

## What limited the original model

The original `temporal-gru-v1` used only correctness, response time, time gap,
attempt index, and running accuracy inside one student-component history. It
achieved 64.43% accuracy and 0.6122 ROC-AUC. Diagnostics showed that most of the
missing signal was question difficulty and cross-concept student history:

- A train-only empirical question baseline reached about 67.56% accuracy and
  0.6889 ROC-AUC.
- Adding an online student-performance term reached about 69.40% accuracy and
  0.7262 ROC-AUC.

Those checks explain the gap; they do not authorize putting EdNet question IDs
into production. LUMII generates new questions, so a model that memorizes
public-item embeddings would receive unknown IDs in the real application.

## Remediation implemented

The production-transfer candidate now uses a leakage-safe difficulty label,
global and target-concept histories, BKT state/evidence, timing, running
performance, and a calibrated statistical prior. A residual attention model
learns corrections to that prior. It is calibrated on validation students,
exports to ONNX, verifies PyTorch/ONNX parity, computes student-cluster bootstrap
intervals, and is blocked by an automated promotion script unless all hard
gates pass.

In parallel, DKT, SAKT, AKT, and SAINT are evaluated with pyKT as an item-aware
research benchmark. That track quantifies attainable headroom but is explicitly
ineligible for production promotion.

## Decision rule

The hard production-transfer gates remain:

- at least 10,000 untouched test examples;
- at least 72% validation-thresholded test accuracy;
- at least 0.78 test ROC-AUC;
- ECE at most 0.03;
- lower log loss than every declared portable baseline;
- exact ONNX parity within tolerance.

If a candidate misses a gate, LUMII does not silently relax the requirement.
The UI continues to use fitted BKT, the candidate stays in the experiment
registry, and the next improvement comes from consented LUMII outcomes,
better item-difficulty measurement, external-domain validation, and retraining.
This is a scientifically defensible result; claiming an inflated score through
row-level leakage, test tuning, or public-item memorization would not be.

## Final audited outcome

After Bayesian hyperparameter screening, the larger tuned candidate was trained
for six epochs and evaluated once on 50,000 untouched examples. It achieved
68.49% accuracy (student-cluster 95% CI 67.83–69.22), 0.7210 ROC-AUC (95% CI
0.7143–0.7270), 0.5927 log loss, and 0.0099 ECE. It improved substantially over
the original model and every declared portable baseline, but the intervals are
clearly below the accuracy and ROC-AUC gates. The result is therefore settled
as a valid research candidate, not a production champion; BKT remains active.
