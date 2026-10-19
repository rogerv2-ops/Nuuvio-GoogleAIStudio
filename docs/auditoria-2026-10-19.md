# Auditoría técnica — Yuddit

**Fecha:** 2026-10-19
**Alcance:** estructura del repo, seguridad, estabilidad, manejo de datos, base de datos.
**Método:** lectura de código y configuración, con evidencia verificable (`archivo:línea` o comando). Las afirmaciones que no pude verificar están marcadas explícitamente en la sección *No verificado*.
**Estado:** solo diagnóstico. No se modificó ninguna línea de código ni de datos.

**Red de seguridad tomada antes de empezar:**

```
/home/ubuntu/backups/nuuvio/nuuviopsg-2026-10-19-pre-auditoria.dump   (303 KB, modo 600)
```

`pg_dump -Fc` de la base `nuuviopsg`, verificado con `pg_restore -l` (11 tablas con datos). Es un backup **local**, no off-site: sirve como red de seguridad para esta auditoría, no cubre la pérdida del host (punto 5).

---

## Resumen ejecutivo

| # | Severidad | Punto | Área |
|---|---|---|---|
| 1 | **Crítico** | El cobro falla abierto ante error de DB | Facturación |
| 2 | **Crítico** | Condición de carrera en la ventana de 24 h (TOCTOU) | Facturación |
| 3 | **Crítico** | El saldo de clics no es atómico ni es la fuente de verdad | Facturación |
| 4 | **Alto** | Sin backups off-site | Datos |
| 5 | **Alto** | `drizzle-kit push` en cada arranque contra producción | Base de datos |
| 6 | **Alto** | Cifrado de PII desactivado y no documentado | Seguridad |
| 7 | **Alto** | El guard de secretos del bundle se auto-anula | Seguridad |
| 8 | **Medio** | Anti-fuerza-bruta y rate limit en memoria | Seguridad |
| 9 | **Medio** | Sin CI | Estabilidad |
| 10 | **Alto** | El repo commitea salida de build como fuente | Estructura |
| 11 | **Alto** | Sin gate de tipos; el contenedor puede arrancar sin SPA | Estructura |
| 12 | **Medio** | Blobs JSON en `app_settings` para datos concurrentes | Base de datos |

Orden de resolución recomendado al final del documento.

---

## P0 — Facturación

### 1. El cobro falla **abierto** ante un error de base de datos

**Evidencia:** `src/db/repo.ts`, dentro de `registerOfferClick` (aprox. L128-160):

```ts
} catch (err) {
  console.warn("[DB Repo] Error consultando clickLogs en PostgreSQL:", err);
}
// ...
const facturable = !existeClicEn24h && saldoDisponible;
```

**Impacto:** si el `SELECT` de deduplicación falla, `existeClicEn24h` queda en `false` y **el clic se factura igual**. Un hipo de la base se traduce en cobro indebido.

**Segundo efecto, peor:** el `INSERT` en `click_logs` también está dentro de un `try/catch` que traga el error y la función **igual devuelve `facturable: true`**. Resultado: se debita el pack del comercio **sin fila en `click_logs`**. Sin esa fila no existe la ventana de 24 h, así que el mismo teléfono puede volver a facturarse en la siguiente visita. Se cobra sin dejar rastro y se pierde la deduplicación.

**Corrección:** en un camino de dinero todo error debe ser *fail-closed*. Si falla la lectura de deduplicación o la escritura del registro, `facturable` debe ser `false` y el error debe propagarse o devolver un estado explícito de fallo. Nada de `catch` silencioso.

---

### 2. Condición de carrera en la ventana de 24 h (TOCTOU)

**Evidencia:** mismo bloque. La secuencia es `SELECT` (L128-140) → `await` → `INSERT` (L153-160), sin transacción ni restricción de unicidad.

**Impacto:** dos peticiones concurrentes con el mismo `(oferta_id, telefono)` leen ambas "no hay clic facturable en 24 h", calculan ambas `facturable = true` y facturan dos veces. El single-thread de Node **no** protege: hay `await` entre la lectura y la escritura, así que el event loop intercala.

