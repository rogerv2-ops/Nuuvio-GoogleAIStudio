# Feature Specification: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

**Feature Branch**: `002-ofertas-mosaico-cpc`

**Created**: 2026-10-17

**Status**: Draft

**Input**: User description: "IMPLEMENTAR FASES 1B y 2 (Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección)"

## Contexto y alcance

El sistema envía a los usuarios de WhatsApp ofertas cercanas, y además publica
ofertas en una landing web. Hoy hay tres deficiencias que esta especificación
resuelve como capacidades verificables:

1. **Mosaico de ofertas (Fase 1B)**: el envío de ofertas no consolida las mejores
   opciones en una sola imagen cuadrada; se busca enviar **hasta 3 ofertas** en
   **un único mensaje** que contiene un **mosaico vertical** de imágenes cuadradas,
   cada una numerada, con un pie de mensaje que liste cada oferta.
2. **Formato 1:1 y limpieza de tarjeta (Fase 1B)**: la imagen de cada oferta deja
   de ser rectangular (4:5) y pasa a ser **cuadrada (1:1)**; se elimina el botón de
   favoritos/corazón del arte generado.
3. **Clics CPC y redirección (Fase 2)**: cuando un usuario sigue el enlace de una
   oferta, el sistema **registra el clic** (oferta, comercio, teléfono, fecha),
   determina si es **facturable** (primer clic de ese usuario a esa oferta en 24 h),
   genera un **código de canje**, **debita un clic** del saldo del comercio cuando
   corresponde y **redirige** al usuario a un chat de WhatsApp con el comercio con
   un mensaje prellenado que incluye el código de canje.

Además, en la landing pública las tarjetas usan imagen **cuadrada**, no repiten
título/descripción debajo de la imagen, incorporan un botón **"Me Gusta"**
interactivo que refleja el conteo en vivo, y el botón **"Lo quiero"** abre la app
nativa de WhatsApp con un mensaje dirigido a la plataforma.

**Alcance excluido**: no se rediseña la moderación ni el aprovisionamiento de
ofertas; no se cambia el proveedor de mensajería; no se introduce facturación
distinta a la ya existente por packs de clics.

## Clarifications

### Session 2026-10-17

- Q: ¿Cómo debe contarse el botón "Me Gusta" de la landing: cada toque suma uno, o solo un voto por usuario? → A: Cada toque suma 1 (anónimo, sin identificar ni deduplicar al visitante).
- Q: Cuando un clic sería facturable pero el comercio ya no tiene saldo de clics, ¿cómo debe comportarse el sistema? → A: Con clics agotados la oferta NO se despacha; los comercios sin saldo quedan excluidos del mosaico.
- Q: Si alguien abre el enlace sin que llegue el teléfono del usuario, ¿cómo se trata el clic? → A: No aplica; el enlace lo genera el bot para el teléfono del destinatario, por lo que el teléfono SIEMPRE viaja en el enlace.
- Q: ¿Cómo se eligen y ordenan las hasta 3 ofertas del mosaico? → A: Se reutiliza el criterio/orden de selección ya existente del bot y solo se limita el resultado a 3.
- Q: ¿Qué protección antiuso debe tener el endpoint público de redirección/clic y el de "Me Gusta"? → A: Límite de frecuencia por IP/teléfono, sin verificación adicional ni enlace firmado.
- Q: ¿Cómo se factura el clic al enlace de WhatsApp en el tiempo? → A: Solo **1 clic es facturable** por ventana de 24 h: se debita **únicamente el primero**; los clics siguientes dentro de esas 24 h no debitan y **no reinician** la ventana; pasadas las 24 h desde el último clic facturable, el siguiente clic vuelve a ser facturable, y así cada 24 h.
- Q: ¿El "Me Gusta" afecta la facturación? → A: No. Es **informativo**, no genera débito CPC; solo cuenta y puede influir en el orden de selección de ofertas (FR-022).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Recibir un mosaico de las mejores ofertas en un solo mensaje (Priority: P1)

Un usuario escribe al bot pidiendo ofertas cercanas. En lugar de recibir varios
mensajes o imágenes rectangulares, recibe **un solo mensaje** con una imagen
cuadrada compuesta por **hasta 3 ofertas apiladas**, cada segmento marcado con su
número (1, 2, 3) y un texto que lista cada oferta con su título, precio y enlace.

**Why this priority**: Es el corazón de la Fase 1B y la mayor mejora de
experiencia y costo: menos mensajes, formato consistente y ofertas identificables
de un vistazo.

**Independent Test**: Solicitar ofertas al bot cuando hay 3 (y cuando hay 1 o 2)
ofertas disponibles y verificar que llega **un único** mensaje con un mosaico
cuadrado por segmento, numeración visible y un pie que enumera cada oferta.

