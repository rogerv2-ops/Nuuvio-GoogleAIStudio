# Flujo de consulta de ofertas (vuuy / WhatsApp)

> Estado a 2026-10-18. Corresponde a la feature `003-embudo-lead-calificado`.
> Referencias de código: `server.ts`, `src/db/repo.ts`, `src/utils/cardRenderer.ts`, `src/components/PublicWeb.tsx`.

## Visión general

El consumidor opera **PULL** (el bot solo responde). El flujo es:
*mensaje entrante → clasificación de intención → mosaico de hasta 3 ofertas (Paso 1) →
selección → oferta específica + CTA (Paso 2) → `/c/:ofertaId` → redirección al WhatsApp del comercio con código de canje*.

```
WhatsApp (Baileys/Meta)
   └─► procesarMensajeEntrante()              server.ts:206
         ├─ resolve LID→tel, descarta no-Perú, separa comercio vs consumidor
         ├─ clasificarConsultaDeterminista() ──► "si"/"no"/"ambiguo"
         │      └─ si ambiguo → clasificarConsultaIA() (Gemini)
         ├─ si falta zona → pide datos (etapa "esperando_datos")
         └─ if consultaConIntencion
               └─► dispatchOffersMosaic()        server.ts:56   [PASO 1]
                     ├─ Mensaje 1: imagen mosaico 1:1 + caption numerado SIN enlaces
                     └─ Mensaje 2: botones nativos "Ver Opción 1/2/3"
   └─► selección (botón buttonId  ó  "Quiero la oferta: {título}")
         └─► enviarOfertaEspecifica()            server.ts:205  [PASO 2]
               └─ Mensaje de cierre + CTA (sin imagen) → /c/{id}?u={tel}
   └─► GET /c/:ofertaId                          server.ts:~309
         └─ registerQualifiedLead()  → click_logs + NV-XXXXXX
         └─ 302 → api.whatsapp.com/send?phone={comercio}&text=...NV-XXXXXX...
Landing pública "Lo quiero"
   └─ handleContactarOferta() → abrirWhatsAppNativo(botPhone,"Quiero la oferta: {título}")
```

## Paso a paso

### 0. Entrada e identidad
Dos canales: Baileys (`canal:"waha"`) y Meta Cloud API (`canal:"meta"`); ambos llaman
`procesarMensajeEntrante({ from, body, senderPhone, pushName, canal, hasImage, imageMessage, buttonId })`.
Se resuelve `LID→teléfono` (`lidToPhoneMap` / `resolverTelefonoLID`), se descarta número no
peruano (solo Lima, `+51`) y se chequea **primero** si es comercio
(`comerciosModule.obtenerPorTelefono`) antes que audiencia (separación de roles).

### 1. Clasificación de intención (`server.ts:206`)
- `clasificarConsultaDeterminista(body)`: detección determinista de "ofertas"/categoría/verbos
  de búsqueda (`busco`, `quiero`, `precio`, …) → `si` / `no` / `ambiguo`.
- `esSugerencia()` → fuerza intención sin término.
- `ambiguo` → `clasificarConsultaIA()` (Gemini) que extrae producto/tipo.
- Sin intención → `respuestaGuia(tipo)` (saludo / agradecimiento / queja / otro). No se envían ofertas.

### 2. Registro / zona
Si el usuario no tiene `distrito`, se pide nombre + edad + distrito (`etapa:"esperando_datos"`);
el distrito se autodetecta con `detectLimaDistrict()`.

### 3. Paso 1 — `dispatchOffersMosaic` (`server.ts:56`)
- **Filtro de validez**: `estado==="activa"` ∧ no expirada ∧ comercio con WhatsApp válido
  (≥7 dígitos) ∧ **comercio con saldo**. Si no cumple, la oferta no aparece.
- **Distrito**: prioriza ofertas del distrito objetivo; si no hay, usa todas.
- **Búsqueda por término** (`searchQuery`): filtra por tokens (título + descripción, ≥3 chars).
  Sin coincidencias → mensaje "**no encontramos ofertas**" con sugerencia.
- **Anti-repetición**: excluye `user.utm.vistasIds`; si se agotan, reinicia.
- **Ranking** (`sortFn`): plan del comercio (premium > destacado > normal) → `likes` desc →
  más reciente.
- **Tope de 3** (`slice(0, 3)`).
- **Render** `renderMosaicImage()` (`cardRenderer.ts:405`): **una sola imagen** 800×800N (1:1),
  cada segmento numerado (badge en `x=40, y=40`).
- **Mensaje 1 (imagen)**: caption = intro + lista `1️⃣/2️⃣/3️⃣` con título y precio,
  **sin enlaces**, + "…responde *Más ofertas*…".
- **Mensaje 2 (botones nativos)**: `Ver Opción 1/2/3` (id = `ofertaId`) + "👇 Elige…".
  Con *fallback textual* si el canal no soporta botones.

### 4. Selección (Paso 2)
Dos disparadores que convergen:
- **Botón**: `buttonId ∈ {ofertaIds}` → `enviarOfertaEspecifica`.
- **Texto**: `"Quiero la oferta: {título}"` → `ofertaEspecificaDisponible(query)` (match por
  título, activa, no expirada, con saldo) → `enviarOfertaEspecifica`; si no hay match exacto →
  nuevo `dispatchFiveOffers` con el término.

### 5. `enviarOfertaEspecifica` (`server.ts:205`)
Mensaje de cierre (*título + ahorro* + comercio + precios + distrito) + **CTA sin imagen**
"Quiero esta oferta" → `{origin}/c/{id}?u={tel}`. Solo adjunta `?u=` si el teléfono es peruano
válido; si es LID no resoluble, se omite.

### 6. Redirección de lead — `GET /c/:ofertaId`
Ruta pública, con rate limit 20/60 s por IP:
- Valida `u` (9–15 dígitos); inválido → lead **no facturable**.
- `registerQualifiedLead({ ofertaId, comercioId, usuarioTelefono, saldoDisponible })` → fila en
  `click_logs` con código **`NV-XXXXXX`**; `facturable = tel válido ∧ sin facturable previo 24 h
  (misma oferta + tel) ∧ saldo`.
- Si facturable → `debitarClic` (CPC) + `leadsCalificados + 1`.
- **302** a `https://api.whatsapp.com/send?phone={comercioWsp}&text=… título … Mi código es NV-XXXXXX`.

### 7. Landing pública "Lo quiero" (`PublicWeb.tsx`)
Gate de registro; si está verificado, hace `fetch('/api/whatsapp/config')` y
`abrirWhatsAppNativo(botPhone, "Quiero la oferta: {título}")`, con fallback a `/go/oferta/:id`.

## Rutas puente (Muro de Fuego — sin exponer números)

Todo es server-side: `/c/:ofertaId` (lead + código), `/go/oferta/:id`, `/go/whatsapp`,
`/api/go/pedir`, `/api/go/comercio`. Ningún teléfono va *hardcoded* en el frontend.

## Reglas aplicadas

- **Consumo**: 1 imagen + 1 texto interactivo por respuesta (ahorro Meta).
- **Formato**: tarjetas individuales 800×800 (1:1); mosaico 1:1.
- **Antifraude**: dedupe 24 h en Postgres; sin teléfono válido no hay cobro.
- **Resiliencia**: `doSend` envuelto en `try/catch` y con fallback textual (botones/CTA).
