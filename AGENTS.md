# AGENTS.md

Yuddit (formerly vuuy/nuuvio): WhatsApp bot + offers platform for Lima, Peru. Single Express backend + React SPA, Postgres via Drizzle. Deployed with Docker on Coolify.

## Reglas inquebrantables — enlaces a WhatsApp

**Todo enlace a WhatsApp deja elegir la app, y el teléfono nunca se expone.** Salen de un incidente real (2026-10-19): **todos los botones de WhatsApp de la landing estaban muertos**. El botón pedía `/api/whatsapp/config`, que está fuera de `esRutaPublica`; el gate global de `/api` respondía 401, el cliente se quedaba sin número y hacía `return` **sin avisar**. Cero clics, cero leads, cero señal.

| Regla | Cómo se cumple | Dónde |
|---|---|---|
| **1. Siempre se puede elegir la app** | Android: esquema nativo `whatsapp://` → el sistema muestra el selector (WhatsApp / WhatsApp Business) con **un solo toque**. iOS y web: el sistema no ofrece selector, así que lo pone la hoja de opciones (WhatsApp / WhatsApp Business / WhatsApp Web). **Vale para TODOS los enlaces, también los firmados `/c/:id` que manda el bot** (medido el 2026-10-21: esos iban a `wa.me`, que no ofrece selector). | `src/utils/whatsappLinks.ts` (reglas puras), `src/components/WhatsAppChooser.tsx` (hoja del SPA), `src/utils/hojaWhatsApp.ts` (hoja del servidor, para `/c/:id`) |
| **2. El teléfono no se expone** | El número **no** va en el HTML, ni en el bundle, ni en un endpoint público. Se resuelve en el servidor **en el momento del clic** y se responde con el enlace ya armado (`Cache-Control: no-store`). `/api/whatsapp/config` **no** es ruta pública: sigue así. El payload público de ofertas no lleva teléfonos. | `GET /api/whatsapp/contacto` (público) |
| **3. Todo contacto se registra y se atribuye** | El clic entra en `click_logs` **con `facturable: false`** (sin teléfono del usuario y sin firma HMAC: solo `/c/:id` con HMAC factura) y el destino elegido se guarda en `security_logs` (`accion: "whatsapp_contacto"`). El mensaje lleva el título de la oferta, su `ref` y el código de canje. | `src/db/repo.ts` (`registerOfferClick`), `server.ts` |
| **4. Un botón que no abre, avisa** | Nunca un `return` silencioso: si el servidor no responde, la interfaz muestra el error. | `src/utils/whatsappNative.ts` |
| **5. Todo enlace accionable va EN EL TEXTO, no en un botón** | El motor en producción es **Baileys v7**, que **no soporta botones**: `templateButtons` y `buttons` no existen en su tipo de mensaje y la librería los **descarta en silencio** (sin error, sin log). Un botón que se pierde es un lead que no llega al comercio. El enlace firmado `/c/:id?u=&s=` va **escrito en el texto**; WhatsApp lo linkifica solo. | `server.ts` (`enviarOfertaEspecifica`, `dispatchOffersMosaic`), `docs/reglas-whatsapp.md` |

Cómo se aplica:

- **Nunca reescribas una URL de WhatsApp a mano** fuera de `src/utils/whatsappLinks.ts`. Duplicar las reglas es exactamente como se rompe la elección de app.
- **El mensaje al bot tiene que disparar su intención de "pedir ofertas"** (`esIntencionOfertas`, en `src/utils/securityGuards.ts`). La palabra va **en plural**: "quiero ver las **ofertas** de Yuddit: {título}". El mensaje viejo ("Hola quiero aprovechar esta **oferta**: …") no la disparaba, así que el bot no entendía el pedido.
- **La landing enruta al bot, no al comercio**: así los teléfonos de los comercios no llegan al público. El lead llega al comercio por el enlace firmado `/c/:id`, que sí factura.
- **Los enlaces `/c/:id` también dejan elegir la app** (2026-10-21): el bot los manda por WhatsApp y la persona los toca desde el chat. Antes iban a `wa.me`, que abre la app directo sin dejar elegir. Ahora: en Android, 302 al esquema `whatsapp://` (selector del sistema); en iOS y web, el servidor sirve la hoja de opciones. El teléfono del comercio **no** va en el HTML: cada botón vuelve al servidor con `dest=` y el servidor responde con el enlace ya armado.

