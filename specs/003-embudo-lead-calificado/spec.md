# Feature Specification: Embudo de Lead Calificado con Botones Nativos y Redirección Segura

**Feature Branch**: `003-embudo-lead-calificado`

**Created**: 2026-10-18

**Status**: Draft

**Input**: User description: "IMPLEMENTAR FASE 1B y 2 (Mosaico 1:1, Embudo de Lead Calificado con Botones Nativos y Redirección Segura)"

## Contexto y alcance

Sobre la base ya existente del mosaico de ofertas (feature `002-ofertas-mosaico-cpc`),
esta especificación convierte el envío de ofertas en un **embudo de conversión de dos
pasos** por WhatsApp y formaliza el **lead calificado** como unidad de valor y de
facturación por clic (CPC). El objetivo es reducir fricción, subir la conversión a
"lead calificado" y evitar el costo del mensaje del usuario que inicia la conversación.

Capacidades que define esta especificación:

1. **Mosaico 1:1 numerado (Fase 1B)**: la imagen de cada oferta es **cuadrada (1:1)**,
   el arte **no** incluye control de favoritos/corazón, y hasta **3 ofertas** se apilan
   en **una sola imagen** con un **número visible (1, 2, 3)** en la esquina superior
   izquierda de cada segmento.
2. **Embudo de botones nativos (Fase 2)**: tras la imagen del mosaico, el bot envía un
   mensaje **interactivo con 3 botones** ("Ver Opción 1/2/3") cuya identidad lleva la
   oferta correspondiente. Cuando el usuario toca un botón, el bot responde con el
   **mensaje impulsador de cierre** y un **botón de URL (CTA ofuscado)** hacia la
   redirección segura de esa oferta. **El primer mensaje no contiene enlaces genéricos**:
   el enlace solo aparece en el paso 2, asociado a la oferta elegida.
3. **Lead calificado y redirección segura (Fase 2)**: al seguir el enlace CTA se registra
   un **lead calificado** (oferta, comercio, teléfono, código de canje, facturabilidad,
   fecha/hora). El lead es **facturable** solo si ese teléfono no generó un lead
   facturable sobre la misma oferta en las **últimas 24 h**; si es facturable se genera
   **código de canje**, se **debita 1 clic** del saldo del comercio y se incrementa el
   contador de leads de la oferta; luego se **redirige** al WhatsApp del comercio con un
   mensaje prellenado que incluye el **código de canje** y el título de la oferta.
4. **Landing pública (Fase 1B/2)**: la tarjeta de oferta usa imagen **cuadrada**, **no**
   repite título/descripción bajo la foto, y su botón **"Lo quiero"** abre la app nativa
   de WhatsApp del **bot/plataforma** con un mensaje prellenado **"Quiero la oferta:
   [título]"**, que detona el **paso 2** directamente en el bot (evitando el costo del
   primer mensaje del usuario).

**Alcance excluido**: no se redefine el criterio de selección/ranking de ofertas ni la
moderación; no se cambia el motor de mensajería; no se introduce facturación distinta a
la ya existente por packs/clics; no se altera el flujo de "Me Gusta" (informativo) ya
especificado en 002.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Embudo de dos pasos con botones nativos (Priority: P1)

Un usuario pide ofertas al bot. Recibe **una sola imagen** (mosaico de hasta 3 ofertas
cuadradas y numeradas) acompañada de un texto que lista las 3 opciones, y **acto seguido
un mensaje con 3 botones** ("Ver Opción 1", "Ver Opción 2", "Ver Opción 3"). Al tocar un
botón, recibe el mensaje de cierre de esa oferta con un botón de enlace para asegurar su
código con el comercio.

**Why this priority**: Es el núcleo del embudo y la principal palanca de conversión; sin
los botones nativos el usuario debe volver a escribir, perdiendo intención y generando
costo de mensaje.

**Independent Test**: Solicitar ofertas con 3 (y con 1 y con 2) ofertas disponibles;
verificar que llega **una** imagen de mosaico numerada, seguida de un mensaje interactivo
con botones equivalentes al número de ofertas; tocar un botón y comprobar que llega el
mensaje de cierre con el enlace CTA de **esa** oferta.

**Acceptance Scenarios**:

1. **Given** 3 o más ofertas activas de comercios con saldo, **When** el usuario pide
   ofertas, **Then** recibe una única imagen de mosaico de 3 segmentos cuadrados
   numerados 1..3, un texto que lista las 3, y un mensaje con 3 botones que identifican
   cada oferta.
2. **Given** solo 2 ofertas activas, **When** el usuario pide ofertas, **Then** el
   mosaico tiene 2 segmentos y el mensaje interactivo ofrece 2 botones.