**Corrección:** que la decisión y la escritura sean una sola operación atómica. Opciones, de menor a mayor esfuerzo:
- `INSERT ... SELECT ... WHERE NOT EXISTS (...)` en una sentencia.
- Transacción con `SELECT ... FOR UPDATE`.
- Restricción única sobre `(oferta_id, usuario_telefono, ventana)`.

Ojo: agregar la restricción requiere que los datos existentes estén limpios primero — si hay duplicados previos, la migración falla. Hay que auditar `click_logs` antes.

---

### 3. El saldo de clics no es atómico ni es la fuente de verdad

**Evidencia:** `src/modules/facturacion.ts:34` documenta *"Débito atómico de 1 clic"*. El cuerpo (L38-79) hace:

```ts
private packs: Map<string, ClickPack> = new Map();   // L18
// ...
packActivo.saldoClics -= 1;                          // L66
```

El saldo vive en un `Map` en memoria y se persiste reescribiendo el **array completo** en `app_settings.click_packs_list`.

**Impacto:** tres capas de no-atomicidad alrededor del dinero:
1. El decremento ocurre en memoria, no en la base.
2. La persistencia reescribe el array entero (patrón lost-update clásico entre el `await` de lectura y el de escritura).
3. Un reinicio recarga desde el blob; si el último guardado quedó viejo, el comercio **recupera saldo que ya gastó** o pierde saldo que no gastó.

**Corrección:** tabla real `click_packs` y un único decremento atómico:

```sql
UPDATE click_packs SET saldo = saldo - 1
WHERE comercio_id = $1 AND saldo > 0
RETURNING saldo;
```

La fila afectada (o la ausencia de fila) **es** el resultado. Sin lectura previa, sin blob, sin mapa en memoria.

---

## P1 — Pérdida de datos

### 4. Sin backups off-site

**Evidencia:** documentado por ustedes mismos en `INVENTARIO.md:76` y `INVENTARIO.md:82`.

**Impacto:** con facturación encima, es el único riesgo de esta lista que **no tiene arreglo después de que ocurre**. La base hoy pesa 9.5 MB (`nuuviopsg`): el costo de resolverlo es trivial comparado con la pérdida total.

**Corrección:** `pg_dump` diario a almacenamiento externo (S3/R2) con retención, **y un restore probado**. Un backup sin restore probado es una hipótesis, no un backup. El dump de la red de seguridad de esta auditoría sirve como primer artefacto.

**Dato operativo:** no hay cliente `psql`/`pg_dump` instalado en el host; el dump se toma vía `docker exec` contra el contenedor `oa0t0nzguh49o1fim0juu5nj`.

---

### 5. `drizzle-kit push` en cada arranque contra producción

**Evidencia:** `docker-entrypoint.sh:16`:

```sh
yes "" | timeout 120 bunx drizzle-kit push --config=src/db/drizzle.config.ts \
```

**Impacto:**
- `push` calcula el diff y lo aplica **sin revisión ni versionado**. Puede emitir `ALTER`/`DROP` destructivos según cómo quede el esquema.
- `yes ""` acepta automáticamente cualquier confirmación interactiva.
- `timeout 120` puede cortar un cambio de esquema **a la mitad**: un `ALTER` aplicado y el siguiente no, dejando un estado intermedio del que nadie tiene registro.
- El `|| echo "WARN..."` hace que la app arranque igual, contra un esquema posiblemente inconsistente.

**Corrección:** migraciones generadas y revisadas (`drizzle-kit generate` → revisar el SQL → `migrate`). Como paso intermedio, sacar el `push` del arranque y convertirlo en un paso explícito y manual del deploy. `src/db/schema.ts` es hoy la única fuente de verdad y no hay ningún archivo de migración en el repo (`drizzle.config.ts` apunta a `./src/db/migrations`, que no existe).

---

## P2 — Seguridad

### 6. El cifrado de PII está desactivado y nadie lo sabe

**Evidencia:** `src/utils/pii.ts`:

```ts
export function piiHabilitado(): boolean {
  return !!clavePii();
}
```

