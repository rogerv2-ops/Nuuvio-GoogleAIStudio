/**
 * Los enlaces firmados de oferta (`/c/:id`): elegir la app de WhatsApp y
 * cobrar SOLO cuando la persona entra al chat del comercio.
 *
 * QUE PIDIO EL DUENO (2026-10-21)
 *
 * "necesito que tanto en android como en ios se abra el selector de la app
 * porque muchos tienen whatsapp normal y whatsapp business y por eso es
 * necesario escoger con cual abrir el enlace y cobrar cuando se abre el
 * whatsapp en ambos casos, cuando el usuario llega al whatsapp del comercio
 * se cobra"
 *
 * LAS DOS REGLAS
 *
 * 1. TODO enlace deja elegir la app. Antes el enlace firmado iba a
 *    `https://wa.me/...`, que NO ofrece selector: abria la app directo. Y en
 *    Android el selector del sistema ocurre FUERA de nuestro servidor
 *    (nadie nos avisa cuando la persona elige ahi), asi que la hoja la
 *    sirve el servidor en TODAS las plataformas: la eleccion vuelve como un
 *    request (`dest=`) y ahi se puede cobrar.
 *
 * 2. Se cobra cuando la persona entra al chat del comercio, NO cuando toca
 *    el enlace. Antes el clic se registraba y se debitaba el pack del
 *    comercio en la primera visita, sin que existiera ningun chat. Ahora la
 *    hoja no registra NADA: el clic, el debit y el lead pasan al request con
 *    `dest=`, que es el instante en que la persona entra al chat.
 *
 * LO QUE NO SE ROMPE (y estos tests lo vigilan)
 *
 * - El telefono del comercio NO aparece en el HTML de la hoja (regla 2).
 * - Los tokens viajan intactos: `u` (quien recibe la oferta) y `s` (la firma
 *   HMAC) siguen en la URL, y la ventana de 24 h sigue contando UN clic.
 * - El codigo de canje (`NV-XXXXXX`) sigue viajando en el mensaje al
 *   comercio: es lo que acredita el lead.
 * - La eleccion queda registrada (tracking) en `security_logs`.
 */
import { test, expect, describe } from "bun:test";
import pg from "pg";
import { BASE, servidorOnline, login, ADMIN, crearOfertaDePrueba, conOfertaDePrueba } from "./_helpers.ts";
import { htmlHojaWhatsApp, urlOpcionHoja, escaparHtml } from "../../src/utils/hojaWhatsApp.ts";

const online = await servidorOnline();
const TELEFONO_COMERCIO = "51987654321";

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

const conBase = await hayBase();

let ipSecuencia = 0;
/**
 * IP propia para este archivo.
 *
 * Pool DISTINTO al de `ventana-24h.test.ts` (203.0.113.x): los archivos
 * corren en paralelo y el rate limit de clics es POR IP, asi que compartir
 * pool hacia que los clics de un archivo comieran el cupo del otro y la
 * suite se volviera intermitente.
 */
function ipPropia(): string {
  ipSecuencia += 1;
  return `198.51.100.${(ipSecuencia % 200) + 20}`;
}

let telSecuencia = 0;
/** Telefono propio: las filas de click_logs se atribuyen por telefono. */
function telefonoNuevo(): string {
  telSecuencia += 1;
  return `519${String(Date.now() % 100000000).padStart(8, "0")}${telSecuencia % 10}`;
}

const UA_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
const UA_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const UA_WEB = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Un solo login para todo el archivo.
 *
 * El login tiene un rate limit de 10 por IP cada 5 minutos
 * (`rateLimit("login", 10, 300000)` en `src/routes/auth.ts`): si cada test
 * entra por su cuenta, este archivo se come una parte del cupo de la suite
 * entera y la vuelve intermitente.
 */
let sesionAdmin: string | null = null;
async function tokenAdmin(): Promise<string> {
  if (!sesionAdmin) {
    const t = await login(ADMIN.email, ADMIN.password);
    if (!t) throw new Error("no se pudo iniciar sesion como administrador");
    sesionAdmin = t;
  }
  return sesionAdmin;
}

