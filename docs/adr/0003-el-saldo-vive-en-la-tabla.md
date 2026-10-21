# ADR-0003: El saldo de clics vive en la tabla, y el débito es atómico

- Estado: aceptada
- Fecha: 2026-10-19 (punto 3 de la auditoría)
- Decidido por: el dueño (Roger)

## Contexto

El saldo de cada comercio era un `Map` en memoria que se persistía reescribiendo el
array completo en `app_settings.click_packs_list`: un *read-modify-write* por clic. Con
dos clics concurrentes, ambos leían el mismo array, cada uno restaba en su copia y el
último *write* pisaba al otro. En producción se midió: **3 clics facturables, 2
descuentos persistidos**. El comentario del código decía "débito atómico" y no lo era.

## Decisión

- La tabla `click_packs` es la **fuente de verdad** del saldo.
- El débito es **un solo `UPDATE ... RETURNING`** (`debitarClicAtomico`): el saldo baja
  en la base o no baja.
- `app_settings.click_packs_list` queda congelado como respaldo histórico: se lee una
  vez para sembrar una tabla vacía y no se vuelve a escribir.
- El **bot no decide** el cobro: el error caro (cobrar de menos) lo previene el SQL, no
  una caché.

## Consecuencias

- Un commerce puede comprar packs sin fear de perder clics por concurrencia.
- El panel y el comercio leen el saldo **de la base**, nunca de una semilla
  (`facturacionModule` expone `GET /api/facturacion/packs`).
- El `Map` en memoria queda solo como caché de lectura para poder filtrar ofertas de
  forma síncrona; su desactualización es benigna porque no decide cobros.
