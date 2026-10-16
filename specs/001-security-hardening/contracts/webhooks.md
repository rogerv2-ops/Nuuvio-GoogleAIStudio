# Contrato: Webhooks entrantes (verificación de origen)

> Estado: pendiente (US2). Actualmente los webhooks se procesan sin verificar
> firma (SEC-06).

## Meta Cloud API

### `GET /api/whatsapp/webhook` — verificación de suscripción

Meta envía `hub.mode`, `hub.verify_token`, `hub.challenge`.

- Si `hub.mode === "subscribe"` y `hub.verify_token === WHATSAPP_VERIFY_TOKEN`
  ⇒ `200` con el `hub.challenge` en texto plano.
- Si no ⇒ `403`.

### `POST /api/whatsapp/webhook` — eventos

- El cuerpo debe procesarse como **raw body** (`express.raw({ type: 'application/json' })`
  acotado a esta ruta) para calcular el HMAC sobre los bytes exactos.
- Verificar `X-Hub-Signature-256` = `sha256=<hex>` con
  `HMAC_SHA256(WHATSAPP_APP_SECRET, rawBody)`, comparación **timing-safe**.
- Firma inválida o ausente ⇒ `403` y **sin** procesamiento ni persistencia.
- **Fail-closed**: si `WHATSAPP_APP_SECRET` no está configurado en producción,
  rechazar (`503`/`403` según política) y registrar advertencia.

## WAHA

### `POST /api/waha/webhook` — eventos

- Verificar secreto compartido: header configurado por WAHA (p. ej.
  `X-Api-Key` / `Authorization`) comparado timing-safe contra
  `WAHA_WEBHOOK_SECRET`.
- Inválido/ausente ⇒ `403`, sin procesar.
- **Fail-closed** si el secreto no está configurado en producción.

## Reglas comunes

- Nunca confiar en headers de reenvío para autenticar el origen.
- Idempotencia deseable: ignorar un `message.id` ya procesado (evita doble
  respuesta/registro).
- Los webhooks **no** requieren Bearer de usuario (son servidor-a-servidor).
- Un webhook válido sigue el flujo normal de `procesarMensajeEntrante`; la
  verificación no altera la lógica de negocio ni la sesión Baileys.

## Verificación de cumplimiento (SC-004)

1. `POST` sin header de firma ⇒ `403`.
2. `POST` con firma incorrecta ⇒ `403`.
3. `POST` con firma correcta (calculada en la prueba) ⇒ `200` y procesamiento.
4. Confirmar que en los casos 1–2 no se crean `chat_logs`/registros.
