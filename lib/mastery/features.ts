export const MASTERY_FEATURE_COUNT = 5;
export const DEFAULT_MASTERY_SEQUENCE_LENGTH = 50;
export const TRANSFER_MASTERY_FEATURE_COUNT = 13;

const ELAPSED_SCALE_SECONDS = 3_600;
const GAP_SCALE_SECONDS = 30 * 24 * 3_600;
const ATTEMPT_SCALE = 100;

export type TemporalAttempt = {
  correct: boolean;
  responseTimeMs: number | null;
  createdAt: Date;
  componentId?: string | null;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
};

function logScale(value: number, scale: number) {
  return Math.min(1, Math.max(0, Math.log1p(value) / Math.log1p(scale)));
}

export function buildMasteryFeatures(
  attempts: readonly TemporalAttempt[],
  sequenceLength = DEFAULT_MASTERY_SEQUENCE_LENGTH,
) {
  const selected = attempts.slice(-sequenceLength);
  const output = new Float32Array(sequenceLength * MASTERY_FEATURE_COUNT);
  let successes = 0;
  for (let index = 0; index < selected.length; index += 1) {
    const attempt = selected[index];
    successes += attempt.correct ? 1 : 0;
    const previous = index > 0 ? selected[index - 1] : null;
    const gapSeconds = previous
      ? Math.max(
          0,
          (attempt.createdAt.getTime() - previous.createdAt.getTime()) / 1_000,
        )
      : 0;
    const offset = index * MASTERY_FEATURE_COUNT;
    output[offset] = attempt.correct ? 1 : 0;
    output[offset + 1] = logScale(
      Math.max(0, (attempt.responseTimeMs ?? 0) / 1_000),
      ELAPSED_SCALE_SECONDS,
    );
    output[offset + 2] = logScale(gapSeconds, GAP_SCALE_SECONDS);
    output[offset + 3] = logScale(index, ATTEMPT_SCALE);
    output[offset + 4] = successes / (index + 1);
  }
  return { values: output, length: selected.length };
}

function difficultyValue(difficulty: TemporalAttempt["difficulty"]) {
  if (difficulty === "EASY") return 0.25;
  if (difficulty === "HARD") return 0.75;
  return 0.5;
}

function probabilityCorrect(mastery: number) {
  const guess = 0.35;
  const slip = 0.28956306650520824;
  return mastery * (1 - slip) + (1 - mastery) * guess;
}

function updateMastery(mastery: number, correct: boolean) {
  const learn = 0.07395798983169082;
  const forget = 0.012125785317259273;
  const slip = 0.28956306650520824;
  const likelihood = probabilityCorrect(mastery);
  const denominator = correct ? likelihood : 1 - likelihood;
  const numerator = correct ? mastery * (1 - slip) : mastery * slip;
  const posterior = denominator > 0 ? numerator / denominator : mastery;
  return posterior * (1 - forget) + (1 - posterior) * learn;
}

function logit(probability: number) {
  const bounded = Math.min(0.95, Math.max(0.05, probability));
  return Math.log(bounded / (1 - bounded));
}

export function buildTransferMasteryFeatures(
  attempts: readonly TemporalAttempt[],
  target: {
    componentId: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    globalProbability: number;
  },
  sequenceLength: number,
) {
  const output = new Float32Array(
    sequenceLength * TRANSFER_MASTERY_FEATURE_COUNT,
  );
  const globalRunning: number[] = [];
  const globalGaps: number[] = [];
  const conceptAttempts: number[] = [];
  const conceptRunning: number[] = [];
  const conceptStates = new Map<
    string,
    { count: number; successes: number; mastery: number }
  >();
  let globalSuccesses = 0;
  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    globalSuccesses += attempt.correct ? 1 : 0;
    globalRunning.push(globalSuccesses / (index + 1));
    globalGaps.push(
      index === 0
        ? 0
        : Math.max(
            0,
            (attempt.createdAt.getTime() -
              attempts[index - 1].createdAt.getTime()) /
              1_000,
          ),
    );
    const componentId = attempt.componentId ?? "__unknown__";
    const state = conceptStates.get(componentId) ?? {
      count: 0,
      successes: 0,
      mastery: 0.7571719352777952,
    };
    conceptAttempts.push(state.count);
    state.count += 1;
    state.successes += attempt.correct ? 1 : 0;
    conceptRunning.push(state.successes / state.count);
    state.mastery = updateMastery(state.mastery, attempt.correct);
    conceptStates.set(componentId, state);
  }

  const targetState = conceptStates.get(target.componentId) ?? {
    count: 0,
    successes: 0,
    mastery: 0.7571719352777952,
  };
  const targetDifficulty = difficultyValue(target.difficulty);
  const studentProbability = globalRunning.at(-1) ?? target.globalProbability;
  const portableBaseline =
    1 /
    (1 +
      Math.exp(
        -(
          logit(studentProbability) +
          logit(1 - targetDifficulty) -
          logit(target.globalProbability)
        ),
      ));
  const start = Math.max(0, attempts.length - sequenceLength);
  const selected = attempts.slice(start);
  for (let localIndex = 0; localIndex < selected.length; localIndex += 1) {
    const globalIndex = start + localIndex;
    const attempt = selected[localIndex];
    const offset = localIndex * TRANSFER_MASTERY_FEATURE_COUNT;
    output[offset] = attempt.correct ? 1 : 0;
    output[offset + 1] = logScale(
      Math.max(0, (attempt.responseTimeMs ?? 0) / 1_000),
      ELAPSED_SCALE_SECONDS,
    );
    output[offset + 2] = logScale(globalGaps[globalIndex], GAP_SCALE_SECONDS);
    output[offset + 3] = logScale(globalIndex, ATTEMPT_SCALE);
    output[offset + 4] = globalRunning[globalIndex];
    output[offset + 5] = logScale(conceptAttempts[globalIndex], ATTEMPT_SCALE);
    output[offset + 6] = conceptRunning[globalIndex];
    output[offset + 7] = difficultyValue(attempt.difficulty);
    output[offset + 8] = attempt.componentId === target.componentId ? 1 : 0;
    output[offset + 9] = targetDifficulty;
    output[offset + 10] = probabilityCorrect(targetState.mastery);
    output[offset + 11] = logScale(targetState.count, ATTEMPT_SCALE);
    output[offset + 12] = portableBaseline;
  }
  return { values: output, length: selected.length };
}
