# Authorship and Code-Reuse Declaration

This is a template for the formal declaration to complete and sign with your
academic supervisor. Fill in the bracketed fields and remove this note before
submission. Legal permission to reuse code is not the same as academic
authorship; both must be declared explicitly and approved in writing.

## 1. Submission

- **Artefact**: LUMII (this repository).
- **Student**: [Name], [Student ID].
- **Module / Programme**: [Module], BSc (Hons) Computer Science.
- **Supervisor**: [Name].
- **Declaration date**: [Date].

## 2. Reuse of prior work

This artefact reuses patterns and code from a prior project ("mevaro") owned by
the author. The reuse is **declared here, listed in the report, and the source
repository is licensed/permitted** for this use.

Reused patterns (adapted, not copied verbatim):

- The AI quiz approach: `generateObject` with a Zod schema, multiple-choice
  questions, and instant client feedback. LUMII adds server-verified scoring (an
  encrypted answer-key token), ephemeral results, a PDF export, and a
  transactional completion record.
- The AI summary and tutor-chat approach over a document.
- The file-upload approach: presigned uploads to object storage with validation.
- Small utilities (the Prisma client singleton pattern, storage helpers).

Deliberate differences from the prior work: Clerk (not the prior auth), a private
R2 bucket with presigned access (not public URLs), no vector search, and
server-verified quiz scoring.

- **Source repository**: [URL], commit [hash].
- **Licence / permission**: [state the licence or the written permission].

## 3. Third-party components

The project uses standard open-source libraries and managed services, each under
its own licence: Next.js, React, Tailwind CSS, shadcn/ui (Base UI), Prisma,
Clerk, the Vercel AI SDK, OpenRouter, Cloudflare R2, Recharts, Zustand, and
`@react-pdf/renderer`. See `package.json` for versions.

## 4. Statement of personal contribution

Describe precisely what you personally designed, implemented, tested, and
evaluated, and the nature of any assistance received. Be specific per area
(for example: data model, AI prompts and validation, gamification rules, session
lifecycle, UI, tests, evaluation study).

- [Your statement.]

## 5. Supervisor approval

- Reuse of prior work approved: [ ] Yes / [ ] No, on [Date].
- Any conditions: [ ].
- Supervisor signature: ____________________
