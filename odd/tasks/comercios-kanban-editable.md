# Comercios — kanban editable, datos completos y unicidad

Rama: `feat/comercios-kanban-editable` · Deploy: push a `main` (Coolify) · Runner: `bun test tests/security` con servidor + credenciales admin.

## Specs

- **S1.** El panel de gestión de comercios debe permitir **agregar columnas (etapas) al kanban**. Hoy las 7 etapas están hardcodeadas en `ComerciosDomainView.tsx` (`KANBAN_STAGES`) y `KanbanStage` es una unión de literales en `src/types/index.ts`.
- **S2.** El panel debe permitir **quitar columnas del kanban**. Hoy no existe ninguna acción para borrar una etapa.
- **S3.** Al quitar una columna que contiene comercios, la operación **debe bloquearse** con un aviso; primero hay que vaciarla. Decisión del dueño (2026-10-23): *"Bloquear hasta vaciarla"*. No se debe perder ningún comercio.
- **S4.** La **Ficha 360 debe mostrar el RUC** del comercio. (Ya implementado en `ComerciosDomainView.tsx`; se verifica con evidencia.)
- **S5.** El **Directorio de Comercios Activos** debe mostrar columnas de **RUC y correo**. (RUC ya está; falta la columna de correo.)
- **S6.** El registro debe **verificar unicidad de RUC, correo y WhatsApp**: no se permite que dos comercios compartan cualquiera de esos tres datos. El RUC ya se valida; faltan correo y WhatsApp (comparando el teléfono normalizado: `51XXXXXXXXX` ≡ `9XXXXXXXX`).

### Fuera de alcance (explícito)

- Migrar comercios del blob JSON de `app_settings` a una tabla indexada (es **P-23** en `PENDIENTES.md`, fase aparte).
- Crear automáticamente el `auth_users` al aprobar un comercio (**P-24**, paso 4, se decide después).

## Tasks

| ID | Specs | Ruta | Estado | Evidencia |
|---|---|---|---|---|
| T1 | S1,S2,S3 | inline | hecho | Columnas dinámicas en `ComerciosDomainView.tsx` (`kanbanColumns`, modal "Nueva Columna", botón `×`), persistidas en `app_settings.kanban_columns`. Quitar con comercios dentro bloquea y avisa. Commit `b8002d9`. |
| T2 | S4,S5 | inline | hecho | Columna **Correo** agregada al Directorio de Activos; el RUC ya estaba en la Ficha 360 y en la tabla. Commit `b8002d9`. |
| T3 | S6 | inline | hecho | Unicidad de RUC/correo/WhatsApp en `registrarComercio` y `registrarProspecto`; teléfono comparado canonizado (`51XXXXXXXXX` ≡ `9XXXXXXXX`). Commit `b8002d9`. |

## Log

- **L1 (dueño, 2026-10-23):** *"ahora hay que hacer una funcion para editar los niveles de kanban, actualmente no puedo borrar ninguna etapa/columna, debo poder agregar y quitar columnas y ademas en en la ficha debe aparecer el ruc, en la pantalla de coemrcios activos debe aparecer una columna con el ruc y correo y algo critico, el registro debe verificar que ruc, correo y whatsapp sean unicos, no debe permitirse que un comercio duplique uno de estos datos"*
- **L2 (decisión, 2026-10-23):** al quitar una columna con comercios, **bloquear hasta vaciarla** (elegido por el dueño).
- **L3 (implementación, 2026-10-23):** `KanbanStage` pasó de unión de literales a `string` y se agregó `KanbanColumn` (con `rol` opcional `activo|riesgo|perdido` para conservar la semántica operativa; una columna sin rol es solo visual). Las columnas viven en memoria en el módulo y se persisten en `app_settings.kanban_columns`; `eliminarColumnaKanban` nunca deja menos de una y bloquea si hay comercios dentro.
- **L4 (implementación, 2026-10-23):** dos caminos que fallaban en silencio ahora avisan (regla del repo "un camino que no abre, avisa"): (a) el alta por WhatsApp contestaba *"Tu solicitud ha sido registrada"* aunque `registrarProspecto` hubiera rechazado el registro — ahora responde el error real; (b) `handleMoverEtapa` no persistía, así que arrastrar un comercio entre columnas se perdía al recargar — ahora sincroniza y avisa si no se pudo guardar.
- **L5 (verificación, 2026-10-23):** suite `tests/security` con el env completo de CI (dos bases, credenciales admin/comercio, `VUUV_PII_KEY`): **270 pass / 1 skip / 0 fail**. `npm run lint` (type gate): **0 errores nuevos** (54 preexistentes). `npm run build`: OK. Tests nuevos: `tests/security/comercios-kanban-unicidad.test.ts`, 13 casos (columnas agregar/quitar/bloqueo/título duplicado/vacío/inexistente, unicidad pública de RUC/correo/WhatsApp con `+51`, persistencia de columnas, alta por WhatsApp con RUC duplicado, movimiento de etapa persistido).
- **L6 (hallazgo, 2026-10-23 — NO es de este cambio):** `tests/security/login-lockout.test.ts` es frágil entre corridas seguidas. Usa un correo **fijo** (`nadie@ejemplo-inexistente.test`) y el contador de `login_failures` vive en la base y sobrevive reinicios: a la quinta corrida dentro de la ventana de 900 s esa cuenta queda bloqueada y el test falla con `423` en vez de `401`. Además, sus 7 logins por IP contra el límite de 10/5 min se agotan si se corre la suite dos veces seguidas sin reiniciar el servidor. Se comprobó que era estado ambiente: borrando la fila y reiniciando el servidor, la suite pasa. Pendiente de decisión del dueño (no se tocó).
- **L7 (siguiente, 2026-10-23):** queda **P-24** (crear el `auth_users` automáticamente al aprobar un comercio, elegido por el dueño) y **P-23** (migrar comercios del blob JSON a una tabla indexada).