**Acceptance Scenarios**:

1. **Given** 3 o más ofertas activas, **When** el usuario solicita ofertas,
   **Then** recibe un único mensaje con un mosaico de exactamente 3 segmentos
   cuadrados numerados 1..3 y un pie que lista las 3 ofertas con precio y enlace.
2. **Given** solo 2 ofertas activas, **When** el usuario solicita ofertas,
   **Then** el mosaico contiene 2 segmentos (alto proporcional) y el pie lista 2.
3. **Given** 1 sola oferta activa, **When** el usuario solicita ofertas,
   **Then** el mosaico contiene 1 segmento (imagen cuadrada) y el pie lista 1.
4. **Given** cualquier envío, **When** se completa, **Then** no se incluyen
   enlaces genéricos a la web y el envío cuenta como **un solo** mensaje de WhatsApp.
5. **Given** un comercio con clics agotados, **When** el usuario solicita ofertas,
   **Then** las ofertas de ese comercio NO aparecen en el mosaico.

---

### User Story 2 - Redirección al comercio con seguimiento de clic (CPC) (Priority: P1)

Un usuario toca el enlace de una oferta. El sistema registra el clic, decide si
es facturable, genera un código de canje, debita el clic del comercio si
corresponde y redirige al usuario a un chat de WhatsApp con el comercio, con un
mensaje que menciona la oferta y muestra el código de canje.

**Why this priority**: Es el mecanismo de monetización (CPC) y de atribución de
canjes; sin él el negocio no puede facturar por clic ni rastrear conversiones.

**Independent Test**: Abrir el enlace de una oferta con un teléfono de prueba,
comprobar la redirección al WhatsApp del comercio con el código, y verificar en la
base que se creó un clic facturable y se debitó 1 del saldo; repetir en menos de
24 h con el mismo teléfono y comprobar que el segundo clic **no** es facturable y
**no** debita saldo.

**Acceptance Scenarios**:

1. **Given** un usuario sin clic previo sobre la oferta en 24 h, **When** abre su
   enlace, **Then** se registra un clic **facturable**, se genera un código de
   canje, se debita 1 del saldo del comercio y es redirigido a WhatsApp del comercio.
2. **Given** el mismo usuario que ya hizo clic en esa oferta hace < 24 h, **When**
   vuelve a abrir el enlace, **Then** se registra el clic como **no facturable**,
   **no** se debita saldo, pero **sí** recibe un código de canje y **sí** es redirigido.
3. **Given** un clic facturable, **When** se arma la redirección, **Then** el
   mensaje prellenado incluye el título de la oferta y el código de canje.
4. **Given** que pasan más de 24 h desde el último clic de ese usuario a esa
   oferta, **When** vuelve a abrir el enlace, **Then** el clic vuelve a ser facturable.

---

### User Story 3 - Tarjeta de oferta 1:1 y acciones en la landing pública (Priority: P2)

Un visitante de la web pública ve las tarjetas de ofertas con imagen **cuadrada**,
sin título ni descripción duplicados bajo la imagen, con un botón **"Me Gusta"**
que incrementa y muestra el conteo en vivo, y un botón **"Lo quiero"** que abre su
app nativa de WhatsApp con un mensaje prellenado.

**Why this priority**: Mejora la presentación y el enganche en el canal web, pero
es secundario frente al flujo de WhatsApp y la facturación por clic.

**Independent Test**: Abrir la landing, verificar que la imagen principal es
cuadrada y no hay texto duplicado; pulsar "Me Gusta" y ver el contador subir y
persistir tras recargar; pulsar "Lo quiero" y comprobar que se abre WhatsApp nativo
con el mensaje esperado.

**Acceptance Scenarios**:

1. **Given** una tarjeta de oferta en la landing, **When** se muestra, **Then** la
   imagen principal es cuadrada (1:1) y no repite título/descripción.
2. **Given** una tarjeta, **When** el visitante pulsa "Me Gusta", **Then** el
   conteo se incrementa y se refleja de inmediato, y persiste tras recargar.
3. **Given** una tarjeta, **When** el visitante pulsa "Lo quiero", **Then** se
   abre la app nativa de WhatsApp con un mensaje que menciona la oferta.

---

### Edge Cases

- **Menos de 3 ofertas**: el mosaico se ajusta al número real (1, 2 o 3) sin
  espacios vacíos ni segmentos en blanco.
- **Cero ofertas disponibles**: no se envía mosaico; se comunica al usuario que no
  hay ofertas por ahora.
