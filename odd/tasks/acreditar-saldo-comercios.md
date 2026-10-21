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

- **T1** (inline, S3, S4): data layer en `src/db/repos/facturacion.ts` + re-export en `src/db/repo.ts`:
  funcion para insertar el pack acreditado (id propio, `pack_acc_*`).
- **T2** (inline, S2, S6): `POST /api/facturacion/packs/acreditar` en `src/routes/facturacion.ts`:
  admin-only, validacion fail-closed, escritura en `click_packs`, recarga del cache del servidor
  (para que la oferta se vea de inmediato) y auditoria en `security_logs`.
- **T3** (inline, S2, S4): panel admin: boton "Acreditar saldo" por comercio en
  `src/components/gestion/views/CampanasCobroDomainView.tsx`, con formulario de clics + monto y aviso de
  exito/error.
- **T4** (inline, S5): panel admin: aviso "no visible: sin saldo" en
  `src/components/gestion/views/OfertasDomainView.tsx` para las ofertas activas sin saldo.
- **T5** (inline, S7): `tests/security/acreditar-saldo.test.ts`: RED -> GREEN. Prueba de negocio:
  oferta activa de un comercio SIN saldo no aparece en `/api/ofertas/publicas`; al acreditar saldo, aparece.
  Un comercio no puede acreditar (403). El saldo acreditado queda en `click_packs`.
- **T6** (inline, S7): suite completa + `npm run lint` + `npm run build`.

## Log

- **L1** (2026-10-21, dueño): *"¿Cómo se le da saldo de clics a un comercio nuevo para que su oferta
  aprobada se vea en la landing?"* → **"Botón de acreditar pack (admin)"**.
- **L2** (2026-10-21, dueño, previo): el flujo de comercios estaba bloqueado porque el panel armaba su
  catalogo desde el `localStorage` (arreglado en `ca9486a`): ahora la cola de moderacion ve las ofertas que
  publica el bot.
- **L3** (2026-10-21, verificado): `/api/ofertas/publicas` filtra por `comercioTieneSaldo`; en la base solo
  hay packs de `merch_01`, `merch_02` y `merch_03`. Un comercio nuevo no tiene pack -> su oferta
  aprobada no llega a la landing, sin aviso.
