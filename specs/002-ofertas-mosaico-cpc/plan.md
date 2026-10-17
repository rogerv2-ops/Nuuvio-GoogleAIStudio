# Implementation Plan: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

**Branch**: `002-ofertas-mosaico-cpc` | **Date**: 2026-10-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-ofertas-mosaico-cpc/spec.md`

## Summary

Consolidar y completar las Fases 1B y 2 sobre el repositorio `vuuy`:
el bot de WhatsApp envía **hasta 3 ofertas** en **un solo mensaje** cuyo cuerpo es
una **imagen mosaico vertical de segmentos 1:1 numerados**, con un pie que lista
cada oferta y su **enlace de redirección**. Al seguir ese enlace, el sistema
**registra el clic** (facturable solo la primera vez por usuario/oferta en 24 h),
genera un **código de canje**, **debita un clic** del comercio cuando corresponde y
**redirige a WhatsApp del comercio**. En la landing pública, la tarjeta usa imagen
**1:1**, no repite título/descripción, incorpora **"Me Gusta"** y **"Lo quiero"**
(WhatsApp nativo).

**Estado actual (importante)**: la mayor parte de la Fase 1B/2 **ya está
implementada y commiteada** en el repo (`click_logs`, `registerOfferClick`,
`renderOfferCardImage` 1:1 sin corazón, `renderMosaicImage`,
`dispatchOffersMosaic`, `POST /api/ofertas/:id/like`, `GET /c/:ofertaId`,
`facturacionModule.debitarClic`, y la landing con `aspect-square` y "Lo quiero").
Este plan formaliza el diseño y define las **brechas pendientes** para cumplir
todos los requisitos de la spec (ver Gap Analysis).

## Technical Context

**Language/Version**: TypeScript en runtime Bun (target Node); frontend React + Vite.

**Primary Dependencies**: Express (backend monolítico `server.ts`), Drizzle ORM + Postgres, `@napi-rs/canvas` (render de tarjetas/mosaico), Baileys 7.x (WhatsApp, vía WAHA) con Meta Cloud API como canal alterno, `lucide-react` + Tailwind (UI).

**Storage**: Postgres (tablas `offers`, `click_logs`, `app_settings`; los packs de clics viven en `app_settings.click_packs_list`). Render de imágenes a `public/cards/*.jpg` (caché efímera de artefactos; el buffer se envía directo por WhatsApp).

**Testing**: `bun test` (suite en `tests/`), verificación black-box HTTP contra el servicio desplegado, `bun run build` obligatorio antes de push.

**Target Platform**: Linux ARM64, contenedor Docker en Coolify (`https://nuuvio.sustrae.com`).

**Project Type**: Aplicación web full-stack single-service (backend + SPA servida por el mismo proceso).

**Performance Goals**: render del mosaico de hasta 3 segmentos (< ~1.5 s por composición); respuesta de redirección de clic inmediata (302, < 500 ms en caliente).

**Constraints**: 1 clic facturable por usuario/oferta/24 h; saldo de comercio nunca negativo; ofertas de comercios sin saldo **no se despachan**; endpoint público de clic y "Me Gusta" con límite de frecuencia.

**Scale/Scope**: catálogo pequeño (≤ ~7 ofertas públicas activas; mosaico ≤ 3), pocos comercios con packs de clics. Sin objetivos de alta escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|-----------|-----------|--------|
| I. Persistencia total en Postgres | `click_logs` es tabla (no estado en memoria); `offers.likes/clics/leadsCalificados` columnas; saldo en `app_settings`. El estado efímero de rate limiting queda fuera de alcance (constitución v1.1.0). | PASS ⚠ (ver nota) |
| II. Imágenes a disco, jamás dataURLs | El mosaico se envía como buffer (no se persiste dataURL); los `.jpg` en `public/cards` son caché de render, no data de dominio. | PASS |
| III. Deploys no borran data | `click_logs` se crea por `drizzle-kit push` aditivo; no hay migraciones destructivas. | PASS |
| IV. Backend y frontend desde este repo | Cambios en `server.ts`, `src/utils/cardRenderer.ts`, `src/db/*`, `src/components/PublicWeb.tsx` de este repo. | PASS |
| V. WhatsApp Baileys compatible | No se altera el ciclo de sesión Baileys; solo el payload de envío. | PASS |

> **Nota (PASS condicionado, a resolver en la implementación)**: `syncOffers` no
> incluye `likes` en el `onConflictDoUpdate.set`, por lo que un "Me Gusta" sobre
> una oferta ya persistida **no se guardaría**. Debe corregirse (ver research R6).

**Post-design re-check**: los artefactos de Fase 1 no introducen violaciones
nuevas. Sin entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-ofertas-mosaico-cpc/
├── plan.md              # Este archivo
├── spec.md              # Especificación (con clarificaciones)
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── offer-like.md
│   ├── offer-redirect.md
│   └── whatsapp-offers-dispatch.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
server.ts                         # dispatchOffersMosaic, POST /api/ofertas/:id/like, GET /c/:ofertaId, rateLimit, esRutaPublica
src/
├── db/
│   ├── schema.ts                 # tabla click_logs + offers.likes/clics/leadsCalificados
│   └── repo.ts                   # registerOfferClick, syncOffers/getAllOffers
├── utils/
│   ├── cardRenderer.ts           # renderOfferCardImage (800x800), renderMosaicImage
│   └── whatsappNative.ts         # abrirWhatsAppNativo
├── modules/
│   ├── facturacion.ts            # debitarClic / listarTodosLosPacks
│   └── clics.ts                  # (lógica de clics auxiliar)
├── components/
│   └── PublicWeb.tsx             # tarjeta 1:1, Me Gusta, Lo quiero
└── types/index.ts                # interface Offer
tests/
└── (suite de contrato/HTTP)
```

**Structure Decision**: Se mantiene la estructura existente de proyecto único
(backend `server.ts` + SPA en `src/`). No se crean nuevos paquetes ni servicios.

## Gap Analysis (estado real vs. spec)

| Requisito | Estado en repo | Acción requerida |
|-----------|----------------|------------------|
| FR-001 (máx 3) | Implementado (`slice(0,3)`) | Verificar |
| FR-002 (un solo envío con imagen) | Implementado (`doSend({image})`) | Verificar |
| FR-003/FR-004 (1:1 + numeración) | Implementado (`renderMosaicImage`) | Verificar |
| FR-005 (pie con título/precio/enlace) | Implementado | Verificar |
| FR-006/FR-007 (tarjeta 1:1 sin corazón) | Implementado | Verificar |
| FR-008/FR-009 (registro clic + 24 h) | Implementado, pero la ventana cuenta **todos** los clics | Anclar la ventana a clics **facturables** (`facturable=true`); un solo cobro por 24 h (T018) |
| FR-010 (código canje) | Implementado (`NV-####`) | Verificar |
| FR-011 (débito 1 clic) | Parcial (débito existe; falta condicionar a saldo y a 1 por ventana) | Ver FR-020/021 (T019/T020) |
| FR-012 (302 a WhatsApp comercio) | Implementado | Verificar |
| FR-013 (landing 1:1) | Implementado (`aspect-square`) | Verificar |
| FR-014 (sin título/descripción duplicados) | **Pendiente** (se repite título y descripción bajo la foto) | Eliminar bloque duplicado |
| FR-015 (Me Gusta en vivo) | **Pendiente** (existe endpoint, no el botón en la landing) | Añadir botón + estado (informativo, no factura) |
| FR-016 (likes persistentes) | **Parcial/bug** (`syncOffers` no actualiza `likes` en conflicto) | Corregir persistencia (informativo) |
| FR-017 (Lo quiero menciona oferta) | **Parcial** (llama con texto `'Ofertas'`) | Cambiar a `Quiero la oferta: <título>` |
| FR-018 (clics persistentes) | Implementado | Verificar |
| FR-019 (Me Gusta público + rate limit) | Parcial (público sí; sin rate limit) | Añadir bucket |
| FR-020 (excluir comercios sin saldo) | **Pendiente** | Filtrar en `dispatchOffersMosaic` |
| FR-021 (saldo nunca negativo en enlace antiguo) | Parcial (`debitarClic` acotado; redirección facturable) | Asegurar no-debit cuando no hay saldo |
| FR-022 (ranking existente) | Implementado (`sortFn` plan→likes→fecha) | Verificar |
| FR-023 (rate limit clic) | **Pendiente** | Añadir bucket a `/c/` y like |
| Tipos (`OfferCardData`) | **Pendiente** (referenciado sin definir) | Definir interfaz |

## Complexity Tracking

> Sin violaciones a la constitución que justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |
