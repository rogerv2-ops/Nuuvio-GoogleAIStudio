# ADR-0002: Un dominio con su propia tabla no emite evento

- Estado: aceptada
- Fecha: 2026-10-21
- Decidido por: el dueño (Roger), al pedir "un mapeo completo de eventos"

## Contexto

Había **dos sistemas de registro que no se hablan**:

- El **persistente**: tablas (`click_logs`, `chat_logs`, `audience_users`,
  `click_packs`, `offers`...).
- El **efímero**: `coreEvents`, un `Map` en memoria del navegador. Los eventos se
  perdían al recargar y el panel terminaba inventando números (240 usuarios, 625
  vistas, 12 ventas) con la base vacía.

## Decisión

Se crea la tabla `eventos` **solo para lo que no tiene tabla propia**: la visita a la
landing, la impresión de una oferta, la entrega de una oferta al bot, los pasos del
embudo y la venta confirmada.

**Regla que se sigue desde entonces**: un dominio con su PROPIA tabla no emite evento.

| Hecho | Dónde vive |
|---|---|
| Clic | `click_logs` |
| Chat | `chat_logs` |
| Audiencia | `audience_users` |
| Pack / saldo | `click_packs` |
| Oferta y su estado | `offers` |
| **Visita, impresión, entrega, embudo** | **`eventos`** |

## Consecuencias

- No hay doble verdad: cada hecho se lee de un solo sitio.
- `coreEvents` queda como memoria de la sesión para los listeners, y **además** postea a
  `POST /api/eventos` para que sobreviva a la recarga.
- El alta de eventos es pública (la visita ocurre sin sesión) pero blindada: lista blanca
  de tipos, solo las claves permitidas por tipo, sin PII y con hash de IP.