Lo que **tiene que ver la persona** (si no, no está bien):

| Plataforma | Qué tiene que pasar con un toque |
|---|---|
| **Android** | Se abre el **selector del sistema** con WhatsApp y WhatsApp Business. Un toque, sin hoja intermedia. |
| **iPhone / iPad** | Se abre **la hoja de Yuddit** con las tres opciones (WhatsApp / WhatsApp Business / WhatsApp Web). En iOS el sistema no da selector para esquemas propios: por eso la hoja es nuestra. |
| **Escritorio / web** | Se abre **la hoja de Yuddit** con las tres opciones. |

**Estado de la verificación en dispositivos reales** (2026-10-19): **Android ✅** y **web ✅** (probados por el dueño). **iPhone ⏳ pendiente.** Por eso: **ningún cambio que toque un enlace a WhatsApp se da por cerrado sin probarlo en un Android y en la web** — el CI no alcanza, porque verifica URLs, no lo que ve la persona.

- Spec completa, tablas y verificación: `docs/reglas-whatsapp.md`. Tests que vigilan las reglas: `tests/security/whatsapp-contacto.test.ts` (botones de la landing) y `tests/security/enlace-oferta-whatsapp.test.ts` (enlaces firmados `/c/:id`).

## Reglas inquebrantables — Yuddit es PULL, no PUSH

**Yuddit solo RESPONDE consultas. Nunca empuja.** Decidido por el dueno el 2026-10-21.

| | |
|---|---|
| **Si (PULL)** | La persona escribe al bot (o se registra en la web) y el bot responde. La persona pide ofertas, el bot las manda. |
| **No (PUSH)** | El negocio inicia un contacto: campañas, "te avisamos cuando haya ofertas nuevas", resumen diario, recordatorios, avisos de que algo nuevo apareció. |

Consecuencias practices:

- **Ningun texto puede prometer un envio proactivo.** Nada de "te avisaremos", "te aviso cuando entren ofertas nuevas", "recibirás más ofertas", "resumen diario", "te escribimos". Si el bot no tiene nada nuevo que mostrar, se lo dice y la persona vuelve a escribir.
- **La unica forma de que alguien reciba algo es que haya escrito.** Por eso el bot responde al mensaje del boton "Lo quiero" aunque ya le haya mandado esa oferta: es una peticion suya.
- **El bot de WhatsApp no tiene envios programados a nadie.** Si alguna vez se quisiera, hay que pedirlo explicitamente y cambiar esta regla.
- **El opt-out significa "dejar de RESPONDER"**, no "dejar de notificar": el bot contesta "ya no te respondemos con ofertas; si quieres volver, escribenos *Ofertas*".
- **El digest es el otro canal y no viola la regla**: es por CORREO, con consentimiento explicito (`consentimientos.correo`), y es el unico envio proactivo de Yuddit. La regla de pull/no-push es del bot de WhatsApp. Cuando se implemente de verdad, tiene que salir de la tabla de consentimiento, no de un "te avisaremos" del bot.

Hay un test que vigila esta regla (`tests/security/pull-no-push.test.ts`): escanea el texto que ve la persona y falla si vuelve a aparecer una promesa de envio proactivo.

## Commands

```bash
npm run dev      # tsx server.ts — the ONLY dev server (API + bot + static SPA), port 3000
npm run build    # vite build -> dist/  (server serves dist/ statically)
npm test         # bun test tests/security
npm run lint     # type gate: fails only on NEW type errors (baselined)
```

Focused runs:

