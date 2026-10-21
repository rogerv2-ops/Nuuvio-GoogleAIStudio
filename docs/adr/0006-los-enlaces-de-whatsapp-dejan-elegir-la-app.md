# ADR-0006: Todo enlace de WhatsApp deja elegir la app, y el teléfono nunca se expone

- Estado: aceptada
- Fecha: 2026-10-19
- Decidido por: el dueño (Roger)

## Contexto

Todos los botones de WhatsApp de la landing estaban **muertos**: ninguno abría. El
botón pedía `/api/whatsapp/config`, que está fuera de la lista de rutas públicas, así
que el gate global respondía 401; el cliente se quedaba sin número y hacía `return`
**sin avisar**. Cero clics, cero leads, cero señal.

## Decisión

Cuatro reglas, con sus tablas y sus tests:

1. **Siempre se puede elegir la app.** Android: esquema nativo `whatsapp://` (el sistema
   muestra el selector). iOS y web: la hoja propia con WhatsApp / Business / Web.
2. **El teléfono no se expone**: no va en el HTML, ni en el bundle, ni en un endpoint
   público. El servidor lo resuelve en el momento del clic y devuelve el enlace ya
   armado (`Cache-Control: no-store`).
3. **Todo contacto se registra y se atribuye**: el clic entra en `click_logs` y el
   destino elegido en `security_logs`.
4. **Un botón que no abre, avisa**: nunca un `return` silencioso.

## Consecuencias

- Las reglas de WhatsApp viven en un solo lugar: `src/utils/whatsappLinks.ts`.
- `/api/whatsapp/config` **no** es ruta pública: sigue así.
- Ningún cambio que toque un enlace se da por cerrado sin probarlo en **un Android y en
  la web**: el CI verifica URLs, no lo que ve la persona.
