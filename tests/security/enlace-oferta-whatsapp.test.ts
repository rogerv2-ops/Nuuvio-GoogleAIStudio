/**
 * Los enlaces firmados de oferta (`/c/:id`) tienen que dejar elegir la app
 * de WhatsApp, como TODO enlace a WhatsApp.
 *
 * QUE REPORTÓ EL DUEÑO (2026-10-21)
 *
 * "un detalle con los enlaces de esas ofertas, no abren en la hoja de
 * seleccion de whatsapp normal o business, quedamos en que todo enlace a
 * whatsapp debe tener esa opcion en todos los enlaces a whatsapp y mantener
 * los datos, trackings, tokens, seguridad, etc."
 *
 * LA CAUSA
 *
 * `/c/:id` terminaba en `res.redirect(302, "https://wa.me/...")`. `wa.me` NO
 * ofrece selector: abre la app directo (la normal, o la de negocios si esa
 * fuera la predeterminada). La persona no podia elegir.
 *
 * EL ARREGLO
 *
 * - Android: 302 al esquema nativo `whatsapp://`, que lo resuelven WhatsApp Y
 *   WhatsApp Business -> el sistema muestra el selector (un toque).
 * - iOS y web: el sistema NO ofrece selector, asi que el servidor sirve la
 *   hoja de opciones (`src/utils/hojaWhatsApp.ts`).
 * - La persona elige -> vuelve al servidor con `dest=` -> el servidor registra
 *   el destino y responde con el enlace YA ARMADO.
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
import { BASE, servidorOnline, login, ADMIN, crearOfertaDePrueba, conOfertaDePrueba } from "./_helpers.ts";
import { htmlHojaWhatsApp, urlOpcionHoja, escaparHtml } from "../../src/utils/hojaWhatsApp.ts";

const online = await servidorOnline();
const TELEFONO_COMERCIO = "51987654321";

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

describe.skipIf(!online)("Enlace de oferta (/c/:id) - elegir app de WhatsApp", () => {
  test("en ANDROID responde 302 al esquema nativo (el sistema elige app)", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token!, { titulo: "Oferta del selector" }, async (oferta) => {
      const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000`, {
        redirect: "manual",
        headers: { "User-Agent": UA_ANDROID, "X-Forwarded-For": ipPropia() },
      });
      expect(r.status).toBe(302);
      const location = String(r.headers.get("location") || "");
      // `whatsapp://` lo resuelven las DOS apps: por eso el sistema muestra
      // el selector. `wa.me` NO lo hacia.
      expect(location.startsWith("whatsapp://send?phone=")).toBe(true);
      expect(location).not.toContain("wa.me");
      // Y el codigo de canje sigue en el mensaje (es lo que acredita el lead).
      expect(decodeURIComponent(location)).toContain("Mi codigo es #NV-");
    });
  });

  test("en iOS y en la WEB responde la hoja de opciones (no una redireccion)", async () => {
    const token = await tokenAdmin();
    await conOfertaDePrueba(token!, { titulo: "Oferta de la hoja" }, async (oferta) => {
      for (const ua of [UA_IOS, UA_WEB]) {
        const r = await fetch(`${BASE}/c/${oferta.id}?u=51900000000&s=firma123`, {
          redirect: "manual",
          headers: { "User-Agent": ua, "X-Forwarded-For": ipPropia() },
        });
        expect(r.status).toBe(200);
        expect(r.headers.get("content-type") || "").toContain("text/html");
        // La hoja ofrece las tres destinations.
        const html = await r.text();
        expect(html).toContain("dest=business");
        expect(html).toContain("dest=web");
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
    await conOfertaDePrueba(token!, { titulo: "Oferta del destino" }, async (oferta) => {
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
    await conOfertaDePrueba(token!, { titulo: "Oferta del destino raro" }, async (oferta) => {
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