- **El enlace siempre lleva el teléfono**: el enlace de cada oferta es generado por
  el bot para el teléfono del destinatario; el teléfono es un dato requerido del
  enlace y no se contempla un clic válido sin teléfono.
- **Oferta o comercio inexistente** en el enlace de redirección: no debe generar
  un clic corrupto ni redirigir a un destino inválido.
- **Comercio con clics agotados**: sus ofertas NO deben despacharse en el mosaico
  (quedan excluidas de la selección). Si se accede por un enlace antiguo/directo,
  el clic se registra como no facturable, no se debita y el saldo nunca queda en
  negativo; la redirección al usuario se mantiene.
- **Reintentos/duplicados de redirección** (doble toque): no debe producir doble
  débito ni códigos contradictorios.
- **Títulos o precios muy largos** en el pie del mosaico: el texto debe permanecer
  legible y no truncarse de forma que oculte el enlace.
- **Pulsaciones rápidas repetidas de "Me Gusta"**: el conteo debe mantenerse
  coherente y persistente.
- **Fallo al componer o enviar la imagen**: el sistema debe fallar de forma visible
  y no enviar un mosaico incompleto.
- **Exceso de frecuencia** en el endpoint público de clic o de "Me Gusta": las
  peticiones por encima del límite deben rechazarse temporalmente sin facturar ni
  incrementar conteos.
- **Reinicio de la instancia**: clics y "me gusta" registrados sobreviven.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST limitar el envío de ofertas del bot a un **máximo de 3** ofertas por solicitud.
- **FR-002**: El sistema MUST enviar esas ofertas como **un único mensaje** que contiene **una sola imagen compuesta** (mosaico vertical), no como imágenes o mensajes separados.
- **FR-003**: En el mosaico, cada oferta MUST ocupar un **segmento cuadrado perfecto (1:1)** apilado verticalmente; la altura total del mosaico MUST ser proporcional al número de ofertas.
- **FR-004**: Cada segmento del mosaico MUST mostrar un **indicador visible con el número de posición** (1, 2, 3) en su esquina superior.
- **FR-005**: El pie del mensaje MUST enumerar cada oferta incluida con al menos su **título**, **precio** y **enlace** individual hacia la redirección de esa oferta.
- **FR-006**: La imagen generada de una oferta individual MUST ser **cuadrada (1:1)**.
- **FR-007**: La imagen generada de una oferta individual MUST NOT incluir controles de favoritos/corazón.
- **FR-008**: El sistema MUST registrar un **clic** al seguirse el enlace de una oferta, capturando al menos: oferta, comercio, **teléfono del destinatario** (siempre presente en el enlace, generado por el bot), código de canje, marca de facturabilidad y fecha/hora.
- **FR-009**: El sistema MUST clasificar el clic como **facturable** únicamente si ese teléfono NO tiene un clic **facturable** registrado sobre la **misma oferta** en las **últimas 24 horas**; en caso contrario MUST registrarlo como no facturable. La ventana de 24 h se ancla al **último clic facturable** y los clics no facturables MUST NOT reiniciarla. Dentro de cada ventana de 24 h solo el **primer** clic es facturable y se debita una sola vez; transcurridas las 24 h, el siguiente clic vuelve a ser facturable, y así sucesivamente en cada ventana.
- **FR-010**: El sistema MUST generar un **código de canje** único por clic (formato legible, p. ej. `NV-####`).
- **FR-011**: El sistema MUST debitar **un clic** del saldo del comercio **solo** cuando el clic sea facturable, y como **máximo una vez por ventana de 24 h** (ver FR-009). Los clics no facturables MUST NOT debitar.
- **FR-012**: El sistema MUST redirigir al usuario (HTTP 302) a un chat de WhatsApp con el comercio, con un mensaje prellenado que incluya el **título de la oferta** y el **código de canje**.
- **FR-013**: En la landing pública, la imagen principal de cada tarjeta de oferta MUST ser **cuadrada (1:1)**.
- **FR-014**: En la landing pública, la tarjeta MUST NOT repetir título ni descripción debajo de la imagen.
- **FR-015**: La landing pública MUST ofrecer un botón **"Me Gusta"** que incremente en 1 el conteo de la oferta por cada toque y lo muestre actualizado en vivo; no se identifica ni deduplica al votante (conteo anónimo por toque). El "Me Gusta" es **informativo**: MUST NOT generar facturación ni débito de clics CPC (es independiente del cobro por clic de FR-008..FR-012); su único efecto es el conteo y el orden de selección de ofertas (FR-022).
- **FR-016**: El conteo de "Me Gusta" MUST persistir y sobrevivir reinicios de la instancia.
- **FR-017**: El botón **"Lo quiero"** de la landing MUST abrir la app nativa de WhatsApp con un mensaje prellenado que mencione la oferta.
- **FR-018**: Los registros de clic (y su marca de facturabilidad) MUST persistir y sobrevivir reinicios de la instancia.
- **FR-019**: El registro de "Me Gusta" MUST estar disponible públicamente desde la landing sin requerir sesión de usuario, y MUST aplicar protección básica contra abuso (límite de frecuencia) acorde a los endpoints públicos.
- **FR-020**: El sistema MUST incluir en el mosaico únicamente ofertas de comercios con **saldo de clics disponible**; las ofertas de comercios con clics agotados MUST NOT despacharse.
- **FR-021**: El saldo de clics de un comercio MUST NOT quedar en negativo; si por un enlace antiguo/directo llega un clic de una oferta cuyo comercio ya no tiene saldo, el clic MUST registrarse como no facturable y no se debita.
- **FR-022**: El orden y la prioridad de las ofertas del mosaico MUST corresponder al criterio de selección ya vigente del bot, truncado a las 3 primeras; este feature MUST NOT introducir un nuevo criterio de ranking.
- **FR-023**: El endpoint público de redirección/clic y el de "Me Gusta" MUST aplicar un límite de frecuencia por IP/teléfono (clic/redirección: 20 req/60 s; "Me Gusta": 30 req/60 s); al exceder MUST responder HTTP 429 sin facturar ni incrementar conteos. No se requiere firma del enlace ni verificación adicional de origen.