`clavePii()` lee `process.env.VUUV_PII_KEY`; si falta, emite **un solo `console.error`** y devuelve `null` → todo se guarda en texto plano.

Conteo verificado en el repo:

| Dónde | Menciones de `VUUV_PII_KEY` |
|---|---|
| Código (`.ts`, `.sh`) | 13 |
| `.env.example` | **0** |
| Cualquier `.md` | **0** |

**Impacto:** la variable que activa el cifrado de datos personales no está en el contrato de entorno ni en ninguna documentación. `docker-entrypoint.sh` tampoco la menciona. El modo degradado es silencioso: la app funciona igual y solo deja una línea en logs.

**Corrección:** documentar `VUUV_PII_KEY` en `.env.example` (32 bytes en hex o base64), y hacer visible el estado: un check al arranque que loguee el modo de forma inequívoca y una prueba que falle si el cifrado está apagado donde debería estar encendido.

**A verificar en Coolify (no lo puedo ver desde el repo):** si `VUUV_PII_KEY` está definida en el entorno del contenedor. Si no lo está, la PII almacenada hasta hoy está en texto plano.

---

### 7. El guard de secretos del bundle se auto-anula

**Evidencia:** `tests/security/bundle-secrets.test.ts:23`:

```ts
const archivos = recorrer(DIST);
if (archivos.length === 0) return;   // ← si no hay dist/, el test pasa sin escanear
```

`DIST` es `dist/`, que está en `.gitignore` (y en `.dockerignore`). En un clone limpio `dist/` no existe, así que **el test nunca corre** y reporta verde.

**Contexto:** ese test existe porque **ya se filtró una credencial real al bundle**. La lista de secretos prohibidos incluye un email y una contraseña concretos, además de `vuuy-dev-fallback-secret`, el secreto HMAC de fallback que acompañaba a `auth-secret.test.ts`.

**Impacto:** el mecanismo de detección de la clase de bug que ya ocurrió una vez no puede fallar. Es el peor tipo de test: el que da confianza sin verificar nada.

**Corrección:** que falle si `dist/` no existe (o que construya el bundle antes de escanear), y sumar `src/` al barrido. Además, `auth-secret.test.ts` verifica por *grep* sobre el fuente de `server.ts` buscando strings; conviene complementarlo con una comprobación de comportamiento.

---

### 8. Anti-fuerza-bruta y rate limit viven en memoria

**Evidencia:** `server.ts`, `registrarLoginFallido`:

```ts
function registrarLoginFallido(email){const st=loginFailState.get(email)||{count:0,lockedUntil:0};...}
```

`loginFailState` es un `Map`. Los buckets de `rateLimit(bucket, max, windowMs)` también son estructura en memoria, igual que `wahaSession`, `flujosComercio`, `flujosRegistroComercio` y `ultimasOfertasEnviadasPorUsuario`.

**Impacto:** con más de una instancia, cada réplica cuenta por su cuenta y el límite efectivo se multiplica por el número de réplicas. Y un **reinicio limpia el bloqueo** por fuerza bruta: cualquiera con capacidad de reiniciar el contenedor resetea los contadores. Es aceptable **solo** si está garantizado que corre una única instancia — si Coolify puede escalar a 2, esto se rompe en silencio, sin error visible.

**Corrección:** mover contadores a Postgres o Redis, o documentar y **enforcar** el modo single-instance. Las sesiones ya están bien resueltas en la tabla `sessions` con revocación — ese es el patrón a seguir.

---

### 9. Sin CI

**Evidencia:** no existe `.github/` ni `.gitlab-ci.yml`. Los scripts de verificación (`bun test tests/security`, `scripts/security-smoke.sh`, `scripts/ofertas-tests.sh`) son todos manuales.

**Impacto:** nada de lo anterior se ejecuta de forma automática. Sumado a los puntos 7 y 11, el resultado es que **el repo no tiene ninguna señal automática de que algo se rompió**.

