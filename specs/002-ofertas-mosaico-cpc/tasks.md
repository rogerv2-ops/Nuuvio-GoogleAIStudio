---

description: "Task list for Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección"
---

# Tasks: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

**Input**: Design documents from `/specs/002-ofertas-mosaico-cpc/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: La spec no solicita TDD; los pocos tests se marcan `(OPTIONAL)` y solo si se desea extender la suite existente.

**Organization**: Tareas agrupadas por historia de usuario (US1, US2, US3).

> **Contexto**: Fase 1B/2 ya está mayormente implementada y commiteada. Varias tareas son **verificar/cerrar brechas** sobre código existente (ver Gap Analysis en `plan.md`). No se reescribe lo que ya cumple.
>
> **Regla de cobro (vínculo con facturación)**: solo el **clic de redirección a WhatsApp** se factura (CPC). "Me Gusta" es **informativo** y no factura. Por usuario+oferta, **un clic facturable por ventana de 24 h**; la ventana se ancla al **último clic facturable** (los no facturables no la reinician).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede correr en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: US1 / US2 / US3
- Rutas de archivo exactas incluidas en cada tarea

## Path Conventions

- Proyecto único: `server.ts`, `src/`, `tests/` en la raíz del repo.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirmar prerrequisitos del entorno antes de tocar código.

- [x] T001 Confirmar prerrequisitos en la raíz del repo: `drizzle-kit push` crea `click_logs` de forma aditiva; `app_settings.click_packs_list` tiene ≥2 packs (uno con `saldoClics > 0`, otro `= 0`); ≥3 ofertas `estado="activa"` no vencidas con `comercioWhatsapp` válido.
- [x] T002 [P] Establecer línea base verde: `export PATH="$HOME/.bun/bin:$PATH"; bun run build` y `bun test` pasan antes de cambios en `/home/ubuntu/nuuvio-googleaistudio`.
- [x] T003 [P] Reconfirmar el inventario de implementación y el Gap Analysis en `specs/002-ofertas-mosaico-cpc/plan.md` contra el código actual (`server.ts`, `src/utils/cardRenderer.ts`, `src/db/repo.ts`, `src/components/PublicWeb.tsx`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fundamentos compartidos por todas las historias.

**⚠️ CRITICAL**: Completar antes de las user stories.

- [x] T004 Definir la interfaz `OfferCardData` en `src/utils/cardRenderer.ts` (campos `titulo`, `precioNormal`, `precioOferta`, `comercioNombre`, `distrito`, `imagen`; opcionales `descuentoPct`, `etiqueta`) y anotar `renderOfferCardImage`/`renderMosaicImage` con ese tipo. (FR-003/FR-004)
- [x] T005 [P] (Hardening secundario) Corregir `syncOffers` en `src/db/repo.ts`: eliminar la clave duplicada `likes:o.likes||0` y agregar `likes:o.likes||0` al `onConflictDoUpdate.set`. **Nota**: la persistencia principal de likes es T006 (`incrementOfferLikes` atómico); T005 evita que `syncOffers` deje `likes` desactualizado. (FR-016, informativo)
- [x] T006 [P] Agregar `incrementOfferLikes(ofertaId)` en `src/db/repo.ts` con incremento atómico en SQL (`likes = likes + 1`) que devuelva el conteo nuevo. (FR-015/FR-016, informativo, sin débito)
- [x] T007 Agregar helper `comercioTieneSaldo(comercioId)` en `server.ts` respaldado por `facturacionModule.listarTodosLosPacks()` (verdadero si algún pack activo tiene `saldoClics > 0`). (FR-020/FR-021)
- [x] T008 Agregar buckets de rate limit usando el `rateLimit(bucket,max,windowMs)` existente en `server.ts`: `clicks` (20 req/60 s, ruta de cobro) y `likes` (30 req/60 s, informativo/anti-abuso), con clave por IP (y por teléfono/usuario cuando esté disponible); al exceder ⇒ HTTP 429. (FR-019/FR-023)

**Checkpoint**: Fundamentos listos — las user stories pueden implementarse.

---

## Phase 3: User Story 1 - Mosaico de ofertas en un solo mensaje (Priority: P1) 🎯 MVP

**Goal**: El bot envía hasta 3 ofertas en un único mensaje con imagen mosaico vertical de segmentos 1:1 numerados y pie enumerado.

**Independent Test**: Solicitar ofertas con 3, 2 y 1 ofertas disponibles y verificar un único mensaje con mosaico cuadrado por segmento, numeración visible y pie que lista cada oferta; con un comercio sin saldo, sus ofertas no aparecen.

### Tests for User Story 1 (OPTIONAL)

- [x] T009 [P] [US1] (OPTIONAL) Test de `renderMosaicImage`/`renderOfferCardImage` en `tests/` verificando dimensiones 800×(800·N) por segmento y 800×800 sin corazón. (FR-003/FR-006/FR-007)

### Implementation for User Story 1

- [x] T010 [US1] En `server.ts` (función `dispatchOffersMosaic`), agregar el filtro de saldo: excluir ofertas cuyo `comercioId` no pase `comercioTieneSaldo`. (FR-020)
- [x] T011 [US1] Verificar/completar la composición del mosaico: `renderMosaicImage(seleccionadas)` produce N segmentos 1:1 numerados 1..N con altura total 800·N en `src/utils/cardRenderer.ts`. (FR-003/FR-004)
- [x] T012 [US1] Verificar el envío en un solo mensaje: un único `doSend({image, caption})`, sin mensajes/imágenes por oferta y sin enlaces genéricos a la web, en `server.ts`. (FR-002/SC-001)
- [x] T013 [US1] Verificar que el pie enumera cada oferta con título, precio y enlace `/c/{ofertaId}?u={telefono}` en `server.ts`. (FR-005/FR-008)
- [x] T014 [US1] Cubrir casos borde: altura proporcional con 1/2/3 ofertas; cero ofertas elegibles → no enviar mosaico + aviso; fallo de render/envío visible y no parcial, en `server.ts`/`src/utils/cardRenderer.ts`.
- [x] T015 [US1] Verificar el ranking sin cambios: el `sortFn` de `dispatchOffersMosaic` en `server.ts` usa el criterio vigente (plan → `likes` → fecha) y **no** introduce un criterio nuevo; `likes` solo influye en el orden, nunca en el débito. (FR-022)
- [ ] T016 [US1] Validar US1 con los Escenarios 1–3 de `specs/002-ofertas-mosaico-cpc/quickstart.md` contra una instancia en marcha.

**Checkpoint**: US1 funcional y testeable de forma independiente.

---

## Phase 4: User Story 2 - Redirección al comercio con seguimiento de clic (CPC) (Priority: P1)

**Goal**: Al seguir el enlace, registrar el clic, decidir facturabilidad (una ventana de 24 h anclada al último clic facturable), generar código, debitar 1 clic si corresponde y redirigir a WhatsApp del comercio.

**Independent Test**: Abrir `/c/{id}` con un teléfono de prueba → redirección con código y clic facturable debita 1; repetir <24 h → no facturable, sin débito, no reinicia la ventana; pasadas 24 h → vuelve a ser facturable; con saldo 0 → no facturable, sin débito, pero redirige.

### Tests for User Story 2 (OPTIONAL)

- [ ] T017 [P] [US2] (OPTIONAL) Tests de contrato/integración para `GET /c/:id` (facturable, ancla de ventana 24 h, 404, rate limit) en `tests/`.

### Implementation for User Story 2

- [x] T018 [US2] Ajustar `registerOfferClick` en `src/db/repo.ts`: en el `where` de la consulta de dedup agregar `eq(clickLogs.facturable, true)`, de modo que la ventana de 24 h se ancle al **último clic facturable** y los clics no facturables **no la reinicien**. Mantener la persistencia de `ofertaId`, `comercioId`, `usuarioTelefono`, `codigoCanje` (`NV-####`), `facturable` y `creadoEn`. (FR-008/FR-009/FR-010/FR-018)
- [x] T019 [US2] En `server.ts` (`GET /c/:ofertaId`): calcular `puedeFacturar = facturable && comercioTieneSaldo(comercioId)`; si es falso, **recalcular y persistir `facturable=false`** (no dejar `true` cuando no hay saldo), NO incrementar `leadsCalificados`, NO debitar, y aun así redirigir. (FR-011/FR-021)
- [x] T020 [US2] Asegurar que en clic facturable `puedeFacturar=true` se incrementan `oferta.clics` y `oferta.leadsCalificados` y `syncOffers` lo persiste; `debitarClic` nunca deja saldo < 0 y debita como máximo 1 por ventana de 24 h. (FR-011/SC-004)
- [x] T021 [US2] Construir la redirección `302` a `https://api.whatsapp.com/send?phone={comercioWhatsapp}&text={titulo + " " + codigoCanje}` incluyendo título y código, en `server.ts`. (FR-012/SC-005)
- [x] T022 [US2] Manejar oferta inexistente → `404` sin clic corrupto ni redirección inválida; doble toque idempotente (sin doble débito ni códigos contradictorios), en `server.ts`. (edge cases)
- [x] T023 [US2] Aplicar el bucket `clicks` de rate limit (20/60 s) a `GET /c/:ofertaId` en `server.ts`. (FR-023)
- [ ] T024 [US2] Validar US2 con los Escenarios 4–5 y 8 de `specs/002-ofertas-mosaico-cpc/quickstart.md`.

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Tarjeta 1:1 y acciones en la landing (Priority: P2)

