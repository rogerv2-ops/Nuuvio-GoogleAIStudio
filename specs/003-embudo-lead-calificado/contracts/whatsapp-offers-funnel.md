# Contract: Embudo de Ofertas por WhatsApp (Paso 1 y Paso 2)

Describe el comportamiento observable de la conversación del bot. No es HTTP sino el
"contrato" del diálogo (entradas/salidas del motor Baileys/Meta).

---

## Paso 1 — `dispatchOffersMosaic(telefono, ofertas)`

**Entrada**: teléfono destino + lista de ofertas vigentes (se usa `slice(0, 3)`).

**Precondición**: al menos una oferta con comercio con saldo (ya filtrado por el despacho).

### Salida A — imagen de mosaico (1 sola imagen)

- Imagen 800×800, 1:1, vertical, de hasta 3 ofertas, cada segmento numerado 1..3
  (**badge en `x=40, y=40`**).
- Pie de foto **sin enlaces**:

```
✨ *Aquí tienes las 3 mejores opciones cerca de ti:*
1️⃣ {Título 1}
2️⃣ {Título 2}
3️⃣ {Título 3}

👇 Elige la que quieras ver:
```

### Salida B — mensaje interactivo con botones

Hasta 3 botones de **respuesta rápida**:

| Botón | id | texto |
|-------|----|-------|
| 1 | `{ofertaId1}` | `Ver Opción 1` |
| 2 | `{ofertaId2}` | `Ver Opción 2` |
| 3 | `{ofertaId3}` | `Ver Opción 3` |

Mapeo por canal:
- **Meta**: `interactive.type="button"` con `action.buttons[{type:"reply", reply:{id, title}}]`.
- **Baileys**: `sendMessage(jid, { text, buttons: [...] })`.

**Fallback (FR-008)** — si el canal/botón falla o es simple:

```
Responde con el número de la oferta que quieres:
1) {Título 1}
2) {Título 2}
3) {Título 3}
```

---

## Paso 2 — `procesarMensajeEntrante(...)`

**Disparadores** (convergen al mismo resultado):
1. Botón: `buttonId ∈ {ofertaId1, ofertaId2, ofertaId3}`.
2. Texto: coincide con `"Quiero la oferta: {título}"` (soft-intent existente).

**Precondición**: la oferta referida sigue vigente; si no, se responde el mensaje de
"oferta no encontrada".

### Salida — mensaje impulsador de cierre + CTA

```
¡Gran elección! 🎯 *{Título}* te ahorra S/ {ahorro} hoy.

Toca el enlace de abajo para asegurar tus cupos enviando tu código único al WhatsApp del local. 👇
```

Y un **botón CTA de URL**:

| | valor |
|--|-------|
| texto | `Quiero esta oferta` |
| url | `{VUUV_PUBLIC_ORIGIN}/c/{ofertaId}?u={telefonoNormalizado}` |

Mapeo por canal:
- **Meta**: `interactive.type="cta_url"` (sin cabecera de imagen).
- **Baileys**: `templateButtons:[{ index:1, urlButton:{ displayText, url } }]`.

**Fallback**: URL en texto plano.

### Reglas

- La URL usa el **teléfono del destinatario** (FR-010) para descontar su propio lead.
- Si el teléfono del destinatario no se pudo resolver a número peruano (p. ej. **LID sin
  resolver**), la URL se emite **sin** `?u=`; el lead resultante es **no facturable** (FR-012/FR-018).
- El embudo **no** vuelve a enviar el mosaico en el Paso 2.
- Si el botón no se soporta, el paso 2 igual se entrega como texto + URL (resiliencia).
