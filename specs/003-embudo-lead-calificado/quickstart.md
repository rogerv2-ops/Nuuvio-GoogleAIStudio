# Quickstart: Embudo de Lead Calificado

Guía para validar la feature de punta a punta.

---

## Requisitos previos

- Postgres en marcha y esquema migrado (`docker-entrypoint.sh` o `bun run db:push`).
- Bot con sesión Baileys `WORKING` (o fallback de simulación).
- Al menos 1 comercio con saldo CPC > 0 y 3 ofertas vigentes.
- Para el render: dependencias instaladas (`bun install`), `@napi-rs/canvas` operativo.

---

## Arranque

```bash
export PATH="$HOME/.bun/bin:$PATH"
bun install
bun run build          # vite build (debe pasar)
bun run test           # bun test tests/security
bun run start          # tsx server.ts
```

---

## Escenario 1 — Paso 1 (mosaico + botones)

1. Enviar "Ofertas" (o el trigger de intención) desde un teléfono de prueba.
2. **Esperado**:
   - Llega **una** imagen 1:1 con hasta 3 segmentos numerados (badge arriba-izquierda).
   - El pie lista 1️⃣/2️⃣/3️⃣ con títulos, **sin enlaces**.
   - Llega un mensaje con **3 botones** "Ver Opción 1/2/3".
   - Fallback: si el cliente no muestra botones, aparece el texto "Responde con el número…".

## Escenario 2 — Paso 2 (cierre + CTA)

1. Tocar el botón "Ver Opción 2" (o enviar `Quiero la oferta: {título}`).
2. **Esperado**:
   - Mensaje de cierre con el **título** y el **ahorro** (S/).
   - Un **botón CTA** "Quiero esta oferta" cuya URL es
     `https://yuddit.com/c/{ofertaId}?u={tuTeléfono}`.
   - Fallback: la URL aparece en texto plano.

## Escenario 3 — Lead facturable (redirección)

1. Abrir `GET /c/{ofertaId}?u=519XXXXXXXX` en el navegador.
2. **Esperado**:
   - `302` a `https://api.whatsapp.com/send?phone={comercio}&text=...NV-XXXXXX...`.
   - En BD: nuevo `click_logs` con `codigo_canje = NV-XXXXXX` y `facturable = true`.
   - `offers.leadsCalificados` +1; saldo del comercio -1.
3. Repetir la misma URL en < 24 h.
4. **Esperado**: `302` con **nuevo** código, pero lead `facturable = false` (sin débito, sin
   incremento de `leadsCalificados`).

## Escenario 4 — Saldo agotado

1. Poner el saldo del comercio en 0 y repetir el Escenario 3 con otro teléfono.
2. **Esperado**: lead registrado **no facturable**; saldo **no** baja de 0; `leadsCalificados` sin cambio.

## Escenario 5 — Rate limit

1. Golpear `/c/{ofertaId}` > 20 veces en 60 s desde la misma IP.
2. **Esperado**: respuestas `429` tras el umbral.

## Escenario 6 — Landing "Lo quiero"

1. En la landing, tocar "Lo quiero" en una tarjeta (usuario verificado).
2. **Esperado**: se abre WhatsApp (app nativa en móvil / web en desktop) con
   `Quiero la oferta: {Título}` precargado.
3. Sin verificar: se abre el modal de registro del embudo (no navega a WhatsApp).

---

## Criterios de aceptación

- [ ] `bun run build` sin errores.
- [ ] `bun run test` en verde.
- [ ] Escenarios 1–6 cumplen el resultado esperado.
- [ ] `lead_logs` (físico `click_logs`), `offers.leadsCalificados` y el saldo quedan
      consistentes (invariante R4/repositorio).
- [ ] Deploy no destructivo: `drizzle-kit push` no propone drops.
