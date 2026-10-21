# Enlaces a WhatsApp — reglas, flujo y verificación

Todo enlace a WhatsApp de Yuddit deja elegir la app y nunca expone un teléfono. Esta es la spec que implementa `src/utils/whatsappLinks.ts`, `src/components/WhatsAppChooser.tsx` y el endpoint `GET /api/whatsapp/contacto`.

La versión corta vive en `AGENTS.md` → **Reglas inquebrantables — enlaces a WhatsApp**. Esta es la versión con el detalle.

## El incidente que motivó las reglas (2026-10-19)

Los botones de WhatsApp de la landing **no hacían nada**. Ninguno. El flujo era:

1. El botón hacía `fetch('/api/whatsapp/config')`.
2. Ese endpoint **no está en `esRutaPublica`** → el gate global de `/api` responde **401**.
3. El cliente hacía `cfg.botPhone` → `undefined` → `if (botPhone)` falso → `return` **sin mensaje al usuario**.

Verificado contra producción antes de tocar nada:

```
$ curl -s -o /dev/null -w "%{http_code}" https://yuddit.com/api/whatsapp/config
401
$ curl -s https://yuddit.com/api/whatsapp/public
{"ok":true,"conectado":true}      # el bot SÍ tenía número: el 401 era el bug
```

El botón de la página de bienvenida estaba muerto por la misma razón, y por otra: `App.tsx` no le pasa la prop `botPhone`, así que el enlace era `href="#"` (nunca se construyó).

**Corolario**: un botón que falla en silencio es peor que un botón que no existe. Desde ahora, todo error de apertura se muestra (regla 4).

## Flujo

```
Usuario toca el botón
        │
        ├─ Android ──► GET /api/whatsapp/contacto?oferta=&dest=app
        │                        │
        │                        ├─ registra el clic (click_logs, facturable=false)
        │                        ├─ registra el evento (security_logs)
        │                        └─ responde { url: "whatsapp://send?phone=…&text=…" }
        │                        │
        │                        └─► el sistema muestra el selector de app
        │                            (WhatsApp / WhatsApp Business)
        │
        └─ iOS / web ──► hoja de opciones (WhatsAppChooser)
                          │
                          ├─ "Abrir en WhatsApp"        → dest=app
                          ├─ "Abrir en WhatsApp Business"→ dest=business
                          └─ "Abrir en WhatsApp Web"     → dest=web
                                   │
                                   └─► GET /api/whatsapp/contacto?dest=<elegido>
                                             └─► navega a la url que devuelve
```

Por qué el teléfono se resuelve en el servidor: el número del bot y los de los comercios **no están en el HTML ni en el bundle** (`dist/assets/index-*.js`). Se resuelven en el momento del clic, en el servidor, con rate limit, y se devuelven ya dentro del enlace. El que hace clic necesita el número para abrir el chat; el resto del mundo no lo ve.

## Elección de app por plataforma

| Plataforma | Qué muestra el sistema | Qué hace la app | URL |
|---|---|---|---|
| Android | Selector del sistema con las apps que manejan el esquema `whatsapp` (WhatsApp y WhatsApp Business) | Un toque y el selector aparece | `whatsapp://send?phone=…&text=…` |
| iOS | No hay selector para esquemas propios | Hoja de opciones: WhatsApp / Business / Web | `whatsapp://…`, `whatsappbusiness://…`, `https://web.whatsapp.com/send?…` |
| Escritorio | No hay selector | Hoja de opciones: WhatsApp Web / app / Business | idem |

Detalles que importan:

- Se usa el esquema **`whatsapp://`**, no `intent://`. `intent://` no existe en navegadores de escritorio (Chrome responde `ERR_UNKNOWN_URL_SCHEME`) y se bloquea en algunos WebViews.
- En Android, `whatsapp://` lo resuelven **las dos** apps (WhatsApp y WhatsApp Business registran el esquema), y por eso el sistema muestra el selector.
- En iOS, un esquema propio abre la app directamente, sin elección: por eso la hoja de opciones es obligatoria ahí.
- `https://web.whatsapp.com/send?phone=…&text=…` funciona siempre y es el que evita que alguien se quede sin salida.

## Endpoint

```
GET /api/whatsapp/contacto?oferta=<id>&dest=<app|business|web>
```

Público (está en `esRutaPublica`), con rate limit propio (`whatsapp_contacto`, 30/min) y `Cache-Control: no-store`.

| Campo | Qué es |
|---|---|
| `oferta` | Opcional. Si viene, el clic se atribuye a esa oferta y el mensaje lleva su título, su `ref` y el código de canje. |
| `dest` | `app` (por defecto), `business` o `web`. Cualquier valor raro cae en `app`. |
| `plataforma` | Se detecta del `User-Agent` (`android` / `ios` / `web`). |

Respuesta:

