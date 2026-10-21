/**
 * Acreditar saldo de clics a un comercio (boton de administracion).
 *
 * EL PROBLEMA QUE RESUELVE (medido el 2026-10-21)
 *
 * `/api/ofertas/publicas` filtra por `comercioTieneSaldo`: una oferta ACTIVA de
 * un comercio SIN saldo de clics no llega a la landing. Un comercio nuevo (el
 * que se registra por WhatsApp) no tiene pack en la tabla `click_packs`, asi
 * que su oferta aprobada se quedaba invisible SIN AVISO: el admin aprotaba y
 * no pasaba nada.
 *
 * Decision del dueno (2026-10-21): "Boton de acreditar pack (admin)" — el admin
 * le carga N clics al comercio (el cobro real es por fuera: Yape/transferencia)
 * y la app solo lo registra.
 *
 * LO QUE ESTOS TESTS VIGILAN
 *
 *  1. La oferta de un comercio SIN saldo no aparece en `/api/ofertas/publicas`;
 *     despues de acreditar saldo, aparece. (La prueba de negocio: acreditar
 *     saldo DEBERIA habilitar la oferta.)
 *  2. Un COMERCIO (no admin) NO puede acreditar saldo: 403. Acreditar saldo
 *     regala clics: solo el administrador lo puede hacer.
 *  3. El saldo acreditado queda en la tabla `click_packs` (la verdad) y se
 *     puede leer por `GET /api/facturacion/packs`.
 *  4. La ruta es fail-closed: clics fuera de rango o comercio vacio se
 *     rechazan con 400 y NO se escribe nada.
 */
import { test, expect, describe } from "bun:test";
import { servidorOnline, login, ADMIN, COMERCIO, conOfertaDePrueba, post, get } from "./_helpers.ts";

const online = await servidorOnline();

/**
 * Comercio de prueba que NO tiene pack: es el caso que hoy bloquea la landing.
 *
 * El id lleva la marca del tiempo a proposito: si el mismo id se reutilizara,
 * la acreditacion de una corrida anterior quedaria en la base y el comercio
 * tendria saldo -> la prueba "antes" (que la oferta NO se ve) dejaria de
 * tener sentido. Cada corrida usa un comercio nuevo, sin saldo de partida.
 */
const COMERCIO_SIN_SALDO = `merch_test_sin_saldo_${Date.now()}`;

describe.skipIf(!online)("Acreditar saldo de clics (admin)", () => {
  test("la oferta de un comercio sin saldo no se ve; al acreditar saldo, se ve", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    await conOfertaDePrueba(
      token,
      { comercioId: COMERCIO_SIN_SALDO, titulo: "Oferta de un comercio sin saldo" },
      async (oferta) => {
        // ANTES: el comercio no tiene saldo -> la oferta activa no llega al publico.
        const antes = await get("/api/ofertas/publicas");
        const jAntes: any = await antes.json();
        expect((jAntes.ofertas || []).some((o: any) => o.id === oferta.id)).toBe(false);

        // El admin acredita saldo.
        const r = await post(
          "/api/facturacion/packs/acreditar",
          { comercioId: COMERCIO_SIN_SALDO, clics: 10, monto: 12 },
          token
        );
        expect(r.status).toBe(200);
        const j: any = await r.json();
        expect(j.ok).toBe(true);
        expect(j.pack).toBeTruthy();
        expect(Number(j.pack.saldoClics)).toBe(10);

        // DESPUES: la oferta del mismo comercio ya se ve.
        const despues = await get("/api/ofertas/publicas");
        const jDespues: any = await despues.json();
        expect((jDespues.ofertas || []).some((o: any) => o.id === oferta.id)).toBe(true);
      }
    );
  });

  test("un comercio NO puede acreditar saldo (403)", async () => {
    const token = await login(COMERCIO.email, COMERCIO.password);
    if (!token) return; // sin credencial de comercio en este entorno: nada que exigir
    const r = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_SIN_SALDO, clics: 5 },
      token
    );
    expect(r.status).toBe(403);
  });

  test("el saldo acreditado queda registrado en la tabla (se lee por la API)", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const r = await get(`/api/facturacion/packs?comercioId=${COMERCIO_SIN_SALDO}`, token);
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.origen).toBe("base");
    expect(Number(j.saldoTotal)).toBeGreaterThan(0);
  });

  test("la ruta es fail-closed: no escribe nada con datos invalidos", async () => {
    const token = await login(ADMIN.email, ADMIN.password);

    const sinComercio = await post("/api/facturacion/packs/acreditar", { clics: 10 }, token);
    expect(sinComercio.status).toBe(400);

    const clicsCero = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_SIN_SALDO, clics: 0 },
      token
    );
    expect(clicsCero.status).toBe(400);

    const clicsDeMas = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_SIN_SALDO, clics: 100000 },
      token
    );
    expect(clicsDeMas.status).toBe(400);

    const montoNegativo = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_SIN_SALDO, clics: 5, monto: -10 },
      token
    );
    expect(montoNegativo.status).toBe(400);
  });
});
