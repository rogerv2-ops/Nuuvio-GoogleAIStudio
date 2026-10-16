---

description: "Task list for feature 001-security-hardening"
---

# Tasks: Endurecimiento de Seguridad, Flujo y Lógica

**Input**: Design documents from `/specs/001-security-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Incluidos — la especificación exige pruebas automatizadas (SC-001,
SC-003, SC-004, SC-005, SC-006). Enfoque de caja negra HTTP con `bun test` y
escaneo del bundle (research.md, Decisión 7).

**Organization**: Tareas agrupadas por historia de usuario (US1..US3). US1 ya
tiene su implementación desplegada; sus tareas de código se marcan `[x]` y se
completan con pruebas y ajustes de rol/log pendientes.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: Historia de usuario (US1, US2, US3). Ausente en Setup/Foundational/Polish.
- Todo el backend vive en `server.ts`; los datos en `src/db/`; los tests en `tests/security/`.

## Path Conventions

Proyecto único (monolito full-stack): `server.ts`, `src/`, `tests/` en la raíz
del repositorio.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Infraestructura mínima de pruebas y configuración de secretos.

- [x] T001 Crear infraestructura de pruebas: agregar `"test": "bun test"` en `package.json`, crear directorio `tests/security/`, y `scripts/security-smoke.sh` (smoke con `curl` según quickstart.md)
- [x] T002 [P] Crear `.env.example` documentando `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WAHA_WEBHOOK_SECRET`, `APP_ALLOWED_ORIGINS`, `VUUV_ADMIN_EMAIL`, `VUUV_ADMIN_PASSWORD`, `VUUV_COMMERCE_EMAIL`, `VUUV_COMMERCE_PASSWORD` en la raíz del repo

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Utilidades y middleware de seguridad que TODAS las historias necesitan.

**⚠️ CRITICAL**: Ninguna historia puede completarse sin esta fase.

- [x] T003 [P] Agregar tabla `securityLogs` en `src/db/schema.ts` con campos `id` (text PK), `operadorId` (text notNull), `operadorNombre` (text notNull), `accion` (text notNull), `entidad` (text notNull), `entidadId` (text notNull), `detalles` (text notNull), `createdAt` (timestamp default now)
- [x] T004 [P] Agregar `insertSecurityLog(...)` y `getRecentSecurityLogs(limit)` en `src/db/repo.ts` (usar la tabla `securityLogs`), exportándolas en el mismo estilo que el resto del repositorio
- [x] T005 [P] Agregar helpers de seguridad en `server.ts`: `validarUrlExternaPermitida(url)` (esquema http/https, DNS lookup y rechazo de rangos privados/loopback/link-local/reservados IPv4+IPv6, redirecciones revalidadas o `redirect:'manual'`, timeout ≈5s), `esHostProveedorIaPermitido(providerId, baseUrl)` (allowlist: gemini→generativelanguage.googleapis.com, openai→api.openai.com, anthropic→api.anthropic.com, openrouter→openrouter.ai), `resolverRutaSegura(baseDir, nombre)` (`resolved===baseDir || resolved.startsWith(baseDir+path.sep)`), `validarRangeCabecera(range, fileSize)` (`start>=0`, `end>=start`, `end<fileSize`), `compararHmacHex(a,b)` (timing-safe)
- [x] T006 [P] Agregar rate limiter en memoria en `server.ts`: map `(bucket+IP)→timestamps`, ventanas y límites por bucket (`login` 10/5min, `messaging` 30/min, `ai` 20/min, `global` 120/min), respuesta `429` con `Retry-After`
- [x] T007 [P] Agregar middleware temprano en `server.ts` (después de los parsers de body, antes del gate): cabeceras de seguridad (`X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy` con `frame-ancestors 'self'`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Permissions-Policy`) y CORS explícito (mismo origen por defecto; allowlist `APP_ALLOWED_ORIGINS`)
- [x] T008 Agregar `logEventoSeguridad(evento)` en `server.ts` que escriba log estructurado a consola y, si está disponible, persista con `insertSecurityLog` (depende de T004)

**Checkpoint**: Foundation lista — las historias pueden implementarse.

---

## Phase 3: User Story 1 - Acceso administrativo realmente protegido (Priority: P1) 🎯 MVP

**Goal**: Toda operación sensible exige autenticación/autorización de servidor; no hay credenciales en el cliente.

