# Implementation Plan: Embudo de Lead Calificado con Botones Nativos y Redirección Segura

**Branch**: `003-embudo-lead-calificado` | **Date**: 2026-10-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-embudo-lead-calificado/spec.md`

## Summary

Convertir el envío de ofertas del bot en un **embudo de conversión de dos pasos** por
WhatsApp y formalizar el **lead calificado**:

- **Paso 1**: el bot envía **una** imagen (mosaico 1:1 de hasta 3 ofertas con numeración)
  y un texto que lista las opciones **sin enlaces**, seguido de un **mensaje interactivo
  con botones nativos** ("Ver Opción 1/2/3") cuyo id es el `ofertaId`.
- **Paso 2**: al recibir la selección (botón nativo o texto "Quiero la oferta: [título]"),
  el bot responde con el **mensaje impulsador de cierre** (título + ahorro) y un **botón
  CTA de URL** hacia `/c/<ofertaId>?u=<teléfono>`.
- **Lead calificado**: al abrir `/c/:ofertaId` se registra un **lead** (facturable si no
  hubo lead facturable de ese teléfono/oferta en 24 h), se genera **código de canje**, se
  debita 1 clic si aplica, se aumenta `leadsCalificados` y se **redirige 302** al WhatsApp
  del comercio con el código.
- **Landing**: tarjeta 1:1 sin texto duplicado; botón "Lo quiero" abre WhatsApp **nativo**
  del bot con "Quiero la oferta: [título]".

**Estado actual (importante)**: el mosaico 1:1 (`renderOfferCardImage` 800×800 sin corazón,
`renderMosaicImage` con círculos numerados), el registro de clics
(`click_logs` + `registerOfferClick` con ventana de 24 h anclada a `facturable`), el
débito CPC y `GET /c/:ofertaId`, y la landing 1:1 ya están implementados
(feature `002`). Este plan formaliza el diseño y aísla el **delta pendiente**
(botones nativos, paso 2, `registerQualifiedLead`, y el texto/mecanismo de "Lo quiero").

## Technical Context

**Language/Version**: TypeScript en runtime Bun (target Node); frontend React 19 + Vite.

**Primary Dependencies**: Express (backend monolítico `server.ts`), Drizzle ORM + Postgres,
`@napi-rs/canvas` (render tarjetas/mosaico), **Baileys 7.x** (motor WhatsApp real) con
**Meta Cloud API** como canal alterno, `lucide-react` + Tailwind (UI).

**Storage**: Postgres. El **lead** se persiste en la tabla física `click_logs` (ya
existente) y los contadores en `offers` (`clics`, `leadsCalificados`) y saldo en
`app_settings.click_packs_list`. El render de imágenes es un artefacto efímero (buffer).

**Testing**: `bun test tests/security` (suite existente), verificación black-box HTTP
(`/api/whatsapp/simulate-incoming`, `GET /c/:ofertaId`), `bun run build` obligatorio antes
de push. Los botones nativos requieren prueba manual en dispositivo real.

**Target Platform**: Linux ARM64, contenedor Docker en Coolify (`https://yuddit.com`).

**Project Type**: Aplicación web full-stack single-service (backend + SPA en el mismo proceso).

**Performance Goals**: render del mosaico de ≤3 segmentos (< ~1.5 s); `/c/:ofertaId`
responde 302 en caliente (< ~500 ms).

**Constraints**: 1 lead facturable por teléfono/oferta/24 h (ventana anclada al último
facturable); saldo nunca negativo; ofertas de comercios sin saldo no se despachan; el
endpoint `/c/` tiene rate limit; **los botones nativos dependen del cliente de WhatsApp**
(se requiere fallback textual).

**Scale/Scope**: catálogo pequeño (≤ ~7 ofertas públicas activas; mosaico ≤ 3), pocos
comercios con packs. Sin requisitos de alta escala.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|-----------|-----------|--------|
| I. Persistencia total en Postgres | El lead (facturable, código, teléfono, fecha) vive en la tabla `click_logs`; contadores en `offers`; saldo en `app_settings`. El estado de rate limit es efímero (fuera de alcance, constitución v1.1.0). | PASS |
| II. Imágenes a disco, jamás dataURLs | El mosaico se envía como buffer; los `.jpg` en `public/cards` son caché de render, no data de dominio. No se persisten dataURLs. | PASS |
| III. Deploys no borran data | Cambios de esquema **aditivos** (`drizzle-kit push`); se **reutiliza** `click_logs` (no se renombra ni dropea). Cero migraciones destructivas. | PASS |
| IV. Backend y frontend desde este repo | Cambios en `server.ts`, `src/db/*`, `src/utils/cardRenderer.ts`, `src/utils/whatsappNative.ts`, `src/components/PublicWeb.tsx` del repo. | PASS |
| V. WhatsApp Baileys compatible | No se altera el ciclo de sesión/credenciales Baileys; solo el payload de envío (`sendMessage`) y el parseo de entrantes. | PASS |

