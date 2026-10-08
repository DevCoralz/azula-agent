# Azula Code

An autonomous coding agent platform. Users bring their own model API key, write a
prompt, and the agent plans, edits files, runs commands and streams every step back
into an isolated workspace with a live preview.

```
azula-code/
├── frontend/   React 19 + TypeScript + TanStack Start + Tailwind v4  → Render
└── backend/    Node.js + TypeScript + Express + MySQL                → VPS / Pterodactyl
```

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env            # fill in DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, ADMIN_EMAIL
npm install
npm run migrate                 # creates tables, seeds models/plans/settings
npm run dev                     # http://localhost:8000
```

Generate the secrets:

```bash
openssl rand -hex 48   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY (exactly 64 hex chars)
```

Set `ADMIN_EMAIL` **before** you register — that first account becomes admin.

### 2. Frontend

```bash
cd frontend
cp .env.example .env            # VITE_API_URL=http://localhost:8000
npm install
npm run dev                     # http://localhost:8080
```

### 3. Use it

Register → Settings → add a provider API key (OpenAI, Anthropic, Google, OpenRouter,
Groq, DeepSeek or any OpenAI-compatible endpoint) → Workspace → create a workspace →
prompt the agent. Ctrl/Cmd + Enter sends.

## Deploying

**Frontend on Render** — `render.yaml` is included. Build `npm install && npm run build`,
start `npm run start`, and set `VITE_API_URL` to your backend URL.

**Backend on a VPS** — `npm run build && npm run migrate:prod && npm start`, behind
nginx or Caddy with TLS. A Dockerfile is included.

**Backend on Pterodactyl** — Node.js egg, startup
`npm install && npm run build && npm run migrate:prod && npm start`, container port
8000, `WORKSPACES_ROOT=/home/container/workspaces`. Full notes in `backend/README.md`.

The backend runs real shell commands, so it needs a host you control and a persistent
disk. Set `SANDBOX_MODE=docker` for public hosting — every command then runs in a
throwaway container with dropped capabilities and memory/CPU/PID limits.

## What is included

**Platform**: registration and sign-in, profiles and password changes, encrypted
bring-your-own API keys, referral codes with credit rewards, plans and pricing,
model registry, site settings, audit log.

**Admin console** (`/admin`): user management with roles and suspension, model
management, pricing management, platform settings.

**Workspace**: isolated per-user directories, file tree, code viewer, SSE run log
with expandable tool output, build/plan modes, model picker, backend status pill
with latency, live preview pane.

**Agent tools**: `list_dir`, `read_file`, `write_file`, `delete_file`, `search_files`,
`exec_cmd`, `install_tool`, `start_preview`, `stop_preview`.

## Guard rails

`backend/src/lib/policy.ts` inspects every command before it runs and refuses crypto
mining and chain nodes, DoS and stress tooling, internet-wide scanning, bulk mail,
outbound tunnels and proxies, privilege escalation, kernel and device writes, and
anything reaching outside the workspace. Security and pentest tooling stays available
for authorised testing. File paths are resolved against the workspace root on every
call; commands are time-limited and output-capped.

## Continuing the build

`roadmap.md` tracks what is done and what is next. Everything in the main list is
built; the backlog at the bottom is the next set of features.
