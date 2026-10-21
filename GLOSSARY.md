# GLOSSARY

El lenguaje de Yuddit. Cuando un nombre, un issue, un test o un mensaje nombre un
concepto de este glosario, se usa **esta** palabra y no un sinónimo.

Las definiciones dicen **qué** es y **dónde vive** (para no discutirlo dos veces).

---

## Oferta

Una promoción de un comercio: título, precios (normal y oferta), categoría, distrito,
comercio y vigencia. Es la unidad que la persona ve y por la que hace clic.

- Tabla: `offers` (`src/db/schema.ts`)
- Código de la persona: `src/modules/ofertas.ts`
- **Plural siempre "ofertas"**. Una oferta no es un "producto" ni un "cupón".

## Comercio

El local que publica ofertas. Se llama `comercio` (no "merchant" ni "negocio") en todo el
código. Vive en `app_settings.merchants_list` (JSON) y su pipeline comercial en
`app_settings.merchants_kanban`.

- **Un comercio paga por los clics que le llegan**: modelo de packs (ver *Pack de clics*).

## Lead calificado

Una persona que **realmente abrió el WhatsApp del comercio** desde un enlace con
firma válida. Es la métrica que el negocio compra.

- Se registra en `click_logs` con `facturable = true`.
- **No es lo mismo que un clic**: un clic es cualquier interacción con un enlace; un lead
  calificado es el que pasó por la ventana de deduplicación y el saldo.
- La North-Star metric del panel es **leads calificados por semana**.

## Clic

Una interacción con un enlace de Yuddit. Va a `click_logs` con `facturable` en `true` o
`false`.

- `facturable = true`: pasó por el enlace firmado `/c/:id?u=&s=`, dentro de la ventana de
  **24 horas** por `(oferta, teléfono)` y con saldo disponible.
- `facturable = false`: el resto (por ejemplo, el clic que se registra "anónimo" desde el
  botón de la web).
- Un clic de la web **no** factura y **no** suma al contador de la oferta: solo queda
  atribuido a un número cuando la persona escribe al bot.

## Facturable

Que un clic cumple las condiciones para cobrarse: enlace firmado válido, dentro de las 24
horas, con saldo del pack. `registerOfferClick` es **fail-closed**: si la base falla, el
clic no se factura.

## Pack de clics

El paquete prepagado que un comercio compra: 50, 100 o 500 clics. Su saldo es dinero.

- Tabla: `click_packs`. El débito es **un solo `UPDATE ... RETURNING` atómico**
  (`debitarClicAtomico`).
- El saldo **nunca** se guarda en `app_settings` ni en memoria del navegador: la tabla
  manda. Ver ADR-0003.

## Código de canje (`NV-XXXXXX`)

Código de 6 caracteres que identifica un interés. **No es un referido ni un
descuento**: es el código de **atribución del clic**.

- Se genera en `registerOfferClick` (`NV-` + 6 caracteres de alfabeto sin ambigüedades).
- El que la persona lleva en el mensaje al bot es el que permite **atribuir** el clic de
  la web a su número real.
- El **código de canje de premios** (el del sistema de puntos) es OTRO cosa, y vive en
  el navegador. Ver `odd/tasks/fase-canje-y-referidos.md`.

## Referido

Persona que invita a otra a Yuddit. Se guarda en `audience_users.invitadoPor` y en
`utm.invitadoPor`. **El sistema de referidos todavía no cierra su circuito**: no acredita
puntos ni tiene código propio.

## Ubigeo

La codificación oficial del INEI: 2 dígitos de departamento, 2 de provincia y 2 de
distrito (6 en total, p. ej. `150122` = Miraflores, `150100` = provincia de Lima).

- Tabla: `geo_territorios` (2.095 territorios: 25 departamentos, 196 provincias, 1.874
  distritos).
- **El código es la clave real**: en el Perú hay 99 nombres de distrito repetidos
  ("Santa Rosa" aparece 10 veces, "Miraflores" 4).
- Catálogo: `src/data/ubigeoPeru.ts` (generado; no editar a mano).

## Provincia

