// =============================================================================
// FILE: lib/ai/chat-types.ts
// WHAT THIS FILE DOES:
//   The shared "shape" of one tutor-chat message. A message has a role ("user"
//   for the student, "assistant" for the tutor) and the text content. Kept in
//   its own tiny file with no server code so both the browser chat box and the
//   server tutor logic agree on the same shape.
// =============================================================================
/** Shared chat types (safe to import from client + server). */
export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
