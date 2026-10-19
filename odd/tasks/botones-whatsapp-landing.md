# Botones de WhatsApp — landing, elección de app y no exposición de números

Rama: `fix/botones-whatsapp-landing` (desde `main` = `3c2277e`).
Diagnóstico y reglas: `docs/reglas-whatsapp.md`. Reglas resumidas en `AGENTS.md`.

## Qué pasó

El usuario reportó: **"los botones a WhatsApp en la landing no están funcionando ninguno, hago clic y no pasa nada"**. Confirmado contra producción antes de tocar nada:

```
$ curl -s -o /dev/null -w "%{http_code}" https://yuddit.com/api/whatsapp/config
401
$ curl -s https://yuddit.com/api/whatsapp/public
{"ok":true,"conectado":true}
```

Causa raíz: el botón pedía `/api/whatsapp/config`, que **no está en `esRutaPublica`** → el gate global de `/api` responde 401 → `cfg.botPhone` es `undefined` → `if (botPhone)` falso → `return` **sin mensaje**. El bot tenía número y estaba conectado: el 401 era el bug.

El botón de la página de bienvenida estaba muerto por la misma razón y por otra: `App.tsx` no le pasa la prop `botPhone`, así que el enlace era `href="#"`.

## Specs

- **S1** — Todo enlace a WhatsApp deja elegir la app. Android: un toque y el sistema muestra el selector (WhatsApp / WhatsApp Business) con el esquema nativo `whatsapp://`. iOS y web: hoja de opciones con WhatsApp, WhatsApp Business y WhatsApp Web.
- **S2** — El número (del bot y de los comercios) no está en el HTML, ni en el bundle, ni en un endpoint público. Se resuelve en el servidor en el momento del clic.
- **S3** — El contacto se registra y se atribuye a la oferta: clic en `click_logs` **no facturable** + evento del destino elegido en `security_logs`. El mensaje lleva título de oferta, `ref` y código de canje.
- **S4** — Un botón que no puede abrir WhatsApp avisa; nunca falla en silencio.
- **S5** — Las reglas quedan escritas como inquebrantables en `AGENTS.md` para que las lean todos los agentes.

## Tasks

| ID | Spec | Tarea | Estado |
|---|---|---|---|
| W1 | S1, S2 | `src/utils/whatsappLinks.ts` (reglas puras, compartidas con el servidor) + `src/utils/whatsappNative.ts` (puente del navegador) | **hecho** |
| W2 | S2, S3, S4 | `GET /api/whatsapp/contacto` en `server.ts` + registro en `esRutaPublica` | **hecho** |
| W3 | S1, S4 | `src/components/WhatsAppChooser.tsx` (hoja de opciones) + `PublicWeb.tsx`, `BienvenidaView.tsx`, `ComerciosDomainView.tsx` | **hecho** |
| W4 | S1–S4 | `tests/security/whatsapp-contacto.test.ts` (15 tests) | **hecho** |
| W5 | S5 | `AGENTS.md` (reglas inquebrantables) + `docs/reglas-whatsapp.md` (spec) | **hecho** |

## Log

- **L1** (2026-10-19) — **Causa raíz confirmada con evidencia de producción**, no por lectura de código: el endpoint que la landing pedía respondía 401 y el bot sí estaba conectado.
- **L2** (2026-10-19) — **Decisión de diseño: el teléfono se resuelve en el servidor y se devuelve el enlace armado** (`Cache-Control: no-store`), en vez de devolver el número. Motivo: el bundle del navegador no lleva ningún número (verificado: 0 ocurrencias de `51987654321` en `dist/assets/index-*.js`), y `/api/whatsapp/config` sigue siendo privado.
- **L3** (2026-10-19) — **La landing sigue enroutando al bot, no al comercio.** Es lo que ya hacía el código, y es lo que permite que los teléfonos de los comercios no lleguen al público. El lead llega al comercio por el enlace firmado `/c/:id`, que sí factura. Queda anotado como decisión, no como olvido.
- **L4** (2026-10-19) — **El clic de la landing NO factura.** Se registra con `facturable: false` y `usuario_telefono: "anonimo"`: sin teléfono del usuario y sin firma HMAC no hay lead calificado. Las filas no facturables no abren ni reinician la ventana de 24 h (esa ventana solo mira filas `facturable = true`), así que las invariantes de facturación quedan intactas. Verificado en base: 2 filas de `click_logs` con `facturable = f`.
- **L5** (2026-10-19) — **Dónde se guarda el destino elegido** (qué app, en qué plataforma): `security_logs` con `accion: "whatsapp_contacto"` y `detalles` en JSON. Es la tabla de auditoría genérica que ya existía: **no hubo que tocar el esquema**, así que no hay push de Drizzle ni riesgo de deploy.
- **L6** (2026-10-19) — **Excepción documentada**: los enlaces `/c/:id` que el bot manda *dentro* de WhatsApp siguen yendo directo al chat (la persona ya está en WhatsApp; ahí un selector de app sería absurdo).
- **L7** (2026-10-19) — **Verificación**: suite completa `103 pass / 0 fail` (88 previos + 15 nuevos), gate de tipos `59 preexistentes / 0 nuevos`, build OK. El endpoint probado a mano: público sin token, `dest=app|business|web` respetado, 404 con oferta inexistente, `Cache-Control: no-store`, clic en `click_logs` no facturable y evento en `security_logs`.
- **L8** (2026-10-19) — **Verificado en dispositivo real por el dueño: Android ✅ y web ✅. iPhone ⏳ pendiente.** En Android, un toque abre el **selector del sistema** (WhatsApp / WhatsApp Business), sin hoja intermedia. En la web, un toque abre la **hoja de Yuddit** con las tres opciones. Lo que el CI no puede verificar es lo que ve la persona, asi que la regla queda escrita: **ningun cambio que toque un enlace a WhatsApp se da por cerrado sin probarlo en un Android y en la web**. Como se mira en cada caso, esta en `docs/reglas-whatsapp.md`.
- **L9** (2026-10-19) — **Fuera de alcance (decidido)**: el enlace del correo de verificación (`whatsapp://` directo en el HTML del mail) y el del panel de la empresa no se cambian. El del panel ya usa la hoja nueva; el del correo queda para cuando se rediseñe el flujo de emails, porque el cliente de correo no puede mostrar una hoja de opciones.
- **L10** (2026-10-19) — **Defecto de producto encontrado de paso, y arreglado: el mensaje por oferta no disparaba la intención del bot.** El bot solo contesta con las ofertas si el mensaje dispara `esIntencionOfertas` (frases: "ofertas", "quiero ofertas", "hay ofertas", "promociones"…). El mensaje que usaba la landing —"Hola quiero aprovechar esta **oferta**: {título} (ref {ref})"— **no** la dispara: la lista no tiene "esta oferta" y el plural no aparece. O sea: aunque el botón hubiera funcionado, el bot no entendía el pedido y el lead se perdía. El mensaje ahora se construye en `construirMensajeContactoWhatsApp` y empieza siempre con "quiero ver las **ofertas** de Yuddit: {título} (ref {ref}). Mi codigo es {canje}". Hay un test que lo verifica contra `esIntencionOfertas` (no alcanza con mirarlo: el predicado es una lista de frases con límites de palabra).
