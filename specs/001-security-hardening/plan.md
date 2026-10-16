# Implementation Plan: Endurecimiento de Seguridad, Flujo y Lógica

**Branch**: `001-security-hardening` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-security-hardening/spec.md`

## Summary

Endurecer la plataforma vuuy (servicio web único Express + React + PostgreSQL) en
tres frentes: (P1) autenticación/autorización real de la API y eliminación de
credenciales del cliente; (P2) blindaje de integraciones externas (SSRF,
webhooks sin firma, envío de WhatsApp arbitrario, path traversal, rate limiting,
cabeceras de seguridad); (P3) integridad de datos ante reinicios (FLW-01..04 como
regresión).

Enfoque técnico: mantener la arquitectura actual (un `server.ts` con Express,
`tsx` en runtime, `bun` para build) e introducir middleware de seguridad
transversal, utilidades de validación (SSRF/rutas/enteros), tokens de sesión
HMAC-SHA256 firmados en servidor con credenciales `scrypt` persistidas en
`app_settings`, verificación de firma de webhooks y un cliente frontend que solo
conserva el token (nunca credenciales).

**Estado de partida**: User Story 1 (auth de servidor + limpieza de credenciales
del bundle) ya fue implementada y desplegada como primer corte. Este plan cubre
la totalidad de la especificación, marcando US1 como "implementado, pendiente de
pruebas de regresión/automatización" y US2/US3 como trabajo por ejecutar.

## Technical Context

**Language/Version**: TypeScript 5.x (ES2022). Runtime de producción: Node vía
`tsx server.ts`. Build: `bun` (`bun build server.ts`) + `vite build` (frontend).

**Primary Dependencies**: Express (HTTP), `drizzle-orm` + `pg` (PostgreSQL),
`@whiskeysockets/baileys` 7.x (WhatsApp), `@google/genai` (Gemini/Veo),
`nodemailer`, `sharp`, `qrcode`; frontend React 19 + Vite + Tailwind. Criptografía
vía `node:crypto` (sin dependencias nuevas obligatorias).

**Storage**: PostgreSQL (tablas: `app_settings`, `offers`, `banners`,
`audience_users`, `email_logs`, `registration_logs`, `click_logs`; se propone
añadir `security_logs`). Disco persistente: `/app/auth_info_baileys`,
`/app/data` (uploads WebP), `/app/public/videos`.

**Testing**: No existe framework de pruebas (scripts actuales: `lint: tsc
--noEmit || true`). Decisión: pruebas de contrato HTTP de caja negra con
`bun test` contra una instancia local + escaneo estático del bundle y smoke
script con `curl` (ver research.md, Decisión 7 y quickstart.md).

**Target Platform**: Servidor Linux aarch64 (ARM64) en contenedor Docker detrás
de HTTPS (Coolify/Caddy), instancia única.

**Project Type**: Aplicación web full-stack monolítica (backend y frontend en el
mismo repo/servicio).

**Performance Goals**: Sin regresión perceptible; el gate de auth añade <5 ms por
petición (validación HMAC en memoria, secreto cacheado). Rate limiter en memoria
O(1) por ventana.

**Constraints**: Instancia única (rate limiting en memoria aceptable); no romper
la sesión de WhatsApp Baileys en proceso; despliegues no deben borrar data
(`drizzle-kit push` aditivo); secretos solo vía variables de entorno / DB, nunca
en el repo.

**Scale/Scope**: 53 endpoints `/api/*`; 3 roles (admin, operador, comercio);
usuarios de administración en número reducido; ~9 tablas.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Evaluación | Estado |
|-----------|-----------|--------|
| I. Persistencia total en Postgres (NON-NEGOTIABLE) | Credenciales (`auth_users`), secreto HMAC (`auth_secret`) y eventos (`security_logs`) viven en Postgres. Los contadores del rate limiter en memoria quedan **fuera del alcance** del principio según su cláusula de alcance (constitución v1.1.0): son estado efímero no-dominio. | PASS |
| II. Imágenes a disco, jamás dataURLs (NON-NEGOTIABLE) | No se altera: la validación SSRF de `imageUrl` es defensiva y no introduce dataURLs. `POST /api/media/upload` sigue guardando WebP en disco. | PASS |
| III. Deploys no borran data | `drizzle-kit push` aditivo; `security_logs` es tabla nueva; no se tocan datos operativos. | PASS |
| IV. Backend y frontend desde este repo | El feature elimina bundles versionados (`assets/`, `public/assets/`) y prohíbe `dist/` pre-construido. Refuerza el principio. | PASS |
| V. WhatsApp Baileys compatible | El motor Baileys corre en proceso y no depende de webhooks entrantes; la verificación de firma aplica solo a Meta/WAHA y no afecta a Baileys. | PASS |

**Resultado del gate**: PASS. El rate limiter en memoria no constituye una
desviación: la constitución v1.1.0 define explícitamente que el estado efímero
de seguridad/rendimiento queda fuera del alcance del Principio I.

## Project Structure

### Documentation (this feature)

```text
specs/001-security-hardening/
├── plan.md              # Este archivo (/speckit.plan)
├── spec.md              # Especificación (/speckit.specify)
├── research.md          # Fase 0 (/speckit.plan)
├── data-model.md        # Fase 1 (/speckit.plan)
├── quickstart.md        # Fase 1 (/speckit.plan)
├── contracts/           # Fase 1 (/speckit.plan)
│   ├── auth-api.md
│   ├── security-middleware.md
│   ├── webhooks.md
│   └── media-and-ssrf.md
├── checklists/
│   └── requirements.md  # (/speckit.checklist)
└── tasks.md             # Fase 2 (/speckit.tasks - no lo crea /speckit.plan)
```

### Source Code (repository root)

```text
server.ts                         # Servidor Express (punto de integración de middleware y rutas)
docker-entrypoint.sh              # Aplica schema (drizzle-kit push) y arranca
Dockerfile                        # Build reproducible (bun + vite)
src/
├── core/
│   └── security.ts               # [US1] Auth de cliente: token de servidor + interceptor fetch
├── components/
│   ├── LoginView.tsx             # [US1] Login asíncrono contra /api/auth/login
│   ├── NavigationHeader.tsx      # [US1] Uso de sesión (rol/email)
│   ├── PublicWeb.tsx             # Superficie pública (endpoints públicos)
│   ├── UserRegistrationFunnelModal.tsx  # Registro público de audiencia
│   ├── gestion/                  # Panel admin (rutas sensibles)
│   │   ├── GestionLayout.tsx
│   │   └── views/ConfiguracionDomainView.tsx  # [US1] Sin exponer contraseñas
│   └── comercio/                 # Panel comercio
├── db/
│   ├── schema.ts                 # Tablas Drizzle (añadir security_logs)
│   ├── index.ts                  # Conexión
│   └── repo.ts                   # Settings y persistencia (sync autoritativo)
├── modules/                      # Módulos de dominio (persistencia vía API)
└── utils/
    └── uploadMedia.ts            # Subida WebP al servidor

# Nuevos artefactos de código previstos (Fase 2):
# tests/security/*.test.ts        # Pruebas de contrato HTTP (bun test)
# scripts/security-smoke.sh       # Smoke de caja negra (curl)
```

**Structure Decision**: Proyecto único (monolito full-stack). No se crean
proyectos `backend/` + `frontend/` separados: el repo ya integra ambos en un
`server.ts` + `src/`. Las utilidades de seguridad se implementan como funciones
y middleware dentro de `server.ts` (coherente con el estilo actual del archivo) y
la lógica de datos nueva (tabla `security_logs`) en `src/db/`.

## Complexity Tracking

> Sin violaciones al Constitution Check. (Antes había una excepción candidata por
> el rate limiter en memoria; resuelta definiendo su alcance en la constitución
> v1.1.0, por lo que ya no se registra aquí.)

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| — | — | — |

## Phase Plan

### Phase 0 — Research (`research.md`)
Resolver las incógnitas técnicas: mecanismo de firma de webhooks Meta/WAHA,
estrategia SSRF, verificación HMAC vs. almacén de sesiones, enfoque de pruebas
sin framework y límites de rate/size. **Salida**: `research.md` sin NEEDS
CLARIFICATION.

### Phase 1 — Design (`data-model.md`, `contracts/`, `quickstart.md`)
Modelar entidades (Credencial, Sesión, EventoSeguridad, RecursoPersistente,
WebhookEntrante), formalizar contratos HTTP de auth/middleware/webhooks/media y
SSRF, y escribir la guía de validación ejecutable. **Salida**: artefactos listos
para `/speckit.tasks`.

### Phase 2 — Tasks (`/speckit.tasks`, no incluido aquí)
Desglose en tareas ejecutables y verificables.

## Constitution Check (re-evaluación post-diseño)

Tras completar Fase 0 (research.md) y Fase 1 (data-model.md, contracts/,
quickstart.md), el gate se mantiene **PASS**:

- **I. Persistencia**: credenciales, secreto y (opcional) `security_logs` en
  Postgres; el rate limit en memoria queda fuera del alcance del principio
  (cláusula de alcance, constitución v1.1.0). Sin cambios.
- **II. Imágenes a disco**: los contratos no introducen dataURLs; la subida sigue
  siendo WebP a disco. PASS.
- **III. Deploys no borran data**: `security_logs` es aditivo; sin cambios
  destructivos de esquema. PASS.
- **IV. Fuente de verdad el repo**: el feature elimina bundles versionados y
  valida que `vite build` compile la app real (quickstart §3). PASS.
- **V. Baileys**: la verificación de webhooks no toca el motor en proceso; el
  flujo de `procesarMensajeEntrante` se mantiene. PASS.

No se requieren nuevas violaciones ni entradas adicionales en Complexity
Tracking.

## Key Rules
- Rutas absolutas para operaciones de filesystem; rutas relativas al repo en la documentación.
- ERROR ante violación injustificada del Constitution Check o clarificación no resuelta.
