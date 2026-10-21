/**
 * El enlace firmado de oferta (`/c/:id`): lleva DIRECTO al chat del comercio.
 *
 * DECISIÓN DEL DUEÑO (2026-10-21)
 *
 * "se supone que la persona solo debe recibir el enlace con todos los datos
 * ofuscados por seguridad, y el enlace lo debe llevar al whatsapp del
 * comercio directo, ya estan en whatsapp ambos, no necesitan escojer app"
 *
 * O sea: la persona recibe SOLO un enlace, con los datos ofuscados (la firma
 * HMAC; el teléfono del comercio NO va en el enlace), y el enlace lo lleva
 * directo al chat del comercio. El selector de app y el cobro por canje con
 * código QR son proyectos aparte.
 *
 * Un intento anterior de poner un selector de app en este enlace se revirtió:
 * en iOS el sistema no ofrece selector, y en Android el selector nativo ocurre
 * fuera de nuestro servidor (nadie nos avisa cuando la persona elige ahí).
 *
 * LO QUE ESTOS TESTS VIGILAN
 *
 *  1. El enlace va DIRECTO al chat del comercio (un 302 a `wa.me` con el
 *     teléfono del comercio y el código de canje en el mensaje).
 *  2. El enlace que el bot manda en el texto de WhatsApp NO lleva el
 *     teléfono del comercio: los datos del comercio se resuelven en el
 *     servidor, en el momento del clic (regla 2).
 *  3. Sin firma HMAC válida NO se cobra nada (fail-closed), aunque el enlace
 *     siga llevando al chat.
 *  4. El código de canje viaja en el mensaje: es lo que acredita el lead.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { BASE, servidorOnline, login, ADMIN, crearOfertaDePrueba, conOfertaDePrueba } from "./_helpers.ts";

const online = await servidorOnline();
const TELEFONO_COMERCIO = "51987654321";
const ROOT = path.resolve(import.meta.dir, "../..");
const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");

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

describe("Enlace firmado de oferta - el link NO expone los datos del comercio", () => {
  test("el enlace que arma el bot NO lleva el telefono del comercio", () => {
    // El bot arma el enlace con el id de la oferta, el telefono de QUIEN
    // recibe la oferta y la firma HMAC. El telefono del COMERCIO se resuelve
    // en el servidor, en el momento del clic (regla 2): si fuera en el
    // enlace, cualquier persona que lo viera tendria el numero del comercio.
    const i = SERVER.indexOf('const trackingUrl =');
    expect(i).toBeGreaterThan(-1);
    const linea = SERVER.slice(i, i + 400);
    expect(linea).toContain("/c/");
    expect(linea).toContain("u=");
    expect(linea).toContain("s=");
    // Y nada de telefono del comercio en el enlace.
    expect(linea).not.toMatch(/comercioWhatsapp|comercioTelefono|telefonoComercio/);
  });

  test("la ruta /c/:id NO ofrece selector de app (va directo al chat)", () => {
    // Decisión del dueño: la persona ya está en WhatsApp, no necesita
    // escoger app. La ruta redirige al chat del comercio.
    const i = SERVER.indexOf('app.get("/c/:ofertaId"');
    expect(i).toBeGreaterThan(-1);
    const ruta = SERVER.slice(i, i + 3000);
    expect(ruta).toContain("wa.me/");
    // Sin selector: ni hoja, ni parametro de destino.
    expect(ruta).not.toContain("dest=");
    expect(ruta).not.toContain("htmlHojaWhatsApp");
  });
});

describe.skipIf(!online)("Enlace de oferta (/c/:id) - lleva directo al chat del comercio", () => {
  test("responde 302 al chat del comercio con el codigo de canje en el mensaje", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token, { titulo: "Oferta del enlace directo" }, async (oferta) => {
      const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000&s=firma`, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile", "X-Forwarded-For": ipPropia() },
      });
      expect(r.status).toBe(302);
      const location = String(r.headers.get("location") || "");
      // Al chat del comercio.
      expect(location.startsWith(`https://wa.me/${TELEFONO_COMERCIO}?text=`)).toBe(true);
      // Y el codigo de canje en el mensaje: es lo que acredita el lead.
      expect(decodeURIComponent(location)).toContain("Mi codigo es #NV-");
      // El mensaje lleva el titulo de la oferta.
      expect(decodeURIComponent(location)).toContain("Oferta del enlace directo");
    });
  });

  test("sin firma valida NO se cobra nada (fail-closed), pero el enlace abre el chat", async () => {
    const token = await tokenAdmin();
    const tel = telefonoNuevo();
    await conOfertaDePrueba(token, { titulo: "Oferta sin firma" }, async (oferta) => {
      const r = await fetch(`${BASE}/c/${oferta.id}?u=${tel}&s=firmaInventada`, {
        redirect: "manual",
        headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile", "X-Forwarded-For": ipPropia() },
      });
      // El enlace sigue llevando al chat (la persona no se queda sin salida).
      expect(r.status).toBe(302);
      expect(String(r.headers.get("location") || "")).toContain("wa.me/");

      if (!conBase) return;
      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const filas = await client.query(
          "select count(*) filter (where facturable)::int as cobrables from click_logs where oferta_id = $1 and usuario_telefono = $2",
          [oferta.id, tel],
        );
        // Ni una fila facturable: sin la firma del bot, nadie paga.
        expect(Number(filas.rows[0].cobrables)).toBe(0);
      } finally {
        await client.end().catch(() => undefined);
      }
    });
  });
});
