/** Shared chat types (safe to import from client + server). */
export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };
