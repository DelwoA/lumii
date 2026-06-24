// =============================================================================
// FILE: lib/env.ts
// WHAT THIS FILE DOES:
//   Reads "environment variables", which are the secret settings kept OUTSIDE
//   the code (database address, API keys, and so on). They live in a .env file
//   locally and in the hosting settings in production, so secrets are never
//   written into the code itself.
//
//   This file describes every setting (with Zod), fills in sensible defaults,
//   and offers requireServerEnv(...) which throws a clear error if a genuinely
//   required secret is missing. Secrets are optional in the schema so the app
//   can still build for testing without them. Secret VALUES are never logged.
//
// HOW TO ADD A NEW SETTING: add it to serverSchema below, then read it with
//   requireServerEnv("YOUR_KEY") where it is needed.
// =============================================================================
import { z } from "zod";

/**
 * Environment access for LUMII.
 *
 * Secrets are intentionally OPTIONAL in the schema so the app builds without
 * them (e.g. CI builds, local UI work). Runtime code that genuinely needs a
 * secret must call `requireServerEnv(...)`, which throws a clear error if the
 * value is missing. Never log secret VALUES.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  // Database (Neon)
  DATABASE_URL: z.string().url().optional(),
  DIRECT_URL: z.string().url().optional(),

  // Clerk
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),

  // AI (OpenRouter)
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("google/gemma-3-27b-it:free"),
  OPENROUTER_FALLBACK_MODEL: z.string().default("google/gemini-2.5-flash"),

  // Storage (Cloudflare R2)
  CLOUDFLARE_R2_ENDPOINT: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET: z.string().optional(),

  // Quiz token encryption (32+ char secret)
  QUIZ_TOKEN_SECRET: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export const env: ServerEnv = serverSchema.parse(process.env);

/**
 * Assert that the given server env keys are present (non-empty) at runtime.
 * Returns a typed object with those keys guaranteed defined.
 */
export function requireServerEnv<K extends keyof ServerEnv>(
  ...keys: K[]
): { [P in K]: NonNullable<ServerEnv[P]> } {
  const missing: string[] = [];
  const out = {} as { [P in K]: NonNullable<ServerEnv[P]> };
  for (const key of keys) {
    const value = env[key];
    if (value === undefined || value === null || value === "") {
      missing.push(String(key));
    } else {
      out[key] = value as NonNullable<ServerEnv[K]>;
    }
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(", ")}. ` +
        `Set them in .env.local (see .env.example).`,
    );
  }
  return out;
}