```bash
bun test tests/security/auth.contract.test.ts        # single file
BASE_URL=https://yuddit.com VUUV_ADMIN_EMAIL=... VUUV_ADMIN_PASSWORD=... ./scripts/ofertas-tests.sh   # tests/ofertas (needs Docker + python3)
BASE_URL=http://localhost:3000 ./scripts/security-smoke.sh                                            # 12 curl checks
./scripts/set-admin-password.sh                                                                       # rotate admin password without writing it to disk
./scripts/ci/run-contract-tests.sh                          # what CI runs: boots the server, runs tests/security, writes results/security.xml
bun scripts/ci/assert-tests-ran.mjs results/security.xml --min 80   # fails if tests were skipped or below the floor
```

## Verification gotchas (read before trusting a green run)

- `npm run lint` is **not** a plain `tsc`. It runs `scripts/typecheck-baseline.mjs`, a type gate that freezes the pre-existing errors in `typecheck-baseline.json` (59 at the time of writing) and exits 1 only when a **new** error appears. `npm run typecheck` is the raw `tsc --noEmit`; `npm run typecheck:baseline` regenerates the baseline (review that diff). `npm run build` is a bare `vite build`, and the Dockerfile asserts `dist/index.html` exists, because `dist` is in `.dockerignore` and a failed Vite build used to ship an image that served no SPA. **Do not re-add `|| true`.**
- `tsconfig.json` has `include: ["server.ts", "src/**/*.ts", "src/**/*.tsx"]`. `tsc` would follow imports from `server.ts` anyway, but the explicit globs are what pull in the React layer and the modules unreachable from the server. Without them, 10 real errors were invisible.
- **HTTP 200 does not prove the SPA works.** `curl` returned 200 with the full HTML, the CSS and a 1.68 MB bundle while `yuddit.com` rendered a blank page — a module-level `ReferenceError` kills the entire script, and no `try/catch` or `ErrorBoundary` can observe it. **The browser bundle must never import `src/db/`**: `src/db/index.ts` creates the pg `Pool` at module scope and uses `global`, which does not exist in a browser. `src/modules/facturacion.ts` is the one client-reachable module that needs the DB layer, so it loads it lazily (`import('../db/repo')`) behind a `window`/`document` guard, and the DB ends up in a separate chunk the client never requests. `tests/security/client-bundle-no-db.test.ts` walks the **static** import graph from `src/main.tsx` and fails if anything reachable touches `src/db/`. Keep it green, and never verify a frontend change with `curl` alone.
- Tests are **black-box HTTP contract tests**. They `describe.skipIf(...)` when the server is unreachable (`TEST_BASE_URL`, default `http://localhost:3000`) or when credentials are missing. A fully green suite can mean nothing ran. Start the server and export `VUUV_ADMIN_EMAIL` / `VUUV_ADMIN_PASSWORD` (and `VUUV_COMMERCE_*` for role tests) before relying on results.
- **"Verde" no significa "verificó"** (medido el 2026-10-19 en este repo): con el servidor arriba y credenciales, `tests/security` corre **90 tests, 0 saltados**; con el servidor caído, **23 tests se saltan y la suite igual da 0 fallos** — o sea, queda **verde y vacía**. Por eso CI no se limita a correr los tests: `scripts/ci/assert-tests-ran.mjs` falla si hay tests saltados o si se ejecutaron menos del mínimo. Si borras o desactivas media suite, actualiza el `--min` **a propósito** y déjalo escrito.
- `bun` is installed at `/root/.bun/bin/bun` but is **not on `PATH`**, so `npm test` (which runs `bun test tests/security`) fails with `exit 127`. Run it as `$HOME/.bun/bin/bun test tests/security`, or put bun on `PATH`. `tsx` and `vite` are available via `node_modules/.bin`.
- The CI job needs **two** databases: the app runs on `SQL_DB_NAME` and the billing tests on `TEST_SQL_DB_NAME`. The billing tests `drop table if exists click_packs` and recreate it with their own shape, so pointing them at the app's database would break the app's schema. `scripts/ci/create-test-db.mjs` creates the second one with the `pg` client (no `psql` needed on the runner).
- `tests/ofertas/` is not covered by `npm test`; it needs DB fixtures seeded, an app **restart** (offers and click packs are loaded in memory), then cleanup — `scripts/ofertas-tests.sh` orchestrates all of that with a `trap EXIT`.

