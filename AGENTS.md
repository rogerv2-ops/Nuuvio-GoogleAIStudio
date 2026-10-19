# AGENTS.md

Yuddit (formerly vuuy/nuuvio): WhatsApp bot + offers platform for Lima, Peru. Single Express backend + React SPA, Postgres via Drizzle. Deployed with Docker on Coolify.

## Commands

```bash
npm run dev      # tsx server.ts — the ONLY dev server (API + bot + static SPA), port 3000
npm run build    # vite build -> dist/  (server serves dist/ statically)
npm test         # bun test tests/security
npm run lint     # tsc --noEmit
```

Focused runs:

```bash
bun test tests/security/auth.contract.test.ts        # single file
BASE_URL=https://yuddit.com VUUV_ADMIN_EMAIL=... VUUV_ADMIN_PASSWORD=... ./scripts/ofertas-tests.sh   # tests/ofertas (needs Docker + python3)
BASE_URL=http://localhost:3000 ./scripts/security-smoke.sh                                            # 12 curl checks
./scripts/set-admin-password.sh                                                                       # rotate admin password without writing it to disk
```

## Verification gotchas (read before trusting a green run)

- `npm run lint` and `npm run build` both end in `|| true` — they **cannot fail**. And `tsconfig.json` only has `include: ["server.ts"]`, so `tsc --noEmit` typechecks a single file and ignores `src/`. Treat a passing lint/build as meaningless; verify otherwise.
- Tests are **black-box HTTP contract tests**. They `describe.skipIf(...)` when the server is unreachable (`TEST_BASE_URL`, default `http://localhost:3000`) or when credentials are missing. A fully green suite can mean nothing ran. Start the server and export `VUUV_ADMIN_EMAIL` / `VUUV_ADMIN_PASSWORD` (and `VUUV_COMMERCE_*` for role tests) before relying on results.
- `bun` is required by the test script and is **not installed** in this environment (`node`/`npm` only). `tsx` and `vite` are available via `node_modules/.bin`.
- `tests/ofertas/` is not covered by `npm test`; it needs DB fixtures seeded, an app **restart** (offers and click packs are loaded in memory), then cleanup — `scripts/ofertas-tests.sh` orchestrates all of that with a `trap EXIT`.

## Architecture

- `server.ts` (~171 KB, 432 lines, lines up to ~28 KB) is the **entire backend**: ~50 endpoints, Baileys/WAHA WhatsApp engine, auth gate, rate limiting, SSRF/webhook guards, static serving. Also minified/one-line: `src/db/schema.ts`, `src/db/repo.ts` (partially), `src/db/index.ts`, `src/core/events.ts`, `src/services/aiService.ts`. **Patch these with surgical string edits; never prettify, reformat, or "clean up" them.**
- Domain logic lives in `src/modules/*` (`ofertas`, `comercios`, `facturacion`, `usuarios`, `clics`, `banners`, `puntos`, `analitica`, `digest`, `seoMetadata`, `emailService`); DB access is centralized in `src/db/repo.ts`; guards/card rendering in `src/utils/*`.
- Frontend entry: `index.html` -> `src/main.tsx` -> `src/App.tsx` (path-based routing: `/gestion`, `/comercio`, root panel, login). Vite alias `@` = repo root.
- Client auth is in `src/core/security.ts`: stores the session token and installs a `fetch` interceptor that adds `Authorization: Bearer <token>` to every `/api/` call.
- **New endpoints must be registered in `esRutaPublica` in `server.ts`** if they should be public; the global `/api` gate 401s anything not allowlisted.

## Data & persistence

- Postgres via Drizzle. `src/db/schema.ts` is the source of truth; there are **no migration files** (`drizzle.config.ts` points at `./src/db/migrations`, which does not exist). Schema is applied with `drizzle-kit push` by `docker-entrypoint.sh` before the app starts.
- `docker-entrypoint.sh` rewrites `SQL_HOST` for the known production container and reads `SQL_ADMIN_USER`/`SQL_ADMIN_PASSWORD` (falling back to `SQL_USER`/`SQL_PASSWORD`); without them it skips the push and still starts.
- Runtime state is partly in memory (offers, click packs, WAHA session, login lockout, rate-limit buckets) — restart the app after changing DB rows that the app caches.

## Conventions

- UI copy, bot replies, prompts, and docs are **Spanish**; identifiers and code stay English. Commits are Conventional Commits with Spanish descriptions, no AI attribution.
- Brand was renamed `vuuy` -> `Yuudit` -> `Yuddit`, but the legacy `VUUV_*` env vars, `vuuy_sesion` cookie, and `vuuy` socket name are intentional. Do not rename them.
- Secrets: passwords are scrypt-hashed in `app_settings.auth_users`; never write plaintext credentials to files. `.env` is gitignored, `.env.example` documents the contract (`APP_URL` > `PUBLIC_URL` > `COOLIFY_URL` > `COOLIFY_FQDN`).
- Billing/security invariants exist because they were bugs: click `/c/:id` only bills when the link carries a valid HMAC (`registerOfferClick`); one billable click per 24 h window per (offer, phone); likes never bill; webhooks fail closed; `imageUrl` passes an SSRF allowlist. Preserve these.

## Repo docs (hand-written, Spanish)

- `FLUJOS.md` — per-feature request/response flows, tables touched, and how to verify each one (F1–F12).
- `INVENTARIO.md` — endpoint/DB/infra inventory and known debt. Dated snapshot (2026-10-16), so cross-check against `server.ts` before trusting.
- `docs/cambio-dominio-yuddit.md` — domain migration runbook; `docs/flujo-consulta-ofertas.md` — offers query flow.

## Deploy

Push to `main` -> Coolify auto-deploy (no CI workflow files in the repo). Deploys run the schema push, so any change to `src/db/schema.ts` takes effect on the next deploy.

## Local checkout quirk

`git` here fails with `detected dubious ownership`. Prefix commands with `git -c safe.directory=/home/ubuntu/nuuvio-googleaistudio ...` instead of editing global git config.
