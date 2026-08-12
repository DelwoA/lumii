# Mastery tracking architecture

## Product behavior

Mastery tracking turns quiz practice into private, concept-level learning
evidence. A material must belong to a topic. LUMII proposes three to eight
knowledge components from the material; the student can edit and confirm them
before quiz generation. Only confirmed components become prediction targets.

Quick quizzes contain five questions and standard quizzes contain ten. The
generator receives an explicit component blueprint, and a separate structured
AI pass validates that every question maps to one canonical component. Low
confidence or invalid assignments are retried rather than silently stored.

On submission, the server uses the encrypted canonical quiz token—not client
question content—to score the attempt. One transaction stores the quiz header,
question/options/selected and correct answer, explanation, component snapshot,
response time, XP event, and idempotency key. The result is then used to
recompute affected mastery records and snapshots.

## Prediction flow

```text
confirmed component
       ↓
targeted generated question → encrypted canonical token
       ↓
authenticated/idempotent submission transaction
       ↓
private QuizQuestionAttempt history + difficulty
       ↓
fitted BKT state ────────────────→ mastery probability
       │
       └─ 3+ attempts → calibrated ONNX predictor → next-answer probability
                              │
                 any failure └────→ BKT next-answer fallback
```

`StudentConceptMastery` stores the latest state. `MasterySnapshot` stores a
point-in-time value per quiz and component for trend display. Deleting one quiz
or clearing history cascades its private question rows/snapshots and recomputes
remaining mastery so displayed values cannot become stale.

## Progress experience

- `/progress` retains the existing overview and adds a concise mastery preview.
- `/progress/mastery` shows an evidence-aware subject/topic/component heatmap,
  current mastery and next-answer estimates, and trends.
- `/progress` recommends a practice-ready confirmed component and deep-links to
  a material quiz focused on that component. Students can also search and choose
  any other practice-ready concept, grouped by subject and topic.
- `/progress/quizzes` provides paginated filters and full question-level review,
  including chosen/correct answers, explanations, component, and response time.
- Legacy summary-only quiz completions remain readable.

Unpractised components are shown as insufficient evidence, not as zero mastery.
Recommendations first build coverage for components with fewer than three
answers. Once every component has a baseline, they choose the weakest component
outside a 24-hour review cooldown. If every component is inside that cooldown,
the least recently practised component becomes the spaced-review suggestion.
Concepts without an accessible linked material are never recommended.

## Data ownership and privacy

All reads and writes are scoped to the authenticated internal user ID. Knowledge
components, attempts, mastery, and history cascade from that user. Material,
topic, and component ownership are rechecked in server actions. Question history
is private and is not included on public profiles or IoT payloads.

## Reliability and rollout

The champion directory contains the last ONNX graph, but its current metadata
sets `promote_deep=false` because it does not meet the stricter audited gates.
Production therefore uses `bkt-ednet-pooled-v2`. When a future candidate passes,
`lib/mastery/inference.ts` will cache ONNX Runtime and will still require both
the feature flag and passing model metadata. Cold starts and all inference
failures use BKT; the source and version are persisted for auditability.

Training and production are intentionally separate. Python, PyTorch, pyKT, and
Optuna run offline on a workstation or Kaggle GPU. They are not deployed with
the web application. A passing candidate is exported to a small ONNX file. The
Next.js server function loads that file through `onnxruntime-node`, reuses one
module-level inference session while the function instance is warm, and returns
the probability. `next.config.ts` explicitly traces the champion directory into
the Vercel function bundle. The feature builder is versioned so a model cannot
silently receive a schema different from the one used in training.

The production-transfer model receives chronological global quiz history,
response time/gap/running performance, historical and target difficulty, target
component evidence and BKT state, and a leakage-safe statistical prior. Public
EdNet item IDs are forbidden from this track because generated LUMII questions
have never-before-seen IDs. Item-aware DKT/SAKT/AKT/SAINT results are reported
separately as research benchmarks and can never trigger production promotion.

Recommended rollout:

1. Apply the additive migration on a Neon branch and run database checks.
2. Deploy with `MASTERY_DEEP_MODEL_ENABLED=false`; exercise concept setup,
   history, deletion/recompute, and BKT behavior.
3. Keep the deep flag off until a candidate passes every hard gate. Then enable
   it on preview, verify ONNX latency/fallback logs, and use a monitored rollout.
4. Re-evaluate calibration on consented LUMII outcomes before retraining.

## IoT compatibility

The mastery migration is additive. Existing device models, pairing tables,
device authentication, route contracts, and API feature flags are unchanged.
Mastery data is not exposed through the device API. Existing IoT regression
tests remain mandatory before deployment.
