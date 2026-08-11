import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMasteryFeatures,
  buildTransferMasteryFeatures,
  DEFAULT_MASTERY_SEQUENCE_LENGTH,
  MASTERY_FEATURE_COUNT,
  TRANSFER_MASTERY_FEATURE_COUNT,
} from "@/lib/mastery/features";
import type { TemporalAttempt } from "@/lib/mastery/features";

type ModelMetadata = {
  model_version: string;
  sequence_length: number;
  promote_deep: boolean;
  feature_schema_version?: string;
  training_global_probability?: number;
};

export type DeepPrediction =
  | { status: "predicted"; probability: number; modelVersion: string }
  | { status: "disabled" | "cold_start" | "fallback"; reason: string };

let metadataPromise: Promise<ModelMetadata> | null = null;
let sessionPromise: Promise<
  import("onnxruntime-node").InferenceSession
> | null = null;
const metadataPath = path.join(
  process.cwd(),
  "ml",
  "artifacts",
  "champion",
  "metadata.json",
);
const modelPath = path.join(
  process.cwd(),
  "ml",
  "artifacts",
  "champion",
  "temporal_mastery.onnx",
);

async function loadMetadata() {
  if (!metadataPromise) {
    metadataPromise = readFile(metadataPath, "utf8").then((value) =>
      JSON.parse(value),
    );
  }
  return metadataPromise;
}

async function loadSession() {
  if (!sessionPromise) {
    sessionPromise = import("onnxruntime-node").then(({ InferenceSession }) =>
      InferenceSession.create(modelPath, {
        executionProviders: ["cpu"],
        graphOptimizationLevel: "all",
      }),
    );
  }
  return sessionPromise;
}

export async function predictNextCorrect(
  attempts: readonly TemporalAttempt[],
  target?: {
    componentId: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
  },
): Promise<DeepPrediction> {
  if (process.env.MASTERY_DEEP_MODEL_ENABLED !== "true") {
    return { status: "disabled", reason: "Deep inference feature flag is off" };
  }
  if (attempts.length < 3) {
    return {
      status: "cold_start",
      reason: "At least three responses are required",
    };
  }

  try {
    const metadata = await loadMetadata();
    if (!metadata.promote_deep) {
      return {
        status: "disabled",
        reason: "The model did not pass promotion gates",
      };
    }
    const sequenceLength =
      metadata.sequence_length || DEFAULT_MASTERY_SEQUENCE_LENGTH;
    const transfer = metadata.feature_schema_version === "portable-transfer-v2";
    if (transfer && !target) {
      return {
        status: "fallback",
        reason: "The prediction target was unavailable",
      };
    }
    const features = transfer
      ? buildTransferMasteryFeatures(
          attempts,
          {
            ...target!,
            globalProbability: metadata.training_global_probability ?? 0.6133,
          },
          sequenceLength,
        )
      : buildMasteryFeatures(attempts, sequenceLength);
    const featureCount = transfer
      ? TRANSFER_MASTERY_FEATURE_COUNT
      : MASTERY_FEATURE_COUNT;
    const { Tensor } = await import("onnxruntime-node");
    const session = await loadSession();
    const result = await session.run({
      features: new Tensor("float32", features.values, [
        1,
        sequenceLength,
        featureCount,
      ]),
      lengths: new Tensor(
        "int64",
        BigInt64Array.from([BigInt(features.length)]),
        [1],
      ),
    });
    const output = result.next_correct_probability;
    const probability = Number(output?.data[0]);
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new Error("Model returned an invalid probability");
    }
    return {
      status: "predicted",
      probability,
      modelVersion: metadata.model_version,
    };
  } catch (error) {
    console.error("Mastery deep inference failed; using BKT fallback", error);
    return { status: "fallback", reason: "Deep inference was unavailable" };
  }
}