## Architecture

- `server.ts` (~171 KB, 432 lines, lines up to ~28 KB) is the **entire backend**: ~50 endpoints, Baileys/WAHA WhatsApp engine, auth gate, rate limiting, SSRF/webhook guards, static serving. Also minified/one-line: `src/db/schema.ts`, `src/db/repo.ts` (partially), `src/db/index.ts`, `src/core/events.ts`, `src/services/aiService.ts`. **Patch these with surgical string edits; never prettify, reformat, or "clean up" them.**
- Domain logic lives in `src/modules/*` (`ofertas`, `comercios`, `facturacion`, `usuarios`, `clics`, `banners`, `puntos`, `analitica`, `digest`, `seoMetadata`, `emailService`); DB access is centralized in `src/db/repo.ts`; guards/card rendering in `src/utils/*`.
- Frontend entry: `index.html` -> `src/main.tsx` -> `src/App.tsx` (path-based routing: `/gestion`, `/comercio`, root panel, login). Vite alias `@` = repo root.
- Client auth is in `src/core/security.ts`: stores the session token and installs a `fetch` interceptor that adds `Authorization: Bearer <token>` to every `/api/` call.
- **New endpoints must be registered in `esRutaPublica` in `server.ts`** if they should be public; the global `/api` gate 401s anything not allowlisted.

## Reglas inquebrantables — credenciales y datos en base

- **Los usuarios de autenticación viven en la tabla `auth_users`, no en un blob JSON.** Cada alta, cambio de clave, MFA y consumo de código de respaldo es una sentencia SQL puntual sobre la fila del usuario (`actualizarAuthUser`, `crearAuthUser`, `eliminarAuthUser`, `consumirHashRespaldo` en `server.ts`). **Nunca** reescribas el array completo de usuarios: eso era el read-modify-write que perdía actualizaciones concurrentes (punto 12 de la auditoría). El test `tests/security/auth-users-table.test.ts` lo vigila, incluso con altas concurrentes.
- **El blob `app_settings.auth_users` queda congelado** como respaldo histórico, igual que `click_packs_list`. No se lee para escribir y no se vuelve a escribir.
- **Si la tabla no está disponible, la app entra en modo degradado**: lee el blob para que nadie se quede sin poder entrar, pero **no escribe** (escribir en una tabla que no se lee deja dos copias divergentes). El modo degradado se registra con `[Auth] CRITICO` en el log.
- **La siembra nunca pisa credenciales existentes**: solo siembra si la tabla **y** el blob están vacíos. En producción no hay `VUUV_ADMIN_PASSWORD`, así que una siembra sobre un blob con usuarios dejaría al administrador con una clave aleatoria.
- **El bloqueo por intentos fallidos de login vive en la tabla `login_failures`, no en memoria.** Con dos instancias, un contador en memoria se elude alternando instancias; y un reinicio lo borraba. `registrarLoginFallidoDb` hace el incremento y el bloqueo en **una sola sentencia** (upsert), así que dos intentos simultáneos no se pisan. El `Map` en memoria queda **solo como respaldo** si la base no responde.
- **Al arrancar, la app avisa si hay otra instancia viva** (toma un advisory lock de Postgres en una conexión **dedificada**, fuera del pool: una conexión del pool podría reciclarse y liberar el lock). Si aparece el aviso `[Instancia] CRITICO`, el sitio funciona pero **los rate limits son por proceso**: el límite efectivo se multiplica por el número de instancias. Antes de escalar, muévelos a Redis.
- **Migrar antes de desplegar**: `bun scripts/migrate-auth-users.mjs` (con `--dry-run` para ver) mueve los usuarios a la tabla y verifica que las claves coincidan. La app también migra al arrancar, pero en producción conviene hacerlo a mano y comprobarlo.

