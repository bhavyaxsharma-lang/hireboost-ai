# Threat Model

## Project Overview

HireBoost AI is a full-stack web application for resume analysis, AI mock interview coaching, LinkedIn post generation, salary-negotiation assistance, and paid resume rewrites. The production stack is a React + Vite frontend in `artifacts/hireboost-ai`, an Express 5 API in `artifacts/api-server`, PostgreSQL via Drizzle in `lib/db`, and OpenAI/Razorpay integrations on the server side.

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
- **Highest-risk areas:** session/cookie/CORS and route-level throttling in `artifacts/api-server/src/app.ts`; public auth and recovery flows in `artifacts/api-server/src/routes/auth.ts` and `password-reset.ts` (especially any direct-reset shortcut that bypasses emailed-token proof); user-scoped data routes in `resume.ts`, `interview.ts`, `dashboard.ts`; payment and rewrite-credit logic in `payment.ts`, `webhook.ts`, and `resume.ts`; OpenAI-backed endpoints in `resume.ts`, `interview.ts`, `linkedin.ts`, `salary.ts`, and `jd-prep.ts`; file parsing in `parse-file.ts`.
- **Public surface:** `/api/auth/*`, `/api/health`, and any API route that does not explicitly reject missing sessions. Public auth endpoints are state-changing even without an existing session and still need CSRF/origin and abuse controls; password-recovery routes must never rely on knowledge of an email address alone and must not disclose whether an email is registered through status-code or message differences. Frontend `ProtectedRoute` pages are not a server-side control and must not be treated as sufficient protection for `/api/resume/parse-file`, `/api/linkedin/*`, or `/api/salary/*`.
- **Authenticated surface:** dashboard, resume history, rewrite/payment status, interview history, interview session detail/actions, JD prep, LinkedIn generator, salary-negotiation features, and upload parsing.
- **Dev-only:** `artifacts/mockup-sandbox`, `lib/api-spec`, `scripts`.

## Threat Categories

### Spoofing

Users authenticate with email/password and a server-side session. All endpoints that return or mutate user data or consume paid backend resources MUST require a valid authenticated session unless they are intentionally public. Session state MUST be bound to the intended user on every request, and account-recovery flows MUST only deliver reset capability to the mailbox owner rather than to the caller of a public endpoint; no production reset path may grant password-change capability based solely on a submitted email address. Public auth endpoints that can create or change session state (such as login, registration, and forgot-password) MUST reject cross-site requests even in same-origin production deployments; SameSite cookies alone are not a sufficient control for those flows. Third-party payment callbacks or client-submitted payment confirmations MUST be verified before changing credit state.

### Tampering

The client can send arbitrary JSON and route parameters regardless of what the frontend UI exposes. The API MUST validate all request bodies and MUST enforce ownership checks before updating interview sessions, payment credits, or stored resume data. Client-supplied business state such as session IDs, question IDs, and rewrite eligibility MUST never be trusted on its own. Payment entitlements MUST be granted only after the server confirms provider-side settlement state, and later refunds or failed captures MUST be reconciled before credits remain usable. If post-settlement reconciliation depends on webhooks, payment features MUST fail closed unless that webhook path is correctly configured and authenticated.

### Information Disclosure

Resume text, interview answers, job targets, activity history, and account metadata are private user data. API responses for these resources MUST be scoped to the authenticated user, and object lookups for user-owned records SHOULD avoid distinguishable `403`/`404` existence oracles that reveal whether another user's record exists. Public authentication and account-recovery endpoints SHOULD also avoid disclosing whether an email address is registered, because that oracle materially improves phishing and credential-stuffing campaigns. Cross-origin browser access MUST be restricted to trusted origins only, and error handling and logs MUST avoid leaking secrets, raw credentials, or private document contents.

### Denial of Service

OpenAI-backed analysis, LinkedIn, salary, rewrite, and interview-generation endpoints can create direct financial cost and heavy backend load. These endpoints MUST have strong server-side access control, bounded input sizes, and abuse controls such as per-user or per-IP throttling. Route-specific throttles MUST cover all accepted URL variants so alternate slash forms cannot silently fall back to weaker limits. File parsing and large prompt construction MUST not allow callers to create memory/CPU exhaustion through in-memory parser bombs, oversized decompression, or unbounded extracted-text growth. Expensive authenticated parsing endpoints should inherit account-level throttles as well as per-IP limits so one user cannot multiply their budget by rotating egress IPs.

### Elevation of Privilege

A regular or unauthenticated caller MUST NOT be able to read or modify another user's records, claim more paid/free entitlements than intended, or invoke protected features simply by calling backend routes directly outside the frontend flow. The backend MUST treat the client as fully untrusted, enforce authorization at every route and object lookup, make credit-consumption decisions atomically rather than with check-then-act races, and resist password-guessing attacks with meaningful server-side password requirements and targeted login throttling.