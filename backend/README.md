# Azula Code — backend

Node.js + TypeScript + Express + MySQL. Runs the agent tool loop, isolated workspaces,
authentication, admin API and live preview.

## Requirements

- Node.js 20 or newer
- MySQL 8
- A Linux host you control (VPS, Pterodactyl egg, Docker). The agent runs real commands.

## Setup

```bash
cp .env.example .env     # then fill it in
npm install
npm run migrate          # creates the schema and seeds models, plans, settings
npm run dev              # development, http://localhost:8000
```

Production:

```bash
npm install
npm run build
npm run migrate:prod
npm start
```

Generate the two secrets before first boot:

```bash
openssl rand -hex 48   # JWT_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY  (must be exactly 64 hex chars)
```

Set `ADMIN_EMAIL` before you register — that account becomes admin automatically.
To promote someone later: `npm run make-admin someone@example.com`.

## Environment

See `.env.example`. The important ones:

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | `mysql://user:pass@host:3306/azula` |
| `JWT_SECRET` | Signs session tokens |
| `ENCRYPTION_KEY` | 32-byte hex key, encrypts user API keys (AES-256-GCM) |
| `CORS_ORIGINS` | Comma-separated frontend origins |
| `WORKSPACES_ROOT` | Where user workspaces live on disk |
| `SANDBOX_MODE` | `process` (dedicated box) or `docker` (recommended publicly) |
| `PREVIEW_URL_TEMPLATE` | How preview ports are exposed, e.g. `https://{port}-box.example.com` |

## Docker sandbox mode

With `SANDBOX_MODE=docker`, every command runs in a throwaway container with the
workspace bind-mounted at `/workspace`, all capabilities dropped, no new privileges,
and memory/CPU/PID limits. Build the image once:

```bash
docker build -t azula/sandbox:latest -f sandbox.Dockerfile .
```

## Pterodactyl

Use the Node.js egg.

- Startup command: `npm install && npm run build && npm run migrate:prod && npm start`
- Container port: `8000` (plus the preview range if you want live preview reachable)
- Add every variable from `.env.example` as an egg variable
- `WORKSPACES_ROOT` must be inside the server's volume, e.g. `/home/container/workspaces`

## API surface

```
GET    /health
POST   /api/auth/register | /api/auth/login
GET    /api/auth/me
PATCH  /api/users/me            POST /api/users/me/password
GET    /api/referrals
GET    /api/keys     POST /api/keys     POST /api/keys/:id/test     DELETE /api/keys/:id
GET    /api/models   GET /api/plans     GET /api/site
GET    /api/workspaces           POST /api/workspaces      DELETE /api/workspaces/:id
GET    /api/workspaces/:id/files | /file | /history | /stats
PUT    /api/workspaces/:id/file  DELETE /api/workspaces/:id/file
POST   /api/workspaces/:id/preview/stop
POST   /v1/chat                  (Server-Sent Events agent stream)
GET    /api/admin/users | models | plans | settings | stats | audit  (+ PATCH/POST/DELETE)
```

## Agent tools

`list_dir`, `read_file`, `write_file`, `delete_file`, `search_files`, `exec_cmd`,
`install_tool`, `start_preview`, `stop_preview`.

Every command passes through `src/lib/policy.ts` first. It refuses crypto mining,
DoS tooling, tunnels/proxies, privilege escalation, host device writes and anything
that reaches outside the workspace. Security tooling (nmap, sqlmap, nuclei, ffuf,
hashcat and friends) is allowed for authorised testing.

## Safety notes

- File paths are resolved and verified against the workspace root on every tool call.
- Commands are time-limited and output-capped.
- Preview servers are tracked per workspace and killed on shutdown.
- API keys are only decrypted in memory for the duration of a run.
