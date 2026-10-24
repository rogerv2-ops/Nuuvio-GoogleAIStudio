import { describe, it, expect } from "bun:test";
import { escapeCsvCelda, filaCsv } from "../../src/utils/csv.ts";
import { CATEGORIAS_CAPTACION, esCategoriaCaptacion } from "../../src/utils/categoriasCaptacion.ts";
import { BASE, login, get } from "./_helpers.ts";

// El endpoint solo existe si el servidor arrancó con EMBUDO_PREREGISTRO=1
// (convención del repo: los tests black-box se saltan si falta el entorno).
const EMBUDO_ACTIVO = process.env.EMBUDO_PREREGISTRO === "1";
const ADMIN_EMAIL = process.env.VUUV_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.VUUV_ADMIN_PASSWORD || "";
const CON_ADMIN = EMBUDO_ACTIVO && !!ADMIN_EMAIL && !!ADMIN_PASSWORD;

let ipSeq = 0;
const ipNueva = () => `10.240.${(ipSeq >> 8) & 255}.${ipSeq++ & 255}`;
const postPrereg = (body: unknown, ip = ipNueva()) =>
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

const tokenDe = (bajaUrl: string) => new URL(bajaUrl, BASE).searchParams.get("token") || "";
const buscarEnAdmin = async (token: string, correo: string) => {
  const r = await get("/api/admin/preregistros", token);
  if (r.status !== 200) return { estadoHttp: r.status, registro: null as any, crudo: null as any };
  const j: any = await r.json();
  const registro = (j.preregistros || []).find((p: any) => p.correo === correo) || null;
  return { estadoHttp: r.status, registro, crudo: j.preregistros || [] };
};

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

