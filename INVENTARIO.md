# INVENTARIO nuuvio — estado al 2026-10-16 17:15 UTC
Fuente de verdad: repo `main` + DB + contenedores. Verificado con evidencia.

## 1. Backend (server.ts — 50 endpoints, todos responden)

| Área | Endpoints | Estado |
|---|---|---|
| WhatsApp config | GET/POST `/api/whatsapp/config`, GET `/api/whatsapp/webhook`, POST webhook, POST `simulate-incoming`, POST `test-message`, GET `logs` | ✅ config verificado 200 JSON |
| WAHA sesión | POST `start`, GET `status/qr`, POST `pairing-code/logout`, POST `/api/waha/webhook` | ✅ QR genera; Baileys 7.0.0-rc14 |
| Banners | GET `/api/banners`, POST `/api/banners/sync` | ✅ desde Postgres (3) |
| Ofertas | GET `/api/ofertas`, POST `sync/activar/:id/like` | ✅ 6 en DB |
| Comercios | GET `/api/comercios`, POST `/api/comercios/sync` | ✅ 10 en DB |
| Audiencia | `users/sync-user/check-uniqueness/purge/verify/*`, `registration-logs/*`, `log-registration` | ✅ 8 usuarios |
| Email | `config/logs/send-verification/test` | ⚠️ `email_config` nunca guardada (sin API key) |
| Media | POST `/api/media/upload`, GET `/api/media/video/:id` | ✅ upload→WebP verificado 200 |
| IA/Video | POST `/api/ai/test|generate`, POST `/api/gemini/generate-video|video-status` | ⚠️ sin probar con GEMINI (quota?) |
| Go/links | `/api/go/*`, `/go/*`, `/c/:ofertaId` | ✅ redirects |
| Sistema | GET `/api/version`, POST `/api/cache/purge` | ✅ |

## 2. Frontend (restaurado de 938a8a8 en rama restore/admin-ui → main)
- Entry real: `index.html → /src/main.tsx → App.tsx` ✅ compila (vite 25s)
- Gestión (`/gestion`): Ofertas, Banners, Comercios, Usuarios, Configuración, Comunicaciones, Analítica, CampañasCobro, ProveedoresIA, PanelGeneral
- Comercio (`/comercio`): Inicio, MisOfertas, MiNegocio, Resultados, Ventas, Historial, Campañas
- Panel admin raíz, login, bienvenida, registro, WhatsAppConfigPanel, WahaQrModal
- ⚠️ Sin probar vista por vista en browser (solo bundle contiene los endpoints)

## 3. Postgres `nuuviopsg` (10 tablas, con datos)
`app_settings(merchants_list, merchants_kanban, whatsapp_config, auth_secret, auth_users, auth_reset_tokens, click_packs_list)`, `click_packs` (saldos; el blob `click_packs_list` quedó como legacy), `offers(6)`,
`banners(3)`, `audience_users(8)`, `chat_logs`, `click_logs`,
`email_logs`, `registration_logs`, `users`, `security_logs`. Patrón: carga-si-existe, siembra-si-vacío.

## 3.b Seguridad (implementado 2026-10-16, commit a313d0d)
- **Auth de servidor**: `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`,
  `GET/POST /api/auth/users`, `PUT/DELETE /api/auth/users/:id`, `POST /api/auth/password`
  (autoservicio o admin). Token HMAC-SHA256; secreto en `app_settings.auth_secret`;
  credenciales (scrypt) en `app_settings.auth_users`.
  Gate global `/api` con allowlist pública (`/api/version`, `/api/banners`, `/api/ofertas`,
  webhooks, `POST /api/auth/forgot-password` y `POST /api/auth/reset-password`).
- **Recuperación de contraseña**: `POST /api/auth/forgot-password` (público, rate-limit `reset` 5/15min,
  respuesta genérica sin enumerar cuentas) genera código temporal (15 min) con hash en
  `app_settings.auth_reset_tokens` y lo despacha por Resend/SMTP (`enviarCorreo`). Si no hay proveedor
  configurado, el código queda solo en logs del servidor. `POST /api/auth/reset-password` valida
  código+expiry (un solo uso) y reemplaza el hash scrypt.
- **Bloqueo por fuerza bruta**: tras 5 intentos fallidos de login por correo, cuenta bloqueada 15 min
  (HTTP 423 + `bloqueado`/`segundosRestantes`); se limpia en login/reset exitoso. Estado en memoria.
