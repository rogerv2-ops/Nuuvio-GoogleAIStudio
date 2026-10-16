# FLUJOS DETALLADOS nuuvio
Cada flujo: actor → pasos con request/response → tablas → cómo verificarlo.

## F1. Vinculación WhatsApp (canal waha, Baileys 7.0.0-rc14)
**Actor:** admin en `WhatsAppConfigPanel` / `WahaQrModal`.
**Estado interno:** `wahaSession {status, phone, name, qrDataUrl, qrExpiresAt(45s), pairingCode, startedAt}` (memoria).

1. `POST /api/waha/session/start` `{}` → `iniciarMotorWhatsApp(false)`:
   - Si hay socket WORKING, reutiliza. Si no, `useMultiFileAuthState(/app/auth_info_baileys)` + `fetchLatestBaileysVersion` + `makeWASocket(browser: vuuy Asistente/Chrome)`.
   - Espera máx 2.5s el QR. Responde `{ok, status: SCAN_QR_CODE, qrDataUrl: data:image/png..., expiresAt, phone: null}`.
2. Frontend hace polling `GET /api/waha/session/status` y muestra el QR.
3. Admin escanea con el teléfono (WhatsApp → Dispositivos vinculados) en <45s.
4. Evento `connection.update=open` → `status=WORKING`, `phone=+51...`, `name`, limpia QR; guarda `whatsapp_config` (número) y respalda auth a DB (`whatsapp_auth_files`).
5. Alternativa sin cámara: `POST /api/waha/session/pairing-code {telefono: "519..."}` → `{pairingCode: "XXXX-XXXX"}` → ingresarlo en el teléfono.
6. `POST /api/waha/session/logout` → `sock.logout()`, borra disco Y DB, `status=STOPPED`.
7. Si el usuario desvincula **desde el teléfono**: evento `close/loggedOut` → limpia disco+DB (fix df36d33), próximo `start` genera QR fresco.
**Tablas:** `app_settings(whatsapp_config, whatsapp_auth_files)`. **Disco:** `/app/auth_info_baileys` (volumen).
**Verificar:** `curl -X POST .../start` → `SCAN_QR_CODE`; tras escanear, `status` → `WORKING` + `phone`.

## F2. Mensaje entrante → respuesta del bot
**Actor:** usuario final por WhatsApp. **Entradas:** socket Baileys `messages.upsert`, `POST /api/waha/webhook {event: message, payload}`, o Meta `POST /api/whatsapp/webhook`.
1. Extrae texto (`conversation/extendedText/caption`), ignora grupos (`@g.us`), resuelve LID→teléfono.
2. `procesarMensajeEntrante({from, body, senderPhone, pushName, canal})`:
   - Flujo comercio (pedir oferta, registrar negocio) o audiencia.
   - Detecta distrito Lima (`detectLimaDistrict`); si es primer mensaje sin zona, la pide.
   - `dispatchFiveOffers`: filtra ofertas por distrito, arma tarjetas (imagen vía `renderOfferCardImage`) y las envía por el socket (`sendMessage`).
   - Registra/actualiza `audience_users` (nombre pushName, teléfono, distrito, etapa).
3. Cada mensaje (entra/sale) → `messageLogs` + `insertChatLog` → `chat_logs`.
4. Testing sin WhatsApp: `POST /api/whatsapp/simulate-incoming {telefono, texto, pushName?, hasImage?, imageUrl?}` → ejecuta el mismo pipeline con `replySender` simulado → `{respuestasGeneradas, respuestas[]}`.
5. `GET /api/whatsapp/logs` → historial (DB). `POST /api/whatsapp/test-message` → envío manual.
**Tablas:** `audience_users`, `offers` (vistas/clics), `chat_logs`. **Probar:** simulate-incoming con `{"telefono":"519...","texto":"ofertas en Miraflores"}`.

## F3. Ofertas: comercio → revisión → público
1. Comercio (`MisOfertasComercioView` o `ComercioLayout` modal): formulario con foto obligatoria → archivo sube a `/api/media/upload` (WebP 1600px) → `imagenUrl=/uploads/...` → `ofertasModule.crearOferta({...imagenes:[url]})` estado revisión. Sin subida OK no deja publicar (fail-hard).
2. Admin (`OfertasDomainView`): ve pendientes, aprueba (`POST /api/ofertas/activar`) o rechaza con motivo → `syncOffers` → Postgres.
3. Público (`PublicWeb`): `GET /api/ofertas` → tarjetas con imagen, precio, comercio, botón pedir.
4. `POST /api/ofertas/:id/like` → `likes+1` persistido. `POST /api/ofertas/sync` → bulk admin.
5. Pedir: `/c/:ofertaId` o `/api/go/pedir?ofertaId=` → 302 a `api.whatsapp.com/send?phone=BOT&text=Hola, quiero la oferta: ...`.
**Tablas:** `offers`, `click_logs` (canjes). **Probar:** crear oferta, aprobarla, verla en `GET /api/ofertas`.

