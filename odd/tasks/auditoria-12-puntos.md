# Auditoría 12 puntos — resolución

Objetivo: cerrar los 12 hallazgos de `docs/auditoria-2026-10-19.md` (estructura, seguridad, estabilidad, datos, base de datos).
Rama: `auditoria/12-puntos` (a crear desde `main`; hoy se commitea directo a `main` y `main` auto-despliega).
Runner: `bun test` (no instalado en el host; ver T9).
Diagnóstico completo: `docs/auditoria-2026-10-19.md` (no duplicar acá; este documento es el plan de ejecución).

## Specs

- **S1** — Cuando falla la lectura de deduplicación o la escritura en `click_logs`, el clic **no** se factura y el fallo es explícito. Criterio: un test que simula error de DB en `registerOfferClick` y verifica que el saldo del pack **no** baja y que **no** se devuelve `facturable: true`.
- **S2** — Bajo dos peticiones concurrentes con el mismo `(oferta_id, telefono)`, se factura **una sola vez**. Criterio: test de concurrencia que dispara N clics simultáneos y afirma exactamente 1 fila facturable y 1 débito.
- **S3** — El saldo de clics se debita con una única sentencia atómica sobre una tabla real, con la fila afectada como resultado. Criterio: `UPDATE ... WHERE saldo > 0 RETURNING` y ningún saldo negativo posible bajo concurrencia.
- **S4** — Existe un backup off-site con retención y **un restore efectivamente probado**. Criterio: restore en base descartable desde el artefacto off-site, con conteo de filas comparable.
- **S5** — El esquema se aplica con migraciones generadas y revisadas, no con `push` automático en el arranque. Criterio: `drizzle-kit generate` versionado en el repo y el entrypoint sin `push`.
- **S6** — El cifrado de PII está documentado en `.env.example` y su estado es visible. Criterio: `VUUV_PII_KEY` documentada y un check de arranque que reporte el modo sin ambigüedad.
- **S7** — El guard de secretos del bundle **falla** cuando no hay bundle que escanear. Criterio: con `dist/` ausente, el test falla en vez de pasar.
- **S8** — El bloqueo por fuerza bruta y los límites de tasa sobreviven un reinicio y son correctos con más de una instancia, o el modo single-instance está enforzado. Criterio: contador persistido, o arranque que falla/avisa si se detecta más de una instancia.
- **S9** — CI corre los tests de contrato contra un servidor levantado, sin `skipIf` que los anule. Criterio: workflow verde que ejecute una cantidad mínima de tests y falle si se saltean.
- **S10** — `server.ts` tiene fuente legible y revisable. Criterio: depende de la decisión A/B registrada en el Log.
- **S11** — El gate de tipos cubre `src/`, y el deploy falla si el SPA no se construyó. Criterio: `lint`/`build` sin `|| true`, `include` con `src/**`, y `test -f dist/index.html` en el Dockerfile.
- **S12** — Los datos que se modifican bajo concurrencia dejan de vivir en blobs JSON de `app_settings`. Criterio: `auth_users` y `click_packs` en tablas propias con operaciones SQL puntuales.

## Tasks

| ID | Spec | Tarea | Ruta | Estado |
|---|---|---|---|---|
| T1 | S1 | Fail-closed en `registerOfferClick` (`src/db/repo.ts`) | inline | **hecho** — `f57c35f` |
| T2 | S7 | Corregir el auto-skip de `tests/security/bundle-secrets.test.ts` | inline | **hecho** — `7460180` |
| T3 | S11 | Quitar `\|\| true`, `include` con `src/**`, `test -f dist/index.html` en Dockerfile | inline | **hecho** — `4f5605a` (gate con baseline; ver L8) |
| T4 | S3 | Tabla `click_packs` + débito atómico; sacar `FacturacionModule.packs` | inline | listo (coordinado con T8) |
| T5 | S12 | `auth_users` y `click_packs` fuera de `app_settings` | inline | listo (absorbe parte de T4) |
| T6 | S2 | Atomicidad de la ventana de 24 h | inline | **bloqueado**: auditar duplicados en `click_logs` |
| T7 | S6 | Documentar `VUUV_PII_KEY` + visibilidad de estado | inline | **bloqueado**: verificar Coolify (¿cifrado ya apagado?) |
| T8 | S5 | Migraciones versionadas en vez de `push` en el arranque | inline | depende de T4/T5 (no versionar el esquema viejo) |
| T9 | S4 | Backup off-site + restore probado | inline | **bloqueado**: destino y credenciales |
| T10 | S8 | Contadores persistentes o single-instance enforzado | por definir | **bloqueado**: ¿cuántas instancias? |
| T11 | S9 | CI que levante la app y corra los tests | por definir | depende de T3 |
| T12 | S10 | Estructura de `server.ts` (opción A u B) | por definir | **bloqueado**: decisión del dueño |

## Log