**La unidad de negocio y la zona de servicio.** Yuddit opera en una provincia o en
varias; el distrito es la ubicación de la persona dentro de una provincia activa.

- Se activan desde el panel (`/gestion/zonas`).
- Ver ADR-0001.

## Distrito

La ubicación de la persona dentro de su provincia. En el catálogo del INEI hay 43 en la
provincia de Lima.

- Para el usuario siempre es "provincia y luego distrito": el distrito **no** se puede
  elegir sin provincia.

## Zona de servicio

El conjunto de provincias encendidas. Es lo que el bot ofrece: si la provincia de la
persona no está encendida, **no hay ofertas que mostrarle** y se le dice la verdad.

## Audiencia

Las personas registradas. **Su identidad es el número de teléfono**: el correo es
nullable y no se inventa. Ver ADR-0004.

- Tabla: `audience_users` (teléfono y nombre cifrados; `telefono_idx` es el índice
  ciego para buscar sin descifrar).
- `estado`: `activo` | `pendiente` | `desuscrito`.

## Evento

Un hecho de negocio que **no tiene tabla propia**: una visita a la landing, una
impresión de una oferta, la entrega de una oferta al bot, un paso del embudo.

- Tabla: `eventos`.
- **Regla**: un dominio con su propia tabla no emite evento (los clics van en
  `click_logs`, los chats en `chat_logs`). Ver ADR-0002.

## Impresión

Que una oferta se **mostró** a una persona. Es la vista real (un evento
`oferta_mostrada`) y es lo que hace posible el CTR: antes no había de dónde sacarlo.

## CTR

Clics sobre **vistas** (impresiones). Solo existe si hay impresiones medidas; si no las
hay, es `null` y la pantalla dice "sin medir".

## Consentimiento / opt-out

Que la persona acepte (o deje de aceptar) recibir mensajes. Se guarda en
`audience_users.consentimientos` (`whatsapp`, `correo`) y en `estado`.

- **"BAJA"** (también "STOP", "CANCELAR", "SALIR", "DESUSCRIBIR", "DETENER") es la
  palabra que el bot entiende.
- Un dado de baja **no se revierte** con el siguiente mensaje: hace falta pedirlo
  explícitamente. Ver ADR-0007.

## Sesión

La sesión de un usuario del panel. Vive en la tabla `sessions` y en el token
(`vuuy_sesion`). Caduca a los 5 minutos de inactividad para `admin` y `comercio`.

## Motor de WhatsApp

El que habla con WhatsApp. En producción es **Baileys v7**
(`@whiskeysockets/baileys`), conectado por WhatsApp Web (modo `waha`).

- **No soporta botones**: `templateButtons` y `buttons` no existen en su tipo de
  mensaje y la librería los **ignora en silencio**. Ver ADR-0005.
- Meta Cloud API está en el código pero **no configurado** en producción.

## Enlace con firma

El enlace `/c/:id?u=<telefono>&s=<hmac>` que abre el WhatsApp del comercio con el
código de canje escrito. **Es el único camino que factura.** El enlace sin firma abre
igual, pero no cobra.

## Oferta activa / vigente

Una oferta con `estado = 'activa'` y `venceEn` en el futuro. Es lo que el bot puede
ofrecer.

## Embudo de registro

El camino de una persona nueva hasta quedar registrada: saludo → edad y distrito →
zona guardada → ofertas de su zona.

## Digest

El resumen matutino que se manda a la audiencia. Es **por correo** y ya filtra por
`consentimientos.correo`. **No hay envíos programados de WhatsApp.**

## Agente de IA

El agente que analiza una publicación de un comercio por WhatsApp y propone la oferta
(`src/agents/`). Produce un **borrador**: el comercio tiene que confirmarlo.

---

## Palabras que este proyecto NO usa

- **"usuario"** cuando se quiere decir **persona** o **audiencia**: el usuario es el que
  entra al panel.
- **"cupón"**: aquí es **código de canje**.
- **"descuento"**: el mecanismo de premiar es **puntos**; el descuento es el precio de la
  oferta.
- **"producto"**: es **oferta** (el producto es lo que el comercio vende).
- **"zona"**: es **provincia** (la zona de servicio) o **distrito** (la ubicación).
