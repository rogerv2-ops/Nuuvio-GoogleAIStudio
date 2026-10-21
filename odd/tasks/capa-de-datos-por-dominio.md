# Capa de datos por dominio — partir `src/db/repo.ts`

Objetivo: sacar las 71 funciones que vivian en un solo `src/db/repo.ts` (1.058 lineas, 74 KB) y dejarlas
en `src/db/repos/<dominio>.ts`, moviendo el codigo verbatim y conservando la misma superficie exportada.
Branch: `refactor/capa-datos-por-dominio` · Runner: `$HOME/.bun/bin/bun test tests/security` + `tests/billing` + `npm run lint` + `npm run build`.

## Specs

- **S1**: la capa de datos se parte **por dominio**, en `src/db/repos/<dominio>.ts`: `ajustes`, `comercios`,
  `catalogo`, `audiencia`, `logs`, `clics`, `auth`, `sesiones`, `facturacion`, `geo`, `eventos`, `analitica`.
  Un archivo por dominio; nada de partir "por funcion" ni por tamano.
- **S2**: **movimiento verbatim**. El cuerpo de cada funcion es **byte a byte** el original, incluido su
  `__name(...)` de esbuild. Prohibido reformatear, "limpiar" o reindentar.
- **S3**: **la superficie no cambia**. `src/db/repo.ts` queda como re-export de compatibilidad con los
  **mismos 71 nombres**; `server.ts`, las 6 rutas, `src/modules/facturacion.ts` y los tests siguen importando
  de `src/db/repo.ts` sin tocar una linea. El shim no tiene logica propia.
- **S4**: los helpers internos viajan con su dominio. Si otro dominio los usa, se importan entre modulos
  (`inMemoryRegLogs` de `logs` → `audiencia`; `getSetting`/`saveSetting` de `ajustes` → `comercios` y `analitica`;
  `normalizePhoneForMatching` de `audiencia` → `eventos`). **No se duplica ninguna definicion.**
- **S5**: el gate de tipos no admite deuda nueva: los 13 errores preexistentes de `repo.ts` pueden cambiar de
  archivo (misma huella de codigo + mensaje) pero el total no sube. Si aparece uno nuevo, se arregla, no se
  congela.
- **S6**: verificacion de cierre: identidad byte a byte declaracion por declaracion, `npm run lint` (0 nuevos),
  `npm run build`, arranque real contra una base **limpia** (migraciones + semilla de WhatsApp) y las suites
  `tests/security` y `tests/billing` **ejecutadas, no saltadas**.
- **S7**: fuera de alcance de este cambio: migrar los consumidores a importar del dominio y retirar el shim.
  Queda anotado como siguiente paso, no se hace aca (el objetivo de este PR es poder demostrar que no cambia
  comportamiento).

## Tasks

| ID | Tarea | Specs | Ruta | Estado | Evidencia |
|----|-------|-------|------|--------|-----------|
| T1 | Documento de control (este archivo) | — | inline | ✅ | — |
| T2 | Inventario exacto de declaraciones (78 halladas, 76 sin preludio) y mapa de dependencias | S1 | inline | ✅ | script de analisis en scratch: 76 declaraciones, 71 exportadas, 5 internas |
| T3 | Partir en 12 modulos + shim de re-export | S1,S2,S4 | inline | ✅ | 12 archivos en `src/db/repos/`, shim de 22 lineas (`f5f56ab`) |
| T4 | Verificar identidad byte a byte y la superficie exportada | S2,S3 | inline | ✅ | 76/76 declaraciones identicas; shim exporta 71/71 exactos; 0 nombres de mas o de menos |
| T5 | Gate de tipos + baseline revisada | S5 | inline | ✅ | 13 errores mudos de archivo, misma firma codigo+mensaje, 0 nuevos; total 57→55 (2 errores de `src/modules/analitica.ts` ya no reproducen en `main`) |
| T6 | Build y arranque real contra base limpia; suites completas | S6 | inline | ✅ | ver Log L3 |

## Log

