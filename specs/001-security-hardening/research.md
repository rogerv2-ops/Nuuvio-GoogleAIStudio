# Phase 0 — Research: Endurecimiento de Seguridad

Este documento resuelve las incógnitas técnicas del `Technical Context` y registra
las decisiones de diseño. No quedan `NEEDS CLARIFICATION`.

---

## Decisión 1 — Mecanismo de sesión del servidor

**Decision**: Token stateless firmado con HMAC-SHA256 (`base64url(payload).base64url(HMAC)`)
emitido por `POST /api/auth/login`, con `exp` (30 días) y payload
`{usuarioId,email,nombre,rol,merchantId,exp,expiraEn}`. El secreto se persiste en
`app_settings.auth_secret` (generado en el primer uso). El cliente solo guarda el
token en `localStorage` y lo envía como `Authorization: Bearer`.

**Rationale**: Sin dependencias nuevas (`node:crypto`), stateless (no requiere
tabla de sesiones), apto para instancia única, y ya validado en producción
durante US1. Firma sobre el cuerpo codificado evita alteraciones.

**Alternatives considered**:
- Sesiones con estado en Postgres (tabla `sessions`): útil para revocación
  inmediata, pero añade escritura/lectura por request y complejidad. Descartado
  por ahora; se conserva `POST /api/auth/logout` como no-op (el cliente borra el
  token).
- JWT con librería (`jsonwebtoken`): añade dependencia y superficie; el formato
  propio es equivalente para HMAC simple.
- Rotación forzada del secreto: invalida todas las sesiones; se deja como
  operación manual futura.

---

## Decisión 2 — Almacenamiento de credenciales

**Decision**: Lista de usuarios en `app_settings.auth_users` con
`passwordSalt` + `passwordHash` (scrypt, N por defecto de Node, 64 bytes).
En el primer arranque sin usuarios se siembra el admin desde
`VUUV_ADMIN_EMAIL`/`VUUV_ADMIN_PASSWORD` (o se genera y registra en logs si no
hay env). Gestión (alta/cambio de clave) solo por administradores autenticados.

**Rationale**: Cumple Principio I (persistencia en Postgres). scrypt es resistente
a fuerza bruta y viene en la stdlib. El hash nunca viaja al cliente
(`GET /api/auth/users` no devuelve campos de hash).

**Alternatives considered**: bcrypt/argon2 (dependencia nativa; innecesaria),
texto plano (inaceptable), variables de entorno por usuario (no escalable).

---

## Decisión 3 — Firma de webhooks entrantes

**Decision**:
- **Meta Cloud API** (`POST /api/whatsapp/webhook`): verificar
  `X-Hub-Signature-256` con HMAC-SHA256 sobre el *raw body* usando
  `WHATSAPP_APP_SECRET`. Se usa `express.raw()` acotado a esa ruta para preservar
  el cuerpo exacto. Sin firma válida ⇒ `403` y sin procesamiento.
- **WAHA** (`POST /api/waha/webhook`): verificar encabezado de secreto compartido
  (`WAHA_WEBHOOK_SECRET`, p. ej. comparación timing-safe del token configurado en
  WAHA). Sin secreto válido ⇒ `403`.
- **Verificación GET** (`GET /api/whatsapp/webhook`): mantener el *challenge* de
  Meta validando `hub.verify_token` contra `WHATSAPP_VERIFY_TOKEN`.

**Rationale**: Es el mecanismo estándar de cada proveedor; `timingSafeEqual`
evita filtrado por temporización.

**Alternatives considered**: Allowlist por IP de origen (frágil, Meta publica
muchas IPs), verificación solo opcional (incumple FR-005).

**Riesgo operativo**: si los secretos no están configurados, en producción se
**falla cerrado** (rechaza) con log de advertencia. Debe coordinarse con la
configuración de WAHA/Meta antes del despliegue para no interrumpir la
recepción real. Documentado en quickstart.md.

---

## Decisión 4 — Prevención de SSRF

**Decision**: Dos capas:
1. **Allowlist de proveedores IA**: para `POST /api/ai/test` y
   `POST /api/ai/generate`, el `baseUrl` debe pertenecer a un host permitido por
   `providerId` (`generativelanguage.googleapis.com`, `api.openai.com`,
   `api.anthropic.com`, `openrouter.ai`). Host fuera de la allowlist ⇒ `400`.
2. **Guard SSRF genérico** para URLs arbitrarias (`imageUrl` en
   `/api/gemini/generate-video` y cualquier fetch derivado de datos del cliente):
   - Esquema solo `http`/`https`.
   - Resolver el host por DNS y rechazar si alguna IP resuelta es
     privada/loopback/link-local/reservada (IPv4 `10/8`, `172.16/12`, `192.168/16`,
     `127/8`, `169.254/16`, `0.0.0.0/8`, multicast/reservado; IPv6 `::1`,
     `fc00::/7`, `fe80::/10`, IPv4-mapped).
   - Seguir redirecciones con revalidación de cada *Location* (o
     `redirect:'manual'`).
   - Timeout corto (p. ej. 5 s) y límite de tamaño de descarga.

**Rationale**: La allowlist elimina el riesgo en los endpoints de IA; el guard
genérico protege el punto restante (`imageUrl`). Evita accesos a metadatos de
nube (`169.254.169.254`) y a la red interna.

**Alternatives considered**: Bloquear solo por string (bypass por DNS
rebinding/IP decimal), deny-list de rangos (incompleto), deshabilitar `imageUrl`
(rompe funcionalidad).

---

