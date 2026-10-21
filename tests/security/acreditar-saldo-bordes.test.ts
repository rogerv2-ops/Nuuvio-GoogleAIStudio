/**
 * Bordes y fail-closed de la acreditacion de saldo (S6), y el debito de UN
 * clic por lead sobre el saldo acreditado.
 *
 * Este archivo es la regresion de las sondas del verificador independiente:
 * los bordes que el test del escritor no cubria (401 sin token, 403 de comercio,
 * "no escribe nada" con datos invalidos, monto 0 como bonificacion, 10000
 * clics como borde valido) y el debito EXACTO de un clic.
 *
 * Criterio de dinero: acreditar saldo REGALA la visibilidad de la oferta del
 * comercio. Si la ruta aceptara datos invalidos o dejara pasar a un comercio,
 * se regalarian clics sin control.
 */
import { test, expect, describe } from "bun:test";
import pg from "pg";
import {
  servidorOnline,
  login,
  ADMIN,
  COMERCIO,
  post,
  conOfertaDePrueba,
  aUrlLocal,
} from "./_helpers.ts";

const SQL = {
  host: process.env.SQL_HOST || "127.0.0.1",
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "test",
  database: process.env.SQL_DB_NAME || "yuddit_test",
};

const online = await servidorOnline();

/** Comercio propio de esta corrida: sin packs (nunca existio en la base). */
const COMERCIO_TEST = `merch_borde_${Date.now()}`;

/** Otro comercio propio: el test de debito no comparte saldo con el de bordes. */
const COMERCIO_DEBITO = `merch_borde_debito_${Date.now()}`;

let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

let ipSecuencia = 0;
function ipPropia(): string {
  ipSecuencia += 1;
  return `203.0.113.${150 + (ipSecuencia % 9)}`;
}

async function simular(token: string, telefono: string, texto: string): Promise<string> {
  const r = await post(
    "/api/whatsapp/simulate-incoming",
    { telefono, texto, pushName: "Acreditar saldo" },
    token,
    { "X-Forwarded-For": ipPropia() }
  );
  expect(r.status).toBe(200);
  const j: any = await r.json();
  return (j.respuestas || []).map((x: any) => x.texto || "").join("\n");
}

async function saldoEnBase(comercioId: string): Promise<number> {
  const c = new pg.Client(SQL);
  try {
    await c.connect();
    const r = await c.query(
      "select coalesce(sum(saldo_clics),0)::int as s from click_packs where comercio_id = $1",
      [comercioId]
    );
    return Number(r.rows[0]?.s || 0);
  } finally {
    await c.end().catch(() => undefined);
  }
}

describe.skipIf(!online)("Acreditar saldo: bordes, fail-closed y debito de 1 clic", () => {
  test("sin token responde 401", async () => {
    const r = await post("/api/facturacion/packs/acreditar", { comercioId: COMERCIO_TEST, clics: 5 });
    expect(r.status).toBe(401);
  });

  test("un comercio recibe 403 (acreditar saldo regala clics)", async () => {
    const token = await login(COMERCIO.email, COMERCIO.password);
    if (!token) return;
    const r = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_TEST, clics: 5 },
      token
    );
    expect(r.status).toBe(403);
  });

  test("los datos invalidos NO escriben ninguna fila", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const c = new pg.Client(SQL);
    await c.connect();
    try {
      const antes = Number((await c.query("select count(*)::int as n from click_packs")).rows[0].n);
      const malos: any[] = [
        { clics: 10 },
        { comercioId: "   ", clics: 10 },
        { comercioId: COMERCIO_TEST, clics: 0 },
        { comercioId: COMERCIO_TEST, clics: -5 },
        { comercioId: COMERCIO_TEST, clics: 10001 },
        { comercioId: COMERCIO_TEST, clics: 5, monto: -10 },
        { comercioId: COMERCIO_TEST, clics: 5, monto: "abc" },
      ];
      for (const body of malos) {
        const r = await post("/api/facturacion/packs/acreditar", body, token);
        expect(r.status).toBe(400);
      }
      const despues = Number((await c.query("select count(*)::int as n from click_packs")).rows[0].n);
      expect(despues).toBe(antes);
    } finally {
      await c.end().catch(() => undefined);
    }
  });

  test("monto 0 es bonificacion y 10000 clics es el borde valido", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const gratis = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_TEST, clics: 5, monto: 0 },
      token
    );
    expect(gratis.status).toBe(200);
    const j: any = await gratis.json();
    expect(Number(j.pack.montoTotal)).toBe(0);
    expect(Number(j.pack.precioUnitario)).toBe(0);

    const tope = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_TEST, clics: 10000, monto: 1 },
      token
    );
    expect(tope.status).toBe(200);
    const j2: any = await tope.json();
    expect(Number(j2.pack.saldoClics)).toBe(10000);
  });

  test("un clic facturable descuenta EXACTAMENTE 1 clic del saldo acreditado", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    // Saldo acreditado: 5 clics para un comercio que no tenia ninguno.
    const acreditado = await post(
      "/api/facturacion/packs/acreditar",
      { comercioId: COMERCIO_DEBITO, clics: 5, monto: 5 },
      token
    );
    expect(acreditado.status).toBe(200);

    await conOfertaDePrueba(
      token,
      { comercioId: COMERCIO_DEBITO, titulo: "Oferta para el debito de un clic" },
      async (oferta) => {
        const antes = await saldoEnBase(COMERCIO_DEBITO);
        expect(antes).toBe(5);

        // El enlace firmado lo arma el bot: es la unica forma de conseguir una
        // firma valida (la ruta /c/:id es fail-closed sin ella).
        const t = telefonoNuevo();
        await simular(
          token!,
          t,
          `Hola, quiero ver las ofertas de Yuddit: ${oferta.titulo} (ref ${oferta.codigoUrl}). Mi codigo es NV-TEST00`
        );
        const texto = await simular(token!, t, "sí");
        const enlace = [...texto.matchAll(/https?:\/\/\S+\/c\/\S+/g)]
          .map((m) => m[0])
          .find((u) => u.includes(`/c/${oferta.id}`));
        expect(enlace).toBeTruthy();

        const r = await fetch(aUrlLocal(enlace as string), {
          redirect: "manual",
          headers: { "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(302);

        const despues = await saldoEnBase(COMERCIO_DEBITO);
        expect(despues).toBe(antes - 1);
      }
    );
  });
});
