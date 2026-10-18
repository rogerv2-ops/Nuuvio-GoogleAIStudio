# Phase 0 — Research: Embudo de Lead Calificado

Resuelve las incógnitas técnicas del spec 003 y consolida las decisiones de diseño.
Todas las decisiones se apoyan en el código real del repo (ver `plan.md` → Gap Analysis).

---

## R1. ¿Cómo se envían botones nativos por canal?

**Decisión**: Enviar un **mensaje interactivo `type:"button"`** en Meta Cloud API y, en
Baileys, un mensaje con `buttons` (quick-reply); ante error o canal no soportado, **caer a
texto numerado**. El canal se determina igual que hoy en `doSend` (Baileys si hay
`activeBaileysSocket` en WORKING; Meta si hay credenciales; si no, simulación).

**Rationale**: El repo **no usa WAHA**; el motor real es **Baileys 7.0.0-rc14** embebido y
Meta Cloud API es el canal alterno. `doSend` ya bifurca por canal y ya sabe mandar
`interactive` (`cta_url`) en Meta y `templateButtons` en Baileys. Los botones de
**respuesta rápida** son la pieza nueva.

**Alternatives considered**:
- *Introducir WAHA* → rechazado: contenedor/compose inexistente, `wahaConfig.endpointUrl/apiKey`
  es config muerta (0 llamadas HTTP), y en WAHA los botones son **Plus-only** y la propia
  doc advierte "not super stable".
- *Solo texto* → rechazado por el spec (FR-007 exige botones cuando el canal los soporte).
- *Lista (`sendList`)* → más frágil entre clientes que botones; se opta por botones.

**Riesgos**: soporte de quick-reply desigual → mitigado por **fallback textual obligatorio**
(FR-008) y por no bloquear el embudo si el botón falla.

---

## R2. ¿Cómo se interpreta la respuesta del botón (entrante)?

**Decisión**: Normalizar en `procesarMensajeEntrante` una **selección** unificada a partir de:
- Meta: `msg.interactive?.button_reply?.id` (id = `ofertaId`).
- Baileys: `msg.message?.buttonsResponseMessage?.selectedButtonId` y
  `templateButtonReplyMessage?.selectedId`.
- Texto: `"Quiero la oferta: <título|id>"` (ya existe el soft-intent).

La selección se traduce a la misma ruta que el intent de texto (Paso 2). Si el id no
corresponde a una oferta vigente, se cae a la búsqueda por título.

**Rationale**: Hoy el webhook solo lee `msg.text?.body`, por lo que un tap de botón se
descartaría. Unificar el parseo evita duplicar la lógica de Paso 1/2.

**Alternatives considered**: Mapear el botón a un texto sintético y reusar el parser actual
(válido, pero más indirecto); se prefiere pasar una `selección` explícita a la función.

---

## R3. ¿`leadLogs` nueva tabla o `click_logs` existente?

**Decisión**: **Reutilizar la tabla física `click_logs`** como el registro de leads y
exponer la función canónica **`registerQualifiedLead(...)`** en `src/db/repo.ts`;
`registerOfferClick` se conserva como **alias deprecado** que delega en la nueva.

**Rationale**: `click_logs` ya modela exactamente el lead (oferta, comercio, teléfono,
`codigoCanje`, `facturable`, timestamp) y `registerOfferClick` ya implementa la ventana de
24 h anclada a `facturable`. Renombrar la tabla rompería el principio III (deploy no borra
data) porque `drizzle-kit push` crearía una tabla nueva y dejaría la antigua huérfana.
Reutilizar mantiene **cero migración destructiva** y cero riesgo de datos.

**Alternatives considered**:
- *Tabla nueva `lead_logs`* → duplicaría datos y obligaría a unir dos tablas en cada
  conteo/limpieza; rechazado.
- *Renombrar `click_logs` → `lead_logs`* → destructivo; rechazado.

**Nota**: el nombre "leadLogs" del spec queda como concepto/alias de dominio; la
persistencia física es `click_logs`.

---

## R4. Ventana de facturabilidad de 24 h

**Decisión**: Se mantiene la semántica **por teléfono + oferta**, contando desde el **último
lead facturable**; un lead dentro de la ventana es **no facturable**. El contador
`leadsCalificados` y el débito CPC solo aplican a leads **facturables**.

**Rationale**: Ya implementado en `registerOfferClick`. Evita doble cobro por el mismo
usuario/oferta y cumple FR-012/FR-014/FR-015.

**Alternatives considered**: ventana global por comercio (rechazado: castiga al comercio por
tráfico legítimo distinto) o por hora (rechazado: no pedido por el spec).

---

## R5. Posición de la numeración en el mosaico

**Decisión**: Mover el círculo numerado del mosaico a **`x=40, y=40`** (hoy `x=54, y=54`)
según el requisito de encuadre del spec.

**Rationale**: FR-002 exige la numeración en la esquina superior izquierda del mosaico; el
valor indicado por el requisito de diseño es (40,40).

