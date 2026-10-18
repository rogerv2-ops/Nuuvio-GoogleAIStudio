---

description: "Task list for Embudo de Lead Calificado con Botones Nativos y Redirección Segura"
---

# Tasks: Embudo de Lead Calificado con Botones Nativos y Redirección Segura

**Input**: Design documents from `/specs/003-embudo-lead-calificado/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: La especificación no exige TDD, pero el gate de despliegue del repo requiere
`bun run build` + `bun test tests/security`, por lo que se incluyen tareas de prueba de
contrato mínimas por historia.

**Organization**: Tareas agrupadas por historia de usuario (US1, US2, US3) para permitir
implementación y prueba independientes.

> **Nota de delta**: la base `002` ya trae mosaico 1:1, `click_logs`/CPC, `/c/:ofertaId`,
> ventana de 24 h y landing 1:1. Estas tareas cubren **solo el delta** del embudo de
> botones + formalización del lead (ver Gap Analysis en `plan.md`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias)
- **[Story]**: US1, US2 o US3
- Rutas de archivo exactas incluidas en cada tarea

## Path Conventions

Proyecto único: backend `server.ts` y módulos `src/`, pruebas en `tests/security/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar la base existente y el entorno; sin migraciones nuevas.

- [X] T001 Baseline: ejecutar `bun run build` y `bun test tests/security` y registrar el estado inicial (74 tests, 51 pass/23 skip) en `package.json`, `tests/security/`
- [X] T002 [P] Verificar entidades persistidas existentes (`click_logs`, `offers.leadsCalificados`, `click_packs_list`) y confirmar que **no** se requiere migración destructiva en `src/db/schema.ts`
- [X] T003 [P] Verificar la config pública del bot (`/api/whatsapp/config` → `botPhone`) y `VUUV_PUBLIC_ORIGIN` usados para construir URLs del embudo en `server.ts`, `.env.example`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura de envío/parseo y API canónica del lead, compartida por todas
las historias.

**⚠️ CRITICAL**: Ninguna historia puede implementarse hasta completar esta fase.

- [X] T004 Extender `doSend` para aceptar `buttons` (respuesta rápida, `id`=`ofertaId`) y `interactiveButton` **sin imagen**, con mapeo Meta (`interactive.type="button"` / `cta_url`) y Baileys (`buttons` / `templateButtons`) y fallback textual (R1, R6, R8) en `server.ts`
- [X] T005 [P] Exponer `registerQualifiedLead({ ofertaId, comercioId, usuarioTelefono })` canónico y dejar `registerOfferClick` como alias deprecado que delega (R3) en `src/db/repo.ts`
- [X] T006 Normalizar el parseo de entrantes a una `SelecciónEntrante` (Meta `interactive.button_reply.id`, Baileys `buttonsResponseMessage.selectedButtonId` / `templateButtonReplyMessage.selectedId`, y texto) dentro de `procesarMensajeEntrante` (R2) en `server.ts`

**Checkpoint**: Envío interactivo, lead canónico y parseo de botones listos.

---

## Phase 3: User Story 1 - Embudo de dos pasos con botones nativos (Priority: P1) 🎯 MVP

**Goal**: Una imagen de mosaico + texto sin enlaces, seguida de un mensaje con 3 botones;
al tocar un botón, mensaje de cierre con CTA de esa oferta.

**Independent Test**: Solicitar ofertas con 1, 2 y 3 ofertas disponibles; verificar **una**
imagen numerada, texto sin enlaces, mensaje con N botones; tocar un botón → llega cierre con
CTA de esa oferta.

### Tests for User Story 1

> **NOTE: Escribir primero; deben FALLAR antes de implementar.**

- [X] T007 [P] [US1] Contrato: Paso 1 sin enlaces y N botones (1/2/3) equivalentes al número de ofertas en `tests/security/mosaic-funnel.test.ts`

### Implementation for User Story 1

- [X] T008 [US1] Reescribir el Paso 1 de `dispatchOffersMosaic`: enviar **una** imagen de mosaico + texto numerado **sin enlaces**, y acto seguido el mensaje con botones `Ver Opción 1/2/3` (id = `ofertaId`) en `server.ts`
- [X] T009 [US1] Ajustar la numeración del mosaico a `x=40, y=40` y confirmar segmentos 1:1 sin corazón (FR-004, FR-005) en `src/utils/cardRenderer.ts`
- [X] T010 [US1] Implementar el Paso 2: al recibir la selección (botón o `Quiero la oferta: [título]`) responder el mensaje de cierre (título + ahorro) + CTA sin imagen, reemplazando `enviarOfertaEspecifica` en `server.ts`
- [X] T011 [US1] Manejar 0/1/2/N ofertas (mosaico y número de botones dinámicos; 0 ofertas → mensaje "no hay ofertas") y el fallback textual cuando no hay botones (FR-008) en `server.ts`

**Checkpoint**: Embudo de botones funcional y testeable de forma independiente.

---

## Phase 4: User Story 2 - Lead calificado y redirección segura al comercio (Priority: P1)

**Goal**: Al seguir el CTA, registrar lead; facturable solo si no hubo facturable en 24 h;
código de canje; débito CPC e incremento de contador solo si facturable; redirección 302.

**Independent Test**: Abrir el CTA con teléfono de prueba → lead facturable + débito +1 +
contador +1; repetir < 24 h → lead no facturable sin débito; comercio sin saldo → nunca
negativo.

### Tests for User Story 2