describe("Hoja de WhatsApp del servidor - reglas puras", () => {
  test("la hoja ofrece las tres destinos y ninguna mas", () => {
    const html = htmlHojaWhatsApp({
      urlBase: "/c/of_test?u=51900000000&s=abc123",
      plataforma: "ios",
      tituloOferta: "Oferta de prueba",
    });
    // CUANTOS destinos, no solo que aparezcan: un destino de mas (o uno que
    // falta) tiene que hacer fallar este test.
    const destinos = [...html.matchAll(/dest=([a-z]+)/g)].map((m) => m[1]);
    expect(destinos.sort()).toEqual(["app", "business", "web"]);
    // Las opciones salen de la MISMA fuente que la hoja del SPA.
    expect(html).toContain("WhatsApp Business");
    expect(html).toContain("WhatsApp Web");
  });

  test("la hoja ofrece las tres destinos tambien en ANDROID", () => {
    // El selector del sistema ocurre fuera de nuestro servidor: si la hoja
    // no ofrece las opciones, la eleccion no vuelve y no se puede cobrar
    // cuando la persona entra al chat.
    const html = htmlHojaWhatsApp({
      urlBase: "/c/of_test?u=51900000000&s=abc123",
      plataforma: "android",
      tituloOferta: "Oferta de prueba",
    });
    const destinos = [...html.matchAll(/dest=([a-z]+)/g)].map((m) => m[1]);
    expect(destinos.sort()).toEqual(["app", "business", "web"]);
  });

  test("la hoja NO lleva el telefono del COMERCIO (regla 2)", () => {
    // El numero del comercio se resuelve en el servidor, en el momento del
    // clic: en la hoja no hay ningun `phone=`.
    const html = htmlHojaWhatsApp({
      urlBase: "/c/of_test?u=51900000000&s=abc123",
      plataforma: "web",
      tituloOferta: "Oferta de prueba",
    });
    expect(html).not.toContain(TELEFONO_COMERCIO);
    expect(html).not.toContain("phone=");
    // El `u` (el telefono de QUIEN recibio la oferta) si aparece: ya esta en
    // la URL que el bot manda, asi que no es exposicion nueva. Lo que no
    // puede aparecer es el numero del comercio.
  });

  test("la hoja escapa el titulo (un comercio puede escribir HTML)", () => {
    const html = htmlHojaWhatsApp({
      urlBase: "/c/of_test",
      plataforma: "web",
      tituloOferta: '<script>alert("x")</script>',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(escaparHtml('a"b&c')).toBe("a&quot;b&amp;c");
  });

  test("los tokens viajan intactos en las opciones de la hoja", () => {
    const url = urlOpcionHoja("/c/of_test?u=51900000000&s=abc123", "business");
    expect(url).toBe("/c/of_test?u=51900000000&s=abc123&dest=business");
    // Sin query previo, agrega el '?'.
    expect(urlOpcionHoja("/c/of_test", "app")).toBe("/c/of_test?dest=app");
  });
});

describe.skipIf(!online)("Enlace de oferta (/c/:id) - elegir app y cobrar al entrar al chat", () => {
  test("en ANDROID responde la hoja con las tres opciones (tambien ahi)", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token, { titulo: "Oferta del selector" }, async (oferta) => {
      const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000`, {
        redirect: "manual",
        headers: { "User-Agent": UA_ANDROID, "X-Forwarded-For": ipPropia() },
      });
      expect(r.status).toBe(200);
      const html = await r.text();
      const destinos = [...html.matchAll(/dest=([a-z]+)/g)].map((m) => m[1]);
      expect(destinos.sort()).toEqual(["app", "business", "web"]);
      // Y el telefono del comercio no esta en el HTML.
      expect(html).not.toContain(TELEFONO_COMERCIO);
    });
  });

  test("en iOS y en la WEB responde la hoja de opciones", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token, { titulo: "Oferta de la hoja" }, async (oferta) => {
      for (const ua of [UA_IOS, UA_WEB]) {
        const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000&s=firma123`, {
          redirect: "manual",
          headers: { "User-Agent": ua, "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-type") || "").toContain("text/html");
        const html = await r.text();
        const destinos = [...html.matchAll(/dest=([a-z]+)/g)].map((m) => m[1]);
        expect(destinos.sort()).toEqual(["app", "business", "web"]);
        // REGLA 2: el telefono del comercio NO esta en el HTML.
        expect(html).not.toContain(TELEFONO_COMERCIO);
        // Y los tokens viajan intactos para que el servidor revalide la firma.
        expect(html).toContain("u=51900000000");
        expect(html).toContain("s=firma123");
        // No se cachea ni se indexa.
        expect(r.headers.get("cache-control") || "").toContain("no-store");
        expect(r.headers.get("x-robots-tag") || "").toContain("noindex");
      }
    });
  });

  test("la persona elige app y el servidor responde con el enlace armado", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token, { titulo: "Oferta del destino" }, async (oferta) => {
      const destinos: Array<[string, string]> = [
        ["business", "whatsappbusiness://send?phone="],
        ["web", "https://web.whatsapp.com/send?phone="],
        ["app", "whatsapp://send?phone="],
      ];
      for (const [dest, prefijo] of destinos) {
        const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000&s=firma&dest=${dest}`, {
          redirect: "manual",
          headers: { "User-Agent": UA_WEB, "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(302);
        const location = String(r.headers.get("location") || "");
        expect(location.startsWith(prefijo)).toBe(true);
        // El codigo de canje viaja en el mensaje.
        expect(decodeURIComponent(location)).toContain("Mi codigo es #NV-");
      }
    });
  });

  test("un destino raro cae en la app (no se inventa un esquema)", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token, { titulo: "Oferta del destino raro" }, async (oferta) => {
      const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000&dest=javascript:alert(1)`, {
        redirect: "manual",
        headers: { "User-Agent": UA_WEB, "X-Forwarded-For": ipPropia() },
      });
      expect(r.status).toBe(302);
      const location = String(r.headers.get("location") || "");
      expect(location.startsWith("whatsapp://send?phone=")).toBe(true);
      expect(location.toLowerCase()).not.toContain("javascript:");
    });
  });
});