**Corrección:** un workflow que instale Bun, levante la app contra un Postgres efímero y corra los tests de contrato. Con `TEST_BASE_URL` apuntando al servidor levantado, para que los `describe.skipIf` no se activen (ver punto 7 del documento de gotchas en `AGENTS.md`).

---

## P3 — Estructura

### 10. El repo commitea salida de build como si fuera código fuente

**Evidencia:** `server.ts` tiene 171 KB en 432 líneas, con líneas de hasta **27 953 caracteres**. Contiene los helpers `__defProp` y `__name` de esbuild, un banner SPDX de Apache y código sin espacios. Lo mismo, en una sola línea cada uno: `src/services/aiService.ts`, `src/core/events.ts`, `src/db/index.ts`, `src/db/schema.ts`. En contraste, `src/modules/ofertas.ts` tiene 397 líneas y un máximo de 109 caracteres por línea: es fuente normal.

O sea: **el repo mezcla fuente legible con artefactos de bundler**. `src/db/repo.ts` es el caso más claro — 230 líneas con un máximo de 6 052 caracteres, es decir un archivo minificado al que después se le fueron agregando parches legibles.

**Dónde ocurrió:** commit `c9a2fa6` (2026-10-16), con el mensaje *"refactor: remove monolithic boilerplate and unused modules"*. Ese commit bajó `server.ts` de **3 294 líneas legibles a 314 líneas minificadas**. Ese mismo commit commiteó bundles a `assets/` y `public/assets/`.

**Impacto:** es la **causa raíz** de que el resto de esta lista sea difícil de arreglar. Sin fuente legible no hay diffs revisables, no hay code review, no hay análisis estático útil, y cualquier corrección de los puntos 1-3 se hace a ciegas. `INVENTARIO.md:84` ya lo reconoce: *"server.ts y repo.ts minificados a una línea: todo cambio ahí con patch quirúrgico + build check."*

#### Hallazgo: el fuente legible **está en el historial de git**

Contrariamente a lo que asumía `INVENTARIO.md`, la versión legible **no está perdida**:

| Commit | Fecha | `server.ts` |
|---|---|---|
| `1fe5245` | 2026-10-12 | 1 168 líneas, máx. 287 chars |
| `938a8a8` | 2026-10-15 | **3 294 líneas, máx. 287 chars** |
| `c9a2fa6` | 2026-10-16 | 314 líneas, máx. 25 039 chars ← minificación |
| `16f7ae8` | 2026-10-18 | 432 líneas, máx. 27 953 chars (actual) |

`938a8a8` es la **última versión legible**. La brecha entre `938a8a8` y `HEAD` contiene todo el trabajo de seguridad, MFA, CPC/mosaico y los rebrands — es decir, no es un revert trivial, es una reconciliación.

**Implicación para el plan:** el punto 10 deja de ser "desminificar un bundle de 171 KB" (inviable) y pasa a ser una decisión de estrategia entre:
- **A.** Restaurar `938a8a8:server.ts` como base legible y reconciliar los ~2 días de cambios posteriores.
- **B.** Aceptar `server.ts` como fuente-de-facto minificada, dejar de empeorarla y extraer los endpoints de a poco hacia módulos reales.

La decisión es del dueño del producto: ver *Decisiones requeridas*.

---

### 11. Sin gate de tipos, y el contenedor puede arrancar sin SPA

**Evidencia — no hay gate de tipos:**

`package.json:7,10`:
```json
"build": "vite build || true",
"lint": "tsc --noEmit || true"
```

`tsconfig.json:21-23`:
```json
"include": ["server.ts"]
```

Ambos comandos terminan en `|| true`, así que **siempre salen con exit 0**. Medido en `HEAD`:

| Comando | Exit real | Resultado |
|---|---|---|
| `npx tsc --noEmit` | **2** | **51 errores de tipos** |
| `npm run lint` | **0** | oculta los 51 |

El alcance del typecheck es más amplio de lo que sugiere el `include`: `tsc` sigue los imports desde `server.ts`, así que **sí** analiza `src/db/*`, `src/modules/*`, `src/utils/*`, `src/core/*` y `src/services/*`. Lo que queda fuera es todo lo que el servidor no importa: `src/components/*`, `src/App.tsx` y `src/main.tsx`, es decir toda la capa React.