**Independent Test**: Sin credenciales, los endpoints sensibles devuelven 401/403; el bundle no contiene credenciales; forjar localStorage no otorga acceso; login válido emite token de servidor.

> **Nota**: la implementación núcleo de US1 ya fue desplegada (commit `48106ed`).
> Las tareas T011–T017 están completadas; T009–T010 y T018–T019 son el trabajo restante.

### Tests for User Story 1 ⚠️

- [x] T009 [P] [US1] Prueba de contrato en `tests/security/auth.contract.test.ts`: recorrer endpoints sensibles y verificar `401`/`403` sin token, afectar rutas públicas (`/api/banners`, `/api/ofertas`, `/api/version`) = 200, login inválido = 401, `/api/auth/me` con/sin token = 200/401, y comercio en `/api/auth/users` = 403 (SC-001)
- [x] T010 [P] [US1] Prueba de escaneo de bundle en `tests/security/bundle-secrets.test.ts`: construir con `vite build` y fallar si el JS contiene `Pasion2271`, `rogerv2@gmail.com` o `rogerv707@gmail.com` (SC-002)

### Implementation for User Story 1

- [x] T011 [US1] Auth de servidor en `server.ts`: import `crypto`, `hashPassword`/`verifyPassword` (scrypt), `signAuthToken`/`verifyAuthToken` (HMAC-SHA256), secreto cacheado en `app_settings.auth_secret`, credenciales en `app_settings.auth_users`, y `seedAuthUsersIfNeeded` en el arranque
- [x] T012 [US1] Endpoints `/api/auth/*` en `server.ts`: `login`, `me`, `logout`, `users` (GET/POST), `password` (POST), con gate global `/api` y allowlist pública
- [x] T013 [US1] `src/core/security.ts`: eliminar `CREDENCIALES_SISTEMA`, login asíncrono contra `/api/auth/login`, almacenar token y añadir interceptor `fetch` con `Authorization: Bearer`
- [x] T014 [US1] `src/components/LoginView.tsx`: `handleSubmit` asíncrono que espera `coreSecurity.iniciarSesion`
- [x] T015 [US1] `src/components/gestion/views/ConfiguracionDomainView.tsx`: no exponer contraseñas; alta/cambio de credenciales vía servidor
- [x] T016 [US1] Eliminar bundles versionados `assets/` y `public/assets/` que filtraban credenciales (Principio IV)
- [x] T017 [US1] Sembrar credenciales reales (hash scrypt) en `app_settings.auth_users` y verificar login admin/comercio
- [x] T018 [US1] Aplicar autorización por rol en `server.ts`: `requireAdmin` en endpoints destructivos/de configuración (`DELETE /api/audience/users/:id`, `POST /api/audience/purge-user`, `POST /api/audience/clear-all-registration-logs`, `GET/DELETE /api/audience/registration-logs`, `POST /api/whatsapp/config`, `POST /api/email/config`, `POST /api/cache/purge`, `POST /api/waha/session/logout`, `POST /api/waha/session/start`), manteniendo `POST /api/ofertas/sync` y `/api/banners/sync` accesibles para rol `comercio` o `admin` (FR-002)
- [x] T019 [US1] Registrar eventos de seguridad en `server.ts` vía `logEventoSeguridad`: login exitoso, login fallido, acceso denegado (401/403), bloqueo por rate limit y cambios de credencial/clave (FR-010; depende de T008)

**Checkpoint**: US1 verificable de forma independiente (pruebas T009/T010 en verde).

---

## Phase 4: User Story 2 - Operaciones externas no son abusables (Priority: P2)

**Goal**: SSRF bloqueado, webhooks verificados, envío de mensajes limitado, rutas confinadas, cabeceras y límites aplicados.

**Independent Test**: Peticiones a URLs internas/metadatos se rechazan; webhooks sin firma se descartan; rate excedido responde 429; traversal y `Range` inválidos se rechazan; cabeceras presentes.

### Tests for User Story 2 ⚠️

