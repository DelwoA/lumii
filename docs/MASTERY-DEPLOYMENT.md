# Mastery model deployment runbook

## What is deployed

Python is used only for offline data preparation, training, tuning, evaluation,
and ONNX export. No Python training process or Kaggle dependency runs when a
student uses LUMII.

Production deploys three pieces with the existing Next.js application:

1. `ml/artifacts/champion/temporal_mastery.onnx`, the immutable inference graph.
2. `ml/artifacts/champion/metadata.json`, including feature version, metrics,
   promotion decision, calibration, and checksum.
3. `onnxruntime-node`, the CPU inference runtime used only in server code.

`next.config.ts` includes the champion directory in Next.js output-file tracing
and treats ONNX Runtime as a server external package. Therefore the model is
bundled into the Vercel Function that executes quiz submission/mastery updates;
there is no separate model server for this version.

## Request lifecycle

When a quiz is submitted, the authenticated server action stores the canonical
question attempts, recomputes BKT, builds the metadata-selected feature schema,
and invokes the cached ONNX session. A warm function reuses that session. A cold
function loads the small graph once. If the feature flag is off, evidence is
insufficient, metadata rejected promotion, the file is absent, ONNX cannot
load, inference throws, or output is invalid, the request completes with BKT.

The student never calls a public model endpoint and never sends private history
to Kaggle, OpenRouter, or another inference provider.

## Safe rollout

1. Train and evaluate offline. Keep the untouched student-level test split
   sealed until final candidate selection.
2. Run `scripts/promote_candidate.py`. It refuses candidates that failed any
   hard gate or whose ONNX checksum differs from metadata.
3. Apply the additive Prisma migrations to a Neon temporary branch and verify
   quiz, mastery, ownership, cascade, and IoT invariants.
4. Create a Vercel preview with `MASTERY_DEEP_MODEL_ENABLED=false`. Validate
   concept setup, detailed quiz history, BKT display, deletion/recompute, and all
   existing device routes.
5. Set the flag to `true` only on preview. Check prediction source/version,
   function logs, cold/warm latency, and deliberate missing-model fallback.
6. Apply the already-verified migration to Neon main only after explicit
   approval and a restore point is available.
7. Promote the same immutable build and environment setting to production.
   Monitor fallback rate, latency, calibration drift, and errors by subject and
   evidence bucket.

## Vercel fit and future split point

The ONNX graph is well below the standard Vercel Function bundle limit, uses CPU
only, and inference is much shorter than normal function-duration limits. The
native Linux ONNX package must still be confirmed by a real preview build; local
macOS success alone is not sufficient evidence.

Keep inference inside Vercel while the champion remains compact and CPU latency
is acceptable. Move it to a dedicated private inference service only if a later
model needs GPU execution, causes the traced function bundle to approach the
platform limit, needs independent autoscaling, or cannot meet measured cold
start/latency targets. The BKT fallback remains required in either topology.

Vercel references: [Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js),
[function limits](https://vercel.com/docs/functions/limitations), and
[advanced function configuration](https://vercel.com/docs/functions/configuring-functions/advanced-configuration).