Traducción: hay **51 errores de tipos preexistentes** en la mitad no-React del código, tapados por un `|| true`. Ver *Correcciones a esta auditoría* al final del documento.

**Evidencia — el contenedor puede arrancar sin SPA:**

`Dockerfile`:
```dockerfile
COPY . .
RUN bun run build
```
`.dockerignore` incluye `dist`.

Como `dist` está en `.dockerignore`, la imagen se construye **sin** `dist/` y depende de que `vite build` lo genere. Pero `bun run build` ejecuta `vite build || true`, que no puede fallar. Si Vite falla, la imagen se construye igual, el contenedor arranca igual, y el servidor hace `express.static(distPath)` + `sendFile(dist/index.html)` sobre un directorio inexistente.

**Impacto:** fallo silencioso en el peor momento posible: el deploy reporta éxito y la SPA no existe. El entrypoint solo hace `push` + `start`, y también traga errores.

**Corrección:** quitar el `|| true` de `lint` y `build`; extender `include` a `["server.ts", "src/**/*.ts", "src/**/*.tsx"]`; y en el Dockerfile, verificar que `dist/index.html` exista antes de dar la imagen por buena. Empezar por el Dockerfile: es un `RUN test -f dist/index.html` y elimina el peor modo de falla.

---

### 12. Blobs JSON en `app_settings` para datos con concurrencia

**Evidencia:** `src/db/repo.ts` usa `getSetting`/`saveSetting` sobre la tabla `app_settings(key, value)` donde `value` es un JSON serializado. Ahí viven `merchants_list`, `merchants_kanban`, `click_packs_list`, `whatsapp_config`, `whatsapp_auth_files`, `auth_secret`, `auth_users` y `auth_reset_tokens`.

**Impacto:** cada escritura es leer-el-array-entero → modificarlo → reescribirlo entero. Con `await` en el medio, dos peticiones concurrentes se pisan y una de las dos actualizaciones **desaparece**. Los casos más sensibles:

- `auth_users`: es un read-modify-write del array completo en cada alta de usuario, cambio de contraseña, activación/desactivación de MFA y consumo de código de respaldo. Un alta concurrente con un cambio de MFA puede perder una de las dos.
- `click_packs_list`: el punto 3.
- `auth_reset_tokens`: códigos de recuperación de contraseña.

Ya existe el patrón correcto en el mismo repo: la tabla `sessions` con `revokeSession`/`insertSession` es SQL puntual. Ese es el modelo a replicar.

**Corrección:** promever a tablas reales los blobs que se modifican bajo concurrencia, empezando por `auth_users` y `click_packs` (este último lo comparte el punto 3). `app_settings` puede quedar para configuración que se escribe rara vez.

---

## No verificado

Para no inflar el informe con afirmaciones sin respaldo:

- **Estado de `VUUV_PII_KEY` en el entorno de producción**: no puedo ver las variables de Coolify. Verificado solo que no está documentada (0 menciones en `.env.example` y en `.md`).
- **Cantidad de instancias de la app**: el punto 8 es crítico o irrelevante según esto. Hay un solo contenedor corriendo en este host, pero Coolify podría escalar.
- **Duplicados existentes en `click_logs`**: necesario saberlo antes de agregar la restricción única del punto 2.
- **Calidad de la reconciliación del fuente legible** (punto 10): no comparé todavía `938a8a8:server.ts` contra el estado actual en detalle. Es el primer paso de la opción A.
- **Vistas de la UI**: `INVENTARIO.md:25` admite "sin probar vista por vista en browser". No lo verifiqué; queda fuera del alcance de esta auditoría.

---

## Orden de resolución propuesto

