# Feature Specification: Endurecimiento de Seguridad, Flujo y Lógica

**Feature Branch**: `001-security-hardening`

**Created**: 2026-10-16

**Status**: Draft

**Input**: User description: "revisa todo el sistema, audita y encuentra errores de flujo, logica y de seguridad"

## Contexto de la auditoría

Auditoría completa de la plataforma vuuy (backend `server.ts` con 53 endpoints,
frontend React, módulos de dominio, Postgres). Hallazgos clasificados por
severidad. Esta especificación define el trabajo de remediación como capacidades
verificables.

### Hallazgos (evidencia)

| ID | Severidad | Hallazgo | Evidencia |
|----|-----------|----------|-----------|
| SEC-01 | Crítica | Ningún endpoint de la API valida autenticación ni autorización; cualquiera con la URL puede leer, escribir, borrar y disparar acciones | `server.ts`: no existe middleware de auth; `app.use` solo define headers y static |
| SEC-02 | Crítica | Credenciales de administrador y comercio embebidas en el bundle del navegador, en texto plano y visibles en la UI | `src/core/security.ts` `CREDENCIALES_SISTEMA` (`rogerv2@gmail.com` / `Pasion2271**//`); `ConfiguracionDomainView.tsx` muestra contraseñas |
| SEC-03 | Crítica | La sesión de administración es 100% cliente (localStorage `vuuy_auth_session_v3`); se puede forjar una sesión admin sin credenciales | `src/core/security.ts` `iniciarSesion`/`estaAutenticado` |
| SEC-04 | Crítica | Endpoints destructivos sin auth: borrar/purgar usuarios de audiencia y limpiar logs de registro | `DELETE /api/audience/users/:id`, `POST /api/audience/purge-user`, `POST /api/audience/clear-all-registration-logs` |
| SEC-05 | Alta | SSRF: se hace `fetch()` a URLs provistas por el cliente | `POST /api/ai/test`, `POST /api/ai/generate` (`baseUrl`), `POST /api/gemini/generate-video` (`imageUrl`) |
| SEC-06 | Alta | Webhooks de entrada sin verificación de firma/origen: se pueden inyectar mensajes falsos y disparar respuestas/registros | `POST /api/whatsapp/webhook`, `POST /api/waha/webhook`, `POST /api/whatsapp/simulate-incoming` |
| SEC-07 | Alta | Envío de WhatsApp arbitrario sin auth (spam/abuso) | `POST /api/whatsapp/test-message` |
| SEC-08 | Alta | Path traversal en servidor de video; no se confina la ruta resuelta al directorio permitido | `GET /api/media/video/:id` → `path.resolve(VIDEOS_DIR, fileName)` |
| SEC-09 | Media | Sin rate limiting ni protección de fuerza bruta en servidor; sin cabeceras de seguridad (CSP/HSTS/X-Frame-Options/nosniff) ni CORS explícito | `server.ts`: sin `helmet`/`cors`/limitador |
| SEC-10 | Media | Config por API sin auth: cambiar modo WhatsApp, credenciales de correo, purgar caché, cerrar sesión de WhatsApp | `POST /api/whatsapp/config`, `POST /api/email/config`, `POST /api/cache/purge`, `POST /api/waha/session/logout` |
| SEC-11 | Media | Límite de body 50 MB por request (DoS por memoria) | `server.ts`: `express.json({limit:"50mb"})` |
| FLW-01 | Alta | Eliminaciones de banners/ofertas no se propagaban a la base (solo upsert), reaparecían como datos fantasma | `src/db/repo.ts` `syncBanners`/`syncOffers` |
| FLW-02 | Alta | Un fallo en una sola carga del arranque abortaba todas las demás; datos no se leían de DB | `server.ts` `initDatabaseState` |
| FLW-03 | Media | Comercio registrado por WhatsApp, saldo de packs de clics no persistían | `server.ts` flujo registro comercio / `facturacionModule.debitarClic` |
| FLW-04 | Media | Listas vacías intencionales se re-sembraban con datos por defecto al reiniciar | `server.ts` arranque de banners/ofertas |
| LOG-01 | Media | Disparadores de texto demasiado laxos (`includes("oferta")`, `includes("promo")`) pueden activar el flujo con mensajes no relacionados | `server.ts` `isAskingForOffers` |
| LOG-02 | Baja | Extracción/comparación de teléfonos por subcadenas (`.endsWith`) puede asociar números distintos | `server.ts` `obtenerPorTelefono`, `getOrFindAudienceUser` |
| LOG-03 | Baja | Rangos HTTP de video no validados (valores negativos/fuera de rango) | `server.ts` `GET /api/media/video/:id` |

