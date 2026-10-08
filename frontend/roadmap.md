# Azula Code — Build Roadmap

Autonomous AI coding agent platform. Free to use; every user brings their own LLM API key.
Frontend: React + TypeScript (TanStack Start) — deployable to Render.
Backend: Node.js + TypeScript + Express + MySQL — deployable to Pterodactyl / any VPS. Lives in `backend/`.

This file is the source of truth for continuing work after a remix or credit interruption.
If asked "what's next?", pick the first unchecked task and keep going.

## Design system (locked)
- White canvas, black typography and controls, subtle neutral glass surfaces.
- Red error alerts and green success alerts only; all other elements monochrome.
- Inter (UI, regular spacing) + JetBrains Mono (code/logs); restrained typography.
- Lucide icons only. No emojis in UI. Custom frosted dialogs, never native alerts.

## Frontend
- [x] Design system tokens in `src/styles.css`, fonts in `__root.tsx`
- [x] API client + auth context (`src/lib/api.ts`, `src/lib/auth.tsx`)
- [x] Landing page `/`
- [x] Auth `/auth` (sign in / register, referral code capture)
- [x] Workspace `/workspace` (prompt bar, SSE run log, file tree, code viewer, live preview)
- [x] Settings `/settings` (agent endpoint, BYO API keys, connection test)
- [x] Profile `/profile`
- [x] Pricing `/pricing`
- [x] Referrals `/referrals`
- [x] Admin `/admin` (users, models, plans, site settings, tools)

## Backend (`backend/`)
- [x] Express + TS skeleton, env config, error handling, rate limiting
- [x] MySQL pool + `schema.sql` + seed
- [x] Auth: register/login/JWT/refresh, roles, bcrypt
- [x] Users + profiles + admin user management
- [x] Encrypted BYO API key storage (AES-256-GCM)
- [x] Models registry + admin CRUD
- [x] Plans / pricing management
- [x] Referral codes + rewards ledger
- [x] Site settings (key/value, admin editable)
- [x] Isolated per-user workspaces on disk, path-traversal safe
- [x] Agent tool loop with SSE streaming (`/v1/chat`)
- [x] Tools: read_file, write_file, list_dir, exec_cmd, delete_file, search, install_tool, preview
- [x] Command policy engine — blocks crypto mining, abuse, fork bombs, destructive ops
- [x] Live preview process manager
- [x] `.env.example`, Dockerfile, README, Pterodactyl notes

## Delivery
- [x] Full zip of frontend + backend

## Backlog (next things to build)
## Current correction
- [x] Diagnose uploaded Render deployment and auth navigation.
- [x] Apply minimal monochrome design across every page, with mobile workspace access.
- [x] Validate sign-in, registration, referral links, failure states and layout.
- [x] Deliver full updated frontend/backend archive and deployment instructions.

## Backlog (next things to build)
- [ ] Google OAuth sign-in (needs client id/secret from the user)
- [ ] Email verification + password reset mail (needs SMTP credentials)
- [ ] Per-workspace git snapshots and diff view
- [ ] Team/org workspaces and sharing
- [ ] Usage analytics dashboard for admins
