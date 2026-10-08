<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Frontend (TanStack Start) talks only to the separate Node backend in `backend/` via `VITE_API_URL`; no Lovable Cloud — user chose self-hosted MySQL.
- Backend is Express + TypeScript + MySQL (`backend/src/db/schema.sql` is the idempotent schema); keep it deployable to plain VPS/Pterodactyl.
- Roles live in `user_roles`, never on `users` — prevents privilege escalation.
- Every agent command passes `backend/src/lib/policy.ts` and every path passes `safeResolve` — shared host safety.
- `roadmap.md` is the continuation source of truth after remixes.
- Exactly one layer owns CORS headers: use CORS_MANAGED_BY_PROXY on Daytona, or Express CORS on a plain VPS, never both — duplicate allow-origin headers break browsers.
- Keep the node-server Nitro target for Render exports; Lovable may pin its own build target — deployable frontend must include client scripts.