> Nota: FLW-01 a FLW-04 ya cuentan con un primer arreglo aplicado durante la
> auditoría (sync autoritativo, arranque a prueba de fallos, persistencia de
> comercio/packs, no re-sembrado). Se incluyen aquí para dejar el comportamiento
> como requisito verificable y evitar regresiones.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Acceso administrativo realmente protegido (Priority: P1)

Un visitante sin credenciales intenta abrir el panel de administración, llamar
directamente a cualquier endpoint de la API o forjar una sesión en el navegador.
El sistema debe impedir el acceso a operaciones sensibles tanto en el servidor
como en el cliente.

**Why this priority**: Hoy cualquier persona puede leer datos de usuarios,
borrar registros, cambiar la configuración y enviar mensajes de WhatsApp en
nombre de la plataforma. Es el riesgo más grave y de mayor impacto.

**Independent Test**: Sin credenciales válidas, toda llamada a endpoints
sensibles devuelve 401/403 y el panel no otorga acceso; forjar localStorage no
habilita operaciones; las credenciales no aparecen en el bundle.

**Acceptance Scenarios**:

1. **Given** un cliente sin sesión válida, **When** llama a un endpoint de
   escritura/borrado (`/api/banners/sync`, `/api/audience/users/:id`,
   `/api/whatsapp/test-message`, etc.), **Then** recibe 401/403 y no se modifica
   ningún dato.
2. **Given** el bundle JS descargado, **When** se inspecciona, **Then** no
   contiene contraseñas ni credenciales de administración.
3. **Given** el panel de administración, **When** el usuario inicia sesión con
   credenciales válidas, **Then** obtiene un token/sesión emitido por el servidor
   con expiración y rol; y **When** se intenta falsificar la sesión en el cliente,
   **Then** el servidor la rechaza.

---

### User Story 2 - Operaciones externas no son abusables (Priority: P2)

Un actor malicioso intenta usar las integraciones de la plataforma (IA, correo,
medios, webhooks) para causar daño, exfiltrar información o abusar de recursos.

**Why this priority**: SSRF, webhooks sin firma y envío arbitrario de mensajes
permiten abuso de costo, spam y acceso a red interna.

**Independent Test**: Las peticiones a URLs internas/metadatos son bloqueadas;
los webhooks sin firma válida se rechazan; el envío de mensajes requiere
autorización y respeta límites de frecuencia.

**Acceptance Scenarios**:

1. **Given** una petición a `/api/gemini/generate-video` con `imageUrl` apuntando
   a una dirección interna (p. ej. `http://169.254.169.254/...`), **When** se
   procesa, **Then** es rechazada y no se realiza la conexión.
2. **Given** un webhook entrante de Meta/WAHA sin firma válida, **When** llega,
   **Then** se descarta con error y no se procesa el mensaje.
3. **Given** rate excedido de envío de mensajes, **When** se supera el límite,
   **Then** las siguientes peticiones se rechazan temporalmente.

---

### User Story 3 - Datos íntegros y consistentes entre reinicios (Priority: P3)

Un operador crea, edita y elimina registros (banners, ofertas, comercios,
usuarios) y reinicia la instancia; el estado debe ser idéntico antes y después,
sin resurrección de datos borrados ni pérdida de datos creados.

**Why this priority**: La integridad percibida por el operador es clave; ya hubo
pérdidas/resurrecciones y se requiere blindar el comportamiento.

**Independent Test**: Crear/editar/borrar en cada dominio, reiniciar la
instancia y comparar el estado observado con el esperado.

**Acceptance Scenarios**:

1. **Given** un banner eliminado y guardado, **When** la instancia se reinicia,
   **Then** el banner no reaparece.
2. **Given** una lista vacía guardada intencionalmente, **When** la instancia se
   reinicia, **Then** la lista permanece vacía (no se re-siembran datos por
   defecto).
3. **Given** un comercio registrado por WhatsApp y un débito de clic, **When** la
   instancia se reinicia, **Then** ambos se conservan.
4. **Given** un fallo al cargar un dominio en el arranque, **When** el servidor
   inicia, **Then** los demás dominios igual se cargan desde la base.

---

### Edge Cases

