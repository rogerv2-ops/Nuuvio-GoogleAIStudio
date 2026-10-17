# Contract: Despacho de ofertas por WhatsApp (mosaico)

Comportamiento del bot al comando de ofertas (equivalente a `dispatchOffersMosaic`).

## Entrada

- Solicitud de ofertas de un usuario de WhatsApp (comando/texto, o flujo automático).

## Selección

1. Filtrar ofertas elegibles:
   - `estado === "activa"`
   - no vencidas (`venceEn` futuro)
   - comercio con `comercioWhatsapp` válido
   - **saldo de clics del comercio > 0** (FR-020; clarificación Q2)
2. Ordenar por el criterio vigente del bot: prioridad de plan del comercio, luego
   `likes`, luego fecha (sin ranking nuevo — clarificación Q4).
3. Truncar a **máximo 3** ofertas (FR-001).

## Envío

- **Un solo mensaje** por ciclo (FR-002) que contiene:
  - **Imagen** = mosaico vertical de segmentos **1:1** numerados (1️⃣/2️⃣/3️⃣),
    compuesto por `renderMosaicImage` (800 × 800·N).
  - **Pie (caption)** = por cada oferta: número, título, precio y su enlace de
    redirección `/c/{ofertaId}` (que lleva al WhatsApp del comercio).

## Reglas

- Si tras el filtro quedan 0 ofertas, no se envía mosaico.
- La tarjeta individual generada (`renderOfferCardImage`) es **800×800 sin corazón**
  (FR-006/FR-007); la numeración y el "me gusta" pertenecen a capas distintas.
- El enlace de cada oferta incluye siempre el teléfono del comercio (generado por
  el bot; clarificación Q3).