**Post-design re-check**: los artefactos de Fase 1 no introducen violaciones nuevas.
Sin entradas en Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/003-embudo-lead-calificado/
├── plan.md              # Este archivo
├── spec.md              # Especificación
├── research.md          # Fase 0
├── data-model.md        # Fase 1
├── quickstart.md        # Fase 1
├── contracts/           # Fase 1
│   ├── whatsapp-offers-funnel.md
│   ├── lead-redirect.md
│   └── landing-lo-quiero.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
server.ts                         # dispatchOffersMosaic (Paso 1), procesarMensajeEntrante (Paso 2),
                                  # doSend (botones/CTA), GET /c/:ofertaId, rateLimit, esRutaPublica
src/
├── db/
│   ├── schema.ts                 # tabla click_logs (lead) + offers.clics/leadsCalificados
│   └── repo.ts                   # registerQualifiedLead (canónico) + registerOfferClick (alias)
├── utils/
│   ├── cardRenderer.ts           # renderOfferCardImage (800x800), renderMosaicImage (badge x=40,y=40)
│   └── whatsappNative.ts         # abrirWhatsAppNativo
├── modules/
│   └── facturacion.ts            # debitarClic / listarTodosLosPacks
├── components/
│   └── PublicWeb.tsx             # tarjeta 1:1 + "Lo quiero" -> WhatsApp nativo
└── types/index.ts                # interface Offer
tests/
└── (suite de contrato/HTTP)
```

**Structure Decision**: Se mantiene el proyecto único existente (backend `server.ts` +
SPA `src/`). No se crean paquetes ni servicios nuevos.

## Gap Analysis (estado real vs. spec 003)

| Requisito | Estado en repo | Acción requerida |
|-----------|----------------|------------------|
| FR-001..FR-005 (máx 3, un mosaico 1:1 numerado, sin corazón) | Implementado (`slice(0,3)`, `renderMosaicImage` 800×800) | Verificar; mover badge a `x=40,y=40` (hoy 54,54) |
| FR-006 (pie sin enlaces) | **Pendiente**: el caption incluye `trackingUrl` por oferta | Quitar enlaces del Paso 1; listar solo títulos |
| FR-007 (mensaje interactivo con 3 botones) | **Pendiente** | Añadir envío de botones nativos tras el mosaico |
| FR-008 (fallback si el cliente no soporta botones) | **Pendiente** | Alternativa textual con opciones numeradas |
| FR-009 (Paso 2 impulsador de cierre + CTA) | **Parcial**: `enviarOfertaEspecifica` reenvía mosaico con enlace | Reescribir como mensaje de cierre + botón CTA |
| FR-010 (CTA con teléfono del destinatario) | Parcial (`/c/...?u=`) | Reusar en el botón CTA del Paso 2 |
| FR-011..FR-013 (lead, 24 h, código) | Implementado (`registerOfferClick`, `click_logs`) | Exponer `registerQualifiedLead` canónico |
| FR-014 (débito 1 clic solo facturable) | Implementado | Verificar |
| FR-015 (`leadsCalificados` solo facturable) | Implementado en `/c/` | Verificar |
| FR-016 (302 a WhatsApp comercio con código) | Implementado | Ajustar texto para incluir código destacado |
| FR-017 (saldo nunca negativo) | Implementado (`debitarClic` acotado) | Verificar |
| FR-018 (rate limit `/c/`) | Implementado (`rateLimit("clicks",20,60000)`) | Verificar |
| FR-019 (landing 1:1 sin texto duplicado) | Implementado (`aspect-square`; título en scrim, no debajo) | Verificar |
| FR-020 ("Lo quiero" → WhatsApp nativo + "Quiero la oferta: [título]") | **Parcial**: usa `/go/oferta/:id` (web, no esquema nativo) | Usar `abrirWhatsAppNativo` con el texto correcto |
| FR-021 (persistencia de leads) | Implementado | Verificar |
| FR-022 (ranking existente) | Implementado (`sortFn`) | Verificar |
| Parseo de respuesta de botón (entrante) | **Pendiente**: solo se parsea texto (`msg.text.body`) | Parsear `button_reply` (Meta) y `buttonsResponseMessage` (Baileys) |

## Complexity Tracking

> Sin violaciones a la constitución que justificar.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| (ninguna) | — | — |
