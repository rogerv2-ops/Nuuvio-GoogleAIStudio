# Validación Previa de WhatsApp, Botón Interactivo CTA y Renderizado Fiel de Ofertas

Plan integral para validar la existencia del usuario de WhatsApp en la base de datos antes de despachar ofertas, enmascarar enlaces de contacto mediante botones interactivos de WhatsApp tipo Call-To-Action (CTA), corregir el renderizado visual de tarjetas con badges y precios idénticos al feed web, estructurar el código de referido con prefijo `REF` + 5 dígitos, y mantener el correo vacío hasta su solicitud progresiva.

---

### Decisiones Críticas Confirmadas por el Usuario

> [!IMPORTANT]
> A partir de las aclaraciones directas del usuario, se fijan las siguientes especificaciones definitivas:
> 1. **Enmascaramiento de Enlace de Contacto:** Se implementará un **Botón interactivo de WhatsApp tipo llamada a la acción (CTA URL button)**. En lugar de exponer cadenas de URLs kilométricas con parámetros UTM y texto codificado dentro del mensaje, WhatsApp desplegará un botón de acción directo (`Pedir por WhatsApp`) que preserva íntegramente la trazabilidad sin ensuciar el texto.
> 2. **Código de Referido:** Formato estricto **`REF` seguido de 5 dígitos numéricos aleatorios** (ej: `REF73910`, `REF48192`), eliminando cualquier prefijo genérico anterior como `vuuy-user` o `VUUY-USER`.
> 3. **Campo de Correo Electrónico:** Se inicializa estrictamente **vacío** (`""`) en el registro por WhatsApp. No se generará ningún correo sintético ni ficticio. El correo se solicitará exclusivamente en el momento que el sistema lo requiera dentro del embudo progresivo.
> 4. **Número de WhatsApp Real:** Se corrige el extractor de identificadores para capturar el número telefónico real del usuario (ej: `+51 987 654 321`), filtrando los identificadores de dispositivo o LIDs (`...@lid`).
> 5. **Cero Enlaces Web en WhatsApp:** Se suprime absolutamente cualquier link hacia la página web en las ofertas enviadas por WhatsApp. Solo se incluye la ficha y el botón interactivo de contacto con el comercio.
> 6. **Fidelidad Visual del Feed en Tarjetas:** El renderizador de servidor (`cardRenderer.ts`) reproducirá con exactitud los badges de porcentaje de descuento, indicador de urgencia de expiración, badge celeste boosted, etiqueta naranja de precio (con precio regular tachado y precio oferta destacado), scrim degradado y píldora de distrito/distancia.

---

## 1. Visión General y Flujo de Experiencia

### Qué Resuelve
Garantiza que ningún usuario reciba ofertas sin antes estar verificado y registrado con su zona en la base de datos PostgreSQL/Cloud SQL. Ofrece una experiencia conversacional pulcra en WhatsApp donde cada oferta llega como una tarjeta gráfica de alta resolución con sus badges y precios visuales, acompañada de un botón nativo interactivo que permite contactar al comercio con un solo toque sin mostrar URLs extensas.

### Flujo del Usuario Paso a Paso

```
┌─────────────────────────┐
│ Usuario hace clic en web │
│   o escribe al WhatsApp │
└────────────┬────────────┘
             │
             ▼
┌────────────────────────────────────────┐
│ ¿Número de WhatsApp existe en DB?       │
└──────┬──────────────────────────┬──────┘
       │ NO                       │ SÍ
       ▼                          ▼
┌──────────────────────────┐  ┌────────────────────────────────────┐
│ 1. Registrar usuario con:│  │ Usuario ya verificado con zona:   │
│    - Teléfono real       │  │                                    │
│    - Email: "" (vacío)   │  │ 1. Saludo personalizado con nombre │
│    - Ref: REF + 5 dígitos│  │ 2. Despacho directo de 5 ofertas   │
│ 2. Solicitar distrito    │  │    en su distrito (sin repreguntar)│
│    (NO enviar ofertas)   │  └────────────────────────────────────┘
└──────────┬───────────────┘
           │
           │ Usuario responde con su distrito
           ▼
┌──────────────────────────────────────┐
│ Actualizar distrito en DB y          │
│ despachar las 5 ofertas prioritarias │
└──────────────────────────────────────┘
```

---

## 2. Experiencia de Usuario y Diseño Visual

### 1. Mensaje de Oferta con Botón Interactivo CTA
En Meta Cloud API se envía un mensaje de tipo `interactive` con `type: "cta_url"`, y en el motor WhatsApp Web (Baileys) se utiliza `templateButtons` con botón de URL:
* **Cabecera Multimedia:** Imagen generada por `@napi-rs/canvas` (4:5, 800x1000 px) con todos los elementos gráficos integrados.
* **Cuerpo del Mensaje:**
  ```text
  🏷️ *Chalina 100% Baby Alpaca Suave*
  🏢 *Atelier Alpaca & Wool* (Miraflores)
  💰 *S/ 95.00* ~Antes S/ 180.00~
  ⏰ Válida hasta hoy 8:00 pm
  ```
* **Botón Interactivo Nativo de WhatsApp:**
  `[ 💬 Pedir por WhatsApp ]`
  *(Al tocar el botón, se abre directamente el chat con el comerciante con el mensaje prellenado y los parámetros de medición preservados internamente sin exponer la URL en el texto)*.

### 2. Renderizado Visual Idéntico al Feed Web
El componente de renderizado en servidor (`cardRenderer.ts`) estandariza:
* **Badges Superiores Izquierdos:**
  - Píldora verde esmeralda con `-% OFF` o `🔥 2X1`.
  - Píldora roja de urgencia: `EXPIRA HOY` o fecha límite.
  - Píldora celeste: `⚡ BOOSTED`.