**Goal**: Tarjetas con imagen 1:1, sin texto duplicado, con "Me Gusta" informativo en vivo persistente y "Lo quiero" a WhatsApp nativo mencionando la oferta.

**Independent Test**: En la landing, la imagen principal es 1:1 y no hay texto duplicado; "Me Gusta" sube y persiste tras recargar/reiniciar; "Lo quiero" abre WhatsApp nativo con el mensaje que menciona la oferta.

### Tests for User Story 3 (OPTIONAL)

- [ ] T025 [P] [US3] (OPTIONAL) Test de que `POST /api/ofertas/:id/like` incrementa y persiste los likes tras reinicio (sin afectar saldos ni clics) en `tests/`.

### Implementation for User Story 3

- [x] T026 [US3] Eliminar el bloque duplicado de título/descripción bajo la foto en `src/components/PublicWeb.tsx`. (FR-014)
- [x] T027 [US3] Verificar que la imagen principal de la tarjeta usa `aspect-square` en `src/components/PublicWeb.tsx`. (FR-013)
- [x] T028 [US3] En `src/components/PublicWeb.tsx`: eliminar el botón Heart/favoritos actual (líneas ~470-479, con `alert("guardada en favoritos")`) y reemplazarlo por el botón "Me Gusta" (👍) que llame a `POST /api/ofertas/{id}/like`, actualice el conteo optimista y luego con el valor del servidor. (FR-015, informativo)
- [x] T029 [US3] Conectar el like a `incrementOfferLikes` vía `POST /api/ofertas/:id/like` en `server.ts`, con persistencia atómica, bucket `likes` (30/60 s) de rate limit y ruta pública en `esRutaPublica`; garantizar que el like **no** toca `clics`, `leadsCalificados` ni saldos (no factura). (FR-016/FR-019/FR-023)
- [x] T030 [US3] Cambiar el manejador "Lo quiero" en `src/components/PublicWeb.tsx` a `abrirWhatsAppNativo(botPhone, "Quiero la oferta: " + oferta.titulo)`. (FR-017)
- [ ] T031 [US3] Validar US3 con los Escenarios 6–7 de `specs/002-ofertas-mosaico-cpc/quickstart.md`.

