// =============================================================================
// FILE: lib/forms.ts
// WHAT THIS FILE DOES:
//   A tiny shared "result" shape that form-handling server actions return:
//   either ok (success) or ok=false with an error message to show. Using one
//   shape everywhere keeps form handling consistent across the app.
// =============================================================================
/** Shared result type for server actions used with React's useActionState. */
export type ActionState = {
  ok: boolean;
  error?: string;
};

export const ACTION_INITIAL: ActionState = { ok: false };