- **L1** (2026-10-21, verbatim del dueno): tras la propuesta de tres frentes —(1) partir la capa de datos,
  (2) sacar el motor de WhatsApp del minificado, (3) contrato de carga de los modulos del panel— respondio:
  **"por la 1"**. Alcance autorizado: partir la capa de datos. Los frentes 2 y 3 quedan sin autorizar.
- **L2** (2026-10-21, medido antes de tocar nada): `src/db/repo.ts` tenia **1.058 lineas / 74 KB / 71 funciones
  exportadas**, y de ahi importaban `server.ts`, las 6 rutas, `src/modules/facturacion.ts` y 7 archivos de tests.
  Adentro convivian 12 dominios que no tienen nada que ver entre si: login y usuarios, sesiones, audiencia, ofertas,
  clics, **el debito atomico del saldo del comercio**, catalogo geografico, eventos y analitica. Consecuencia: para
  cambiar una consulta del saldo habia que abrir el mismo archivo donde vive la autenticacion, y nada avisaba si se
  rompia lo otro. El archivo es un artefacto minificado por esbuild (cada funcion termina en `__name(X,"X")`), asi que
  **no se puede reformatear**: se corta por offsets exactos.
- **L3** (2026-10-21, verificacion): script de particion por offsets de bytes, con inventario previo.
  1. **Identidad**: 76/76 declaraciones byte a byte identicas al original (incluye el `__name` de cada una), 0
     faltantes, 0 duplicadas. El shim exporta exactamente los 71 nombres originales (0 de mas, 0 de menos) y no
     contiene logica.
  2. **Tipos**: `npm run lint` → 55 preexistentes, **0 nuevos**. Los 13 errores de `repo.ts` aparecen ahora en
     `repos/*.ts` con la misma firma `codigo+mensaje` (los 7 `TS2769` se reparten en 4 huellas por archivo: 1+1+2+3,
     siguen siendo 7). El total baja 57→55 porque 2 errores de `src/modules/analitica.ts` **ya no reproducen en
     `main`** (deuda de baseline: se comprobo con `stash` sobre `main`, `tsc` no los emite). No es merito de este cambio.
  3. **Build**: `npm run build` OK; `dist/index.html` presente. El chunk `repo-*.js` (218 KB) sigue siendo un chunk
     aparte que el cliente no pide: **la capa de datos no entra al bundle del navegador**.
  4. **Base limpia**: base nueva `yuddit_arq` + `drizzle-kit push` + `scripts/ci/seed-whatsapp-config.mjs`, servidor
     arriba en :3210 con el codigo de la rama. Una llamada por dominio, todas 200 con datos reales de la base:
     `auth/login` + `auth/me` + `auth/sessions` (auth, sesiones), `audience/users` + `audience/registration-logs`
     (audiencia, logs), `ofertas`/`banners`/`comercios` (catalogo, comercios), `facturacion/packs` (facturacion),
     `geo/provincias` (geo), `analitica/kpis` + `series` (analitica), `POST /api/eventos` → `{"guardados":1}` y la
     vista aparece en las metricas 79→80 (eventos), `POST /api/ofertas/:id/like` → 200 (clics), `/c/:id` → 200.
     Cero errores en el log del servidor.
  5. **Suites**: `tests/security` **221 pass / 0 fail / 0 saltados** (43 archivos, con credenciales de admin y de
     comercio); `tests/billing` **21 pass / 0 fail** (incluye el debito atomico y la ventana de 24 h);
     `scripts/security-smoke.sh` **10 ok / 0 fallidos**. Nada de "verde y vacia".
  6. Base de prueba y servidor de smoke eliminados al terminar; el servidor local de :3000 **no se toco**.
- **L4** (2026-10-21): commit del refactor **`f5f56ab`** (rama `refactor/capa-datos-por-dominio`). El shim queda a
  proposito: este PR tenia que poder demostrar que **no cambia comportamiento**. Siguiente paso anotado (S7):
  que cada consumidor importe del dominio (`server.ts`, las rutas y los tests) y ahi si retirar `repo.ts`.