| Fase | Puntos | Por qué en ese orden |
|---|---|---|
| 0 | Backup off-site (4) | Es lo único sin arreglo después del desastre, y hoy pesa 9.5 MB. |
| 1 | 1 → 2 → 3 | El cobro falla abierto hoy. El 1 es un `catch`; el 2 y el 3 comparten la tabla `click_packs`. |
| 2 | 11 → 9 | Sin gate de tipos ni CI, no hay forma de saber si las fases 1 y 3 siguen arregladas. |
| 3 | 6 → 7 → 8 | Seguridad. El 6 se verifica en Coolify antes de tocar código. |
| 4 | 12 → 5 | Base de datos. El 5 (migraciones) va después del 12 para no versionar el esquema viejo. |
| 5 | 10 | Estructura. Es el más grande y el que menos riesgo elimina por sí solo: va último. |

**Lo que NO haría:** empezar por el punto 10. Es el trabajo más grande de la lista y el que menos reduce el riesgo de inmediato. Sí conviene hacer **una** cosa antes de la fase 1: `git -c safe.directory` y un branch de trabajo, porque hoy se está commiteando directo sobre `main` y `main` auto-despliega.

---

## Decisiones requeridas

1. **Punto 2:** ¿se corrige el fail-open aunque eso implique que un corte de base **detenga la facturación**? Es el comportamiento correcto, pero cambia ingresos.
2. **Punto 10:** opción A (restaurar el fuente legible de `938a8a8` y reconciliar) u opción B (aceptar `server.ts` como fuente-de-facto y extraer de a poco).
3. **Punto 6:** ¿se cifra la PII existente (migración sobre datos personales reales) o solo de acá en adelante?
4. **Puntos 2 y 12:** si hay duplicados en `click_logs`, hay que decidir qué hacer con ellos antes de la restricción única.
5. **Acceso off-site** para el punto 4: destino y credenciales (S3/R2 u otro).

---

## Correcciones a esta auditoría

Esta auditoría se corrige a sí misma cuando la verificación contradice lo escrito.

**Punto 11 — corrección.** La primera versión afirmaba que `tsc` "solo mira `server.ts`: nunca analiza `src/`". Es **falso**: `tsc` sigue los imports y sí analiza la mitad no-React del código. La consecuencia real es la opuesta y más grave: hay **51 errores de tipos** preexistentes que `npm run lint` viene reportando como éxito. El hallazgo se corrigió en el cuerpo del documento.

**Punto 7 — verificación positiva.** Comprobado que las credenciales que motivaron el guard **ya no están** en `src/`, `server.ts` ni `dist/`: `Pasion2271`, `rogerv707@gmail.com`, `vuuy_verify_secret_2026` y `vuuy-dev-fallback-secret` no aparecen en ninguno. La limpieza de esos commits funcionó. La única coincidencia restante es `CREDENCIALES_SISTEMA` en `src/core/security.ts`, que es `export const CREDENCIALES_SISTEMA: Credencial[] = []` — un array vacío, no un secreto. Vale notar que prohibir ese identificador en el barrido es un falso positivo latente.

**Punto 1 — resuelto y verificado.** Ver el commit correspondiente en la rama `auditoria/12-puntos` y `tests/security/billing-fail-closed.test.ts`.

---

## Anexo — evidencia reproducible

```bash
# server.ts minificado desde el primer commit que lo introdujo
git log --format="%h %ad" --date=short -- server.ts | while read h d; do
  echo "$d $h $(git show $h:server.ts | awk '{if(length($0)>m)m=length($0)}END{print NR" lineas maxlen="m}')"
done

# commit de la minificacion
git log -1 c9a2fa6

# VUUV_PII_KEY: 13 usos en codigo, 0 en la documentacion
grep -rn "VUUV_PII_KEY" --include=*.ts --include=*.sh . | grep -v node_modules | wc -l
grep -c "VUUV_PII_KEY" .env.example

# backup verificado
docker exec oa0t0nzguh49o1fim0juu5nj pg_dump -U postgres -Fc -d nuuviopsg > backup.dump
docker exec -i oa0t0nzguh49o1fim0juu5nj pg_restore -l < backup.dump | grep -c "TABLE DATA"

# el gate de tipos: 51 errores reales tapados por || true
npx tsc --noEmit; echo "exit=$?"        # 2
npm run lint; echo "exit=$?"            # 0
```
