# Acreditar saldo de clics a un comercio (que su oferta se vea)

Objetivo: que la oferta aprobada de un comercio **nuevo** (sin pack) se vea en la landing, con un botón
de administración que le acredita saldo de clics, y que el panel avise cuando una oferta activa NO se ve
por falta de saldo.
Branch: `main` · Runner: `$HOME/.bun/bin/bun test tests/security` + `npm run lint` + `npm run build`.

## Specs

- **S1**: el dueño elige la vía manual: **"Botón de acreditar pack (admin)"**. Descripción elegida:
  *"En el panel, el admin le carga N clics a un comercio (vos cobrás por fuera: Yape/transferencia y lo
  registrás). Desbloquea hoy, no regala nada y solo el admin puede hacerlo. Se puede sumar a la compra con
  pasarela más adelante."*
- **S2**: el botón vive en el panel de administración, en la pantalla **"Campañas y Cobro → Campañas
  activas"**, que ya lista cada comercio con su saldo de clics. Solo un **admin** puede acreditar.
- **S3**: acreditar crea un **pack nuevo** en la tabla `click_packs` (la verdad del saldo) con los clics
  acreditados y el monto cobrado; queda registrado en el historial de "Pagos y cobros" como cualquier
  pack. El saldo del comercio es la suma de los clics disponibles de sus packs.
- **S4**: el monto cobrado es opcional (0 = bonificación) y el admin lo escribe: el cobro real ocurre
  fuera de la app (Yape/transferencia) y la app solo lo registra.
- **S5**: **el panel avisa**: una oferta activa de un comercio sin saldo se muestra como **"no visible:
  sin saldo"**, con la acción de acreditar al lado. Un botón que no abre avisa (regla 4 de AGENTS.md): hoy
  aprobar una oferta sin saldo no avisa nada y el dueño cree que ya se publicó.
- **S6**: la ruta de acreditación es **fail-closed**: commerceId vacío, clics fuera de 1..10000 o monto
  negativo se rechazan con 400 y **no** se escribe nada en la base. Un comercio (no admin) recibe 403.
- **S7**: la suite `tests/security` **no se debilita**: se agregan pruebas, no se quitan. El gate de tipos
  no admite errores nuevos.

## Tasks

| ID | Tarea | Specs | Ruta | Estado | Evidencia |
|----|-------|-------|------|--------|-----------|
| T1 | Documento de control (este archivo) | — | inline | ✅ | — |
| T2 | Endpoint admin `POST /api/facturacion/packs/acreditar` (fail-closed, auditoria, recarga de cache) | S2,S3,S4,S6 | inline | ✅ | commit `2ced5f0` |
| T3 | Boton "Acreditar saldo" en Campanas y Cobro → Campañas activas | S2,S4 | inline | ✅ | commit `bc8bb35` |
| T4 | Aviso "No visible: sin saldo" en la lista de ofertas | S5 | inline | ✅ | commit `bc8bb35` |
| T5 | Pruebas: negocio (visible/no visible), bordes, fail-closed, debito de 1 clic | S6,S7 | inline | ✅ | `tests/security/acreditar-saldo.test.ts` (4) + `acreditar-saldo-bordes.test.ts` (5) |
| T6 | Suite completa + gate de tipos + build | S7 | inline | ✅ | 236 pass / 0 fail; "[typecheck] OK: 55 errores preexistentes, 0 nuevos"; build ok |
| T7 | Verificacion independiente (riesgo alto: dinero + permisos) | S1..S7 | delegado | ✅ | 0 blockers; 7/7 sondas ok; RED confirmado en el baseline (404) |

## Log

- **L1** (2026-10-21, dueño): *"¿Cómo se le da saldo de clics a un comercio nuevo para que su oferta
  aprobada se vea en la landing?"* → **"Botón de acreditar pack (admin)"**.
- **L2** (2026-10-21, dueño, previo): el flujo de comercios estaba bloqueado porque el panel armaba su
  catalogo desde el `localStorage` (arreglado en `ca9486a`): ahora la cola de moderacion ve las ofertas que
  publica el bot.
- **L3** (2026-10-21, verificado): `/api/ofertas/publicas` filtra por `comercioTieneSaldo`; en la base solo
  hay packs de `merch_01`, `merch_02` y `merch_03`. Un comercio nuevo no tiene pack -> su oferta
  aprobada no llega a la landing, sin aviso.
- **L4** (2026-10-21, implementacion): endpoint `POST /api/facturacion/packs/acreditar` (solo admin) que
  escribe un pack `pack_acc_*` en `click_packs` y recarga el cache del servidor. El cache es lo que decide
  si la oferta se ve: sin `recargarCache()` el comercio seguiria "sin saldo" hasta el proximo arranque.
  Boton en "Campañas y Cobro → Campañas activas" y distintivo "No visible: sin saldo" en la lista de ofertas.
- **L5** (2026-10-21, verificacion independiente): 0 blockers; las 7 specs y las 7 sondas cumplen; el RED
  fue confirmado contra el baseline (el endpoint da 404 y el test da 0 pass / 4 fail). Sus sondas quedaron
  como regresion en `tests/security/acreditar-saldo-bordes.test.ts`.
  Avisos aceptados: (a) la ruta no valida que el comercio exista (la UI solo ofrece los que estan en la
  lista; un id mal escrito deja un pack huerfano visible en "Pagos y cobros"); (b) el alias `cantidad` se
  elimino para que la superficie sea solo `clics`.
- **L6** (2026-10-21, entorno): la suite `tests/security` es verde y vacia si el server no corre, y se
  rompe si se corre dos veces en 5 minutos: el rate limit de login (10/5 min) es EN MEMORIA. Antes de cada
  corrida hay que reiniciar el server local (matar el PID y su hijo con `pkill -P`, nunca `pkill -f`) y
  ejecutar `delete from login_failures`.
