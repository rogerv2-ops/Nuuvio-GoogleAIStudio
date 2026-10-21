/**
 * La zona de servicio es la PROVINCIA, y la geolocalizacion es
 * provincia -> distrito.
 *
 * Lo pidio el dueno (2026-10-21):
 *  - "lo normal es Provincia-Distrito, cada provincia tiene su lista de
 *     distritos y en todo listado de geolocalizacion funciona primero se
 *     despliega Provincia y un sub menu con los distritos".
 *  - "necesito un activador de provincias en el panel de gestion, para ir
 *     activando a medida que yuddit se expande, pero solo por provincias es
 *     necesario".
 *
 * Y el punto 3 de su lista: el bot debe ofrecer las ofertas de la ZONA
 * (la provincia encendida), no las del distrito exacto.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";
import pg from "pg";

const ROOT = path.resolve(import.meta.dir, "../..");

const SQL = {
  host: process.env.SQL_HOST || "127.0.0.1",
  user: process.env.SQL_USER || "postgres",
  password: process.env.SQL_PASSWORD || "test",
  database: process.env.SQL_DB_NAME || "yuddit_test",
};

async function hayBase(): Promise<boolean> {
  const client = new pg.Client(SQL);
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);
const conBase = await hayBase();

let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

function ipPropia(): string {
  secuencia += 1;
  return `203.0.113.${170 + (secuencia % 20)}`;
}

async function simular(token: string, telefono: string, texto: string): Promise<string> {
  const r = await post(
    "/api/whatsapp/simulate-incoming",
    { telefono, texto, pushName: "Zona Tester" },
    token,
    { "X-Forwarded-For": ipPropia() },
  );
  expect(r.status).toBe(200);
  const j: any = await r.json();
  return (j.respuestas || []).map((x: any) => x.texto || "").join("\n");
}

describe("Zonas: la provincia manda, el distrito se elige dentro de ella", () => {
  test("Z1: el bot ofrece las ofertas de la PROVINCIA, no solo del distrito exacto", async () => {
    if (!online || !hayAdmin) return;
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    // Catalogo de prueba: dos ofertas en distritos DISTINTOS de la misma
    // provincia (la de Lima, que esta encendida). El sync reemplaza el
    // catalogo, asi que el test es autonomo.
    const oferta = (id: string, titulo: string, distrito: string, comercio: string) => ({
      id,
      codigoUrl: `zona-${id}`,
      comercioId: comercio,
      comercioNombre: `Comercio ${distrito}`,
      comercioWhatsapp: "+51987654321",
      titulo,
      descripcion: "Oferta de prueba de zona",
      tipo: "descuento_porcentaje",
      precioNormal: "50",
      precioOferta: "30",
      stock: 10,
      categoria: "Gastronomia y Cafe",
      distrito,
      provincia: "Lima",
      lat: "-12.12",
      lng: "-77.03",
      imagenes: [],
      venceEn: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
      estado: "activa",
      likes: 0,
      vistas: 0,
      clics: 0,
      leadsCalificados: 0,
    });
    const sync = await post(
      "/api/ofertas/sync",
      {
        ofertas: [
          oferta(`of_zona_a_${Date.now()}`, "Oferta Zona Miraflores", "Miraflores", "merch_01"),
          oferta(`of_zona_b_${Date.now()}`, "Oferta Zona Barranco", "Barranco", "merch_02"),
        ],
      },
      token,
    );
    expect(sync.status).toBe(200);

    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    const res = await simular(token!, tel, "Carlos, 28, Miraflores");

    // La persona en Miraflores tiene que ver tambien la oferta de
    // Barranco: es la misma provincia, la misma zona de servicio.
    expect(res).toContain("Oferta Zona Miraflores");
    expect(res).toContain("Oferta Zona Barranco");
  });

  test("Z2: en una provincia NO encendida, el bot lo dice y no manda ofertas de otra zona", async () => {
    if (!online || !hayAdmin) return;
    const token = await login(ADMIN.email, ADMIN.password);

    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    const res = await simular(token!, tel, "Carlos, 28, Arequipa");

    // La verdad: todavia no operamos ahi.
    expect(res).toContain("Todavía no operamos");
    expect(res).toContain("Arequipa");
    // Y NO le manda las ofertas de Lima como si fueran suyas.
    expect(res).not.toContain("/c/");
  });

  test.skipIf(!online || !hayAdmin || !conBase)(
    "Z3: la audiencia guarda el CODIGO del distrito y de la provincia",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      const tel = telefonoNuevo();
      await simular(token!, tel, "hola");
      await simular(token!, tel, "Carlos, 28, Miraflores");

      // El telefono esta CIFRADO en la base, asi que no se puede buscar por
      // SQL: se usa la API de administracion, que lo descifra.
      const res = await get("/api/audience/users", token);
      expect(res.status).toBe(200);
      const cuerpo: any = await res.json();
      const lista: any[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo.users || cuerpo.data || []);
      const digitos = tel.replace(/\D/g, "");
      const mio = lista.find((u: any) =>
        String(u.telefono || "").replace(/\D/g, "").endsWith(digitos.slice(-9)),
      );
      expect(mio).toBeTruthy();
      expect(mio.distrito).toBe("Miraflores");
      // El codigo ubigeo: 150122 = Miraflores, 150100 = provincia de Lima.
      expect(mio.distritoCodigo).toBe("150122");
      expect(mio.provinciaCodigo).toBe("150100");
    },
  );

  test("Z4: no queda ninguna lista de distritos escrita a mano", () => {
    const archivos = [
      "src/data/seedData.ts",
      "src/components/UserRegistrationFunnelModal.tsx",
      "src/components/PublicWeb.tsx",
      "src/components/gestion/views/ComerciosDomainView.tsx",
      "src/components/gestion/views/UsuariosDomainView.tsx",
      "src/components/gestion/views/AnaliticaDomainView.tsx",
      "src/components/gestion/views/OfertasDomainView.tsx",
      "src/components/gestion/views/ComunicacionesDomainView.tsx",
      "src/components/AdminRechartsDashboard.tsx",
    ];
    for (const a of archivos) {
      const texto = fs.readFileSync(path.join(ROOT, a), "utf8");
      expect(texto, `${a} todavia usa la lista escrita a mano`).not.toContain("DISTRITOS_LIMA");
    }
  });

  test("Z5: el selector es provincia -> distrito (el distrito depende de la provincia)", () => {
    const selector = fs.readFileSync(
      path.join(ROOT, "src/components/common/SelectorProvinciaDistrito.tsx"),
      "utf8",
    );
    expect(selector).toContain("provincia");
    expect(selector).toContain("distrito");
    // El distrito no se puede elegir sin provincia.
    expect(selector).toContain("disabled={!provincia}");
    // Y las opciones vienen de la API, no de una lista.
    expect(selector).toContain("cargarDistritos");
  });
});
