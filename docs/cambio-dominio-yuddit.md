# Runbook — Cambio de dominio a `yuddit.com`

> Objetivo: migrar la app de `nuuvio.sustrae.com` / `nuuvio.ai.studio` a **`https://yuddit.com`**
> sin romper enlaces salientes (WhatsApp, correos), webhooks ni CSRF.

## 1. Variables de entorno (Coolify)

En el panel de Coolify → app nuuvio → **Environment**:

| Variable | Valor | Por qué |
|---|---|---|
| `APP_URL` | `https://yuddit.com` | 1.º en la precedencia; arma `/c/:ofertaId` y correos |
| `PUBLIC_URL` | `https://yuddit.com` | 2.º en la precedencia y host del CTA con imagen (Meta) |
| `VUUV_PUBLIC_ORIGIN` | `https://yuddit.com` | validación CSRF de mismo origen (`server.ts` `peticionMismoOrigen`) |
| `APP_ALLOWED_ORIGINS` | `https://yuddit.com` | CORS (si se usa) |
| `COOLIFY_FQDN` / `COOLIFY_URL` | (lo regenera Coolify) | verificar que apunten a `yuddit.com` |

> ⚠️ Si `APP_URL` o `PUBLIC_URL` quedan con el dominio viejo, los enlaces de WhatsApp
> y los correos seguirán apuntando al dominio antiguo (ganan sobre `COOLIFY_FQDN`).

**Precedencia en el código:** `APP_URL > PUBLIC_URL > COOLIFY_URL > COOLIFY_FQDN > https://yuddit.com`.

Después de guardar: **Redeploy**.

## 2. Configuración externa

- **DNS**: `yuddit.com` (y `www` si aplica) → IP/host de Coolify.
- **TLS**: emitir/renovar certificado (Let's Encrypt) para `yuddit.com` en Coolify.
- **Meta for Developers** → WhatsApp → Configuration:
  - Callback URL: `https://yuddit.com/api/whatsapp/webhook`
  - Verify token: sin cambios (`WHATSAPP_VERIFY_TOKEN` / `META_WA_VERIFY_TOKEN`).
- **Redirect** (opcional): `nuuvio.sustrae.com` y `nuuvio.ai.studio` → `yuddit.com`.
- **Search Console / analytics / UTMs**: revisar propiedades registradas con el dominio viejo.
- **Correo**: los remitentes siguen en `no-reply@mail.sustrae.com` (dominio de envío distinto);
  no requiere cambio salvo que se decida enviar desde `yuddit.com` (implicaría SPF/DKIM).

## 3. Código (fallbacks) — ya aplicado en este repo

- `server.ts`: fallback final `https://yuddit.com` (mosaico, oferta específica, correo de
  verificación) y eliminado el fallback `ais-dev-*.run.app` del CTA con imagen (Meta).
- `src/components/comercio/views/HistorialPromocionesView.tsx`: enlaces de compartir ahora
  usan `window.location.origin` (sin dominio hardcodeado).
- Fallbacks `seoMetadata.ts`, `emailService.ts`, `UtmAttributionDashboardWidget.tsx`,
  `ConfiguracionDomainView.tsx`, `WhatsAppConfigPanel.tsx`, `core/events.ts` → `yuddit.com`.

## 4. Documentos y scripts

- `scripts/{set-admin-password.sh,security-smoke.sh,ofertas-tests.sh}` → `BASE_URL` por defecto `yuddit.com`.
- `specs/**/*.md` → referencias al nuevo dominio.
- `.env.example` → documentadas `APP_URL` / `PUBLIC_URL` / `VUUV_PUBLIC_ORIGIN`.

## 5. Verificación post-deploy

1. `GET https://yuddit.com/api/version` → JSON `ok:true`.
2. `GET https://yuddit.com/api/whatsapp/config` → JSON (botPhone, etc.).
3. Simular consulta de ofertas y confirmar que el botón CTA apunta a `https://yuddit.com/c/...`.
4. `GET https://yuddit.com/c/{ofertaId}?u=519XXXXXXXX` → `302` a WhatsApp del comercio.
5. Webhook Meta: enviar un mensaje entrante de prueba → 200 y respuesta del bot.