3. **Given** 1 sola oferta activa, **When** el usuario pide ofertas, **Then** el mosaico
   tiene 1 segmento y el mensaje interactivo ofrece 1 botón.
4. **Given** el mensaje del mosaico, **When** se envía, **Then** **no** contiene enlaces
   a ofertas ni a la web; el enlace solo aparece en el paso 2.
5. **Given** un usuario que toca "Ver Opción N", **When** el bot responde, **Then** el
   mensaje de cierre muestra el título de esa oferta, el ahorro estimado y un botón de
   enlace CTA que apunta a la redirección segura de esa oferta con el teléfono del
   destinatario.
6. **Given** un cliente de WhatsApp que no renderiza botones, **When** el usuario pide
   ofertas, **Then** el bot entrega una alternativa textual equivalente (lista numerada
   y opciones escritas) sin romper el flujo.

---

### User Story 2 - Lead calificado y redirección segura al comercio (Priority: P1)

Un usuario toca el enlace CTA de una oferta. El sistema registra un lead calificado,
decide si es facturable, genera un código de canje, debita el clic del comercio si
corresponde y redirige al usuario al WhatsApp del comercio con un mensaje que menciona la
oferta y muestra el código de canje.

**Why this priority**: Es el mecanismo de monetización (CPC) y de atribución de canjes;
define qué cuenta como "lead calificado".

**Independent Test**: Abrir el enlace CTA con un teléfono de prueba y comprobar la
redirección al WhatsApp del comercio con el código; verificar que se creó un lead
**facturable**, se debitó 1 del saldo y subió el contador de leads de la oferta; repetir
en menos de 24 h con el mismo teléfono y comprobar que el segundo lead **no** es
facturable y **no** debita.

**Acceptance Scenarios**:

1. **Given** un teléfono sin lead previo sobre la oferta en 24 h, **When** sigue el
   enlace CTA, **Then** se registra un lead **facturable** con **código de canje**, se
   debita 1 del saldo del comercio, se incrementa el contador de leads de la oferta y es
   redirigido al WhatsApp del comercio.
2. **Given** el mismo teléfono que ya generó un lead facturable sobre esa oferta hace
   < 24 h, **When** vuelve a seguir el enlace, **Then** el lead se registra como **no
   facturable**, **no** debita saldo, pero **sí** recibe código de canje y **sí** es
   redirigido.
3. **Given** un lead facturable, **When** se arma la redirección, **Then** el mensaje
   prellenado incluye el título de la oferta y el código de canje, dirigido al WhatsApp
   del comercio.
4. **Given** que pasan más de 24 h desde el último lead facturable de ese teléfono a esa
   oferta, **When** vuelve a seguir el enlace, **Then** el lead vuelve a ser facturable.
5. **Given** un comercio sin saldo, **When** llega el enlace (aunque sea por una oferta
   en circulación), **Then** el lead se registra como no facturable, no se debita y el
   saldo nunca queda en negativo; la redirección se mantiene.

---

### User Story 3 - Tarjeta 1:1 y botón "Lo quiero" en la landing (Priority: P2)

Un visitante de la web pública ve tarjetas con imagen **cuadrada** y sin título ni
descripción duplicados bajo la foto. El botón **"Lo quiero"** abre la app nativa de
WhatsApp del bot con el mensaje prellenado **"Quiero la oferta: [título]"**, entrando
directo al paso 2.

**Why this priority**: Mejora presentación y enganche en el canal web y evita el costo
del primer mensaje, pero es secundario frente al flujo de WhatsApp y la facturación.

**Independent Test**: Abrir la landing, verificar imagen cuadrada y ausencia de texto
duplicado; pulsar "Lo quiero" y comprobar que se abre WhatsApp nativo con el mensaje
"Quiero la oferta: [título]" dirigido al número del bot.

**Acceptance Scenarios**:

1. **Given** una tarjeta de oferta, **When** se muestra, **Then** la imagen es cuadrada
   (1:1) y no repite título/descripción.
2. **Given** una tarjeta, **When** el visitante pulsa "Lo quiero", **Then** se abre la
   app nativa de WhatsApp del bot con el mensaje "Quiero la oferta: [título]".
3. **Given** un mensaje entrante "Quiero la oferta: [título]" (por ejemplo desde la
   web), **When** el bot lo procesa, **Then** responde con el mensaje impulsador de
   cierre y el botón CTA de esa oferta (mismo paso 2 del embudo), sin reenviar el
   mosaico.

---

### Edge Cases

- **Menos de 3 ofertas**: el mosaico y el número de botones se ajustan al número real
  (1, 2 o 3) sin segmentos vacíos.
- **Cero ofertas disponibles**: no se envía mosaico ni botones; se comunica que no hay
  ofertas por ahora.