- **Roles**: `requireAdmin` en endpoints destructivos/config (audience users/purge/logs,
  whatsapp config, email config/test, cache/purge, waha/session start·logout·pairing·qr,
  banners/sync, comercios/sync, simulate-incoming). Comercio conserva ofertas/sync,
  media/upload, gemini/ai, test-message.
- **Rate limit** en memoria por bucket: login 10/5min, messaging 30/min, ai 30/min, global 300/min → 429 + `Retry-After`.
- **Cabeceras**: `X-Content-Type-Options`, `X-Frame-Options`, CSP (`frame-ancestors 'self'`),
  `Referrer-Policy`, `HSTS` (https), `Permissions-Policy`; CORS por `APP_ALLOWED_ORIGINS`.
- **SSRF**: allowlist de host por proveedor IA (gemini/openai/anthropic/openrouter) y
  `validarUrlExternaPermitida` (DNS + bloqueo de rangos privados/loopback/link-local) en `imageUrl`.
- **Webhooks**: Meta firma `X-Hub-Signature-256` (HMAC sobre rawBody, `WHATSAPP_APP_SECRET`);
  WAHA secreto compartido (`WAHA_WEBHOOK_SECRET`); fail-closed en producción.
- **Media**: `resolverRutaSegura` (anti-traversal, 400) y `validarRangeCabecera` (416).
- **Auditoría**: tabla `security_logs` + `logEventoSeguridad` (login ok/fallido, denegado 401/403,
  rate limit, credenciales, webhooks rechazados).
- **Tests**: `bun test tests/security` (unit + contrato black-box) y `scripts/security-smoke.sh`.
- **Credenciales**: las contrasenas viven **solo hasheadas** (scrypt + salt) en `app_settings.auth_users`; no se guardan en archivos ni variables de entorno (las `VUUV_*_PASSWORD` solo siembran en el primer arranque y no estan definidas en prod). Para rotar una clave sin escribirla a disco: `./scripts/set-admin-password.sh` (lee con `read -s`, viaja por HTTPS con `--data @-`). Si se filtra, rotar de inmediato.

## 3.c Ofertas: mosaico 1:1, clics CPC y "Me Gusta" (2026-10-17, commit 1eb2bfa)
- **Mosaico**: `dispatchOffersMosaic` envía hasta **3** ofertas en **un solo mensaje** (imagen vertical de segmentos **1:1** numerados + caption con título/precio/enlace). Excluye ofertas de comercios **sin saldo** (`comercioTieneSaldo`).
- **Tarjeta**: `renderOfferCardImage` **800×800** sin corazón; landing `aspect-square` sin título/descripción duplicados.
- **CPC** `GET /c/:ofertaId` (rate limit `clicks` 20/60 s): `registerOfferClick` → `click_logs`; **1 clic facturable por ventana de 24 h** anclada al último clic facturable; debita `click_packs` (un único `UPDATE ... RETURNING` atómico; nunca < 0) e incrementa `leadsCalificados`; sin saldo ⇒ no facturable; `302` a WhatsApp del comercio con `NV-####`.
- **Me Gusta** `POST /api/ofertas/:id/like` (rate limit `likes` 30/60 s): **informativo, no factura**; `incrementOfferLikes` atómico sobre `offers.likes`.
- **Spec-Kit**: `specs/002-ofertas-mosaico-cpc/`.
- **Tests**: `tests/ofertas/{cpc,likes,mosaic}.*.test.ts` + `scripts/ofertas-tests.sh` (siembra fixtures de prueba, reinicia, corre `bun test`, verifica débito en DB y limpia). 10 pass en prod.
- **Verificado en prod**: 302+código, dedup 24 h, pack 80→78 en 2 facturables, rate limits (20/30→429), like persiste; datos de prueba limpiados.

## 4. Infra
- App `pnpsnjshl9...` (Dockerfile, bun start :3000) + entrypoint auto-migrate
- PG `oa0t...` healthy + volumen datos; app vols: auth, data, videos
- Env Coolify: SQL_* + GEMINI_API_KEY + NODE_ENV=production(runtime only)
- Deploy: push→main→auto-deploy. ⚠️ Sin backups off-site de PG.

## 5. Deuda / pendientes
1. Vinculación QR por confirmar con Baileys 7 (último error: loop loggedOut, ya fixeado en código + DB limpia).
2. Probar vistas admin una por una en browser.
3. `email_config` sin configurar (sin Resend/SMTP).
4. Sin backups externos de Postgres.
5. `messageLogs` previos al deploy de chat_logs se perdieron (solo-memoria); desde ahora persisten.
6. `server.ts` y `repo.ts` minificados a una línea: todo cambio ahí con patch quirúrgico + build check.
