# Contract: Landing Pública — Tarjeta 1:1 y botón "Lo quiero"

Contrato de UI/acción de `src/components/PublicWeb.tsx`.

---

## Tarjeta de oferta

- Imagen en **relación 1:1** (`aspect-square`), igual que la tarjeta/mosaico del bot (FR-019).
- El **título** se muestra **sobre la foto** (scrim inferior). **No** se repite el título ni
  la descripción debajo de la foto. (Ya cumplido en el código actual.)
- Sin corazón en la tarjeta generada; el "Me Gusta" de la landing es **informativo** y no
  factura (comportamiento actual, no afectado por el embudo).
- Precio de oferta destacado + precio normal tachado.

---

## Botón "Lo quiero"

Al tocar (FR-020):

1. Emitir el evento `click_lo_quiero_directo` (con `ofertaId`, `oferta?.distrito`,
   `oferta?.comercioNombre`).
2. **Gate de registro**: si el usuario **no** está verificado → abrir el modal del embudo de
   registro (comportamiento actual) y detenerse.
3. Si está verificado → `abrirWhatsAppNativo(botPhone, "Quiero la oferta: " + oferta.titulo)`:
   - `whatsapp://send?phone={botPhone}&text={...}` (esquema nativo);
   - fallback a `https://api.whatsapp.com/send?...` a los ~1.2 s si la app nativa no tomó foco.

- `botPhone` se obtiene de la config pública del servidor (`/api/whatsapp/config`), sin
  exponer datos nuevos.
- El botón del **modal de ficha** (`fichaOferta`) y el de la tarjeta usan el **mismo**
  comportamiento y texto.

---

## Resultado esperado

- En móvil se abre la app de WhatsApp con el chat del bot y el texto
  `Quiero la oferta: {Título}` precargado.
- En desktop, fallback a WhatsApp Web.
- El servidor responde al mensaje entrante con el flujo del **Paso 2** (ver
  `contracts/whatsapp-offers-funnel.md`).
