# Phase 1 — Data Model: Endurecimiento de Seguridad

Modelo de las entidades introducidas o relevantes para el feature. Las entidades
existentes de dominio (banners, ofertas, comercios, usuarios de audiencia, packs
de clics) no cambian su forma; se incluyen como "Recurso persistente" por su
relación con los requisitos de integridad (FR-011..014).

---

## CredencialAcceso

Identidad de administrador/operador/comercio. **Ya no reside en el cliente.**

**Almacenamiento**: `app_settings` (clave `auth_users`, valor = arreglo JSON).

| Campo | Tipo | Notas |
|-------|------|-------|
| email | string (PK lógica) | normalizado a minúsculas |
| passwordSalt | string (hex 16 bytes) | por credencial |
| passwordHash | string (hex, scrypt 64 bytes) | nunca se expone al cliente |
| nombre | string | nombre para mostrar |
| rol | `admin` \| `operador` \| `comercio` | controla autorización |
| usuarioId | string | p. ej. `admin_master_01` |
| merchantId | string \| null | requerido para rol `comercio` |
| descripcion | string | texto libre |

**Validación**:
- `email` único (case-insensitive) y con formato válido.
- `password` mínimo 6 caracteres al crear/cambiar.
- Solo `admin` puede listar/crear/cambiar credenciales.

**Transiciones de estado**: creada → activa → (clave actualizada). No hay borrado
en esta versión; baja lógica futura.

---

## Sesión

Emitida por el servidor en `POST /api/auth/login`; representa un acceso válido.

**Almacenamiento**: stateless. Payload firmado HMAC-SHA256; el cliente guarda el
token en `localStorage` (`vuuy_auth_session_v3`). Secreto en
`app_settings.auth_secret`.

| Campo | Tipo | Notas |
|-------|------|-------|
| token | string | `base64url(payload).base64url(HMAC)` |
| usuarioId | string | desde la credencial |
| email | string | desde la credencial |
| nombre | string | desde la credencial |
| rol | `admin` \| `operador` \| `comercio` | copiado en el token al emitir |
| merchantId | string \| null | alcance del comercio |
| exp (interno) | number | epoch ms de expiración |
| expiraEn | string ISO | exp, para el cliente |

**Validación**: firma HMAC válida y `exp > now`. Token inválido/expirado ⇒ `401`.

**Reglas**: emitir token no altera a la credencial. Cambiar rol/revocar requiere
emitir un token nuevo (o rotar `auth_secret`).

---

## EventoSeguridad

Registro de accesos y acciones sensibles (FR-010).

**Almacenamiento**: auditoría local en cliente (UI, ya existente) + logging
estructurado en servidor; opcional tabla `security_logs` (Drizzle, aditiva).

| Campo | Tipo | Notas |
|-------|------|-------|
| id | string | `aud_<ts>_<rand>` / secuencia DB |
| operadorId | string | usuario o `sistema_seguridad` |
| operadorNombre | string | |
| accion | string | p. ej. "Intento de acceso fallido" |
| entidad | string | `autenticacion`, `usuario_seguridad`, etc. |
| entidadId | string | objetivo |
| detalles | string | texto libre |
| fecha | string ISO | timestamp |

Eventos mínimos a registrar en servidor: login fallido, login exitoso, acceso
denegado (401/403), cambio de credencial/clave, cambio de config sensible
(WhatsApp/correo), bloqueo por rate limit.

---

## ConfiguracionSeguridad

Secretos de operación almacenados en `app_settings` o variables de entorno.

| Clave | Origen | Uso |
|-------|--------|-----|
| auth_secret | `app_settings` (generado) | firma de tokens |
| auth_users | `app_settings` | credenciales |
| WHATSAPP_APP_SECRET | env | firma webhook Meta |
| WHATSAPP_VERIFY_TOKEN | env | challenge GET Meta |
| WAHA_WEBHOOK_SECRET | env | secreto webhook WAHA |
| APP_ALLOWED_ORIGINS | env (opcional) | allowlist CORS |
| VUUV_ADMIN_EMAIL / VUUV_ADMIN_PASSWORD | env (opcional) | seed inicial |

---

## WebhookEntrante

Mensaje de entrada de Meta/WAHA con origen verificable.

| Campo | Tipo | Notas |
|-------|------|-------|
| canal | `meta` \| `waha` | determina el mecanismo de firma |
| firma | header | `X-Hub-Signature-256` (Meta) / token secreto (WAHA) |
| body | JSON | crudo para Meta (HMAC sobre raw body) |
| remitente | string | teléfono normalizado |
| texto | string | cuerpo/caption |
| valido | boolean | resultado de la verificación |

**Reglas**: `valido === false` ⇒ `403`, no se procesa ni persiste. Idempotencia
deseable (evitar reprocesar el mismo `message.id` repetido).

---

## Recurso persistente (existente, sin cambios de forma)

Entidades cuyo ciclo de vida debe sobrevivir reinicios (FR-011..014, SC-005).
Se listan porque las pruebas de regresión las cubren.

| Recurso | Tabla | Relevancia |
|---------|-------|-----------|
| Banner | `banners` | sync autoritativo (borrado propaga); no re-siembra |
| Oferta | `offers` | sync autoritativo; no re-siembra |
| Comercio | `app_settings.merchants_list` | registro por WhatsApp persiste |
| Usuario de audiencia | `audience_users` | alta/borrado/purga persiste |
| Pack de clics | `app_settings.click_packs_list` | débitos persisten |
| Config WhatsApp/correo | `app_settings` | cambios persisten |

**Regla transversal**: eliminar en el cliente debe propagar borrado en DB
(operación autoritativa); listas vacías intencionales no se re-siembran.

---

## Relaciones

```text
CredencialAcceso (admin) ──emite── Sesión
CredencialAcceso (admin) ──gestiona── CredencialAcceso
CredencialAcceso (comercio) ──alcance── Recurso persistente (merchantId)
Sesión ──autoriza── Endpoints sensibles
WebhookEntrante ──valida── ConfiguracionSeguridad (secreto)
EventoSeguridad ──referencia── CredencialAcceso / Sesión / Configuración
```
