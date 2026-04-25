# Threat Model

## Project Overview

HireBoost AI is a full-stack web application for resume analysis and AI mock interview coaching. The production stack is a React + Vite frontend in `artifacts/hireboost-ai`, an Express 5 API in `artifacts/api-server`, PostgreSQL via Drizzle in `lib/db`, and OpenAI/Razorpay integrations on the server side.

The application handles user accounts, session cookies, uploaded resume content, interview answers and feedback, payment state for resume rewrites, and server-held API credentials. Production traffic is assumed to run with `NODE_ENV=production` behind Replit-managed TLS. The `artifacts/mockup-sandbox` app is development-only and should be ignored unless production reachability is demonstrated.

## Assets

- **User accounts and sessions** — email addresses, password hashes, session identifiers, and authenticated browser state. Compromise allows impersonation and access to private career-prep data.
- **Resume and interview data** — resume text, job descriptions, ATS analyses, interview questions, user answers, AI feedback, and sample answers. This is sensitive personal and professional information.
- **Payment state and rewrite credits** — Razorpay order/payment identifiers and whether a paid resume rewrite credit has been earned or consumed. Tampering could enable free service use or disrupt purchased access.
- **Application secrets** — `SESSION_SECRET`, `DATABASE_URL`, OpenAI integration credentials, and Razorpay secrets. Exposure could compromise the entire application.
- **AI spending and backend capacity** — OpenAI-backed endpoints can consume paid tokens and backend resources. Abuse can create direct financial impact and service degradation.

## Trust Boundaries

- **Browser to API** — all frontend requests cross from an untrusted client into the Express API. Authentication, authorization, CSRF protections, and input validation must be enforced server-side.
- **API to PostgreSQL** — the API can read and mutate all persisted user data. Broken access control or unsafe queries at the API layer can expose or tamper with all stored records.
- **API to external providers** — the server calls OpenAI and Razorpay with secret credentials. User-controlled input crossing this boundary can create cost abuse, privacy leaks, or business-logic abuse.
- **Public to authenticated boundary** — the homepage and auth flows are public, while dashboard, resume history, interview history, session details, and rewrite/payment state are intended to be user-scoped. This boundary must be enforced by the backend, not only by frontend route guards.
- **Production to dev-only boundary** — `artifacts/mockup-sandbox`, codegen sources, and repo scripts are assumed non-production unless deployment evidence shows otherwise.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*.ts`, `artifacts/hireboost-ai/src/App.tsx`, `lib/db/src/schema/*`.
- **Highest-risk areas:** session/cookie/CORS setup in `artifacts/api-server/src/app.ts`; user-scoped data routes in `artifacts/api-server/src/routes/resume.ts`, `interview.ts`, `dashboard.ts`; payment logic in `payment.ts`; OpenAI-backed endpoints in `resume.ts` and `interview.ts`.
- **Public surface:** `/api/auth/*`, `/api/health`, plus any API route that does not explicitly reject missing sessions.
- **Authenticated surface:** dashboard, resume history, rewrite/payment status, interview history, interview session detail/actions.
- **Dev-only:** `artifacts/mockup-sandbox`, `lib/api-spec`, `scripts`.

## Threat Categories

### Spoofing

Users authenticate with email/password and a server-side session. All endpoints that return or mutate user data MUST require a valid authenticated session, and session state MUST be bound to the intended user on every request. Third-party payment callbacks or client-submitted payment confirmations MUST be verified before changing credit state.

### Tampering

The client can send arbitrary JSON and route parameters regardless of what the frontend UI exposes. The API MUST validate all request bodies and MUST enforce ownership checks before updating interview sessions, payment credits, or stored resume data. Client-supplied business state such as session IDs, question IDs, and rewrite eligibility MUST never be trusted on its own.

### Information Disclosure

Resume text, interview answers, job targets, activity history, and account metadata are private user data. API responses for these resources MUST be scoped to the authenticated user, and cross-origin browser access MUST be restricted to trusted origins only. Error handling and logs MUST avoid leaking secrets, raw credentials, or private document contents.

### Denial of Service

OpenAI-backed analysis and interview generation endpoints can create direct financial cost and heavy backend load. These endpoints MUST have strong server-side access control, bounded input sizes, and abuse controls such as per-user or per-IP throttling. File parsing and large prompt construction MUST not allow unbounded memory, token, or database growth.

### Elevation of Privilege

A regular or unauthenticated caller MUST NOT be able to read or modify another user's records by supplying numeric IDs or by calling endpoints directly outside the frontend flow. The backend MUST treat the client as fully untrusted and enforce authorization at every route and object lookup.