```json
{
  "ok": true,
  "url": "whatsapp://send?phone=519…&text=Hola%20quiero%20aprovechar%20esta%20oferta…",
  "tracking": { "ofertaId": "ofr_01", "codigoCanje": "NV-PQVAS4", "destino": "app", "plataforma": "android" }
}
```

Códigos: `200` ok · `404` oferta inexistente · `503` WhatsApp no configurado en el servidor · `429` rate limit.

## Qué se registra (y qué no se factura)

| Tabla | Qué se guarda | Por qué |
|---|---|---|
| `click_logs` | El clic, con `facturable: false`, `usuario_telefono: "anonimo"` y su código de canje | Es el libro de clics del embudo. **No factura**: sin teléfono del usuario y sin firma HMAC no hay lead calificado. Las filas no facturables tampoco abren ni reinician la ventana de 24 h (la ventana solo mira filas `facturable = true`). |
| `security_logs` | `accion: "whatsapp_contacto"` con `destino`, `plataforma`, `ofertaId` y `codigoCanje` | Saber **qué app eligió la persona** es el dato que se pierde si solo se registra el clic. |

Lo que **sí** factura sigue igual: `/c/:id` con la firma HMAC (`firmaClicValida`) y la ventana de 24 h por `(oferta, teléfono)`. El fail-closed de `registerOfferClick` no se tocó.

## El mensaje al bot tiene que disparar su intención

El bot solo responde con las ofertas cuando el mensaje dispara su intención de "pedir ofertas" (`esIntencionOfertas`, en `src/utils/securityGuards.ts`). La lista de frases recognized incluye "ofertas", "quiero ofertas", "hay ofertas", "promociones"… pero **no** "esta oferta".

Medido el 2026-10-19 con el mensaje que usaba la landing:

| Mensaje | ¿Dispara la intención? |
|---|---|
| `Ofertas` | sí |
| `Hola, quiero ver las ofertas de Yuddit` | sí |
| `Hola quiero aprovechar esta oferta: Bowl Acai (ref …)` | **no** ← el que usaba la landing |
| `Hola, quiero ver las ofertas de Yuddit: Bowl Acai (ref …). Mi codigo es NV-…` | sí |

O sea: aunque el botón hubiera funcionado, el mensaje por oferta **no lo entendía el bot**. El mensaje se construye en `construirMensajeContactoWhatsApp` (`src/utils/whatsappLinks.ts`): empieza siempre con "quiero ver las **ofertas**" y después va el título de la oferta concreta, su `ref` y el código de canje. Hay un test que lo verifica contra `esIntencionOfertas`.

## La landing enruta al bot, no al comercio

El botón "Lo quiero" de una oferta abre el WhatsApp **del bot**, con el título de la oferta, su `ref` y el código de canje en el mensaje. Es deliberado:

- Los teléfonos de los comercios **no** se entregan al público (regla 2).
- El bot es el embudo: responde con las ofertas disponibles.
- El lead llega al comercio por el enlace firmado `/c/:id`, que **sí** es el clic facturable.

Si algún día se quiere que el botón de una oferta vaya directo al comercio, hay que hacerlo **con el consentimiento del comercio** y, además, revisar la regla 2: ese número quedaría en manos de cualquiera que toque el botón.

## Regla 5 — todo enlace accionable va EN EL TEXTO, nunca en un botón

Esta es la regla que nació de un incidente real (2026-10-21, reportado por el dueño) y es la más fácil de volver a romper.

**Qué pasó.** La persona escribió al bot, el bot respondió con la oferta y el texto *"Toca el botón de abajo para asegurar tus cupos"*, y **el botón nunca llegó**. Peor: el mensaje siguiente de la persona era una pregunta, porque no tenía ninguna forma de abrir la oferta.

**Por qué.** El motor de WhatsApp en producción es **Baileys v7** (`@whiskeysockets/baileys@7.0.0-rc14`, modo `waha`; Meta Cloud API no está configurado: `accessToken` y `phoneNumberId` vacíos). En Baileys v7, el tipo `AnyMessageContent` **no tiene** `templateButtons` ni `buttons`: la librería toma el `text` (válido) e **ignora en silencio** el resto de la llave. No hay excepción, no hay log, no hay error. El mensaje sale "bien" y el botón no existe.

**La regla.** Si la persona tiene que hacer algo (abrir un enlace, entrar al comercio, ver el catálogo), eso va **escrito en el texto**. WhatsApp convierte la URL en un enlace pulsable por su cuenta. Un botón es un adorno opcional; un enlace que no llega es un lead que no existe.

| Correcto | Incorrecto |
|---|---|
| `Abre este enlace para asegurar tus cupos:\n\nhttps://yuddit.com/c/of_01?u=51…&s=…` | `Toca el botón de abajo 👇` + `interactiveButton` / `buttons` |

**Dónde aplica hoy:**