- **Botón no renderizado por el cliente**: se entrega alternativa textual equivalente.
- **Enlace sin teléfono**: el enlace CTA siempre transporta el teléfono del destinatario;
  no se contempla un lead válido sin teléfono.
- **Oferta o comercio inexistente**: no genera un lead corrupto ni redirige a un destino
  inválido.
- **Comercio con saldo agotado**: el lead se marca no facturable, no debita, saldo nunca
  negativo; la redirección se mantiene.
- **Doble toque / reintentos**: no produce doble débito ni códigos contradictorios.
- **Títulos o precios largos**: el texto del pie y de los botones permanece legible.
- **Fallo al componer o enviar la imagen**: el sistema falla de forma visible y no envía
  un mosaico incompleto (cae a alternativa textual si aplica).
- **Exceso de frecuencia** en el endpoint de redirección: peticiones por encima del
  límite se rechazan temporalmente sin facturar.
- **Reinicio de la instancia**: leads, códigos, contadores y saldos sobreviven.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST limitar el envío de ofertas del bot a un **máximo de 3**
  ofertas por solicitud.
- **FR-002**: El sistema MUST enviar esas ofertas como **una sola imagen compuesta**
  (mosaico vertical), no como imágenes o mensajes separados.
- **FR-003**: Cada segmento del mosaico MUST ser **cuadrado (1:1)** y la altura total
  MUST ser proporcional al número de ofertas.
- **FR-004**: Cada segmento MUST mostrar un **número visible (1, 2, 3)** en su **esquina
  superior izquierda**, sobre un fondo que garantice contraste.
- **FR-005**: El **arte individual** de una oferta MUST ser **cuadrado (1:1)** y MUST NOT
  incluir control de favoritos/corazón.
- **FR-006**: El mensaje que acompaña al mosaico MUST enumerar cada oferta incluida con
  al menos su **título**; MUST NOT incluir enlaces a ofertas ni a la web.
- **FR-007**: Inmediatamente después del mosaico, el sistema MUST enviar un **mensaje
  interactivo con botones nativos** con un botón por oferta ("Ver Opción 1/2/3"), cuya
  identidad MUST transportar la **oferta correspondiente**.
- **FR-008**: Si el cliente de WhatsApp no soporta botones, el sistema MUST ofrecer una
  **alternativa textual** equivalente (lista numerada + opción escrita) que permita
  continuar el flujo.
- **FR-009**: Al recibir la selección de un botón (o una intención escrita equivalente,
  p. ej. "Quiero la oferta: [título]"), el sistema MUST responder con el **mensaje
  impulsador de cierre** de esa oferta: saludo de elección, título de la oferta y ahorro
  estimado (precio normal − precio oferta), más un **botón de URL (CTA)**.
- **FR-010**: El botón CTA del paso 2 MUST apuntar a la **redirección segura** de esa
  oferta e incluir el **teléfono del destinatario**.
- **FR-011**: El sistema MUST registrar un **lead calificado** al seguirse el enlace,
  capturando al menos: oferta, comercio, **teléfono**, **código de canje**, marca de
  facturabilidad y **fecha/hora**.
- **FR-012**: El lead MUST clasificarse como **facturable** únicamente si ese teléfono
  **no** tiene un lead **facturable** sobre la **misma oferta** en las **últimas 24 h**;
  en caso contrario MUST registrarse como **no facturable**. La ventana de 24 h se ancla
  al **último lead facturable**; los leads no facturables MUST NOT reiniciarla. Dentro de
  cada ventana solo el **primer** lead es facturable; transcurridas las 24 h el siguiente
  vuelve a serlo.
- **FR-013**: El sistema MUST generar un **código de canje** legible y **único globalmente**
  por lead (formato `NV-XXXXXX`, 6 caracteres de un alfabeto sin ambiguos). El código MUST
  seguir siendo válido aunque el mismo teléfono vuelva a generar leads sobre la misma oferta.
- **FR-014**: El sistema MUST debitar **un clic** del saldo del comercio **solo** cuando
  el lead sea facturable y como **máximo una vez por ventana de 24 h** (FR-012); los
  leads no facturables MUST NOT debitar.
- **FR-015**: El sistema MUST incrementar el **contador de leads de la oferta** solo
  cuando el lead sea facturable.
- **FR-016**: El sistema MUST redirigir al usuario (redirección HTTP) al WhatsApp del
  comercio con un mensaje prellenado que incluya el **código de canje** y el **título de
  la oferta**.
- **FR-017**: El saldo de clics de un comercio MUST NOT quedar en negativo.
- **FR-018**: El endpoint público de redirección MUST aplicar **límite de frecuencia por
  IP/teléfono** y responder con rechazo temporal al excederse, sin facturar.