* **Etiqueta Superior Derecha de Precios:**
  - Fondo naranja vibrante con bordes redondeados y sombra suave.
  - Precio normal tachado en blanco semitransparente.
  - Precio de oferta grande en negrita blanca.
* **Pie de Tarjeta (Scrim Oscuro):**
  - Título en mayúsculas de dos líneas con sombra legible.
  - Nombre del comercio a la izquierda con icono esmeralda.
  - Píldora ámbar a la derecha con `📍 [distancia] · [distrito]`.

---

## 3. Decisiones Técnicas y de Negocio

### Decisión 1: Enmascaramiento mediante Botones CTA vs. Enlaces de Redirección
* **Opción Elegida:** Enviar mensaje interactivo oficial de WhatsApp con botón CTA (`cta_url`) y botón de plantilla en Baileys, complementado con un slug de redirección limpia (`/c/:offerId?ref=...`) en caso de clientes de WhatsApp antiguos que no admitan botones interactivos.
* **Razón:** Cumple fielmente la solicitud del usuario de no mostrar la URL en el texto y ofrecer una experiencia táctil tipo botón.
* **Alternativa Descartada:** Imprimir una URL acortada cruda en el texto plano (el usuario rechazó expresamente ver la URL en el mensaje).

### Decisión 2: Inicialización del Campo de Correo
* **Opción Elegida:** El campo `email` se guarda como cadena vacía `""` al registrar usuarios por WhatsApp hasta que el usuario llegue al paso de perfilado donde se le solicita.
* **Razón:** La integridad de PostgreSQL (`notNull()`) se respeta sin inventar direcciones de correo falsas ni contaminar la base de datos con dominios ficticios.

### Decisión 3: Extracción de Teléfono Real vs Identificador LID
* **Opción Elegida:** Si el remitente viene como `@lid`, se resuelve el número telefónico real consultando `participantJid`, el objeto de contacto o `sock.onWhatsApp(phone)`. El número registrado siempre tendrá el formato internacional canónico (ej: `+51987654321`), nunca una clave interna de dispositivo.

---

## 4. Arquitectura del Sistema y Mapeo de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                   WHATSAPP INCOMING WEBHOOK                 │
│                 (Meta Cloud API / Baileys)                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 cleanPhoneNumberExtractor                   │
│   (Filtra @lid, normaliza código de país y dígitos reales)  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 findAudienceUserByPhone(phone)              │
│                 (Consulta Cloud SQL PostgreSQL)             │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
        Usuario no existe              Usuario ya existe
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌───────────────────────────┐
│ Generar nuevo usuario:       │ │ ¿Tiene distrito asignado? │
│ - email: ""                  │ └─────────────┬─────────────┘
│ - codigoRef: REF + 5 dígitos │               │
│ - etapa: esperando_zona      │       SÍ ─────┴───── NO
│ - Solicitar distrito         │       │              │
└──────────────────────────────┘       ▼              ▼
                               ┌─────────────┐ ┌─────────────┐
                               │ Despachar 5 │ │ Solicitar   │
                               │ ofertas de  │ │ distrito    │
                               │ su zona     │ └─────────────┘
                               └─────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   dispatchFiveOffers                        │
│ 1. renderOfferCardImage(o) -> Imagen con diseño web         │
│ 2. Servir tarjeta estática /cards/:id.jpg                   │
│ 3. Generar enlace de contacto con todos los UTM y mensaje   │
│ 4. Enviar WhatsApp Interactive CTA URL Button ("Pedir")     │
│ 5. Eliminar cualquier enlace web del texto                  │
└─────────────────────────────────────────────────────────────┘
```

### Entidades y Esquema de Datos

* **`audienceUsers` (Cloud SQL / PostgreSQL):**
  - `id`: `usr_wa_${timestamp}_${phoneDigits}`
  - `telefono`: `+51 [9 dígitos]` (número limpio verificado)
  - `email`: `""` (vacío hasta que el usuario lo provea)
  - `codigoRef`: `REF` + 5 dígitos aleatorios (ej: `REF58219`)
  - `distrito`: `null` (hasta que el usuario responda su ubicación)
  - `estado`: `'activo'`
  - `utm.etapa`: `'esperando_zona'` | `'zona_registrada'` | `'perfil_completo'`

* **Generación de Imagen de Tarjeta:**
  - Persistencia de la imagen compuesta en `/public/cards/card_[id].jpg` para que Meta Cloud API y Baileys la sirvan con CDN y caché optimizada sin recargar Unsplash en cada envío.

---

## 5. Plan de Verificación

1. **Prueba de Registro de Usuario Nuevo:**
   - Enviar mensaje inicial desde un número no registrado.
   - Verificar en PostgreSQL que el usuario se guarda con `email: ""`, `codigoRef: "REFXXXXX"` y `distrito: null`.
   - Confirmar que **NO** se envían las 5 ofertas y que el bot solicita el distrito.
2. **Prueba de Confirmación de Distrito:**
   - Responder con "Miraflores" o "Surco".
   - Verificar que el distrito se actualiza en DB y se despachan las 5 ofertas correspondientes a esa zona.
3. **Prueba de Tarjeta Visual y Botón CTA:**
   - Comprobar que la tarjeta recibida contiene todos los badges superiores, precio tachado, precio oferta naranja, degradado y pill de ubicación.
   - Comprobar que el mensaje contiene el botón nativo interactivo `Pedir por WhatsApp` sin URLs crudas a la vista y sin enlaces web.
4. **Prueba de Usuario Ya Registrado:**
   - Enviar "Ofertas" desde el mismo número registrado.
   - Confirmar que el sistema lo reconoce de inmediato y despacha las ofertas directamente sin volver a preguntar su zona.