**Checkpoint**: Las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build, validación integral, documentación y despliegue.

- [x] T032 [P] Ejecutar `bun build server.ts --target=node --outdir /tmp/bc --external vite` y `bun run build`; corregir errores. (raíz del repo)
- [x] T033 [P] Ejecutar `bun test` (extender si se añadieron tests) y `scripts/security-smoke.sh`; confirmar cero regresiones.
- [ ] T034 Actualizar `INVENTARIO.md`/`FLUJOS.md` (F10/F10.b/F11) y marcar el Gap Analysis de `specs/002-ofertas-mosaico-cpc/plan.md` como completado.
- [ ] T035 [P] Ejecutar los 8 Escenarios del `specs/002-ofertas-mosaico-cpc/quickstart.md` de punta a punta.
- [ ] T036 Commit de `specs/002-ofertas-mosaico-cpc/` + cambios de fuente, push a `main`, esperar auto-deploy de Coolify y verificar en producción (mosaico, `/c/`, ventana 24 h, persistencia de likes, rate limits).
- [ ] T037 Validación final de la constitución (Principios I–V): `click_logs` persistido, sin dataURLs, migración aditiva, Me Gusta informativo fuera del cómputo de cobro.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Setup — BLOQUEA todas las historias.
- **User Stories (Phase 3+)**: Dependen de Foundational.
- **Polish (Phase 6)**: Depende de las historias deseadas.

