# ADR-0005: Todo enlace accionable va en el texto del mensaje

- Estado: aceptada
- Fecha: 2026-10-21
- Decidido por: el dueño (Roger)

## Contexto

El bot respondía con la oferta y el texto *"Toca el botón de abajo para asegurar tus
cupos"*, y **el botón nunca llegaba**. No era un error de envío: el motor de WhatsApp
en producción es **Baileys v7**, y en su tipo de mensaje **no existen** `templateButtons`
ni `buttons`; la librería toma el `text` (válido) e **ignora en silencio** el resto de la
llave. Sin excepción, sin log, sin error. El mensaje salía "bien" y el botón no existía.

El bug se agravó porque los tests miraban el `payload` que `simulate-incoming` devuelve,
no lo que WhatsApp entrega: certificaban un botón que nunca se había enviado.

## Decisión

**Todo enlace accionable va escrito en el texto.** WhatsApp linkifica la URL solo.

- El enlace con firma `/c/:id?u=&s=` va en el texto del mensaje.
- El camino de Meta Cloud API (que sí soporta `cta_url`) queda intacto, pero **también**
  lleva el enlace en el texto: el mensaje se entrega a personas que ya no usan el bot.
- Si alguien vuelve a pasar un botón a Baileys, sale un `console.warn` en vez de un
  silencio.

## Consecuencias

- Un lead que llega al comercio depende de un enlace que **sí llega**.
- Los tests tienen que verificar el enlace **dentro de `texto`**, nunca `boton.url`.
