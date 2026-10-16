# Contrato: Middleware de seguridad transversal

Aplican a todas las peticiones `/api/*`. Orden de registro en `server.ts`:
`express.json`/`express.urlencoded` → cabeceras de seguridad → **gate de auth** →
rutas.

> Estado: gate + auth implementados (US1); cabeceras, CORS, rate limit y tamaño
> de body pendientes (US2).

## 1. Cabeceras de seguridad (temprano, todas las respuestas)

| Cabecera | Valor |
|----------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` |
| `Content-Security-Policy` | `default-src 'self'; frame-ancestors 'self'; img-src 'self' data: https:; media-src 'self' https:; object-src 'none'; base-uri 'self'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (solo sobre HTTPS) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self)` |

## 2. CORS

- **Por defecto**: mismo origen; no se emite `Access-Control-Allow-Origin`.
- Si `APP_ALLOWED_ORIGINS` está definido: allowlist exacta (eco del `Origin`),
  métodos `GET,POST,PUT,DELETE,OPTIONS`, cabeceras `Authorization,
  Content-Type`, sin credenciales comodín.

## 3. Gate de autenticación (`/api/*`)

```
if path no empieza con /api/            -> continuar
si es ruta pública                      -> continuar
si Bearer válido (HMAC + exp)           -> adjuntar req.auth, continuar
si no                                   -> 401 { ok:false, error:"No autorizado. Se requiere inicio de sesion." }
```

**Allowlist pública** (exacta, por método cuando aplica):

| Ruta | Método |
|------|--------|
| `/api/auth/login` | POST |
| `/api/auth/me` | GET |
| `/api/version` | GET |
| `/api/banners` | GET |
| `/api/ofertas` | GET |
| `/api/ofertas/:id/like` | POST |
| `/api/media/video/:id` | GET |
| `/api/whatsapp/webhook` | GET, POST |
| `/api/waha/webhook` | POST |
| `/api/audience/check-uniqueness` | POST |
| `/api/audience/sync-user` | POST |
| `/api/audience/log-registration` | POST |
| `/api/audience/verify-token` | GET |
| `/api/verify-email` | GET |
| `/api/email/send-verification` | POST |
| `/api/go/*`, `/go/*`, `/c/*` | GET |

Todo lo demás bajo `/api/*` requiere Bearer válido. Rutas admin además exigen
`rol === "admin"` (403 si no).

## 4. Autorización por rol

| Ámbito | Regla |
|--------|-------|
| Gestión/borrado/config/credenciales | `rol === admin` |
| Panel comercio | `rol === comercio` o `admin`, restringido a `merchantId` propio |

## 5. Rate limiting (en memoria, por `(bucket, IP)`)

| Bucket | Rutas | Límite sugerido |
|--------|-------|-----------------|
| `login` | `POST /api/auth/login` | 10 / 5 min |
| `messaging` | `POST /api/whatsapp/test-message`, `POST /api/whatsapp/simulate-incoming` | 30 / min |
| `ai` | `/api/ai/*`, `/api/gemini/*` | 20 / min |
| `global` | resto de `/api/*` | 120 / min |

Excedido ⇒ `429` con `Retry-After: <segundos>` y evento de seguridad.

## 6. Límite de tamaño de body

| Ámbito | Límite |
|--------|--------|
| JSON global | ~1 MB |
| `/api/media/upload`, `/api/gemini/generate-video` | ~25 MB |

Excedido ⇒ `413`.

## Invariantes

- El gate se registra **después** de los parsers de body y **antes** de la
  primera ruta `/api/*` (sin rutas protegidas previas).
- Ningún endpoint sensible queda fuera del gate; se valida con una prueba que
  recorre el listado de rutas (SC-001).
