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

## F3.b Acreditar saldo de clics a un comercio (2026-10-21)
`GET /api/ofertas/publicas` filtra por `comercioTieneSaldo`: la oferta **activa** de un comercio sin saldo no llega a la landing (un comercio nuevo no tiene pack en `click_packs`, así que su oferta aprobada quedaba invisible sin aviso). El admin lo resuelve en el panel: **Campañas y Cobro → Campañas activas → "Acreditar saldo"** (clics + monto cobrado; monto 0 = bonificación) → `POST /api/facturacion/packs/acreditar {comercioId, clics, monto}` (**solo admin**: comercio → 403, sin token → 401) → escribe un pack nuevo `pack_acc_*` en `click_packs` (saldo = clics, `precio_unitario` = monto/clics) → recarga el cache del servidor → la oferta se ve de inmediato, sin reiniciar. Fail-closed: comercio vacío, clics fuera de 1..10000 o monto negativo → 400 y no se escribe nada. Auditoría en `security_logs` (`Saldo de clics acreditado`). El panel marca "Sin saldo (no se ve)" y, en la lista de ofertas, "No visible: sin saldo".
**Tablas:** `click_packs`, `security_logs`. **Probar:** `bun test tests/security/acreditar-saldo.test.ts tests/security/acreditar-saldo-bordes.test.ts` (la oferta aparece en `/api/ofertas/publicas` después de acreditar).

## F4. Banners
`BannersConfigView`: pestaña URL o archivo → upload a disco (`banners/`) → preview → Guardar → `POST /api/banners/sync {banners[]}` → `syncBanners` (upsert por id). `GET /api/banners` → `PublicWeb` header. Regla server: URLs sustrae/banner.webp se normalizan al banner local. **Probar:** subir imagen, `GET /api/banners` trae `/uploads/banners/...`.

### F4.b Logo de la landing (2026-10-21)
`BannersConfigView` → bloque "Logo de la Landing": URL o archivo (upload a `logo/`) + **alto en px** (24–160, el ancho lo calcula el navegador: siempre proporcional) → `POST /api/banners/sync {banners[], logo:{imagenUrl, altoPx}}` → `saveSetting('landing_logo')`. `GET /api/banners` devuelve también `logo`; `NavigationHeader` (cabecera pública) lo renderiza con `height: altoPx` y `width:auto`, y si no hay logo mantiene el de siempre (la "Y" + "Yuddit"). El logo no es un banner: no entra en la rotación. **Probar:** guardar logo → recargar la landing → el header muestra la imagen con ese alto y sin deformarse; "Quitar Logo" vuelve al logo por defecto.

## F5. Comercios y panel comercio
- `GET /api/comercios` → 10 comercios DB. `POST /api/comercios/sync {comercios, kanban}` → `merchants_list` + `merchants_kanban` (settings).
- Vistas comercio: Inicio (resumen), MisOfertas (CRUD propio), MiNegocio (datos), Resultados/Ventas (de `click_logs`+clics), Historial, Campañas. Todo vía estos endpoints + `facturacionModule.inicializar` (click packs, persistidos en la tabla `click_packs`).
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

## F10. Login / sesión (auth de servidor)
**Actor:** admin o comercio en `LoginView`.
1. `POST /api/auth/login {email, password}` → servidor valida scrypt contra `app_settings.auth_users`
   → responde `{ok, token (HMAC-SHA256), sesion:{usuarioId, rol, merchantId, expiraEn}}`.
2. `src/core/security.ts` guarda el token e instala un interceptor `fetch` que añade
   `Authorization: Bearer <token>` a todo `/api/`.
3. `GET /api/auth/me` valida el token; el gate global `/api` responde `401` sin token válido.
4. `requireAdmin` responde `403` si el rol no es `admin`. `POST /api/auth/logout` es stateless en cliente.
5. Cada intento se registra en `security_logs` (login ok/fallido, acceso denegado, rate limit).
6. **Bloqueo**: tras 5 fallos para un correo → 15 min de bloqueo (`423 {bloqueado, segundosRestantes}`);
   `security.ts` mantiene el countdown y `LoginView` lo muestra. Se limpia al autenticar o restablecer.
**Verificar:** `scripts/security-smoke.sh` (12 checks) o `bun test tests/security` con `TEST_BASE_URL`.

