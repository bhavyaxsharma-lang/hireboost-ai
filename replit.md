# HireBoost AI

## Overview

Full-stack AI-powered web app for resume analysis and mock interview coaching. Mobile-first, Android-friendly React frontend with Node.js/Express backend and PostgreSQL database. Uses Replit AI Integrations (OpenAI) — no personal API key required.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/hireboost-ai)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)
- **Auth**: Session-based (express-session + bcryptjs)
- **Validation**: Zod (zod/v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Features

1. **User Authentication** — Register/login with email & password (session-based)
2. **Resume Analyzer** — Paste resume text, get ATS score (0-100), missing keywords, strengths, improvement suggestions
3. **AI Mock Interview** — Select job role and difficulty, get AI-generated questions, submit answers for feedback and star ratings
4. **LinkedIn Content Generator** — Generate viral LinkedIn posts from a topic + tone (professional/storytelling/motivational), with hook, full post, hashtags, and a "Make it More Viral" button
5. **Salary Negotiation Tool** — Input current/offered/target salary + role + experience, get AI-generated verbal counter script, HR email, market insight, and negotiation tips
6. **Dashboard** — Overview of scores, stats, and recent activity
7. **History** — Past resume analyses and interview sessions
8. **Razorpay Payments** — 1 free resume rewrite lifetime, then ₹99/rewrite via Razorpay (Android WebView + UPI intents supported)
9. **Dark/Light mode** — System-aware theme toggle

## DB Tables

- `users` — id, name, email, password_hash, created_at
- `resume_analyses` — id, user_id, resume_text, job_title, ats_score, missing_keywords, suggestions, strengths, overall_feedback, created_at
- `interview_sessions` — id, user_id, job_role, difficulty, status, average_rating, total_questions, answered_questions, created_at, completed_at
- `interview_questions` — id, session_id, question_text, question_index, user_answer, ai_feedback, rating, created_at
- `conversations` / `messages` — OpenAI chat history

## API Endpoints

- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Get current user
- `POST /api/resume/upload` — Upload/extract resume text
- `POST /api/resume/analyze` — AI analyze resume (returns ATS score + feedback)
- `GET /api/resume/history` — List past analyses
- `GET /api/resume/history/:id` — Get specific analysis
- `GET /api/interview/sessions` — List sessions
- `POST /api/interview/sessions` — Create session + generate questions
- `GET /api/interview/sessions/:id` — Get session with Q&A
- `POST /api/interview/sessions/:id/answer` — Submit answer + get AI feedback
- `POST /api/interview/sessions/:id/complete` — Complete session
- `GET /api/dashboard/stats` — Dashboard stats
- `GET /api/dashboard/recent-activity` — Recent activity feed

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Environment Variables Required

- `SESSION_SECRET` — Secret for express-session
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — Auto-set by Replit AI Integrations
- `AI_INTEGRATIONS_OPENAI_API_KEY` — Auto-set by Replit AI Integrations
