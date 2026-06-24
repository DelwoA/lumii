// =============================================================================
// FILE: lib/quiz/token.ts
// WHAT THIS FILE DOES:
//   Stops cheating on quizzes. When a quiz is generated, the correct answers are
//   NOT sent to the browser. Instead they are sealed inside an encrypted "token"
//   (a scrambled string only the server can read). When the student submits,
//   the server unlocks the token, checks it is theirs and not expired, and works
//   out the real score itself. The token is never saved anywhere.
//
// THE TECHNIQUE (in plain words):
//   It uses AES-256-GCM, a standard, strong, two-way lock (encryption) that also
//   detects tampering. If anyone edits the token, unlocking it fails on purpose.
//   The lock's secret comes from the QUIZ_TOKEN_SECRET environment setting.
//
//   - encryptQuizToken: lock the answers into a token (server -> browser).
//   - decryptQuizToken: unlock + check the token on submit (browser -> server).
//   - scoreQuiz: the trusted marking that the server (not the browser) performs.
// =============================================================================
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * The quiz answer key never reaches the browser. On generation the server
 * returns the questions (without answers/explanations) plus this authenticated-
 * encrypted (AES-256-GCM) token. On submission the server decrypts it, verifies
 * ownership + expiry, and recomputes the score. The token is never persisted.
 *
 * Token format: base64url(iv).base64url(authTag).base64url(ciphertext)
 */
export interface QuizAnswerKey {
  quizInstanceId: string;
  userId: string;
  materialId: string | null;
  questionCount: number;
  correctAnswers: number[];
  explanations: (string | null)[];
  modelId: string;
  generationVersion: string;
}

const TTL_MS = 45 * 60 * 1000; // 45 minutes

function getKey(): Buffer {
  const secret = process.env.QUIZ_TOKEN_SECRET;
  if (!secret) throw new Error("QUIZ_TOKEN_SECRET is not set");
  return createHash("sha256").update(secret).digest(); // 32 bytes
}

export async function encryptQuizToken(payload: QuizAnswerKey): Promise<string> {
  const key = getKey();
  const iv = randomBytes(12);
  const plaintext = Buffer.from(
    JSON.stringify({ ...payload, exp: Date.now() + TTL_MS }),
    "utf8",
  );
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((b) => b.toString("base64url")).join(".");
}

/** Throws if the token is tampered, malformed, or expired. */
export async function decryptQuizToken(token: string): Promise<QuizAnswerKey> {
  const key = getKey();
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed quiz token");
  const [iv, tag, ciphertext] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  // .final() throws if the auth tag fails (tampered ciphertext/key).
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  const obj = JSON.parse(plaintext.toString("utf8")) as QuizAnswerKey & {
    exp: number;
  };
  if (typeof obj.exp !== "number" || Date.now() > obj.exp) {
    throw new Error("Quiz token expired");
  }
  const { exp: _exp, ...rest } = obj;
  void _exp;
  return rest;
}

export interface QuizScore {
  questionCount: number;
  correctCount: number;
}

/** Server-trusted scoring: submitted[i] is the chosen option index or null. */
export function scoreQuiz(
  correctAnswers: number[],
  submitted: (number | null)[],
): QuizScore {
  const questionCount = correctAnswers.length;
  let correctCount = 0;
  for (let i = 0; i < questionCount; i++) {
    if (submitted[i] != null && submitted[i] === correctAnswers[i]) {
      correctCount += 1;
    }
  }
  return { questionCount, correctCount };
}