- [X] T012 [P] [US2] Contrato: lead facturable/no facturable (ventana 24 h), saldo nunca negativo y `leadsCalificados` solo facturable en `tests/security/lead-qualified.test.ts`

### Implementation for User Story 2

- [X] T013 [US2] Migrar `GET /c/:ofertaId?u=` a `registerQualifiedLead` y armar el redirect 302 a WhatsApp del comercio con el mensaje que incluye **título + código `NV-XXXXXX`** (FR-016) en `server.ts`
- [X] T014 [P] [US2] Confirmar la ventana de 24 h anclada al último `facturable`, que el no facturable no la reinicia, y que `offers.leadsCalificados` sube solo si facturable en `src/db/repo.ts`
- [X] T015 [US2] Verificar rate limit por IP (20/60 s) y condición de ruta pública en `/c/` (FR-018) en `server.ts`

**Checkpoint**: Monetización y atribución del lead operativas e independientes.

---

## Phase 5: User Story 3 - Tarjeta 1:1 y botón "Lo quiero" en la landing (Priority: P2)

**Goal**: Tarjeta cuadrada sin texto duplicado; "Lo quiero" abre WhatsApp nativo del bot
con "Quiero la oferta: [título]" y entra directo al Paso 2.

**Independent Test**: Verificar imagen 1:1 y ausencia de texto duplicado; pulsar "Lo quiero"
→ abre WhatsApp nativo con el mensaje correcto; enviar ese texto al bot → responde Paso 2 sin
reenviar el mosaico.

### Implementation for User Story 3

- [X] T016 [US3] Cambiar el botón "Lo quiero" (tarjeta y modal de ficha) a `abrirWhatsAppNativo(botPhone, "Quiero la oferta: " + oferta.titulo)`, conservando el gate de registro y el evento `click_lo_quiero_directo` (FR-020) en `src/components/PublicWeb.tsx`
- [X] T017 [US3] Verificar que la imagen es 1:1 (`aspect-square`) y que la tarjeta no repite título/descripción bajo la foto (FR-019) en `src/components/PublicWeb.tsx`

**Checkpoint**: Todas las historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verificación, resiliencia y despliegue.

- [X] T018 [P] Ejecutar `bun run build` y `bun test tests/security`; corregir fallos en `package.json`, `tests/security/`
- [ ] T019 Verificar que `drizzle-kit push` no propone drops (deploy aditivo) en `docker-entrypoint.sh`, `src/db/schema.ts`
- [ ] T020 Ejecutar `quickstart.md` Escenarios 1–6 y QA manual de botones en un dispositivo real (o simulación) en `specs/003-embudo-lead-calificado/quickstart.md`
- [ ] T021 Commit, push a `main` y verificación e2e en prod (login 200, `/c/` 302 con código, sin re-siembra) en `server.ts`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias.
- **Foundational (Phase 2)**: depende de Setup — **bloquea** todas las historias.
- **User Stories (Phase 3+)**: dependen de Foundational. US1 y US2 (ambas P1) pueden ir en
  paralelo si hay capacidad, o secuencial US1 → US2 → US3.
- **Polish (Phase 6)**: depende de las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: arranca tras Foundational; sin dependencias de otras historias.
- **US2 (P1)**: arranca tras Foundational; usa el CTA de US1 para el flujo e2e, pero es
  testeable por separado (se puede abrir `/c/` directamente).
- **US3 (P2)**: arranca tras Foundational; su Paso 2 reutiliza la implementación de US1
  (T010), por lo que comparte el manejador de texto.

### Within Each User Story

- Tests antes de implementar (T007, T012) y deben fallar primero.
- Backend (`server.ts`) antes que integration/UI.
- Story completa antes de pasar a la siguiente prioridad.

### Parallel Opportunities

- T002, T003 (Setup) en paralelo; T005 (repo) en paralelo con T004/T006 (server.ts, mismo archivo → secuenciales entre sí).
- T007 (US1) y T012 (US2) son archivos de prueba distintos → paralelos.
- T014 (repo) paralelo a T013/T015 (server.ts).
- T016/T017 (PublicWeb.tsx) no paralelizables entre sí (mismo archivo).

---

## Parallel Example: User Story 1

```bash
# Solo el test de contrato (archivo propio) corre en paralelo con el repo de US2:
Task: "Contrato Paso 1 sin enlaces y N botones en tests/security/mosaic-funnel.test.ts"
Task: "registerQualifiedLead canónico en src/db/repo.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2, ambas P1)

1. Completar Fase 1 (Setup) y Fase 2 (Foundational).
2. Implementar US1 (embudo de botones) **y** US2 (lead calificado + monetización) — ambas son
   P1 y juntas habilitan la conversión monetizable.
3. **STOP y VALIDAR** US1+US2 de forma independiente (Escenarios 1–3 del quickstart).

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 + US2 → embudo de botones + lead calificado/CPC (MVP P1).
3. US3 → landing 1:1 + "Lo quiero" nativo.
4. Polish → build/tests, deploy aditivo y verificación e2e.

---

## Notes

- [P] = archivos distintos, sin dependencias.
- El manejo de "Quiero la oferta: [título]" es **compartido**: lo implementa US1 (T010) y lo
  consume US3 (T016).
- Evitar: tareas vagas, conflictos de archivo en paralelo, dependencias entre historias que
  rompan su independencia.
- Confirmar que cada test falla antes de implementar.
- Commit por tarea o grupo lógico.