### Key Entities *(include if feature involves data)*

- **Registro de clic**: evento de un usuario sobre una oferta; atributos: oferta, comercio, teléfono del usuario, código de canje, si es facturable, fecha/hora.
- **Código de canje**: identificador legible generado por clic, usado por el comercio para validar la conversión.
- **Oferta (conteo social)**: la oferta acumula un contador de "me gusta".
- **Comercio (saldo CPC)**: saldo de clics que se debita por clics facturables.
- **Mosaico de ofertas**: composición vertical de hasta 3 segmentos cuadrados con numeración, entregada como una sola imagen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las solicitudes de ofertas produce como máximo un mensaje con un mosaico de hasta 3 segmentos numerados (0 casos de múltiples mensajes o imágenes separadas).
- **SC-002**: El 100% de las imágenes de oferta individuales generadas son cuadradas (relación 1:1) y sin control de favoritos.
- **SC-003**: El 100% de los enlaces seguidos genera un registro de clic; de ellos, exactamente los primeros por usuario/oferta cada 24 h quedan marcados como facturables (0 dobles débitos dentro de la ventana).
- **SC-004**: El saldo del comercio se reduce en exactamente 1 por cada clic facturable y en 0 por los no facturables, verificado en una secuencia de prueba con clics repetidos.
- **SC-005**: El 100% de las redirecciones abre WhatsApp con el comercio y un mensaje que contiene el título de la oferta y el código de canje.
- **SC-006**: El 100% de las tarjetas de la landing muestra imagen cuadrada y sin texto duplicado; el "Me Gusta" refleja el incremento en vivo y persiste tras recargar en el 100% de las pruebas.
- **SC-007**: Tras un reinicio de la instancia, el 100% de los clics y conteos de "me gusta" se conservan.

## Assumptions

- El enlace de redirección es generado por el bot para el teléfono del destinatario y SIEMPRE transporta ese teléfono; se asume que todo clic válido proviene de un enlace con teléfono presente.
- La ventana de facturabilidad es de **24 horas** por par usuario/oferta, tal como se especificó.
- El "Me Gusta" web es de acceso anónimo y cada pulsación cuenta como un incremento; se asume protección básica contra abuso acorde al resto de la API.
- El código de canje es de formato corto y legible; no requiere ser globalmente único en el tiempo a nivel de canje por el comercio, pero sí distinto por clic registrado.
- "Lo quiero" se dirige al WhatsApp de la plataforma/bot (no al comercio), según lo indicado.
- El formato 1:1 se aplica tanto al arte que se envía por WhatsApp como a la tarjeta de la landing.
- Los packs de clics y el mecanismo de débito por comercio ya existen y se reutilizan.
- Se mantiene el motor de mensajería actual y el canal activo; no cambia la autenticación de la plataforma.

## Dependencies

- Saldo y packs de clics por comercio ya operativos (módulo de facturación).
- Número de WhatsApp del comercio registrado para construir la redirección.
- Número de WhatsApp de la plataforma/bot disponible para "Lo quiero".
- Reglas de seguridad vigentes (autenticación/roles) para el endpoint de "Me Gusta" y de redirección pública.
