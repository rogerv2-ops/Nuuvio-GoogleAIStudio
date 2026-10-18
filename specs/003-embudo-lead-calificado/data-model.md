# Phase 1 — Data Model: Embudo de Lead Calificado

Entidades y DTOs que toca la feature. **No se crean tablas nuevas** (ver `research.md` R3).

---

## 1. `click_logs` — Lead (persistido, ya existente)

Tabla física en Postgres que representa el **lead calificado**. No se renombra.

| Campo | Tipo | Notas |
|-------|------|-------|
| `id` | serial PK | — |
| `oferta_id` | text | FK lógica a `offers.id` |
| `comercio_id` | text | FK lógica a `offers.comercioId` (denormalizado) |
| `usuario_telefono` | text | teléfono normalizado del lead |
| `codigo_canje` | text | formato `NV-XXXXXX` (6 chars, alfabeto sin ambiguos), único global por lead |
| `facturable` | boolean | `true` si no hubo facturable de ese teléfono+oferta en 24 h |
| `creado_en` | timestamp | default now |

**Reglas**:
- Un lead es **facturable** si no existe otro `facturable = true` para el mismo
  (`usuario_telefono`, `oferta_id`) en las últimas 24 h (anclado al último facturable).
- Ventana de 24 h por **teléfono + oferta** (no global).

**Acceso canónico**:
- `registerQualifiedLead({ ofertaId, comercioId, usuarioTelefono })` → `{ facturable, codigoCanje }`.
- `registerOfferClick(...)` se mantiene como **alias deprecado** que delega en la anterior.

**Transiciones**:
```
selección de oferta → registerQualifiedLead()
    ├─ ¿existe facturable < 24 h para (telefono, oferta)?
    │     sí → insertar lead NO facturable  (no debita, no suma)
    │     no → insertar lead facturable
    │            ├─ debitarClic(comercioId)   [saldo nunca negativo]
    │            └─ offers.leadsCalificados += 1
    └─ generar codigoCanje (NV-XXXXXX) → 302 a WhatsApp del comercio con el código
```

---

## 2. `offers` — campos relevantes (ya existentes)

| Campo | Tipo | Uso en esta feature |
|-------|------|---------------------|
| `id` | text PK | id del botón interactivo; clave del lead |
| `titulo` | text | texto del listado (Paso 1) y del cierre (Paso 2); búsqueda del intent |
| `comercioId` | text | dueño del saldo a debitar |
| `comercioNombre`, `comercioWhatsapp` | text | destino del 302 (paso lead) |
| `precioNormal`, `precioOferta` | numeric | ahorro mostrado en el cierre |
| `clics` | int | contador total de clics (informativo) |
| `leadsCalificados` | int | **+1 por lead facturable** |
| `estado` | text | solo ofertas vigentes entran al embudo |
| `likes` | int | informativo (no factura); no afectado por el embudo |

**Invariante**: `offers.leadsCalificados` se incrementa **únicamente** con leads
`facturable = true` (FR-015).

---

## 3. `app_settings` — saldo CPC (ya existente)

| Clave | Forma | Uso |
|-------|-------|-----|
| `click_packs_list` | JSON `{ comercioId: { saldo } }` | Saldo de clics por comercio |

**Regla**: `debitarClic(comercioId)` descuenta 1 si `saldo > 0`; si el saldo llega a 0 el
lead se registra **no facturable**. Nunca negativo (FR-017). `comercioTieneSaldo` filtra
las ofertas del embudo (FR, ya en despacho).

---

## 4. DTO `OfferCardData` (render, ya existente)

Entrada de `renderOfferCardImage` / `renderMosaicImage`.

| Campo | Tipo | Notas |
|-------|------|-------|
| `titulo` | string | — |
| `precioNormal`, `precioOferta` | number | — |
| `imagen` | Buffer\|string | imagen base |
| `distrito`, `comercioNombre` | string | overlay |
| `numero` | number? | índice 1..3 en el mosaico (círculo **x=40, y=40**) |
| `descuentoPct` | number? | badge |

**Regla**: `renderMosaicImage(segmentos.slice(0, 3))` — máximo **3** segmentos (FR-001).
Sin corazón/like en la tarjeta (ya cumplido).

---

## 5. DTO de salida `WhatsAppSendPayload` (extendido)

Payload que acepta `doSend` para el embudo.

| Campo | Tipo | Notas |
|-------|------|-------|
| `chatId` | string | teléfono destino |
| `image` | string? | ruta/base de imagen (Paso 1) |
| `caption` | string? | texto del mensaje (sin enlaces en Paso 1) |
| `buttons` | `{ id, text }[]`? | **NUEVO** — botones de respuesta rápida (id = `ofertaId`) |
| `interactiveButton` | `{ displayText, url }`? | CTA de URL (Paso 2); ahora permitido **sin** `image` |
| `text` | string? | texto plano / fallback |

**Mapeo por canal**:
- **Meta**: `buttons` → `interactive.type="button"`, `action.buttons[].type="reply"`;
  `interactiveButton` → `interactive.type="cta_url"`.
- **Baileys**: `buttons` → `sendMessage(jid, { text, buttons })`; `interactiveButton` →
  `templateButtons:{ urlButton:{...} }`.
- **Fallback** (error o canal simple): concatenar `buttons` como texto numerado y/o la URL
  en texto plano (FR-008).

---

## 6. DTO de entrada `SelecciónEntrante` (normalizado, nuevo)

Resultado de parsear un mensaje entrante en `procesarMensajeEntrante`.

| Campo | Tipo | Origen |
|-------|------|--------|
| `texto` | string? | `msg.text.body` |
| `buttonId` | string? | Meta `interactive.button_reply.id` / Baileys `buttonsResponseMessage.selectedButtonId` / `templateButtonReplyMessage.selectedId` |
| `telefono` | string | chat/jid emisor |

**Regla**: si hay `buttonId`, resolver la oferta por `id`; si no, por intent de texto
(`"quiero la oferta:"`). Ambos convergen al Paso 2.

---

## 7. `facturacion` — interacción (ya existente)

- `debitarClic(comercioId)` → descuenta 1 del saldo.
- Packs/prices para recargas (no modificado por esta feature).

---

## Entidades NO tocadas

- `audience_users` (sin cambios; el teléfono del lead ya proviene del chat).
- `sessions`, `auth_users` (sin cambios).
- `likes`/`incrementOfferLikes`: informativo, **no** facturable (comportamiento actual).
