/** Shared result type for server actions used with React's useActionState. */
export type ActionState = {
  ok: boolean;
  error?: string;
};

export const ACTION_INITIAL: ActionState = { ok: false };