## Decisión 5 — Confinamiento de rutas y validación de `Range`

**Decision**: `resolverRutaSegura(baseDir, nombre)` que hace `path.resolve` y
exige `resolved === baseDir || resolved.startsWith(baseDir + path.sep)`; si no,
`400/404`. En `GET /api/media/video/:id`, reemplazar el `startsWith` por este
guard y validar `Range`: `start >= 0`, `end >= start`, `end < fileSize`;
`416` con `Content-Range: bytes */<size>` si es inválido.

**Rationale**: Confina la lectura al directorio de videos y elimina traversal y
rangos inválidos (SEC-08, LOG-03). No introduce dependencias.

**Alternatives considered**: `serve-static` con `dotfiles`/`root` (no aplica al
patrón con `Range` manual), sanitizar quitando `..` (menos robusto que comparar
rutas resueltas).

---

## Decisión 6 — Rate limiting, cabeceras y tamaño de body

**Decision**:
- **Rate limiter en memoria** (ventana deslizante/fija) por `(ruta, IP)` con
  buckets específicos: `login` (p. ej. 10/5 min), envío de WhatsApp
  (`test-message`, simulación), IA/Gemini, y un límite global por IP. Responde
  `429` con `Retry-After`.
- **Cabeceras de seguridad** en un middleware temprano:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` +
  `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Strict-Transport-Security` (HTTPS),
  `Permissions-Policy` mínima. CSP `default-src 'self'` con excepciones para
  fuentes de medios/imágenes necesarias.
- **CORS explícito**: mismo origen por defecto (sin `Access-Control-Allow-Origin`
  comodín); si se necesita, allowlist por `APP_ALLOWED_ORIGINS`.
- **Tamaño de body**: bajar el JSON global a ~1 MB; aplicar un parser mayor
  (~25 MB) solo en `/api/media/upload` y `/api/gemini/generate-video`.

**Rationale**: Mitiga fuerza bruta, DoS por memoria y abuso de coste; cabeceras
mínimas según OWASP.

**Alternatives considered**: `express-rate-limit`/`helmet` (dependencias
aceptables, pero el proyecto prefiere stdlib y control explícito; se pueden
adoptar si el equipo lo prefiere), persistir contadores (innecesario: la
constitución v1.1.0 define el estado efímero de seguridad fuera del alcance del
Principio I, por lo que no se requiere persistencia).

---

## Decisión 7 — Estrategia de pruebas sin framework existente

**Decision**: Pruebas de **caja negra HTTP** con `bun test` que:
- Arrancan (o apuntan a) la instancia y recorren la lista de endpoints para
  verificar `401` sin token y respuesta correcta con token (SC-001).
- Verifican SSRF: URLs a `127.0.0.1`, `169.254.169.254`, RFC1918 ⇒ bloqueadas
  (SC-003).
- Verifican webhooks sin firma ⇒ `403` sin procesar (SC-004).
- Escanean el bundle construido en busca de secretos (SC-002).
- Ciclo de persistencia: crear/borrar, reiniciar, comparar (SC-005);
  recomputa la tasa de falsos positivos de intención (SC-006).

Complemento: `scripts/security-smoke.sh` con `curl` para verificación manual
rápida post-deploy.

**Rationale**: El servidor no exporta la app Express (se arranca como proceso);
la caja negra evita refactor invasivo y prueba exactamente el contrato. `bun`
ya está disponible en el entorno de build.

**Alternatives considered**: `supertest` (requiere exportar `app` y separar
`startServer`), `vitest` (más pesado), E2E Playwright (excesivo para el alcance
de seguridad).

---

## Decisión 8 — Persistencia de eventos de seguridad y logs

**Decision**: Mantener `coreSecurity.registrarAuditoria` en el cliente para
auditoría local (UI), y añadir en el servidor un log estructurado a consola
según FR-010 para accesos denegados/fallidos y cambios sensibles. Opcional
(recomendado): tabla `security_logs` (Drizzle, aditiva) para histórico
consultable de eventos del servidor.

**Rationale**: FR-010 exige registrar eventos; el logging estructurado cubre el
mínimo sin riesgo, y la tabla da trazabilidad alineada con el Principio I.

**Alternatives considered**: Solo logs de contenedor (se pierden al recrear),
persistir todo evento del cliente (ruido/no confiable).

---

## Decisión 9 — Coincidencia de intención y de teléfonos (LOG-01/02)

**Decision**:
- Intención de ofertas: normalizar (minúsculas, sin acentos) y usar coincidencias
  por palabra/límite (`\b`) o lista de frases completas, en lugar de
  `includes("oferta")` genérico.
- Teléfonos: normalizar al formato canónico (`519XXXXXXXX`) y comparar por
  igualdad exacta; prohibir `.endsWith`/subcadenas para emparejar contactos.

**Rationale**: Reduce falsos positivos (SC-006) y asociaciones erróneas
(FR-016) sin cambiar la UX del usuario final.

**Alternatives considered**: NLP/intención con modelo (excesivo), mantener
subcadenas (sigue fallando).

---

## Decisión 10 — FLW-01..04 (regresión)

**Decision**: No re-diseñar; los arreglos ya aplicados (sync autoritativo,
arranque por dominio a prueba de fallos, persistencia de comercio/packs, no
re-siembra de listas vacías) se conservan y se cubren con pruebas de regresión
en `quickstart.md` y en la suite.

**Rationale**: Evita regresiones; el spec los marca como requisito verificable.

**Alternatives considered**: Reimplementar (innecesario y riesgoso).
