# Contract: POST /api/ofertas/:id/like

Registra un "Me Gusta" anónimo sobre una oferta e incrementa su contador.

- **Método / Ruta**: `POST /api/ofertas/{id}/like`
- **Auth**: Pública (incluida en `esRutaPublica`).
- **Rate limit**: Sí — bucket dedicado por IP (FR-019/FR-023). Al exceder ⇒ `429`.
- **Body**: vacío.

## Responses

| Código | Cuerpo | Cuándo |
|--------|--------|--------|
| `200` | `{ "ok": true, "likes": <number> }` | Oferta encontrada; contador incrementado y persistido |
| `404` | `{ "ok": false, "error": "Oferta no encontrada" }` | No existe la oferta |
| `429` | `{ "ok": false, "error": "..." }` | Límite de frecuencia excedido |

## Requisitos

- El incremento debe ser **atómico y persistente** (FR-016): debe sobrevivir a un
  reinicio del servicio y no perderse por escrituras concurrentes.
- Cada tap suma `+1` (sin deduplicación por usuario — clarificación Q1).
- El valor `likes` devuelto debe reflejar el total tras el incremento.
