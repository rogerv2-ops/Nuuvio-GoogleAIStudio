# Quickstart — Validación del endurecimiento de seguridad

Guía de verificación ejecutable extremo a extremo. No contiene código de
implementación; los detalles viven en `contracts/` y `data-model.md`.

## Prerrequisitos

- Instancia accesible (local `http://localhost:3000` o producción
  `https://yuddit.com`).
- Credenciales de prueba (admin + comercio) sembradas en `app_settings.auth_users`.
- Para webhooks: `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
  `WAHA_WEBHOOK_SECRET` configurados en el entorno de despliegue.

Variables de conveniencia:
```bash
export B="https://yuddit.com"
export ADMIN_EMAIL="rogerv2@gmail.com"
export ADMIN_PASS="<password>"
export COM_EMAIL="rogerv707@gmail.com"
export COM_PASS="<password>"
```

## 1. Rutas públicas y protegidas (US1 · SC-001)

```bash
# Públicas -> 200
curl -s -o /dev/null -w "%{http_code}\n" "$B/api/banners"
curl -s -o /dev/null -w "%{http_code}\n" "$B/api/ofertas"
curl -s -o /dev/null -w "%{http_code}\n" "$B/api/version"

# Sensibles sin token -> 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$B/api/banners/sync" -H 'Content-Type: application/json' -d '{}'
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE "$B/api/audience/users/x"
curl -s -o /dev/null -w "%{http_code}\n" "$B/api/whatsapp/config"
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$B/api/whatsapp/test-message" -H 'Content-Type: application/json' -d '{"telefono":"51900000000","texto":"x"}'
```
**Esperado**: 200/200/200 y 401/401/401/401.

## 2. Login y sesión (US1)

```bash
LOGIN=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
TOKEN=$(printf '%s' "$LOGIN" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s -o /dev/null -w "me=%{http_code}\n" "$B/api/auth/me" -H "Authorization: Bearer $TOKEN"   # 200
curl -s -o /dev/null -w "me_no=%{http_code}\n" "$B/api/auth/me"                                   # 401
curl -s -o /dev/null -w "cfg=%{http_code}\n" "$B/api/whatsapp/config" -H "Authorization: Bearer $TOKEN"  # 200
curl -s -o /dev/null -w "badpass=%{http_code}\n" -X POST "$B/api/auth/login" \
  -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"incorrecta\"}"  # 401
```
**Esperado**: `me=200 me_no=401 cfg=200 badpass=401`.

Autorización por rol (comercio no puede admin):
```bash
CTOKEN=$(curl -s -X POST "$B/api/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$COM_EMAIL\",\"password\":\"$COM_PASS\"}" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s -o /dev/null -w "admin_userlist_as_comercio=%{http_code}\n" "$B/api/auth/users" -H "Authorization: Bearer $CTOKEN"  # 403
```
**Esperado**: 403.

## 3. Sin credenciales en el bundle (US1 · SC-002)

```bash
ASSET=$(curl -s "$B/" | grep -oE '/assets/index-[^"]+\.js' | head -1)
curl -s "$B$ASSET" -o /tmp/deployed.js
grep -E "Pasion2271|rogerv2@gmail.com|rogerv707@gmail.com" /tmp/deployed.js && echo LEAK || echo CLEAN
```
**Esperado**: `CLEAN`.

## 4. SSRF bloqueado (US2 · SC-003)

```bash
# Con token admin:
for U in "http://169.254.169.254/latest/meta-data/" "http://127.0.0.1:3000/" "http://10.0.0.5/" "file:///etc/passwd"; do
  curl -s -o /dev/null -w "%{http_code} $U\n" -X POST "$B/api/gemini/generate-video" \
    -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"imageUrl\":\"$U\",\"prompt\":\"x\"}"
done
```
**Esperado**: `400` (bloqueado) en todos; no se crea conexión saliente.

## 5. Webhooks sin firma (US2 · SC-004)

```bash
curl -s -o /dev/null -w "sin_firma=%{http_code}\n" -X POST "$B/api/waha/webhook" \
  -H 'Content-Type: application/json' -d '{"event":"message","payload":{"from":"51900000000","body":"hola"}}'
```
**Esperado**: `403`. Verificar que **no** se creó un `chat_logs` nuevo para ese
número. Repetir con firma válida calculada en la prueba ⇒ `200`.

## 6. Path traversal y `Range` (US2 · SEC-08/LOG-03)

```bash
curl -s -o /dev/null -w "traversal=%{http_code}\n" "$B/api/media/video/..%2f..%2fetc%2fpasswd"   # 400
curl -s -o /dev/null -w "bad_range=%{http_code}\n" -H "Range: bytes=10-5" "$B/api/media/video/<nombre>"  # 416
```
**Esperado**: `400` y `416`.

## 7. Cabeceras de seguridad (US2 · FR-009)

```bash
curl -sI "$B/" | grep -iE "x-content-type-options|x-frame-options|content-security-policy|referrer-policy"
```
**Esperado**: presencia de `nosniff`, `SAMEORIGIN`, CSP y `Referrer-Policy`.

## 8. Rate limiting (US2 · FR-008)

```bash
for i in $(seq 1 15); do curl -s -o /dev/null -w "%{http_code} " -X POST "$B/api/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"x@x","password":"y"}'; done; echo
```
**Esperado**: respuestas `401` hasta el umbral y luego `429`.

## 9. Persistencia tras reinicio (US3 · SC-005)

1. Crear un banner, eliminarlo y guardar; crear un comercio y debitar un clic.
2. Redeploy/restart de la instancia.
3. Verificar:
```bash
curl -s "$B/api/banners"   # el banner eliminado NO reaparece
curl -s "$B/api/ofertas"   # lista vacía intencional permanece vacía
```
4. Confirmar en DB (`app_settings.merchants_list`, `click_packs_list`) que el
   comercio y el débito siguen presentes.
**Esperado**: 0 datos fantasma, 0 pérdidas tras 3 ciclos.

## 10. Intención de ofertas (US3 · LOG-01 · SC-006)

Enviar un conjunto de mensajes no relacionados ("que ofertas hay", "mi compra
llegó tarde", "promociono mi negocio") y verificar que el flujo de ofertas solo
se activa con intención real. **Esperado**: < 1% de falsos positivos.

## Criterio de aceptación global

- Todos los pasos anteriores con el resultado esperado.
- `bun build server.ts` y `bun run build` pasan antes del despliegue.
- Sin secretos/credenciales en el repo ni en el bundle.
