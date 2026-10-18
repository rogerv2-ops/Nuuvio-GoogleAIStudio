# Contract: Redirección Segura de Lead — `GET /c/:ofertaId`

Endpoint público que registra el **lead calificado** y redirige al WhatsApp del comercio.

---

## Request

```
GET /c/:ofertaId?u={telefonoNormalizado}
```

- Ruta pública (exenta del middleware de auth, como hoy).
- `ofertaId`: id de la oferta seleccionada.
- `u` (**requerido para facturar**): teléfono del lead (9–15 dígitos). Si falta o no es
  válido, el lead se registra igualmente con `usuarioTelefono = "anonimo"` y
  `saldoDisponible = false` → **nunca facturable**. Así se cierra el hallazgo de auditoría
  "`?u=` infla clics".

**Rate limit**: 20 req / 60 s por IP (`rateLimit("clicks", 20, 60000)`, FR-018).

---

## Comportamiento

1. Cargar la oferta por `ofertaId`. Si no existe o no está vigente → no registra lead.
2. `registerQualifiedLead({ ofertaId, comercioId, usuarioTelefono })`:
   - inserta fila en `click_logs` con `codigoCanje` `NV-XXXXXX`;
   - `facturable = true` solo si (a) hay teléfono válido (`u`) **y** (b) no hubo
     facturable de ese teléfono+oferta en 24 h **y** (c) el comercio tiene saldo;
   - si facturable → `debitarClic(comercioId)` (saldo nunca negativo) y
     `offers.leadsCalificados += 1`.
3. Responder **302** con `Location` al WhatsApp del comercio:

```
https://api.whatsapp.com/send?phone={comercioWhatsapp}
   &text={mensaje con el codigoCanje NV-XXXXXX}
```

Mensaje al comercio (ejemplo):

```
¡Hola! Quiero la oferta: {Título}. Mi código es {NV-XXXXXX}.
```

---

## Respuestas

| Caso | Status | Efecto |
|------|--------|--------|
| Lead registrado (facturable o no) | `302` | `Location` a WhatsApp del comercio |
| Oferta inexistente/no vigente | `302` | a WhatsApp genérico del comercio (sin lead) |
| Comercio sin `comercioWhatsapp` | `302` | a `{VUUV_PUBLIC_ORIGIN}` (landing) |
| Límite de tasa excedido | `429` | — |

---

## Invariantes

- El lead **siempre** se persiste antes de redirigir (FR-011, FR-021).
- El contador `leadsCalificados` y el débito CPC ocurren **solo** si `facturable` (FR-014/FR-015).
- Doble apertura dentro de 24 h → segundo lead **no facturable** (FR-012).
- El saldo del comercio nunca queda negativo (FR-017).
