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

## 3. Postgres `nuuviopsg` (9 tablas, con datos)
`app_settings(merchants_list, merchants_kanban, whatsapp_config)`, `offers(6)`,
`banners(3)`, `audience_users(8)`, `chat_logs(nueva, vacía)`, `click_logs`,
`email_logs`, `registration_logs`, `users`. Patrón: carga-si-existe, siembra-si-vacío.

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