- [x] T020 [P] [US2] Prueba SSRF en `tests/security/ssrf.test.ts`: `imageUrl`/`baseUrl` hacia `169.254.169.254`, `127.0.0.1`, `10.0.0.5`, `[::1]`, `file:///etc/passwd` ⇒ bloqueados; host permitido ⇒ procede (SC-003)
- [x] T021 [P] [US2] Prueba de webhooks en `tests/security/webhooks.test.ts`: POST sin firma/incorrecta ⇒ 403 sin crear `chat_logs`; firma válida calculada en la prueba ⇒ 200 (SC-004)
- [x] T022 [P] [US2] Prueba de medios en `tests/security/media.test.ts`: traversal `..%2f..%2fetc%2fpasswd` ⇒ 400; `Range` `10-5`, `-1-`, `0-999999999` ⇒ 416 (SEC-08/LOG-03)
- [x] T023 [P] [US2] Prueba de middleware en `tests/security/middleware.test.ts`: cabeceras de seguridad presentes; >umbral de login ⇒ 429 con `Retry-After`; body > límite ⇒ 413 (FR-008/FR-009/SEC-11)

### Implementation for User Story 2

- [x] T024 [US2] Aplicar `esHostProveedorIaPermitido` a `baseUrl` en `POST /api/ai/test` en `server.ts` (`400` si host fuera de allowlist; depende de T005)
- [x] T025 [US2] Aplicar `esHostProveedorIaPermitido` a `baseUrl` en `POST /api/ai/generate` en `server.ts` (depende de T005)
- [x] T026 [US2] Aplicar `validarUrlExternaPermitida` a `imageUrl` en `POST /api/gemini/generate-video` en `server.ts` antes de descargar (depende de T005)
- [x] T027 [US2] Verificación de firma Meta en `POST /api/whatsapp/webhook` en `server.ts`: parser `express.raw({type:'application/json'})` acotado a la ruta, `HMAC_SHA256(WHATSAPP_APP_SECRET, rawBody)` comparado timing-safe con `X-Hub-Signature-256`; fail-closed si falta el secreto en producción (depende de T005; contrato en `contracts/webhooks.md`)
- [x] T028 [US2] Verificación de secreto WAHA en `POST /api/waha/webhook` en `server.ts` comparando timing-safe con `WAHA_WEBHOOK_SECRET`; fail-closed si falta (depende de T005)
- [x] T029 [US2] Reducir el límite global de body en `server.ts` a ~1 MB y montar parser mayor (~25 MB) solo en `POST /api/media/upload` y `POST /api/gemini/generate-video` (depende de T007)
- [x] T030 [US2] Conectar los buckets del rate limiter a las rutas en `server.ts` (`login`, `messaging`, `ai`, `global`) (depende de T006)
- [x] T031 [US2] Reemplazar el `startsWith` por `resolverRutaSegura(VIDEOS_DIR, ...)` y usar `validarRangeCabecera` en `GET /api/media/video/:id` en `server.ts`, devolviendo `400` y `416` con `Content-Range: bytes */<size>` (depende de T005)
- [x] T032 [US2] Asegurar auth + rate limit de `messaging` en `POST /api/whatsapp/test-message` y `POST /api/whatsapp/simulate-incoming` en `server.ts` (depende de T030)

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Datos íntegros y consistentes entre reinicios (Priority: P3)

**Goal**: Ciclo de vida de datos sin resurrección ni pérdida tras reinicios; intención de flujo precisa.

**Independent Test**: Crear/editar/borrar y reiniciar ⇒ estado idéntico; mensajes no relacionados no activan el flujo.

### Tests for User Story 3 ⚠️

- [x] T033 [P] [US3] Prueba de intención en `tests/security/intent.test.ts`: un lote de mensajes no relacionados ("mi compra llegó tarde", "promociono mi negocio") no debe activar el flujo; mensajes con intención real sí ⇒ <1% falsos positivos (SC-006)
- [x] T034 [P] [US3] Guion/prueba de persistencia en `tests/security/persistence.test.ts`: crear banner/comercio, borrar banner, debitar clic, reiniciar la instancia y comparar estado (0 fantasma, 0 pérdida tras 3 ciclos) (SC-005)

### Implementation for User Story 3

- [x] T035 [US3] Refinar `isAskingForOffers` en `server.ts`: normalizar (minúsculas, sin acentos) y usar coincidencia por palabra/límite (`\b`) o frases completas en lugar de `includes("oferta")` (FR-015)
- [x] T036 [US3] Corregir el emparejamiento de teléfonos en `server.ts` (`obtenerPorTelefono`, `getOrFindAudienceUser`): normalizar a `519XXXXXXXX` y comparar por igualdad exacta, sin `.endsWith`/subcadenas (FR-016)
- [ ] T037 [US3] Verificar regresión de FLW-01..04 (sync autoritativo en `src/db/repo.ts`, arranque por dominio aislado y no re-siembra en `server.ts`, persistencia de comercio WhatsApp y débito de packs); corregir cualquier regresión detectada (FR-011..014)

