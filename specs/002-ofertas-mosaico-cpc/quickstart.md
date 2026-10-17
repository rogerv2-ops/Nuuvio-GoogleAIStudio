# Quickstart / Validación: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

Guía para validar la feature una vez implementadas las brechas del plan.
No contiene el código de implementación (ver `tasks.md` tras `/speckit.tasks`).

## Prerrequisitos

- Postgres accesible y `drizzle-kit push` aplicado (crea `click_logs` de forma aditiva).
- Al menos 2 comercios con packs en `app_settings.click_packs_list`, uno **con saldo > 0**
  y otro **con saldo 0**.
- Al menos 3 ofertas activas, no vencidas, con `comercioWhatsapp` válido.
- Servicio en marcha (`bun run start` o contenedor Coolify).

## Escenario 1 — Formato 1:1 del render

1. Generar la tarjeta individual de una oferta y verificar dimensiones **800×800**.
2. Verificar que la tarjeta **no** incluye ningún corazón/"me gusta".
3. Verificar que el mosaico de N ofertas mide **800 × (800·N)** y tiene N segmentos
   cuadrados numerados.

**Esperado**: dimensiones y composición correctas (FR-003/004/006/007).

## Escenario 2 — Selección y envío del mosaico

1. Disparar el comando de ofertas con 4+ ofertas elegibles.
2. Observar el mensaje enviado.

**Esperado**: un único mensaje con imagen mosaico y pie listando **máximo 3**
ofertas, cada una con su enlace `/c/{id}` (FR-001/002/005).

## Escenario 3 — Exclusión por saldo (FR-020)

1. Poner el saldo del comercio A en `0` y dejar ofertas de A entre las mejores.
2. Disparar el comando de ofertas.

**Esperado**: las ofertas del comercio A **no** aparecen en el mosaico; se
despachan solo ofertas de comercios con saldo.

## Escenario 4 — Clic facturable + débito (FR-008/010/011/012)

1. Registrar el saldo inicial del comercio y el `clics`/`leadsCalificados` de la oferta.
2. Abrir `GET /c/{id}` por primera vez (con teléfono de usuario `U1`).
3. Repetir con el **mismo** `U1` dentro de 24 h.
4. Repetir con otro usuario `U2`.
5. Simular >24 h (p. ej. insertar el clic facturable con `creadoEn` de hace 25 h) y
   volver a abrir con `U1`.

**Esperado**:
- Cada apertura redirige (`302`) a `api.whatsapp.com` con el teléfono del comercio
  y un código `NV-####`.
- `U1` (1.º) ⇒ `facturable = true`, saldo −1, `leadsCalificados` +1.
- `U1` (2.º) ⇒ `facturable = false`, sin débito, igualmente redirige, y **no
  reinicia** la ventana de 24 h.
- `U2` ⇒ `facturable = true`, saldo −1.
- `U1` tras 24 h desde su clic facturable ⇒ **vuelve a ser facturable**, saldo −1
  (una venta por ventana de 24 h).

## Escenario 5 — Saldo nunca negativo / enlace obsoleto (FR-021)

1. Poner saldo del comercio en `0` y abrir un enlace `/c/{id}` de una oferta suya
   con un usuario nuevo.

**Esperado**: el clic se registra como no facturable, **no** hay débito, el saldo
permanece en `0`, y aun así redirige a WhatsApp.

## Escenario 6 — "Me Gusta" persistente (FR-015/016/019)

1. En la landing, pulsar "Me Gusta" en una oferta y anotar el conteo.
2. Reiniciar el servicio.
3. Recargar la landing.

**Esperado**: el conteo incrementó y **persiste** tras el reinicio.
Superar el límite de frecuencia ⇒ `429`. El like **no** altera `clics`,
`leadsCalificados` ni saldos (no factura).

## Escenario 7 — Landing (FR-013/014/017)

1. Verificar que la tarjeta usa imagen **1:1** (`aspect-square`).
2. Verificar que **no** se repite título/descripción bajo la foto.
3. Pulsar "Lo quiero".

**Esperado**: se abre WhatsApp del bot con el texto que menciona la oferta
(`"Quiero la oferta: <título>"`).

## Escenario 8 — Límite de frecuencia en clic (FR-023)

1. Realizar ráfagas de `GET /c/{id}` y de `POST /api/ofertas/{id}/like` desde la
   misma IP.

**Esperado**: al exceder el umbral ⇒ `429`; el resto del servicio sigue operativo.

## Pruebas automatizadas

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun test                 # suite existente (contrato/HTTP)
bun run build            # build de producción obligatorio
```
