# Punto 10 — Descomponer server.ts por módulos

Objetivo: extraer los ~68 endpoints de `server.ts` (minificado, 489 líneas, 181 KB) a módulos de rutas por dominio, moviendo código verbatim, sin cambiar comportamiento. Un PR por grupo.
Branch: `feat/modular-server-g1-auth` (primer grupo) · Test runner: `$HOME/.bun/bin/bun test tests/security` + `npm run lint` (gate de tipos) + smoke local.

## Specs

- **S1**: Extraer por **dominios**, no función por función. Decisión registrada: "opción B ya elegida — partir del minificado y extraer endpoints a módulos, por dominios, moviendo código verbatim, un PR por grupo, mismo test suite sin tocarla" (Log de `odd/tasks/auditoria-12-puntos.md`).
- **S2**: **Verbatim**: el código se mueve tal cual desde `server.ts`; solo se ajustan imports/exports y la llamada de registro en `server.ts`.
- **S3**: La suite `tests/security` (118 tests) **no se debilita**. Debe correr verde con 0 saltados contra servidor local. Enmienda (2026-10-20, consecuencia mecánica del refactor aprobado): 9 archivos de tests que leían `server.ts` como texto ahora leen la unión `server.ts + src/routes/*.ts` (helper `tests/security/server-code.ts`); ninguna aserción cambia de significado — siguen vigilando el mismo código aunque viva en otro archivo.
- **S4**: Estado compartido: **preferir la base de datos**; si no existe en base, objeto a nivel de módulo. (Lockout de login ya está en tabla `login_failures`; sesiones en tabla `auth_sessions`.)
- **S5**: Un **PR por grupo**; merge solo con OK explícito del usuario (los merges son decisión del usuario; `main` auto-despliega).
- **S6**: Nuevo destino de módulos de rutas: `src/routes/<dominio>.ts`, cada uno exporta `registrarRutas<Nombre>(app, ctx)` y server.ts lo invoca donde estaban los endpoints. `src/modules/*` existentes son módulos de dominio cliente/servidor: **no** son el patrón de rutas.
- **S7**: Regla WhatsApp: si un grupo toca un enlace o handler de WhatsApp, no se cierra sin prueba en Android + web (dueño).
- **S8**: `server.ts` se patchea con edits quirúrgicos; nunca reformat ni "limpieza" del minificado.

## Tasks

| ID | Grupo | Alcance | Estado | Commit |
|----|-------|---------|--------|--------|
| T1 | Documento de control + inventario | Este documento, listado de grupos | ✅ hecho | — |
| **T2** | **G1 Autenticación y usuarios admin** | 18 endpoints + helpers de auth/sesión/scrypt/MFA → `src/routes/auth.ts` | ✅ hecho | `feat/modular-server-g1-auth` |
| T3 | G2 Embudo de registro (audience) | audience/* (check-uniqueness, sync-user, log-registration, clear-all-registration-logs, users, users/:id, registration-logs, verify-token) + verify-email (~11) → `src/routes/audience.ts` | ⬜ pendiente | — |
| T4 | G3 Motor WhatsApp/WAHA | whatsapp/* (webhook, public, logs, contacto, config, test-message, simulate-incoming) + waha/* (webhook, session/*) (~12) → `src/routes/whatsapp.ts`. ⚠️ S7 aplica | ⬜ pendiente | — |
| T5 | G4 Correos | email/* (config, logs, send-verification, test) (~5) → `src/routes/email.ts` | ⬜ pendiente | — |
| T6 | G5 IA y medios | ai/*, gemini/*, media/* (~6) → `src/routes/media.ts` (o ai.ts + media.ts) | ⬜ pendiente | — |
| T7 | G6 Catálogos y varios | ofertas (get, publicas, sync, activar, like), comercios, banners, version, security/logs, cache/purge, /c/:id (~15) | ⬜ pendiente | — |
| T8 | G7 Infraestructura de seguridad (evaluación final) | gate `/api`, esRutaPublica, rate limiting, SSRF — se decide al final si se mueve o queda en `server.ts` | ⬜ pendiente | — |

## Log

- **L1** (2026-10-20, verbatim usuario): auditoría punto 10 — descomponer `server.ts` por módulos. "vamos con el primer grupo" (autorización G1). Pidió listado completo de grupos con control en un documento. En esta sesión: "el punto 10 para que necesitas otra instancia?" (aclarado: ninguna instancia extra de servidor; solo asistentes de código opcionales) y "si" (arranque).
- **L2** (2026-10-20): Inventario con grep: 71 endpoints en `server.ts`. Agrupados por dominio en T2–T8. Descubierto que `src/modules/*` NO registran rutas (son dominio compartido con el cliente, usan `fetch`): el patrón nuevo es `src/routes/*.ts` (S6).
- **L3** (2026-10-20): Ubicación del bloque auth: helpers líneas 237–307 (`getAuthSecret`, `hashPassword`, wrappers auth_users, `inicializarAuthUsers`, `seedAuthUsersIfNeeded`, `signAuthToken`/`verifyAuthToken`, `crearSesionParaUsuario`, cookies) + endpoints 309–318. Ojo: líneas 19 (`syncAuthDirToDb`, `restoreAuthDirFromDb`, `AUTH_DIR`) son del directorio de sesión de Baileys, NO de login — no se tocan en G1.
- **L4** (2026-10-20): T2 completado inline (ruta directa; sin trigger de writer: una unidad, sin paralelismo ni backstop). Extracción verbatim por bytes exactos (script `assemble.mjs` en scratch, no en repo): movidas L234–285, L288–293, L295–318 → `src/routes/auth.ts` (38 KB). Quedan en `server.ts` (410 líneas, −80): infra de seguridad (L224–233: `clienteIp`, `rateLimit`, `aplicarCabecerasSeguridad`, `logEventoSeguridad`), gate+`esRutaPublica` (L286–287), `enviarCorreo` (L294, infra de correo → G4). `server.ts` importa 13 helpers exportados y llama `registrarRutasAuth(app,{rateLimit,logEventoSeguridad,clienteIp,enviarCorreo})` en la posición exacta de los endpoints (orden de registro de Express preservado). Puente de contexto a nivel de módulo (`_rateLimit` etc.) para que los helpers de módulo sigan viendo los nombres verbatim. `enviarCorreo` requiere `emailConfig` (L388, fuera del bloque) → se queda en server.ts y va por ctx.
- **L5** (2026-10-20): Verificación: gate de tipos OK (59 preexistentes, 0 nuevos; baseline regenerada — diff revisado: 6 errores mudaron de server.ts a auth.ts con el mismo mensaje, total 59→59). `npm run build` OK. Suite completa: **118 pass / 0 fail / 0 saltados** contra servidor local (base `yuddit_ci_app`). Smoke: 10 ok / 0 fallidos. Diferencial contra commit base `d5c903d` (procedimiento idéntico con estado limpio): 10/10 en ambos → los 3 fallos intermedios (429/423) eran contaminación de estado entre corridas repetidas (filas viejas en `login_failures`), no regresión. Corrección de errores de ensamblado durante la tarea: endpoints duplicados en el wrapper (corregido acotando el bloque), `export` doble de `registrarRutasAuth`, y 3 helpers que el server conservado usa (`validarSesionToken`, `peticionMismoOrigen`, `esErrorSecretoAuth`) agregados a exports/imports.
- **L6** (2026-10-20): Pendiente: push + PR (decisión del usuario el merge). El boot de producción (`startServer`) llama `inicializarAuthUsers` vía import — verificado que la línea 489 original quedó fuera del rango movido y el import resuelve. Próximo grupo: G2 audience.
