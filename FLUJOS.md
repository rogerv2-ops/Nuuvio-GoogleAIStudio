# FLUJOS nuuvio — qué hace cada endpoint y quién lo llama

Leyenda: 🟢 verificado 200 · 🟡 existe, sin probar E2E · 🔴 pendiente

## F1. Vinculación WhatsApp (Baileys, canal `waha`)
Actor: admin en `WhatsAppConfigPanel` / `WahaQrModal`.
1. `POST /api/waha/session/start` → arranca motor (o reutiliza), espera QR hasta 2.5s → `{status, qrDataUrl, expiresAt}` (QR vive 45s). 🟢
2. `GET /api/waha/session/status` → polling de estado (`STOPPED/STARTING/SCAN_QR_CODE/WORKING`). 🟢
3. `GET /api/waha/session/qr?force=true` → fuerza QR nuevo (borra credenciales). 🟡
4. `POST /api/waha/session/pairing-code {telefono}` → código de 8 dígitos para vincular sin QR. 🟡
5. Teléfono escanea → evento `open` → `wahaSession=WORKING`, guarda `whatsapp_config` (número) + respalda auth a DB. 🟡 (último intento: loop `loggedOut`, fixeado)
6. `POST /api/waha/session/logout` → cierra socket, borra disco Y DB. 🟡
7. `GET /api/whatsapp/config` → config + sesión actual (lo que ve el panel). 🟢
8. `POST /api/whatsapp/config` → guarda modo (`meta|waha`), meta, waha, número en `app_settings`. 🟡

## F2. Mensaje entrante real (usuario → bot)
1. Baileys `messages.upsert` (o `POST /api/waha/webhook` externo, o Meta `POST /api/whatsapp/webhook`) → `procesarMensajeEntrante({from, body, senderPhone, canal})`.
2. Valida/distrito (Lima), registra o actualiza usuario en `audience_users`, despacha 5 ofertas (`dispatchFiveOffers`), responde por el mismo socket.
3. Cada mensaje → `messageLogs` (memoria) + `chat_logs` (DB, nuevo). 🟡 E2E real pendiente de probar con sesión vinculada.
4. `POST /api/whatsapp/simulate-incoming` → mismo flujo sin WhatsApp (testing). 🟡
5. `GET /api/whatsapp/logs` → historial del panel (desde `chat_logs`). 🟡
6. `POST /api/whatsapp/test-message` → envío manual de prueba. 🟡

## F3. Ofertas (comercio propone → admin aprueba → público ve)
- Comercio crea en `MisOfertasComercioView` (imagen obligatoria vía `/api/media/upload`) → `ofertasModule.crearOferta` → estado revisión.
- `POST /api/ofertas/sync` / `activar` / admin `OfertasDomainView` aprueba→publica (`syncOffers` → Postgres). 🟡
- Público: `GET /api/ofertas` (DB) → `PublicWeb`. 🟢
- `POST /api/ofertas/:id/like` → suma like y persiste. 🟡
- Compartir: `/c/:ofertaId`, `/api/go/pedir?ofertaId=`, `/go/pedir` → redirect a `api.whatsapp.com/send` con texto. 🟡

## F4. Banners (admin)
- `BannersConfigView`: URL o archivo → `/api/media/upload` → `POST /api/banners/sync` (`syncBanners`). `GET /api/banners` alimenta web. 🟢 (upload y lectura verificados; sync UI pendiente de clic)

## F5. Comercios (admin + panel comercio)
- `GET /api/comercios` (DB, 10) 🟢 · `POST /api/comercios/sync` persiste lista+kanban (`merchants_list`, `merchants_kanban`). 🟡
- Vistas: `MiNegocio`, `MisOfertas`, `Resultados`, `Ventas`, `Historial`, `Campañas` (leen/escriben vía estos + módulos locales). 🟡 sin probar una por una.

## F6. Usuarios / audiencia (registro público)
- Funnel `UserRegistrationFunnelModal` → `POST /api/audience/sync-user` (upsert + log) → `GET /api/audience/users` (8 en DB 🟢).
- `check-uniqueness` (email/tel duplicados), `purge-user`, `clear-all-registration-logs`, `registration-logs` (+DELETE) → auditoría. 🟡
- Email verify: `POST /api/email/send-verification` → `GET /api/verify-email?token` → redirect `/bienvenida`; `GET /api/audience/verify-token`. 🟡 (requiere email_config)

## F7. Email (admin `EmailConfigModal`)
- `GET/POST /api/email/config` (Resend o SMTP → `app_settings`), `POST /api/email/test`, `GET /api/email/logs`. 🔴 `email_config` vacía: sin probar.

## F8. Media e IA
- `POST /api/media/upload {dataUrl, folder}` → sharp WebP 1600px q80 → `/uploads/...` (disco persistente). 🟢 verificado.
- `GET /uploads/*` estático; `GET /api/media/video/:id` streaming con rangos. 🟡
- `POST /api/gemini/generate-video {imageBase64|imageUrl, prompt, aspectRatio}` → Veo o fallback ffmpeg → `/videos/*.mp4` (volumen nuevo). 🟡
- `POST /api/gemini/video-status` → polling del job. 🟡
- `POST /api/ai/test|generate` (gemini/openai/anthropic/openrouter). 🟡

## F9. Sistema
- `GET /api/version` (timestamp deploy, rompe caché) 🟢 · `POST /api/cache/purge` 🟡.
- Meta verify: `GET /api/whatsapp/webhook?hub.mode=subscribe` (modo `meta`, sin usar hoy).

## Mapa de llamadas (quién→qué)
- `PublicWeb` → banners, ofertas, audience/sync, go/pedir, verify.
- `AdminPanel`/gestión → banners/sync, ofertas/sync+activar, comercios/sync, audience/*, email/*, whatsapp/config+test, cache/purge.
- `MerchantPanel` → ofertas (crear vía módulo), comercios, gemini/video, audience.
- `WhatsAppConfigPanel/WahaQrModal` → waha/session/*, whatsapp/config.
- WhatsApp red → webhooks entrantes → procesarMensajeEntrante → Baileys send + chat_logs.