## F10.b Recuperación de contraseña por correo
**Actor:** cualquiera en `LoginView` ("¿Olvidaste tu contraseña?").
1. `POST /api/auth/forgot-password {email}` (público, bucket `reset` 5/15min) → responde mensaje genérico
   (sin enumerar cuentas). Si la cuenta existe: código de 8 hex (15 min) con hash SHA-256 en
   `app_settings.auth_reset_tokens`; se envía por Resend/SMTP con `enviarCorreo`. Sin proveedor, el código
   queda en logs del servidor (`[Auth] ... Codigo temporal: XXXXXXXX`).
2. `POST /api/auth/reset-password {email, codigo, password}` (público) valida hash+expiry, reemplaza scrypt,
   invalida el código (un solo uso) y limpia el bloqueo → `200`.
3. UI en 2 pasos (solicitar código → código + nueva clave); `security.ts` expone
   `solicitarResetContrasena` / `confirmarResetContrasena`.

## F11. Webhooks y guardas (SSRF / media)
- **Meta** `POST /api/whatsapp/webhook`: exige `X-Hub-Signature-256` = HMAC-SHA256(rawBody, `WHATSAPP_APP_SECRET`);
  sin firma válida → `403` (fail-closed en producción). `GET` valida `hub.verify_token` (`WHATSAPP_VERIFY_TOKEN` o DB).
- **WAHA** `POST /api/waha/webhook`: exige secreto `WAHA_WEBHOOK_SECRET` (`x-api-key`/`x-webhook-secret`/Bearer) → `403` si falta.
- **SSRF IA**: `baseUrl` en `/api/ai/test|generate` limitado a allowlist por proveedor; `imageUrl` en
  `/api/gemini/generate-video` pasa por DNS + bloqueo de rangos privados → `400`.
- **Media** `GET /api/media/video/:id`: `resolverRutaSegura` bloquea traversal (`400`); `Range` inválido → `416`.
- **Rate limit**: buckets login/messaging/ai/global → `429` + `Retry-After`.

## F12. Mosaico de ofertas (1:1), clics CPC y "Me Gusta" (2026-10-17)
- **Mosaico (bot)**: `dispatchOffersMosaic` en `server.ts`. Filtra ofertas `activa`, no vencidas, con WhatsApp válido y **saldo de clics > 0** (`comercioTieneSaldo`); ordena por plan → `likes` → fecha; toma **máximo 3**; genera `renderMosaicImage` (segmentos **1:1** numerados) y envía **un solo mensaje** (imagen + caption con título/precio/enlace `/c/:id?u=<telefono>`).
- **Tarjeta 1:1**: `renderOfferCardImage` es **800×800** y sin corazón; la landing usa `aspect-square` y ya no repite título/descripción.
- **Redirección CPC** `GET /c/:ofertaId?u=<telefono>` (rate limit `clicks` 20/60 s): registra el clic en `click_logs` (`registerOfferClick`), decide facturabilidad y redirige `302` a WhatsApp del comercio con título + código `NV-####`.
- **Ventana de facturabilidad**: solo el **1.er clic facturable cada 24 h** por `(oferta, teléfono)`; la ventana se ancla al **último clic facturable** (los no facturables no la reinician). Un clic facturable debita **1** de la tabla `click_packs` con un único `UPDATE ... WHERE saldo_clics > 0 ... RETURNING` (`debitarClicAtomico`): es una sola sentencia, así que el saldo no puede quedar negativo bajo concurrencia. El guard tiene que ir en el `UPDATE` y no solo en la subconsulta. E incrementa `leadsCalificados`; sin saldo ⇒ no facturable, sin débito, igual redirige.
- **"Me Gusta"** `POST /api/ofertas/:id/like` (rate limit `likes` 30/60 s): **informativo, no factura**; `incrementOfferLikes` (SQL atómico) persiste en `offers.likes`. La landing muestra el conteo en vivo.
- **Tablas:** `click_logs`. **Probar:** `GET /c/<oferta>?u=519...` (302 + código), repetir <24 h (no facturable), `POST /api/ofertas/<id>/like`. Automatizado: `./scripts/ofertas-tests.sh` (siembra fixtures, corre `tests/ofertas/`, verifica débito y limpia).

## Orden sugerido de pruebas E2E
1. Vincular QR (F1) → 2. simulate-incoming "ofertas en Miraflores" (F2) → 3. crear+aprobar oferta con imagen (F3+F8) → 4. registro usuario (F6) → 5. vistas comercio/admin una por una (F5) → 6. email (F7). Login/sesión (F10) precede a todo lo de gestión.