| Flujo | Qué hace |
|---|---|
| Oferta individual (`enviarOfertaEspecifica`) | El enlace firmado `/c/:id?u=&s=` va en el texto del mensaje. |
| Mosaico de 3 ofertas (`dispatchOffersMosaic`) | Cada oferta del mosaico lleva su enlace firmado en el caption. Antes se mandaba un bloque `buttons` con "Ver Opción 1/2/3" que **nunca llegaba**, y las ofertas se veían pero no se podían abrir. |

**El camino de Meta Cloud API sí soporta botones** (`cta_url` y `reply`), así que ese código sigue ahí y no se toca. Si algún día se migra a Meta, se puede volver a un botón — pero **el enlace tiene que estar en el texto igual**, porque el mensaje se entrega a personas que ya no usan el bot y llegan por el link de la web.

**El código lo avisa**: si alguien vuelve a pasar `buttons` o `interactiveButton` al camino de Baileys, sale un `console.warn` en vez de un silencio. Hay un test (`tests/security/bot-mensaje-oferta.test.ts`) que vigila que `server.ts` no vuelva a pedirle botones a Baileys, y que los dos flujos lleven el `trackingUrl` dentro del texto.

> **Corolario sobre los tests.** `POST /api/whatsapp/simulate-incoming` devuelve el **payload** que el bot quiso mandar, no lo que WhatsApp entrega. Un test que mira `boton.url` da verde mientras la persona no recibe nada — eso pasó con los tests R2/R3/R6 de `bot-zona-confirmacion.test.ts`. Por eso ahora se verifica **el enlace dentro de `texto`**: lo único que sale de verdad en un chat de WhatsApp.

## Archivos

| Archivo | Rol |
|---|---|
| `src/utils/whatsappLinks.ts` | Reglas puras: detectar plataforma, normalizar destino, construir la URL, listar las opciones. **Único** lugar donde se escriben URLs de WhatsApp. |
| `src/utils/whatsappNative.ts` | Puente del navegador: pide el destino al servidor y abre el enlace. |
| `src/components/WhatsAppChooser.tsx` | Hoja de opciones (iOS y web). |
| `server.ts` | `GET /api/whatsapp/contacto` + su registro en `esRutaPublica`. |
| `tests/security/whatsapp-contacto.test.ts` | Tests que vigilan las 4 reglas. |

## Verificación en dispositivos reales

El CI verifica **URLs**, no lo que ve la persona. Por eso, un cambio que toca un enlace a WhatsApp **no está cerrado hasta que se probó en un dispositivo de verdad**.

| Plataforma | Qué tiene que pasar con un toque | Estado (2026-10-19) |
|---|---|---|
| **Android** | Se abre el **selector del sistema** con WhatsApp y WhatsApp Business. Un toque, sin hoja intermedia. | ✅ **verificado** por el dueño en su Android |
| **iPhone / iPad** | Se abre **la hoja de Yuddit** con las tres opciones (WhatsApp / WhatsApp Business / WhatsApp Web). En iOS el sistema no da selector para esquemas propios: por eso la hoja es nuestra. | ⏳ **pendiente** (falta un iPhone) |
| **Escritorio / web** | Se abre **la hoja de Yuddit** con las tres opciones. | ✅ **verificado** por el dueño |

Qué mirar en cada prueba, más allá de que "funcione":

1. Que se abra **WhatsApp** (o WhatsApp Business, si se elige esa opción) y no otra app.
2. Que el chat llegue **con el mensaje escrito** ("Hola, quiero ver las ofertas de Yuddit: {titulo}").
3. Que en la página **no se vea ningun numero** (el numero lo resuelve el servidor en el momento del clic).
4. En Android: que aparezca el **selector del sistema** y no nuestra hoja.
5. Si algo falla: que se vea el **aviso de error**, no un silencio.

## Verificación

```bash
# Suite completa (con el servidor levantado y credenciales)
export TEST_BASE_URL=http://127.0.0.1:3000
export VUUV_ADMIN_EMAIL=… VUUV_ADMIN_PASSWORD=…
bun test tests/security

# A mano: el endpoint responde sin token y devuelve el enlace armado
curl -s "http://127.0.0.1:3000/api/whatsapp/contacto?dest=app"
# {"ok":true,"url":"whatsapp://send?phone=…","tracking":{…}}

# A mano: el destino elegido se respeta
curl -s "http://127.0.0.1:3000/api/whatsapp/contacto?dest=business"   # whatsappbusiness://
curl -s "http://127.0.0.1:3000/api/whatsapp/contacto?dest=web"         # https://web.whatsapp.com/

# A mano: el clic se registro y NO es facturable
docker exec <pg> psql -U postgres -d nuuviopsg -c \
  "select oferta_id, usuario_telefono, codigo_canje, facturable from click_logs order by creado_en desc limit 5"
```

En el navegador: en Android, un toque debe abrir el **selector del sistema**; en iOS y en escritorio debe abrirse la hoja con las tres opciones.