## F4. Banners
`BannersConfigView`: pestaña URL o archivo → upload a disco (`banners/`) → preview → Guardar → `POST /api/banners/sync {banners[]}` → `syncBanners` (upsert por id). `GET /api/banners` → `PublicWeb` header. Regla server: URLs sustrae/banner.webp se normalizan al banner local. **Probar:** subir imagen, `GET /api/banners` trae `/uploads/banners/...`.

## F5. Comercios y panel comercio
- `GET /api/comercios` → 10 comercios DB. `POST /api/comercios/sync {comercios, kanban}` → `merchants_list` + `merchants_kanban` (settings).
- Vistas comercio: Inicio (resumen), MisOfertas (CRUD propio), MiNegocio (datos), Resultados/Ventas (de `click_logs`+clics), Historial, Campañas. Todo vía estos endpoints + `facturacionModule.cargarDeDB` (click packs).
**Probar:** `GET /api/comercios` 🟢 ya verificado.

## F6. Usuarios y registro
- `UserRegistrationFunnelModal` (+ `/bienvenida?verify_token=`): `POST /api/audience/sync-user {id, email, telefono, nombre...}` → upsert + `registration_logs(success)`.
- `POST /api/audience/check-uniqueness {email, telefono}` → bloquea duplicados.
- Auditoría: `GET /api/audience/registration-logs`, `DELETE .../:id`, `POST clear-all`, `POST /api/audience/purge-user {id|email}` (borra usuario + sus logs).
- Email: `POST /api/email/send-verification` → `GET /api/verify-email?token` → activa (`emailVerificado`, `estado=activo`) → redirect bienvenida. `GET /api/audience/verify-token` valida.
**Tablas:** `audience_users`, `registration_logs`, `email_logs`.

## F7. Email (Resend/SMTP)
`EmailConfigModal` → `GET/POST /api/email/config` → `app_settings(email_config)` (apiKey, from, provider). `POST /api/email/test {destinatario}` → envía prueba real. `GET /api/email/logs`. 🔴 Sin credenciales: pendiente configurar.

## F8. Media, video e IA
- Upload: `POST /api/media/upload {dataUrl: "data:image/...;base64,...", folder}` → valida tipo/peso (15MB) → sharp rotate/resize/WebP80 → `/app/data/uploads/<folder>/img_<ts>_<rnd>.webp` → `{url, bytes, originalBytes}`. Servido en `GET /uploads/*`. 🟢
- Video: `POST /api/gemini/generate-video {imageBase64|imageUrl, prompt, aspectRatio 9:16|16:9}` → Veo 3.1 (con GEMINI_API_KEY) o fallback ffmpeg Ken-Burns → `/videos/*.mp4` (volumen) → `POST /api/gemini/video-status {videoId}` polling. Rango-streaming en `GET /api/media/video/:id`.
- `POST /api/ai/test|generate {providerId: gemini|openai|anthropic|openrouter|custom, modelId, prompt}` → prueba/genera texto (usado por agentes y ⁠campañas).

## F9. Sistema y Meta
- `GET /api/version` → `{version: deployTimestamp}` (el frontend invalida caché con esto). `POST /api/cache/purge` → bump manual.
- Meta Cloud API (inactivo, modo=waha): `GET /api/whatsapp/webhook` verifica `hub.verify_token`; POST procesa `whatsapp_business_account` → mismo `procesarMensajeEntrante(canal: meta)`. Para activarlo algún día: `POST /api/whatsapp/config {modoActivo: meta, metaConfig:{...}}`.

## Orden sugerido de pruebas E2E
1. Vincular QR (F1) → 2. simulate-incoming "ofertas en Miraflores" (F2) → 3. crear+aprobar oferta con imagen (F3+F8) → 4. registro usuario (F6) → 5. vistas comercio/admin una por una (F5) → 6. email (F7).