### User Story Dependencies

- **US1 (P1)**: depende de T004 (OfferCardData) y T007 (saldo). Sin dependencia de US2/US3.
- **US2 (P1)**: depende de T007/T008 y T018 (ancla de ventana). Independiente de US1/US3.
- **US3 (P2)**: depende de T005/T006/T008. Independiente de US1/US2.

### Within Each User Story

- Modelo/DTO → servicio/helper → endpoint → integración → validación.

### Parallel Opportunities

- Setup: T002, T003.
- Foundational: T005, T006 (archivos distintos).
- Tests opcionales: T009, T017, T025.
- Historias: US1, US2 y US3 pueden abordarse en paralelo tras Foundational (distintas áreas).

---

## Parallel Example: Foundational & User Stories

```bash
# Foundational en paralelo:
Task: "T005 Corregir syncOffers en src/db/repo.ts"
Task: "T006 Agregar incrementOfferLikes en src/db/repo.ts"

# Historias en paralelo (tras Foundational):
Task: "US1 server.ts dispatchOffersMosaic (filtro saldo + ranking) en server.ts"
Task: "US2 GET /c/:ofertaId (ventana 24h + facturabilidad + débito) en server.ts"
Task: "US3 PublicWeb.tsx (Me Gusta + Lo quiero) en src/components/PublicWeb.tsx"
```

> Nota: US1 y US2 tocan ambos `server.ts`; si se ejecutan en paralelo, coordinar las
> ediciones del archivo (evitar conflictos de cadena minificada).

---

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Phase 1: Setup.
2. Completar Phase 2: Foundational (BLOQUEA todo).
3. Completar Phase 3: US1.
4. **STOP y VALIDAR**: probar US1 de forma independiente (quickstart Escenarios 1–3).
5. Desplegar/demostrar si está listo.

### Incremental Delivery

1. Setup + Foundational → base lista.
2. US1 → validar → desplegar (MVP).
3. US2 → validar → desplegar (monetización CPC).
4. US3 → validar → desplegar (landing informativa).
5. Cada historia agrega valor sin romper las anteriores.

> Como US1 y US2 son ambas P1, el MVP mínimo recomendado es **US1 + US2**
> (mosaico + monetización), dejando US3 (P2, informativa) como incremento posterior.

---

## Notes

- [P] = archivos distintos y sin dependencias pendientes.
- `server.ts` y `src/db/repo.ts` están minificados: usar reemplazos quirúrgicos de
  cadena y verificar coincidencia única antes de compilar.
- Solo el clic de redirección factura; "Me Gusta" es informativo.
- Verificar tests fallando antes de implementar (si se incluyen tests).
- Commit tras cada tarea o grupo lógico.
- Detenerse en cada checkpoint para validar la historia.
