# Fase canje y referidos — lo que hoy no llega a ningún lado

Estado: **anotada para una fase propia** (decisión del dueño, 2026-10-20: *"el codigo de canje tampoco va a algun lado ahora, el sistema de canje va para otra fase"*; y antes: *"por ahora el sistema de referidos no esta completo y va tambien para otra fase"*).
Rama: por crear cuando se arranque. Base: `main`.

## Por qué esta fase existe

Durante la corrección del flujo del botón "Lo quiero" (PR #23) salieron a la luz **dos códigos distintos que ninguno completa su circuito**. El dueño los confundió entre sí (muy comprensible: los dos viajan en el mismo mensaje), y la pregunta que abrió esta fase fue: *"revisa si ese codigo es referido o codigo de descuento"*.

## Los TRES códigos (no son dos)

| # | Código | Formato | Para qué es | ¿Hoy funciona? |
|---|--------|---------|-------------|----------------|
| 1 | **Código de referido** | `REF#####` (5 dígitos) | Que un usuario invite a otros y se le acrediten puntos | **A medias** — ver R1 |
| 2 | **Código de canje del clic** | `NV-XXXXXX` (6 chars) | Atribuir el clic a la oferta y al comercio | **A medias** — ver C1 |
| 3 | **Código de canje de premio** | 8 chars (ej. `K7M2QP4B`) | Canjear puntos por un premio en un comercio | **A medias** — ver C2 |

### R1 — Referidos: el campo existe, el circuito no

- Se genera en `src/modules/usuarios.ts:83,225` (`REF` + 5 dígitos aleatorios) al registrarse por la web.
- Se ve en el panel del admin (columna "Cód. Ref") y en el widget de atribución UTM (`UtmAttributionDashboardWidget.tsx:212`, `mapaAfiliados`).
- El tipo de movimiento de puntos contempla el motivo `'referido_registrado'` (`src/modules/puntos.ts:30`, `src/types/index.ts:134`).
- **Pero**: nadie invoca `acreditarPuntos` con ese motivo. Los únicos puntos que se acreditan son los **manuales** desde el panel de gestión (`motivo: 'ajuste_gestion'`, `UsuariosDomainView.tsx:86`).
- **Y no hay link de registro con código de referido** en la web: `UserRegistrationFunnelModal.tsx:168` lee `invitadoPor: atribucion?.afiliadoId`, pero nadie genera ese `afiliadoId` desde un `codigoRef`.

Es decir: el usuario recibe un código, ese código no se puede usar para nada y los puntos no se acreditan solos.

### C1 — El código del clic (`NV-XXXXXX`)

- Se genera en `registerOfferClick` (`src/db/repo.ts`), uno por clic, y se guarda en `click_logs.codigo_canje`.
- El usuario lo lleva en el mensaje al bot (`construirMensajeContactoWhatsApp`), y el bot lo usa (PR #23) para **atribuir el clic**: el clic deja de ser "anónimo" y queda con el teléfono real.
- El comercio lo recibe en el mensaje final de `/c/:id`: *"Hola, vi en Yuddit la oferta "X". Mi codigo es #NV-XXXXXX"*.
- **Lo que NO existe**: ninguna pantalla donde el comercio **ingrese** ese código para ver de qué oferta/clic viene, ni una que le confirme que el cliente es real. El código viaja al comercio pero el comercio no tiene dónde meterlo. Solo sirve para que un humano lo lea y lo cruze a mano.

### C2 — El canje de premios (el sistema que sí tiene pantalla)

- `VentasComercioView.tsx` (panel del comercio) tiene el input de código y llama a `puntosModule.validarCodigoCanje(codigo, comercio.id)` (`puntos.ts:140`), que marca el canje como `usado` y emite el evento.
- Los códigos salen de `puntos.ts:98-120` (8 caracteres) y se guardan en `this.canjes` (un `Map` **en memoria del navegador**).
- **Problemas**:
  - El `Map` de canjes está **en memoria del cliente**: si el usuario recarga la página, **los canjes emitidos se pierden** y el código deja de existir. No hay tabla en la base.
  - `puntosModule.validarCodigoCanje` se llama **sin token de sesión**: el canje lo valida el navegador del comercio, no el servidor. Cualquiera con un código puede canzearlo desde su propio navegador, y dos comercios pueden canjear el mismo código a la vez (no hay bloqueo atómico).
  - El método que **emite** el canje (`puntos.ts:98`) **no lo invoca nadie**: no hay flujo en la web pública donde un usuario canjee sus puntos por un premio. Las recompensas (`SEED_REWARDS`) solo se listan en el panel de admin.

## Decisiones ya tomadas por el dueño

- **2026-10-20**: el sistema de referidos va para otra fase (no se completa ahora).
- **2026-10-20**: el sistema de canje va para otra fase (no se completa ahora).
- Lo que **sí** quedó en producción (PR #23 y #24): el bot entiende el mensaje del botón "Lo quiero", entrega la oferta correcta con su enlace firmado, y el clic queda atribuido a la persona (no "anónimo"). El cobro y los contadores no se tocaron: el débito sigue siendo exclusivo del enlace firmado.

## Qué habría que decidir al arrancar la fase

1. **Dónde vive el canje**: tabla en la base (recomendado) o seguir en memoria del navegador. Si es en memoria, un canje se pierde al recargar y dos comercios pueden canjear lo mismo.
2. **Quién valida el canje**: el servidor (con la fila de la oferta y el saldo del usuario bajo control) o el navegador del comercio (como hoy, que no deja auditar nada).
3. **Si el `NV-XXXXXX` entra al panel del comercio** como algo consultable (qué oferta/clic trajo al cliente), o si se descarta y se reemplaza por el `ref` de la oferta, que ya viaja en el mensaje y es más legible.
4. **El circuito del referido**: si el código `REF#####` se entrega dentro de un link de registro (`/r/REF12345` o similar) y el que se registra suma puntos al que invitaba.

## Verificación de la fase

- Suite `tests/security` sin debilitar; `npm run lint` y `npm run build` en verde.
- Prueba de concurrencia en el canje: dos comercios con el mismo código, a la vez → **uno solo** puede canjear.
- Prueba de recarga: un canje emitido sigue siendo válido después de recargar la página.
- Prueba del circuito de referidos: A se registra con el link de B → A queda activo, B suma sus puntos, y el panel del admin lo muestra.

## Nota de alcance

Esta fase **no toca** el flujo que ya funciona (botón "Lo quiero" → oferta → enlace firmado → cobro). Ese camino está cerrado y verificado en los PR #23 y #24. Aquí se trata solo de los dos sistemas de códigos que quedaron a medias.