## Reglas inquebrantables — el esquema de la base

- **El esquema se cambia con migraciones versionadas, nunca con `push`.** El entrypoint ya no hace `drizzle-kit push` (que alteraba producción en cada deploy sin que nadie lo revisara): hace `drizzle-kit migrate`.
- **Cómo se cambia el esquema** (en este orden, en el mismo PR):
  1. Se edita `src/db/schema.ts`.
  2. `bunx drizzle-kit generate --config=src/db/drizzle.config.ts --name=lo_que_sea` → genera `src/db/migrations/00NN_*.sql` + `meta/`.
  3. **Se revisa el SQL generado** (es lo que se va a ejecutar en producción).
  4. Se commitea el `.sql` **y** la carpeta `meta/`.
- **Nunca edites a mano** `src/db/migrations/*.sql` ni `meta/_journal.json`: drizzle compara el esquema contra el último snapshot, y tocarlo a mano desincroniza la generación siguiente.
- **La migración base (`0000_baseline`) ya está aplicada en producción.** Se marcó con `scripts/mark-migrations-applied.mjs` (que además **verifica que las tablas existan** antes de marcar nada: marcarla sobre una base vacía dejaría el esquema sin crear para siempre). Las migraciones nuevas se aplican solas en el siguiente deploy.
- **Un cambio de esquema sin migración es un bug**: en un entorno nuevo la tabla no existiría. El test `tests/security/migrations-versionadas.test.ts` lo detecta (compara las tablas del esquema con las de las migraciones).

## Data & persistence

- Postgres via Drizzle. `src/db/schema.ts` is the source of truth. The schema is applied by **versioned migrations** in `src/db/migrations` (`drizzle-kit migrate`, run by `docker-entrypoint.sh` before the app starts). **There is no `drizzle-kit push` anymore** — see "Reglas inquebrantables — el esquema de la base" for how to change the schema.
- `docker-entrypoint.sh` rewrites `SQL_HOST` for the known production container and reads `SQL_ADMIN_USER`/`SQL_ADMIN_PASSWORD` (falling back to `SQL_USER`/`SQL_PASSWORD`); without them it skips the push and still starts.
- Runtime state is partly in memory (offers, the click-pack read cache, WAHA session, login lockout, rate-limit buckets) — restart the app after changing DB rows that the app caches. Pack balances live in the `click_packs` table, the source of truth; `app_settings.click_packs_list` is frozen legacy data read once, only to seed an empty table. The debit is a single atomic `UPDATE ... RETURNING` (`debitarClicAtomico` in `src/db/repo.ts`), so that read cache only affects what is *shown*, never what is *billed*.

## Conventions

- UI copy, bot replies, prompts, and docs are **Spanish**; identifiers and code stay English. Commits are Conventional Commits with Spanish descriptions, no AI attribution.
- Brand was renamed `vuuy` -> `Yuudit` -> `Yuddit`, but the legacy `VUUV_*` env vars, `vuuy_sesion` cookie, and `vuuy` socket name are intentional. Do not rename them.
- Secrets: passwords are scrypt-hashed in `app_settings.auth_users`; never write plaintext credentials to files. `.env` is gitignored, `.env.example` documents the contract (`APP_URL` > `PUBLIC_URL` > `COOLIFY_URL` > `COOLIFY_FQDN`).
- Billing/security invariants exist because they were bugs: click `/c/:id` only bills when the link carries a valid HMAC (`registerOfferClick`); one billable click per 24 h window per (offer, phone); likes never bill; webhooks fail closed; `imageUrl` passes an SSRF allowlist. Preserve these.
- **Billing decision (2026-10-19):** `registerOfferClick` is deliberately **fail-closed**. If the 24 h dedup read fails or the `click_logs` insert fails, `facturable` is `false` and the click is not billed (the user still gets redirected). Do not "fix" this into a retry-or-bill path without reading `docs/auditoria-2026-10-19.md` point 1.
- **`VUUV_PII_KEY` is required in any environment holding real user data.** Without it, `piiHabilitado()` is false and all PII is stored in **plaintext** with only a `console.error` at boot. 32 bytes, hex (64 chars) or base64. Losing or changing the key makes already-encrypted rows permanently unreadable (`descifrarCampo` returns the raw blob). Local tests set it themselves (`tests/security/pii.test.ts`).