describe.skipIf(!online || !conBase)(
  "Enlace de oferta (/c/:id) - se cobra cuando la persona entra al chat",
  () => {
    test("ver la hoja NO registra ningun clic (el comercio no paga por una hoja abierta)", async () => {
      const token = await tokenAdmin();
      const tel = telefonoNuevo();
      await conOfertaDePrueba(token, { titulo: "Oferta sin cobro" }, async (oferta) => {
        const r = await fetch(`${BASE}/c/${oferta.id}?u=${tel}&s=firma`, {
          redirect: "manual",
          headers: { "User-Agent": UA_IOS, "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(200);

        const client = new pg.Client(SQL);
        await client.connect();
        try {
          const filas = await client.query(
            "select count(*)::int as n from click_logs where oferta_id = $1 and usuario_telefono = $2",
            [oferta.id, tel],
          );
          // Ni una fila: nadie pago por una hoja que nadie eligio.
          expect(Number(filas.rows[0].n)).toBe(0);
        } finally {
          await client.end().catch(() => undefined);
        }
      });
    });

    test("elegir app registra UN clic (y el codigo de canje va en el mensaje)", async () => {
      const token = await tokenAdmin();
      const tel = telefonoNuevo();
      await conOfertaDePrueba(token, { titulo: "Oferta con cobro" }, async (oferta) => {
        const r = await fetch(`${BASE}/c/${oferta.id}?u=${tel}&s=firma&dest=business`, {
          redirect: "manual",
          headers: { "User-Agent": UA_IOS, "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(302);
        const location = String(r.headers.get("location") || "");
        const codigo = decodeURIComponent(location).match(/Mi codigo es #([A-Z0-9-]+)/)?.[1] || "";
        expect(codigo).toMatch(/^NV-/);

        const client = new pg.Client(SQL);
        await client.connect();
        try {
          const filas = await client.query(
            "select count(*)::int as n, min(codigo_canje) as codigo from click_logs where oferta_id = $1 and usuario_telefono = $2",
            [oferta.id, tel],
          );
          // UN interes -> UNA fila.
          expect(Number(filas.rows[0].n)).toBe(1);
          // Y el codigo de la fila es el que va en el mensaje al comercio:
          // el comercio puede acreditar el lead con el.
          expect(filas.rows[0].codigo).toBe(codigo);
        } finally {
          await client.end().catch(() => undefined);
        }
      });
    });

    test("tocar dos opciones SIN firma valida NO le cobra nada al comercio (fail-closed)", async () => {
      // Sin la firma HMAC del bot, el enlace no puede facturar: se
      // registraran las filas, pero ninguna sera facturable y no se debita
      // nada del pack. El caso de la firma valida (un solo cobro por
      // interes) lo vigila V2 de `ventana-24h.test.ts`, que usa un enlace
      // firmado de verdad.
      const token = await tokenAdmin();
      const tel = telefonoNuevo();
      await conOfertaDePrueba(token, { titulo: "Oferta con dos toques" }, async (oferta) => {
        for (const dest of ["app", "business"]) {
          const r = await fetch(`${BASE}/c/${oferta.id}?u=${tel}&s=firma&dest=${dest}`, {
            redirect: "manual",
            headers: { "User-Agent": UA_ANDROID, "X-Forwarded-For": ipPropia() },
          });
          expect(r.status).toBe(302);
        }
        const client = new pg.Client(SQL);
        await client.connect();
        try {
          const filas = await client.query(
            "select count(*)::int as n, count(*) filter (where facturable)::int as cobrables from click_logs where oferta_id = $1 and usuario_telefono = $2",
            [oferta.id, tel],
          );
          // Ni una fila facturable: el comercio no paga nada.
          expect(Number(filas.rows[0].cobrables)).toBe(0);
        } finally {
          await client.end().catch(() => undefined);
        }
      });
    });
  },
);