**Checkpoint**: Las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Actualizar `INVENTARIO.md` con los endpoints `/api/auth/*`, el gate y las cabeceras de seguridad
- [ ] T039 [P] Actualizar `FLUJOS.md` con el flujo de login/token, verificación de webhooks y guard SSRF
- [ ] T040 Ejecutar `quickstart.md` de extremo a extremo (local y producción) y registrar resultados
- [ ] T041 Rotar las contraseñas de admin y comercio (estuvieron expuestas en el bundle) y re-sembrar `app_settings.auth_users` con los nuevos hashes
- [ ] T042 Validación final: `bun build server.ts --target=node --outdir /tmp/bc --external vite` + `bun run build` + `bun test` en verde, luego push y verificar post-deploy

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias (T003–T008).
- **User Stories (Phase 3–5)**: dependen de Foundational.
  - US1 (P1) primero (MVP). US2 y US3 pueden ir en paralelo tras Foundational, pero US2 es prerequisito natural de algunas validaciones de US3.
- **Polish (Phase 6)**: depende de las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: tras Foundational. Núcleo ya implementado; resta T018–T019 y pruebas.
- **US2 (P2)**: tras Foundational. Depende de helpers T005–T007. Independiente de US1 (pero usa su gate).
- **US3 (P3)**: tras Foundational. Independiente de US1/US2 (la persistencia FLW ya existe).

### Within Each User Story

- Escribir pruebas (T009/T020–T023/T033–T034) y verlas fallar antes de implementar.
- Helpers (T005) antes de sus usos (T024–T028, T031).
- Middleware (T006/T007) antes de T029/T030.
- `insertSecurityLog` (T004) antes de `logEventoSeguridad` (T008) antes de T019.

### Parallel Opportunities

- T002 junto a T001.
- T003, T004, T005, T006, T007 en paralelo (archivos/zonas distintas; T006/T007 comparten `server.ts` → coordinar edición).
- US1: T009 y T010 en paralelo.
- US2: T020–T023 en paralelo; T024/T025/T026/T031 en paralelo (cada uno una ruta distinta); T027 y T028 en paralelo.
- US3: T033 y T034 en paralelo.
- Polish: T038 y T039 en paralelo.

---

## Parallel Example: User Story 2

```bash
# Pruebas (en paralelo):
Task: "Prueba SSRF en tests/security/ssrf.test.ts"
Task: "Prueba de webhooks en tests/security/webhooks.test.ts"
Task: "Prueba de medios en tests/security/media.test.ts"
Task: "Prueba de middleware en tests/security/middleware.test.ts"

# Implementación en rutas distintas (en paralelo):
Task: "Allowlist en /api/ai/test (server.ts)"
Task: "Allowlist en /api/ai/generate (server.ts)"
Task: "Guard SSRF en /api/gemini/generate-video (server.ts)"
Task: "Ruta segura + Range en /api/media/video/:id (server.ts)"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 (Setup) → Phase 2 (Foundational).
2. Phase 3 (US1): completar T009–T010 y T018–T019 (el núcleo ya está desplegado).
3. **STOP y VALIDAR**: pruebas de US1 en verde (SC-001/SC-002).
4. Desplegar.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → deploy (MVP).
3. US2 → validar (SSRF/webhooks/rate/headers) → deploy.
4. US3 → validar (persistencia/intención) → deploy.
5. Polish (T038–T042) → validación final.

### Parallel Team Strategy

Con varios desarrolladores: completar Setup+Foundational juntos; luego A→US1 (rol/log),
B→US2 (SSRF/webhooks/media), C→US3 (intención/teléfonos/regresión). Coordinar
ediciones concurrentes de `server.ts`.

---

## Notes

- [P] = archivos/zonas distintas, sin dependencias.
- `server.ts` es un único archivo: evitar ediciones simultáneas no coordinadas.
- Verificar que las pruebas fallen antes de implementar.
- Confirmar build (`bun build server.ts` y `bun run build`) y `bun test` en verde antes de cada push.
- Rotar credenciales una vez desplegado el endurecimiento (T041).