## Repo docs (hand-written, Spanish)

- `FLUJOS.md` — per-feature request/response flows, tables touched, and how to verify each one (F1–F12).
- `odd/tasks/mapa-del-sistema.md` — **mapa verificado del sistema** (estado real, no documentado): 69 endpoints verificados uno por uno contra produccion, 14 tablas con sus filas reales, el inventario de los 28 eventos (y por que no se persisten) y 14 hallazgos con consecuencia de negocio. Es el mapa de referencia antes de tocar cualquier cosa.
- `INVENTARIO.md` — snapshot del 2026-10-16, **desactualizado**: dice 50 endpoints (hoy 69) y describe un estado que ya cambio. Solo como referencia historica; el vigente es `odd/tasks/mapa-del-sistema.md`.
- `docs/cambio-dominio-yuddit.md` — domain migration runbook; `docs/flujo-consulta-ofertas.md` — offers query flow.
- `docs/reglas-whatsapp.md` — spec of the WhatsApp links: app choice per platform, endpoint, tracking tables, security rules, how to verify.
- `odd/tasks/fase-canje-y-referidos.md` — fase de canje y referidos (pendiente de arranque; el dueno la postergo). Ojo: hay TRES codigos distintos y ninguno cierra su circuito: `REF#####` (referido, no acredita puntos ni tiene link de registro), `NV-XXXXXX` (atribucion del clic; el bot ya lo usa, pero el comercio no tiene donde consultarlo) y el codigo de canje de premios (vive en un `Map` en memoria del navegador: se pierde al recargar y dos comercios pueden canjear lo mismo).
- `odd/tasks/fase-seo-indexacion.md` — fase SEO/indexacion (pendiente de arranque; el dueño la priorizó como crítica). Antes de tocar la landing: la SPA sirve 1 KB de HTML, el contenido de ofertas viene de la base, y **cualquier pre-render NO puede incluir el número de WhatsApp en el HTML** (misma regla que `docs/reglas-whatsapp.md`: el número se resuelve en el servidor al momento del clic).

## Deploy

Push to `main` -> Coolify auto-deploy. Deploys run the schema push, so any change to `src/db/schema.ts` takes effect on the next deploy.

CI lives in `.github/workflows/ci.yml` (two jobs: type gate + build + contract tests against a booted server + billing tests, and a build/boot of the production image). **CI does not gate the deploy**: Coolify deploys on the push, not on a green check, so a red CI means the bad commit is already live — fix forward fast, and check the *served* artifact, not just the code.

## Local checkout quirk

`git` here fails with `detected dubious ownership`. Prefix commands with `git -c safe.directory=/home/ubuntu/nuuvio-googleaistudio ...` instead of editing global git config.

## Agent skills

### Issue tracker

GitHub Issues de `rogerv2-ops/Nuuvio-GoogleAIStudio`, vía el CLI `gh`. Un cambio llega como issue y sale como pull request. Ver `docs/agents/issue-tracker.md`.

### Triage labels

Las cinco etiquetas canónicas: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. Ver `docs/agents/triage-labels.md`.

### Domain docs

Layout **single-context**: un `GLOSSARY.md` en la raíz y las decisiones en `docs/adr/`. Antes de explorar, leer el glosario y los ADR del área; si tu output contradice un ADR, dilo en vez de pisarlo. Ver `docs/agents/domain.md`.
