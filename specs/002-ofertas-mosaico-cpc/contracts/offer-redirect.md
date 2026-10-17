# Contract: GET /c/:ofertaId

Registra el clic sobre una oferta (determinando si es facturable), actualiza
contadores y redirige a WhatsApp del comercio con un código de canje.

- **Método / Ruta**: `GET /c/{ofertaId}` (query opcional `u` / teléfono del usuario).
- **Auth**: Pública (incluida en `esRutaPublica`).
- **Rate limit**: Sí — bucket dedicado por IP/teléfono (FR-023). Al exceder ⇒ `429`.

## Flujo / Responses

| Paso | Comportamiento |
|------|----------------|
| 1 | Resolver la oferta por `ofertaId`. Si no existe ⇒ `404`. |
| 2 | `registerOfferClick(ofertaId, usuarioTelefono, comercioId)` ⇒ `{ facturable, codigoCanje }`. La ventana de 24 h se evalúa sobre clics **facturables**: `facturable = true` solo si no existe un clic `facturable = true` de ese teléfono para esa oferta en las últimas 24 h. |
| 3 | `oferta.clics += 1` y persistir. |
| 4 | Si `facturable && saldo(comercio) > 0`: `oferta.leadsCalificados += 1`, `debitarClic(comercioId)` (nunca por debajo de 0). Si no hay saldo ⇒ **no** debitar y marcar no facturable (FR-021). |
| 5 | Sincronizar la oferta. |
| 6 | `302` a `https://api.whatsapp.com/send?phone={comercioWhatsapp}&text={titulo + " " + codigoCanje}`. |

## Requisitos

- El teléfono del comercio **siempre** está presente porque el enlace lo genera el
  bot; no hay clic sin teléfono (clarificación Q3).
- Un segundo clic de la misma `(oferta, usuario)` dentro de 24 h: se registra como
  `facturable = false`, sin débito, y **aún así** redirige (FR-008/FR-009/FR-021).
  Los clics no facturables **no** reinician la ventana: solo el último clic
  **facturable** la ancla. Pasadas 24 h desde ese clic facturable, el siguiente
  clic vuelve a ser facturable (una venta cada 24 h).
- El débito es de exactamente 1 clic por clic facturable; `saldoClics >= 0` siempre.
