# Phase 0 Research: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

Todas las decisiones de diseño se apoyan en el código ya presente en el repo.
`NEEDS CLARIFICATION` se resolvió vía `/speckit-clarify` (5 preguntas integradas a la spec).

## R1. Criterio de selección de ofertas para el mosaico

- **Decision**: Reutilizar el criterio de selección vigente del bot: elegibilidad
  (`estado === "activa"`, no vencida, comercio con WhatsApp válido), orden por
  plan del comercio y luego por `likes`, y **truncar a las 3 primeras**.
- **Rationale**: Clarificación de spec (Q4): no se introduce un ranking nuevo.
  El código actual en `server.ts` (`dispatchOffersMosaic`) ya implementa
  filtro + `sortFn` + `slice(0,3)`.
- **Alternatives considered**: Ranking ponderado nuevo (claramente fuera de
  alcance); orden aleatorio (rompe reproducibilidad y prioridad por plan).

## R2. Formato de la imagen del mensaje

- **Decision**: Una sola imagen vertical compuesta por segmentos **1:1 (cuadrados)**
  apilados, cada uno con la foto de la oferta y numeración (1️⃣/2️⃣/3️⃣). En la
  landing, cada tarjeta usa `aspect-square` y la tarjeta generada individual es
  **800×800 sin corazón**.
- **Rationale**: FR-002/003/004/006/007/013. `renderMosaicImage` (cardRenderer.ts)
  ya compone 800 × (800 × N) y `renderOfferCardImage` es 800×800 sin "me gusta".
- **Alternatives considered**: Grid 2×2 con huecos vacíos (descartado: se ve
  incompleto con 3 ofertas); un mensaje por oferta (viola FR-002).

## R3. Detección de clic facturable (una vez por 24 h)

- **Decision**: La facturabilidad se decide consultando `click_logs` por
  `ofertaId + usuarioTelefono` **con `facturable = true`** dentro de una ventana
  móvil de 24 h: `facturable = !existeClicFacturableEn24h`. La ventana se ancla al
  **último clic facturable**; los clics no facturables se insertan como filas pero
  **no** reinician la ventana. Así hay **una sola venta cada 24 h** por usuario/oferta.
  El "Me Gusta" es un contador informativo separado y no interviene aquí.
- **Rationale**: FR-008/FR-009/FR-018. `registerOfferClick` (repo.ts) ya aplica
  esta consulta y retorna `{ facturable, codigoCanje }`.
- **Alternatives considered**: Estado en memoria (viola Principio I de
  persistencia); `UNIQUE(ofertaId, phone)` (impide el histórico de clics repetidos
  y la ventana móvil de 24 h).

## R4. Código de canje

- **Decision**: Código corto legible `NV-####` generado por clic, incluido en el
  texto del mensaje de WhatsApp al que se redirige y persistido en
  `click_logs.codigoCanje`.
- **Rationale**: FR-010. Ya implementado en `registerOfferClick`.
- **Alternatives considered**: UUID (ilegible para el comerciante); reusar un
  código por oferta (rompe la trazabilidad por clic/usuario).

## R5. Redirección a WhatsApp del comercio

- **Decision**: `GET /c/:ofertaId` registra el clic y responde **302** a
  `https://api.whatsapp.com/send?phone=<comercioWhatsapp>&text=<título + código>`.
  El teléfono **siempre** va en el enlace generado por el bot (clarificación Q3).
- **Rationale**: FR-011/FR-012/FR-021. La ruta ya existe y redirige tras registrar.
- **Alternatives considered**: Página intermedia HTML (más latencia, no aporta);
  enlaces firmados HMAC (descartado en clarificación Q5).

## R6. Persistencia de "Me Gusta" (decisión de corrección)

- **Decision**: Persistir el incremento de `likes` con una **actualización atómica
  en SQL** (`likes = likes + 1`) por `ofertaId`, y además incluir `likes` en el
  `onConflictDoUpdate.set` de `syncOffers` como salvaguarda.
