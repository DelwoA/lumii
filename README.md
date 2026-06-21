# LUMII

LUMII is an AI-powered study companion. You upload your study material (PDFs or
typed notes), and LUMII turns it into clear summaries and quizzes, answers
questions about it through a tutor chat, and helps you build a study habit with a
timetable, focus sessions, streaks, ranks, and progress analytics.

This repository is the final-year BSc (Hons) Computer Science artefact. For the
architecture, data model, and authorship/reuse declaration, see the [`docs/`](docs)
folder.

## Features

- **Authentication**: email/social sign-in via Clerk, with a Svix webhook and
  lazy provisioning that keep the local user record in sync.
- **Subjects & topics**: organise materials and sessions by subject and topic.
- **Materials**: upload PDFs (stored privately in Cloudflare R2 via short-lived
  presigned URLs) or type notes.
- **AI summaries**: structured, markdown revision summaries of any material.
- **AI quizzes**: five-question multiple-choice quizzes with server-verified
  scoring, instant explanations, and a downloadable PDF result.
- **AI tutor chat**: ask questions about a specific document; the tutor uses the
  material as context and favours guiding answers over hand-outs.
- **Timetable & sessions**: plan study sessions, then start a live-timed session
  with heartbeat tracking and gentle auto-stop when idle.
- **Gamification**: a deterministic Session Quality score, an XP ledger, ranks,
  an adherence streak, and trophies.
- **Mood check-in**: a privacy-hardened wellbeing signal (the text is classified
  once then discarded; only a label is stored, for 30 days).
- **Progress analytics**: charts for study minutes, weekly adherence, cumulative
  XP, and a study-activity heatmap.
- **Public showcase**: an opt-in `/u/[handle]` page that shows only rank and
  trophies (never your materials, quizzes, timetable, sessions, or mood).

## Tech stack

- **Framework**: Next.js 16 (App Router, Turbopack), React 19, TypeScript.
- **Styling**: Tailwind CSS v4 + shadcn/ui (Base UI preset).
- **Auth**: Clerk (`@clerk/nextjs`) with a Svix webhook.
- **Database**: Neon Postgres via Prisma.
- **AI**: Vercel AI SDK with OpenRouter (Gemini Flash primary, a configurable
  fallback), isolated behind a single provider module.
- **Storage**: Cloudflare R2 (private bucket, presigned access).
- **State**: React Server Components and server actions for server state; Zustand
  for the small amount of global client state (the active session).
- **Charts**: Recharts. **PDF export**: `@react-pdf/renderer`.
- **Testing**: Vitest (unit) and Playwright (end-to-end).

## Getting started

### Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io)
- Accounts: Neon, Clerk, OpenRouter (funded), Cloudflare R2

### Setup

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm db:deploy               # apply migrations to your database
pnpm dev                     # http://localhost:3000
```

`DATABASE_URL` is the pooled Neon connection used at runtime; `DIRECT_URL` is the
direct connection used for migrations. `QUIZ_TOKEN_SECRET` should be a random
string of at least 32 characters (it encrypts the quiz answer-key token).

`CLERK_WEBHOOK_SIGNING_SECRET` is only needed once the app is deployed to a public
URL where Clerk can deliver webhooks; it can be left empty for local development.

### Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm e2e` | Run end-to-end tests (Playwright) |
| `pnpm db:migrate` | Create/apply a dev migration |
| `pnpm db:deploy` | Apply migrations (production/CI) |
| `pnpm db:studio` | Open Prisma Studio |

## Project structure

```
app/
  (app)/        Authenticated app (dashboard, subjects, materials, timetable, ...)
  (auth)/       Clerk sign-in / sign-up
  u/[handle]/   Public profile (opt-in showcase)
  api/          Route handlers (Clerk webhook)
  page.tsx      Marketing landing page
components/      UI components (shadcn/ui in components/ui)
lib/            Domain logic: ai, sessions, gamification, timetable, progress, ...
prisma/         Schema and SQL migrations
```

Domain logic lives in `lib/` and is unit-tested where it is logic-heavy (session
timing and auto-close, Session Quality, XP/ranks, adherence streak, quiz-token
encryption, and timezone-aware day boundaries).

## Deployment

The app deploys to Vercel. The build runs `prisma generate` (via `postinstall`);
run `prisma migrate deploy` against the production database as a release step.
Set every variable from `.env.example` in the Vercel project (production and
preview), point the Clerk webhook at `https://<domain>/api/webhooks/clerk`, and
add `CLERK_WEBHOOK_SIGNING_SECRET` once the URL exists.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): system design and key decisions.
- [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md): the data model.
- [`docs/AUTHORSHIP.md`](docs/AUTHORSHIP.md): authorship and code-reuse declaration.