describe.skipIf(!EMBUDO_ACTIVO)("contrato /api/preregistros: validación y anti-abuso", () => {
  it("rechaza cuando falta un campo obligatorio", async () => {
    const body = valido();
    delete (body as any).responsable;
    const r = await postPrereg(body);
    expect(r.status).toBe(400);
  });

  it("rechaza correo inválido", async () => {
    const r = await postPrereg(valido({ correo: "no-es-correo" }));
    expect(r.status).toBe(400);
  });

  it("rechaza categoría fuera de la lista aprobada", async () => {
    const r = await postPrereg(valido({ categoria: "Otra cosa" }));
    expect(r.status).toBe(400);
  });

  it("rechaza sin consentimiento explícito", async () => {
    const r = await postPrereg(valido({ consentimientoEmail: false }));
    expect(r.status).toBe(400);
  });

  it("acepta un registro válido y entrega el enlace de baja una vez", async () => {
    const r = await postPrereg(valido());
    expect(r.status).toBe(200);
    const j: any = await r.json();
    expect(j.ok).toBe(true);
    expect(j.bajaUrl).toMatch(/^\/api\/preregistros\/baja\?token=[a-f0-9]{48}$/);
  });

  it("el reenvío del mismo correo es idempotente y la respuesta es homogénea (anti-oráculo)", async () => {
    const body = valido();
    const r1 = await postPrereg(body);
    const j1: any = await r1.json();
    const r2 = await postPrereg(body);
    const j2: any = await r2.json();
    // Misma forma de respuesta para nuevo y duplicado: no revela existencia.
    expect(j1.ok).toBe(true);
    expect(j2.ok).toBe(true);
    expect(j2.bajaUrl).toMatch(/^\/api\/preregistros\/baja\?token=[a-f0-9]{48}$/);
  });

  it("el honeypot devuelve ok sin error (no revela que es trampa)", async () => {
    const r = await postPrereg(valido({ empresa: "bot-relleno" }));
    expect(r.status).toBe(200);
    expect((await r.json()).ok).toBe(true);
  });

  it("la baja rechaza tokens con formato inválido", async () => {
    const bad = await fetch(`${BASE}/api/preregistros/baja?token=corto`, {
      headers: { "X-Forwarded-For": ipNueva() },
    });
    expect(bad.status).toBe(400);
    const badPost = await fetch(`${BASE}/api/preregistros/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipNueva() },
      body: JSON.stringify({ token: "corto" }),
    });
    expect(badPost.status).toBe(400);
  });

  it("aplica rate-limit por IP en el registro", async () => {
    const ip = ipNueva();
    let ultimo = 0;
    for (let i = 0; i < 7; i++) {
      const r = await postPrereg(valido(), ip);
      ultimo = r.status;
    }
    expect(ultimo).toBe(429);
  });
});

describe.skipIf(!CON_ADMIN)("contrato /api/preregistros: ciclo baja y consentimiento (con admin)", () => {
  it("GET de baja muestra confirmación y NO da de baja (prefetch/escáner seguro)", async () => {
    const body = valido();
    const alta = await postPrereg(body);
    const { bajaUrl } = (await alta.json()) as any;
    const tok = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const antes = await buscarEnAdmin(tok!, body.correo as string);
    expect(antes.registro?.estadoAviso).toBe("pendiente");

    const pagina = await fetch(`${BASE}${bajaUrl}`, { headers: { "X-Forwarded-For": ipNueva() } });
    expect(pagina.status).toBe(200);
    expect(pagina.headers.get("content-type") || "").toContain("text/html");
    expect(await pagina.text()).toContain("baja del boletín");

    const despues = await buscarEnAdmin(tok!, body.correo as string);
    expect(despues.registro?.estadoAviso).toBe("pendiente");
  });

  it("POST de baja sí da de baja; la reactivación exige formulario nuevo con consentimiento", async () => {
    const body = valido();
    const alta = await postPrereg(body);
    const { bajaUrl } = (await alta.json()) as any;
    const tok = await login(ADMIN_EMAIL, ADMIN_PASSWORD);

    const baja = await fetch(`${BASE}/api/preregistros/baja`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": ipNueva() },
      body: JSON.stringify({ token: tokenDe(bajaUrl) }),
    });
    expect((await baja.json()).ok).toBe(true);
    const enBaja = await buscarEnAdmin(tok!, body.correo as string);
    expect(enBaja.registro?.estadoAviso).toBe("baja");
    const tsBaja = enBaja.registro?.consentimientoTs;

    // Un POST anónimo con el checkbox NO revierte la baja: cualquiera puede
    // escribir un correo ajeno. La reactivación exige probar el control del
    // correo (proceso pendiente; sin envíos autorizados, inactiva).
    const re = await postPrereg(body);
    const jre: any = await re.json();
    expect(jre.ok).toBe(true);
    expect(jre.bajaUrl).toMatch(/^\/api\/preregistros\/baja\?token=/); // inerte, homogénea
    const sigue = await buscarEnAdmin(tok!, body.correo as string);
    expect(sigue.registro?.estadoAviso).toBe("baja");
    expect(sigue.registro?.consentimientoTs).toBe(tsBaja);
  });

  it("el dedupe de un correo activo NO renueva consentimiento ni estado", async () => {
    const body = valido();
    await postPrereg(body);
    const tok = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const antes = await buscarEnAdmin(tok!, body.correo as string);
    await postPrereg(body);
    const despues = await buscarEnAdmin(tok!, body.correo as string);
    expect(despues.registro?.consentimientoTs).toBe(antes.registro?.consentimientoTs);
    expect(despues.registro?.estadoAviso).toBe(antes.registro?.estadoAviso);
    const total = despues.crudo.filter((p: any) => p.correo === body.correo).length;
    expect(total).toBe(1);
  });

  it("el JSON admin no expone el hash del token de baja", async () => {
    const body = valido();
    await postPrereg(body);
    const tok = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const { registro } = await buscarEnAdmin(tok!, body.correo as string);
    expect(registro).not.toBeNull();
    expect("bajaTokenHash" in registro).toBe(false);
  });
});