- **FR-019**: En la landing pública, la imagen principal de cada tarjeta MUST ser
  **cuadrada (1:1)** y la tarjeta MUST NOT repetir título ni descripción bajo la imagen.
- **FR-020**: El botón **"Lo quiero"** de la landing MUST abrir la app nativa de WhatsApp
  del **bot/plataforma** con el mensaje prellenado **"Quiero la oferta: [título]"**.
- **FR-021**: Los leads calificados (con su marca de facturabilidad y código) y los
  contadores/saldos asociados MUST persistir y sobrevivir reinicios de la instancia.
- **FR-022**: El orden y la prioridad de las ofertas del mosaico MUST corresponder al
  criterio de selección vigente del bot, truncado a las 3 primeras; este feature MUST NOT
  introducir un nuevo criterio de ranking.

### Key Entities *(include if feature involves data)*

- **Lead calificado**: evento de un usuario sobre una oferta; atributos: oferta, comercio,
  teléfono, código de canje, si es facturable, fecha/hora.
- **Código de canje**: identificador legible generado por lead, usado por el comercio para
  validar la conversión.
- **Oferta (conteo de leads)**: la oferta acumula un contador de leads calificados.
- **Comercio (saldo CPC)**: saldo de clics que se debita por leads facturables.
- **Mosaico de ofertas**: composición vertical de hasta 3 segmentos cuadrados numerados,
  entregada como una sola imagen.
- **Mensaje interactivo**: mensaje con botones nativos cuyo identificador enlaza a la
  oferta y habilita el paso 2 del embudo.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las solicitudes de ofertas produce como máximo una imagen de
  mosaico de hasta 3 segmentos numerados, seguida de un mensaje interactivo con botones
  equivalentes al número de ofertas (0 casos de múltiples imágenes separadas).
- **SC-002**: El 100% de las imágenes de oferta individuales generadas son cuadradas
  (1:1) y sin control de favoritos; el 100% de los segmentos muestra su número en la
  esquina superior izquierda.
- **SC-003**: El mensaje del mosaico no contiene enlaces en el 100% de los envíos.
- **SC-004**: El 100% de las selecciones de botón (o intenciones escritas equivalentes)
  produce el mensaje de cierre con botón CTA de la oferta correcta.
- **SC-005**: El 100% de los enlaces CTA seguidos genera un lead calificado; de ellos,
  exactamente los primeros por teléfono/oferta cada 24 h quedan marcados como facturables
  (0 dobles débitos dentro de la ventana).
- **SC-006**: El saldo del comercio se reduce en exactamente 1 por cada lead facturable y
  en 0 por los no facturables, verificado con leads repetidos.
- **SC-007**: El 100% de las redirecciones abre WhatsApp del comercio con un mensaje que
  contiene el título de la oferta y el código de canje.
- **SC-008**: El 100% de las tarjetas de la landing muestra imagen cuadrada sin texto
  duplicado; "Lo quiero" abre WhatsApp nativo del bot con "Quiero la oferta: [título]" en
  el 100% de las pruebas.
- **SC-009**: Tras un reinicio de la instancia, el 100% de los leads, códigos, contadores
  y saldos se conservan.

## Assumptions

- El enlace CTA es generado por el bot para el teléfono del destinatario y SIEMPRE lo
  transporta **cuando el teléfono pudo resolverse** (número peruano válido). Si el
  destinatario llega con un **LID no resoluble**, el enlace se emite **sin** teléfono y el
  lead resultante **no es facturable**.
- La ventana de facturabilidad es de **24 horas** por par teléfono/oferta.
- El código de canje es corto y legible (`NV-XXXXXX`); es único entre **todos** los leads
  registrados, no solo por par teléfono/oferta.
- Los botones nativos se envían por el canal de mensajería vigente; cuando el cliente no
  los soporta, se usa una alternativa textual equivalente.
- "Lo quiero" se dirige al WhatsApp del **bot/plataforma** (no al comercio), según lo
  indicado.
- El formato 1:1 se aplica tanto al arte enviado por WhatsApp como a la tarjeta de la
  landing.
- Los packs de clics y el mecanismo de débito por comercio ya existen y se reutilizan.
- Se mantiene el motor de mensajería actual y el canal activo; no cambia la autenticación.

## Dependencies

- Base del mosaico 1:1, CPC y redirección ya operativa (feature `002-ofertas-mosaico-cpc`).
- Saldo y packs de clics por comercio operativos (módulo de facturación).
- Número de WhatsApp del comercio registrado para construir la redirección.
- Número de WhatsApp del bot/plataforma disponible para "Lo quiero".
- Canal de mensajería vigente capaz de enviar mensajes interactivos/botones (o su
  alternativa textual).