**Alternatives considered**: dejar 54,54 (rechazado: no coincide con el encuadre solicitado;
el cambio es de bajo riesgo y localizado en `renderMosaicImage`).

---

## R6. Botón CTA sin imagen (Paso 2)

**Decisión**: Extender `doSend` para **enviar un CTA (`interactiveButton`) sin imagen**
(caption/texto corto). Hoy la rama `interactiveButton` solo actúa si viene `payload.image`.

**Rationale**: El mensaje de cierre del Paso 2 es **texto + botón CTA de URL** (FR-009/FR-010),
sin imagen. Meta `cta_url` admite sin cabecera; Baileys `templateButtons` funciona sobre
texto. Sin esta extensión, el botón no se envía.

**Alternatives considered**: incluir una miniatura (rechazado: el spec pide mensaje de cierre,
no otro mosaico; añade peso innecesario).

---

## R7. "Lo quiero" en la landing

**Decisión**: El botón abre **WhatsApp nativo del bot** mediante `abrirWhatsAppNativo(botPhone,
"Quiero la oferta: " + oferta.titulo)`. Se conserva el **gate de registro/verificación**
(hoy abre el modal de embudo si el usuario no está verificado) y el evento
`click_lo_quiero_directo`. El `botPhone` se obtiene de la config pública ya expuesta por el
servidor (`/api/whatsapp/config`), sin exponer nada nuevo.

**Rationale**: FR-020 pide abrir la app de WhatsApp del bot con el texto "Quiero la oferta:
[título]". Hoy navega a `/go/oferta/:id` (redirect web), lo que en móvil no garantiza abrir
la app nativa. `abrirWhatsAppNativo` ya implementa `whatsapp://send` + fallback web.

**Alternatives considered**: mantener `/go/oferta/:id` (rechazado: no cumple el texto ni el
esquema nativo pedido); exponer el teléfono hardcodeado (rechazado: se lee de config).

---

## R8. Fallback y resiliencia del embudo

**Decisión**: Cada paso degrada de forma independiente:
- Botones no soportados/error → texto numerado ("Responde 1, 2 o 3") (FR-008).
- CTA no soportado → URL en texto plano.
- Imagen falla → mensaje de texto con las opciones.

**Rationale**: El cliente de WhatsApp es heterogéneo; el embudo no debe romperse (SC-001).
Consistente con el patrón actual de `doSend` (Baileys `templateButtons` con `catch` a texto).

**Alternatives considered**: asumir soporte total de botones (rechazado: la doc advierte
inestabilidad).

---

## R9. Rate limit y antiinflado de `/c/:ofertaId`

**Decisión**: Mantener `rateLimit("clicks", 20, 60000)` sobre `/c/:ofertaId`. La ventana de
24 h ya evita doble facturación por usuario/oferta.

**Rationale**: FR-018. Mitiga el parámetro `?u=` para inflar clics (hallazgo de auditoría
previo, abierto). No se cambia el esquema de identidad del lead.

**Alternatives considered**: cap global por oferta/día (queda documentado como hallazgo
abierto, fuera del alcance de 003).

---

## R10. ¿Paso 1 es uno o dos mensajes?

**Decisión**: **Dos envíos**: (1) imagen del mosaico + texto numerado sin enlaces, y
(2) mensaje interactivo con los botones. El teléfono del usuario **no genera mensajes
adicionales** en este paso.

**Rationale**: FR-006/FR-007 describen "el mosaico seguido de un mensaje interactivo"; el
spec SC-001 lo enuncia como "como máximo una imagen de mosaico ... seguida de un mensaje
interactivo". Dos envíos del bot, una sola imagen.

**Alternatives considered**: botones dentro del mismo mensaje de imagen (Baileys lo permite
en algunos clientes vía `caption`+`templateButtons`, pero no es quick-reply y Meta no lo
soporta con 3 botones sobre imagen de forma fiable); rechazado por menor compatibilidad.

---

## Resumen de decisiones

| # | Tema | Decisión |
|---|------|----------|
| R1 | Envío de botones | `interactive button` (Meta) + `buttons` (Baileys) + fallback texto |
| R2 | Parseo entrante | Normalizar `button_reply`/`buttonsResponseMessage` + texto |
| R3 | Lead persistido | Reusar `click_logs`; canónico `registerQualifiedLead` |
| R4 | Ventana 24 h | Por teléfono+oferta desde último facturable |
| R5 | Numeración mosaico | `x=40, y=40` |
| R6 | CTA del Paso 2 | CTA sin imagen (extender `doSend`) |
| R7 | "Lo quiero" | WhatsApp nativo + "Quiero la oferta: [título]" |
| R8 | Resiliencia | Fallbacks de botón/CTA/imagen |
| R9 | Rate limit `/c/` | 20/min por IP |
| R10 | Paso 1 | 2 mensajes (mosaico+texto, luego botones) |