- **L1** — Pedido del usuario, textual: *"hay que resolver todo, deja el documento en docs, que necesitas para reslver todo? no se si antes creamos el indice de codegraph? Lo de codegraph lo hacemos antes o despues d resolver los 12 puntos de la auditori"*
- **L2** (2026-10-19) — Diagnóstico escrito en `docs/auditoria-2026-10-19.md` con 12 hallazgos y evidencia `archivo:línea`. Red de seguridad tomada antes de tocar nada: `pg_dump -Fc` de `nuuviopsg` en `/home/ubuntu/backups/nuuvio/nuuviopsg-2026-10-19-pre-auditoria.dump` (303 KB, modo 600), verificado con `pg_restore -l` → 11 tablas con datos. Es local, no off-site: cubre esta auditoría, no la pérdida del host.
- **L3** (2026-10-19) — Hallazgo que cambia el punto 10: el `server.ts` legible **no está perdido**, está en el historial. Última versión legible `938a8a8` (2026-10-15, 3294 líneas, máx. 287 chars/línea); la minificación entró en `c9a2fa6` (2026-10-16, *"refactor: remove monolithic boilerplate and unused modules"*), que lo bajó a 314 líneas con máx. 25 039 chars. La brecha `938a8a8 → HEAD` contiene seguridad, MFA, CPC/mosaico y rebrands: es reconciliación, no revert. Decisión pendiente (opción A o B).
- **L4** (2026-10-19) — Contexto operativo relevante: **producción corre en esta máquina** (app `pnpsnjshl9otauk7y7m5dqtf-...` y Postgres `oa0t0nzguh49o1fim0juu5nj` vivos, vía `sudo -n docker`). Cualquier cambio de datos toca usuarios reales. No hay `psql`/`pg_dump` en el host: todo pasa por `docker exec`. Base `nuuviopsg` = 9.5 MB.
- **L5** (2026-10-19) — Estrategia de entrega elegida por el usuario: **rama + PR por fase**. Rama `auditoria/12-puntos` creada desde `main`. Nada se pushea sin autorización explícita.
- **L6** (2026-10-19) — T1 y T2 cerrados y verificados.
  - T1 `f57c35f`: RED observado primero (los dos casos devolvían `facturable: true`), luego GREEN. Suite completa: 65 pass / 23 skip / 0 fail. Se aisló la DB con `mock.module` sobre `src/db/index.ts` — es el primer test del repo que mockea; el resto son unit puros o contratos HTTP.
  - T2 `7460180`: verificado en ambas direcciones moviendo `dist/` (con dist pasa, sin dist falla).
  - Verificación positiva: las credenciales filtradas (`Pasion2271`, `rogerv707@gmail.com`, `vuuy_verify_secret_2026`, `vuuy-dev-fallback-secret`) **ya no están** en `src/`, `server.ts` ni `dist/`. La limpieza funcionó.
  - **Corrección de la auditoría**: el punto 11 estaba mal escrito. `tsc` **sí** revisa `src/` (por transitividad de imports desde `server.ts`); lo que queda fuera es la capa React. Y hay **51 errores de tipos** preexistentes que `npm run lint` reporta como éxito (`tsc` exit 2, `lint` exit 0). T3 es más grande de lo previsto: sacar el `|| true` exige resolver o baselinar esos 51.
- **L7** (2026-10-19) — Pendiente de decisión del usuario antes de seguir: T3 (alcance de los 51 errores), T4/T5 (tocan el esquema de producción), T7 (verificar Coolify), T9 (destino off-site), T10 (¿cuántas instancias?), T12 (opción A u B), y autorización para pushear.
- **L8** (2026-10-19) — **Decisiones del usuario y avance.**
  - **T3 hecho** (`4f5605a`). `lint` y `build` ya no llevan `|| true`. Como hay 51 errores preexistentes (34 en `server.ts`, 14 en `repo.ts`, 2 en `aiService.ts`, 1 en `facturacion.ts` — 36 de 51 justo en los dos archivos minificados que la opción B deja quietos), se implementó un **gate con baseline**: `scripts/typecheck-baseline.mjs` congela los 51 y falla solo ante errores nuevos. Las huellas excluyen línea y columna a propósito, porque en un bundle de líneas de ~28 KB un carácter corre todas las columnas. Verificado en ambas direcciones: error inyectado → exit 1 nombrando el error; restaurado → exit 0. `vite build` pasa hoy (exit 0), así que sacar el `|| true` del build era seguro. Dockerfile ahora exige `dist/index.html`.
  - **Verificación diferencial de T1**: `tsc` sobre `main` = 51 errores, 14 en `repo.ts`; sobre el fix = idéntico. **Cero errores introducidos.**
  - **T12: opción B.** El usuario decide partir del minificado y extraer de a poco, porque el estado actual del repo es mejor que el de hace dos días (eliminó mucho). `938a8a8` queda como referencia, no como base.
  - **T6/T4/T5 autorizados** a tocar el esquema de producción (con backups tomados).
  - **Ramas separadas** (un PR por fase, sin solapamiento de archivos): `auditoria/fase-1-facturacion` (AGENTS, auditoría, plan, T1, T2 — 605 inserciones, de las cuales ~440 son documentación) y `auditoria/fase-2-gate-tipos` (gitignore, gate de tipos, Dockerfile, package.json — 163). Cada una verificada verde **por separado**: fase 1 = 88 tests 0 fail; fase 2 = 82 tests 0 fail + lint OK + build OK.
  - **Bloqueo real de T-push**: no hay credenciales de GitHub en el host (`gh` sin login, sin `~/.git-credentials`, sin helper). No se puede pushear sin que el usuario autentique o aporte un token.
  - **T7 (PII)**: usuario no tenía `VUUV_PII_KEY`. Se generó una (32 bytes hex) y se verificó con round-trip real: `piiHabilitado()` true, cifrado/descifrado OK, **y el texto plano existente se sigue leyendo igual** → habilitar el cifrado no bloquea a nadie. Dos hallazgos operativos: (a) una clave con formato inválido **degrada en silencio a texto plano** (no falla el arranque); (b) al activar el cifrado, **los backups pasan a depender de la clave**: sin ella, el PII cifrado del dump es irrecuperable. La clave NO se escribió en ningún archivo del repo. `.env.example` no se pudo editar (el harness protege archivos `.env*`): queda pendiente que el usuario pegue el bloque.
