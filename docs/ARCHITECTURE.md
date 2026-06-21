# LUMII Architecture

This document describes the system design of LUMII v1: its components, data flow,
and the decisions that shaped it. It is the current, authoritative architecture
reference and supersedes earlier proposal diagrams.

## 1. Overview

LUMII is a **modular monolith** built on Next.js (App Router). One deployable
application contains the UI, the server-side business logic, and the API surface.
This keeps the system simple to reason about and defend, which suits a single
maintainer and a final-year artefact, while still drawing clear internal
boundaries.

```
Browser
  |
  v
Next.js (Vercel)
  |- Server Components + Server Actions  ->  lib/ domain modules
  |- Route handler: /api/webhooks/clerk
  |
  +-- Clerk        (authentication, user identity)
  +-- Neon         (Postgres, via Prisma)
  +-- Cloudflare R2 (private file storage)
  +-- OpenRouter   (LLM inference, via the Vercel AI SDK)
```

## 2. Component boundaries

- **Routes (`app/`)**: Server Components fetch data and render; Server Actions
  (`"use server"`) handle mutations. The only route handler is the Clerk webhook.
- **Domain logic (`lib/`)**: framework-independent modules grouped by concern:
  - `lib/ai` — provider isolation, summary, quiz, tutor, mood classifier.
  - `lib/sessions` — session lifecycle and the pure timing math.
  - `lib/gamification` — XP ledger, ranks, Session Quality, streak, trophies.
  - `lib/timetable` — scheduled sessions and timezone-aware day boundaries.
  - `lib/progress` — analytics aggregation.
  - `lib/storage` — R2 access; `lib/quiz` — answer-key token; `lib/auth` — user
    resolution; `lib/prisma` — the client singleton.
- **UI (`components/`)**: presentational and interactive components, with the
  shadcn/ui primitives under `components/ui`.

Server-only modules import `server-only` so they can never leak into the client
bundle. Types shared with the client live in dedicated `types.ts` files that have
no server-only imports.

## 3. Key data flows

- **Material upload**: the client requests a short-lived presigned PUT URL (the
  server validates type/size and creates a `PENDING_UPLOAD` row with an opaque
  key), uploads directly to R2, then finalizes. The server verifies the bytes
  (magic-byte check via a ranged GET) before marking the material `READY`.
- **Summary / quiz / tutor**: the server loads the material (note text, or the
  PDF bytes from R2) and sends it to the model through the isolated provider.
  There is no stored extracted text; each AI operation re-sends the source. Quiz
  output is validated against a Zod schema.
- **Quiz scoring (server-verified)**: on generate, the browser receives the
  questions **without** the answer key plus an encrypted token (AES-256-GCM)
  bound to the user, material, and an expiry. On submit, the server decrypts the
  token, recomputes the score, and writes the completion and XP. The answer key
  is never stored or sent to the browser until grading.
- **Study session lifecycle**: Start creates one open `StudySession` (a partial
  unique index enforces "one open session per user"). A heartbeat updates
  `lastHeartbeatAt` while the tab is visible. Finalization is **reconcile-on-read**:
  any request that observes an open session auto-closes it if it is idle (no
  heartbeat for 5 minutes) or past the 4-hour cap, crediting time only up to the
  last heartbeat or the cap. Explicit Stop credits up to now (capped).
- **Gamification**: every XP event is an append-only `ActivityEvent` (the ledger)
  written with a deterministic idempotency key. `GamificationProfile` is a
  rebuildable projection whose `totalXp` equals the sum of ledger deltas. Awards
  are idempotent and daily-capped.

## 4. Notable decisions

- **AI provider isolation**: all model access goes through one module
  (`lib/ai/provider.ts`) with an ordered primary/fallback. Swapping providers is
  a one-file change.
- **Deterministic Session Quality**: a published 0-100 formula (duration
  adherence, explicit stop, declared goal, bounded engagement). It measures
  product engagement and session discipline, not learning or attention.
- **Adherence streak**: computed over planned days only; a day is adherent at
  >= 80% of its planned minutes. A separate perfect-day badge requires 100%.
- **Privacy**: mood text is sent only to a dedicated classifier and then
  discarded; only a label is stored, with a 30-day retention purged on access.
  The public profile exposes an explicit allowlist (name, bio, rank, optional XP,
  trophies, member-since) and 404s when private.
- **Deletion saga**: account/material deletion removes both Postgres rows and R2
  objects. Because the two stores cannot share a transaction, deletion is an
  idempotent, retryable saga (delete R2 objects, then the database); the Clerk
  webhook returns failure so Svix retries on partial failure.

## 5. Security

- **Authorization on every private route**: resolve the Clerk session to the
  local user, then query through the owner relation so a non-owned resource is
  simply not found.
- **Files**: opaque per-user R2 keys, short-lived presigned URLs, post-upload
  verification, and a private bucket (no public URLs).
- **Webhooks**: the Clerk webhook is Svix-signature verified; the app also lazily
  provisions the user on first authenticated request, so it never depends on
  eventually-consistent webhook delivery.