- **Rationale**: FR-015/FR-016. Hoy `syncOffers` **no** incluye `likes` en el
  `set` del upsert, por lo que un like sobre una oferta existente no se guarda.
  Una operación de lectura-modificación-escritura (`oferta.likes + 1` en memoria +
  `syncOffers`) también puede perder incrementos concurrentes.
- **Alternatives considered**: Confiar solo en `syncOffers` (bug actual, pierde
  el like); contador en `app_settings` (no escala por oferta).

## R7. Elegibilidad por saldo de clics (FR-020)

- **Decision**: Antes de seleccionar ofertas para el mosaico, excluir las de
  comercios cuyo saldo de clics sea `<= 0`. La fuente de verdad son los packs en
  `app_settings.click_packs_list`, consultados vía
  `facturacionModule.listarTodosLosPacks()` / un helper `comercioTieneSaldo`.
- **Rationale**: Clarificación Q2 (una oferta de comercio sin saldo **no** se
  despacha) y FR-020. `debitarClic` ya acota el saldo a `Math.max(0, ...)`.
- **Alternatives considered**: Seguir despachando y no cobrar (genera tráfico sin
  retorno para el comercio); mostrar la oferta sin enlace (rompe FR-005).

## R8. Saldo nunca negativo en enlaces antiguos (FR-021)

- **Decision**: Si un usuario abre un enlace obsoleto de un comercio sin saldo,
  registrar el clic como **no facturable** (sin débito) y **aun así** redirigir a
  WhatsApp. El débito solo ocurre si `facturable && saldo > 0`.
- **Rationale**: FR-021. `debitarClic` ya no baja de 0; falta que el flujo de
  `/c/` no cuente `leadsCalificados`/débito cuando no hay saldo.
- **Alternatives considered**: Bloquear la redirección (mala UX y evita el
  contacto legítimo); permitir saldo negativo (viola FR-021).

## R9. Límite de frecuencia en endpoints públicos (FR-023 / Q5)

- **Decision**: Aplicar el `rateLimit` existente con buckets dedicados a
  `GET /c/:ofertaId` y `POST /api/ofertas/:id/like`, con clave por IP (y por
  teléfono/usuario cuando esté disponible). **Sin** firma de enlace.
- **Rationale**: Clarificación Q5. Es la mitigación elegida frente a abuso sin
  agregar criptografía de enlaces.
- **Alternatives considered**: Firmas HMAC por enlace (descartado en
  clarificación); CAPTCHA (fricción alta y no aplica a redirección móvil).

## R10. Tipo de datos de entrada del render (`OfferCardData`)

- **Decision**: Definir la interfaz `OfferCardData` en `src/utils/cardRenderer.ts`
  con los campos usados por el mosaico (título, precio normal/oferta, comercio,
  distrito, imagen, etc.), alineada con `Offer`.
- **Rationale**: Hoy se referencia sin definir → error de tipos (esbuild lo
  ignora, `tsc` lo reporta). Definirla mejora la seguridad de tipos sin cambiar
  el comportamiento en runtime.
- **Alternatives considered**: Omitir la anotación (deja el typecheck sucio).

## R11. Interacción "Me Gusta" en la landing

- **Decision**: Botón 👍 que llama a `POST /api/ofertas/:id/like`, actualiza el
  contador en estado local de forma optimista y refleja el total real devuelto
  por el servidor. No repite título/descripción bajo la imagen; "Lo quiero" usa
  `abrirWhatsAppNativo(botPhone, "Quiero la oferta: <título>")`.
- **Rationale**: FR-014/FR-015/FR-017. La landing ya tiene `aspect-square` y
  `abrirWhatsAppNativo`; falta el botón y el texto correcto.
- **Alternatives considered**: Requerir registro para dar like (clarificación Q1
  indica que el like es anónimo); recargar toda la lista tras el like (parpadeo).
