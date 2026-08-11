export const BKT_MODEL_VERSION = "bkt-ednet-pooled-v2";

export type BktParameters = {
  prior: number;
  learn: number;
  forget: number;
  guess: number;
  slip: number;
};

export const DEFAULT_BKT_PARAMETERS: BktParameters = {
  // Fitted on the EdNet training students used by temporal-gru-v1. Guess and
  // slip were constrained for LUMII's four-option quiz format.
  prior: 0.7571719352777952,
  learn: 0.07395798983169082,
  forget: 0.012125785317259273,
  guess: 0.35,
  slip: 0.28956306650520824,
};

export type BktEstimate = {
  masteryProbability: number;
  nextCorrectProbability: number;
  evidenceCount: number;
};

function clampProbability(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function probabilityCorrect(
  mastery: number,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
) {
  return clampProbability(
    mastery * (1 - parameters.slip) + (1 - mastery) * parameters.guess,
  );
}

export function updateBkt(
  mastery: number,
  correct: boolean,
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
) {
  const p = clampProbability(mastery);
  const likelihoodCorrect = probabilityCorrect(p, parameters);
  const denominator = correct ? likelihoodCorrect : 1 - likelihoodCorrect;
  const numerator = correct ? p * (1 - parameters.slip) : p * parameters.slip;
  const posterior = denominator > 0 ? numerator / denominator : p;
  return clampProbability(
    posterior * (1 - parameters.forget) + (1 - posterior) * parameters.learn,
  );
}

export function estimateBkt(
  responses: readonly boolean[],
  parameters: BktParameters = DEFAULT_BKT_PARAMETERS,
): BktEstimate {
  let mastery = parameters.prior;
  for (const response of responses) {
    mastery = updateBkt(mastery, response, parameters);
  }
  return {
    masteryProbability: mastery,
    nextCorrectProbability: probabilityCorrect(mastery, parameters),
    evidenceCount: responses.length,
  };
}
