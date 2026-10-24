import { describe, it, expect } from "bun:test";
import { escapeCsvCelda, filaCsv } from "../../src/utils/csv.ts";
import { CATEGORIAS_CAPTACION, esCategoriaCaptacion } from "../../src/utils/categoriasCaptacion.ts";

const BASE = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";
// El endpoint solo existe si el servidor arrancó con EMBUDO_PREREGISTRO=1
// (convención del repo: los tests black-box se saltan si falta el entorno).
const EMBUDO_ACTIVO = process.env.EMBUDO_PREREGISTRO === "1";
let ipSeq = 0;
const ipNueva = () => `10.240.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`;
const post = (body: unknown, ip = ipNueva()) =>
  fetch(`${BASE}/api/preregistros`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: JSON.stringify(body),
  });

const valido = (extra: Record<string, unknown> = {}) => ({
  nombreComercial: "Comercio de Prueba",
  responsable: "Persona de Prueba",
  correo: `prueba-${Math.random().toString(36).slice(2)}@example.com`,
  distritoZona: "Miraflores",
  categoria: "Comida y Restaurantes",
  consentimientoEmail: true,
  ...extra,
});

describe("csv utils: formula injection", () => {
  it("prefija con comilla simple las celdas que empiezan por = + - @ TAB CR", () => {
    expect(escapeCsvCelda("=1+1")).toBe('"\'=1+1"');
    expect(escapeCsvCelda("+51 999")).toBe('"\'+51 999"');
    expect(escapeCsvCelda("-5")).toBe('"\'-5"');
    expect(escapeCsvCelda("@user")).toBe('"\'@user"');
    expect(escapeCsvCelda("\t=x")).toBe('"\'\t=x"');
  });
  it("no altera valores normales y escapa comillas", () => {
    expect(escapeCsvCelda("Comercio")).toBe('"Comercio"');
    expect(escapeCsvCelda('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(escapeCsvCelda(null)).toBe('""');
  });
  it("filaCsv une con comas", () => {
    expect(filaCsv(["a", "b"])).toBe('"a","b"');
  });
});

describe("categorías de captación", () => {
  it("son las 17 aprobadas, con texto exacto", () => {
    expect(CATEGORIAS_CAPTACION.length).toBe(17);
    expect(CATEGORIAS_CAPTACION).toContain("Herramientas, Autos y Motos");
    expect(CATEGORIAS_CAPTACION).toContain("Tecnología y Electrónica");
  });
  it("esCategoriaCaptacion valida estricto", () => {
    expect(esCategoriaCaptacion("Viajes")).toBe(true);
    expect(esCategoriaCaptacion("viajes")).toBe(false);
    expect(esCategoriaCaptacion("Herramientas/Autos/Motos")).toBe(false);
    expect(esCategoriaCaptacion(123)).toBe(false);
  });
});

describe.skipIf(!EMBUDO_ACTIVO)("contrato /api/preregistros (EMBUDO_PREREGISTRO=1)", () => {
  it("rechaza cuando falta un campo obligatorio", async () => {
    const body = valido();
    delete (body as any).responsable;
    const r = await post(body);
    expect(r.status).toBe(400);
  });

  it("rechaza correo inválido", async () => {
    const r = await post(valido({ correo: "no-es-correo" }));
    expect(r.status).toBe(400);
  });

  it("rechaza categoría fuera de la lista aprobada", async () => {
    const r = await post(valido({ categoria: "Otra cosa" }));
    expect(r.status).toBe(400);
  });

  it("rechaza sin consentimiento explícito", async () => {
    const r = await post(valido({ consentimientoEmail: false }));
    expect(r.status).toBe(400);
  });

  it("acepta un registro válido y el reenvío del mismo correo es idempotente", async () => {
    const body = valido();
    const r1 = await post(body);
    expect(r1.status).toBe(200);
    expect((await r1.json()).ok).toBe(true);
    const r2 = await post(body);
    expect(r2.status).toBe(200);
    expect((await r2.json()).ok).toBe(true);
  });

  it("el honeypot devuelve ok sin error (no revela que es trampa)", async () => {
    const r = await post(valido({ empresa: "bot-relleno" }));
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });

  it("la baja rechaza tokens con formato inválido y es genérica con tokens inexistentes", async () => {
    const bad = await fetch(`${BASE}/api/preregistros/baja?token=corto`, {
      headers: { "X-Forwarded-For": ipNueva() },
    });
    expect(bad.status).toBe(400);
    const inexistente = await fetch(
      `${BASE}/api/preregistros/baja?token=${"a".repeat(48)}`,
      { headers: { "X-Forwarded-For": ipNueva() } }
    );
    expect(inexistente.status).toBe(200);
  });

  it("aplica rate-limit por IP en el registro", async () => {
    const ip = ipNueva();
    let ultimo = 0;
    for (let i = 0; i < 7; i++) {
      const r = await post(valido(), ip);
      ultimo = r.status;
    }
    expect(ultimo).toBe(429);
  });
});