- Token de sesión expirado o revocado durante el uso del panel.
- Petición con `Range` de video inválido (negativo, invertido, mayor al tamaño).
- Webhook duplicado o repetido (idempotencia de procesamiento de mensajes).
- URL de recurso externo con redirecciones hacia un destino interno.
- Lista de datos vacía guardada por el usuario vs. instalación nueva sin datos.
- Reinicio a mitad de una escritura (consistencia de la sincronización autoritativa).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST exigir autenticación en todos los endpoints de la API que lean o modifiquen datos sensibles o ejecuten acciones (config, sync, moderación, borrado, envío de mensajes, IA, correo).
- **FR-002**: El sistema MUST autorizar por rol: solo administradores pueden ejecutar operaciones de gestión/borrado; los comercios solo sobre sus propios recursos.
- **FR-003**: El sistema MUST emitir y validar la sesión del lado del servidor (token con expiración); la sesión del cliente no puede otorgar permisos por sí sola.
- **FR-004**: El sistema MUST NOT incluir credenciales, contraseñas ni secretos en el bundle del frontend ni mostrarlos en la UI.
- **FR-005**: El sistema MUST validar el origen/firma de los webhooks entrantes (Meta y WAHA) y descartar los no verificados.
- **FR-006**: El sistema MUST restringir las conexiones salientes disparadas por datos del cliente (SSRF): bloquear rangos privados/loopback/link-local y validar esquema/host.
- **FR-007**: El sistema MUST confinar las rutas de archivos servidos a sus directorios permitidos (sin traversal) y validar los rangos de bytes.
- **FR-008**: El sistema MUST aplicar límites de frecuencia a endpoints sensibles (login, envío de mensajes, IA, simulación) y límites razonables de tamaño de request.
- **FR-009**: El sistema MUST incluir cabeceras de seguridad (al menos `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`, `Referrer-Policy`) y una política CORS explícita.
- **FR-010**: El sistema MUST registrar eventos de seguridad relevantes (accesos denegados, intentos fallidos, cambios de configuración sensible).
- **FR-011**: El sistema MUST propagar eliminaciones a la base de datos de forma autoritativa (lo que se borra, se borra; lo que queda, queda) para banners y ofertas.
- **FR-012**: El sistema MUST cargar cada dominio de datos de forma independiente al arrancar, de modo que el fallo de uno no impida cargar los demás.
- **FR-013**: El sistema MUST persistir toda creación de dominio (incluido el registro de comercios por WhatsApp y los débitos de packs de clics).
- **FR-014**: El sistema MUST NOT re-sembrar datos por defecto cuando el usuario haya dejado intencionalmente una lista vacía.
- **FR-015**: El sistema MUST restringir la activación de flujos conversacionales a coincidencias de intención precisas (evitar disparos por subcadenas genéricas).
- **FR-016**: El sistema MUST evitar asociaciones erróneas de números de teléfono distintos al comparar/emparejar contactos.

### Key Entities *(include if feature involves data)*

- **Credencial de acceso**: identidad de administrador o comercio; ya no reside en el cliente.
- **Sesión**: emisión, expiración y validación del lado del servidor; rol y alcance.
- **Evento de seguridad**: registro de auditoría de accesos y acciones sensibles.
- **Recurso persistente**: banners, ofertas, comercios, usuarios de audiencia, packs de clics; su ciclo de vida debe sobrevivir reinicios.
- **Webhook entrante**: mensaje de Meta/WAHA con origen verificable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los endpoints sensibles rechaza peticiones no autenticadas (verificado por pruebas automatizadas que recorren la lista de endpoints).
- **SC-002**: 0 credenciales o secretos detectables en el bundle del frontend (escaneo del artefacto construido).
- **SC-003**: 100% de las peticiones SSRF de prueba a rangos internos son bloqueadas.
- **SC-004**: 100% de los webhooks sin firma válida son rechazados y no generan procesamiento de mensajes.
- **SC-005**: 0 casos de datos fantasma (elementos borrados que reaparecen) y 0 casos de pérdida de datos creados tras 3 ciclos de reinicio en prueba.
- **SC-006**: Menos de 1% de falsos positivos en la activación del flujo de ofertas sobre un conjunto de mensajes de prueba no relacionados.

## Assumptions

- El despliegue sigue siendo un servicio único detrás de HTTPS (Coolify/Caddy), con Postgres y volúmenes persistentes ya configurados.
- Se prioriza autenticación basada en sesión/token sencilla (sin proveedor externo de identidad) acorde al tamaño actual del sistema.
- Los administradores son un conjunto pequeño y conocido; la gestión de credenciales puede migrarse a un almacén del servidor.
- Las integraciones Meta/WAHA soportan firma de webhook configurable; se usará el mecanismo estándar de cada proveedor.
- No se cambia la experiencia funcional del usuario final de WhatsApp; solo se endurece el acceso y la robustez.
- Los arreglos ya aplicados de persistencia (sync autoritativo, arranque a prueba de fallos, no re-sembrado) se mantienen y se cubren con pruebas de regresión.

## Dependencies

- Variables de entorno/secretos gestionados en el panel de despliegue (no en el repo).
- Capacidad de configurar firma de webhooks en Meta Cloud API y/o WAHA.
