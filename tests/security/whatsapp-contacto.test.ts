/**
 * Botones de WhatsApp: eleccion de app, atribucion y no exposicion de numeros.
 *
 * Contexto (2026-10-19): los botones de WhatsApp de la landing NO HACIAN
 * NADA. La causa: el boton pedia `/api/whatsapp/config`, que esta FUERA de
 * `esRutaPublica`, asi que el gate global de `/api` respondia 401; el cliente
 * se queda sin numero y hacia `return` sin avisar. Verificado contra
 * produccion: `GET /api/whatsapp/config` -> HTTP 401.
 *
 * Reglas que este test fija (ver AGENTS.md, "Reglas inquebrantables"):
 *  1. Todo enlace a WhatsApp deja elegir la app.
 *  2. El numero (del bot o de los comercios) no se expone en el HTML, ni en el
 *     bundle, ni en los endpoints publicos: se resuelve en el servidor, en el
 *     momento del clic.
 *  3. El clic queda atribuido a la oferta y NO es facturable (sin telefono del
 *     usuario y sin firma HMAC: solo `/c/:id` factura).
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline } from "./_helpers.ts";
import {
  construirUrlWhatsApp,
  construirMensajeContactoWhatsApp,
  detectarPlataformaDesdeUA,
  normalizarDestino,
  opcionesWhatsAppPorPlataforma,
} from "../../src/utils/whatsappLinks.ts";
import { esIntencionOfertas } from "../../src/utils/securityGuards.ts";

const online = await servidorOnline();
const ROOT = path.resolve(import.meta.dir, "../..");
import { leerTextoServidor } from "./server-code";
const SERVER = leerTextoServidor();
const LANDING = fs.readFileSync(path.join(ROOT, "src/components/PublicWeb.tsx"), "utf8");
const FLUJO = fs.readFileSync(path.join(ROOT, "src/utils/whatsappNative.ts"), "utf8");

describe("WhatsApp - reglas puras de los enlaces", () => {
  test("el destino se normaliza: cualquier valor raro cae en la app", () => {
    expect(normalizarDestino("app")).toBe("app");
    expect(normalizarDestino("business")).toBe("business");
    expect(normalizarDestino("web")).toBe("web");
    expect(normalizarDestino(undefined)).toBe("app");
    expect(normalizarDestino("javascript:alert(1)")).toBe("app");
  });

  test("la plataforma se detecta por user-agent", () => {
    expect(detectarPlataformaDesdeUA("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120 Mobile")).toBe("android");
    expect(detectarPlataformaDesdeUA("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148")).toBe("ios");
    expect(detectarPlataformaDesdeUA("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe("web");
    expect(detectarPlataformaDesdeUA("")).toBe("web");
  });

  test("el destino 'app' usa el esquema nativo (en Android el sistema elige app)", () => {
    const url = construirUrlWhatsApp("app", "android", "51987654321", "Ofertas");
    expect(url.startsWith("whatsapp://send?phone=51987654321")).toBe(true);
    expect(url).toContain("text=Ofertas");
  });

  test("el destino 'business' usa el esquema de WhatsApp Business", () => {
    const url = construirUrlWhatsApp("business", "ios", "+51 987 654 321", "Ofertas");
    expect(url.startsWith("whatsappbusiness://send?phone=51987654321")).toBe(true);
  });

  test("el destino 'web' usa WhatsApp Web", () => {
    const url = construirUrlWhatsApp("web", "web", "51987654321", "Ofertas");
    expect(url.startsWith("https://web.whatsapp.com/send?phone=51987654321")).toBe(true);
  });

  test("sin telefono NO se inventa un enlace (mejor un boton que avisa)", () => {
    expect(construirUrlWhatsApp("app", "android", "", "Ofertas")).toBe("");
    expect(construirUrlWhatsApp("app", "android", "no-es-un-numero", "Ofertas")).toBe("");
  });

  test("Android deja el selector en manos del sistema; iOS y web reciben opciones", () => {
    expect(opcionesWhatsAppPorPlataforma("android").length).toBe(1);
    const ios = opcionesWhatsAppPorPlataforma("ios").map((o) => o.destino);
    expect(ios).toEqual(["app", "business", "web"]);
    const web = opcionesWhatsAppPorPlataforma("web").map((o) => o.destino);
    expect(web).toContain("web");
    expect(web).toContain("app");
    expect(web).toContain("business");
  });

  test("el mensaje al bot SIEMPRE dispara su intencion de pedir ofertas", () => {
    // El bot solo contesta con las ofertas si el mensaje dispara la intencion
    // (ver `esIntencionOfertas`). El mensaje viejo ("Hola quiero aprovechar
    // esta oferta: ...") NO la disparaba: el bot no entendia el pedido.
    const sinOferta = construirMensajeContactoWhatsApp({});
    expect(esIntencionOfertas(sinOferta)).toBe(true);

    const conOferta = construirMensajeContactoWhatsApp({
      titulo: "Bowl Acai Organico + Cafe Pasado",
      ref: "desayuno-verde-bisetti",
      codigoCanje: "NV-PQVAS4",
    });
    expect(esIntencionOfertas(conOferta)).toBe(true);
    expect(conOferta).toContain("Bowl Acai Organico + Cafe Pasado");
    expect(conOferta).toContain("NV-PQVAS4");
  });
});

describe("WhatsApp - no exposicion de numeros", () => {
  test("la landing NO pide el numero a un endpoint protegido", () => {
    // `/api/whatsapp/config` esta fuera de `esRutaPublica`: pedirlo desde la
    // landing devolvia 401 y el boton quedaba muerto.
    expect(LANDING).not.toContain("/api/whatsapp/config");
    expect(FLUJO).not.toContain("/api/whatsapp/config");
    // El destino se pide al endpoint publico, que lo arma en el servidor.
    expect(FLUJO).toContain("/api/whatsapp/contacto");
  });

  test("el endpoint de contacto esta declarado como ruta publica", () => {
    expect(SERVER).toContain('if(rawPath==="/api/whatsapp/contacto"&&m==="GET")return true;');
  });

  test("las ofertas publicas no llevan ningun telefono", async () => {
    if (!online) return;
    const res = await fetch(`${BASE}/api/ofertas`);
    const texto = await res.text();
    // El numero del comercio no puede aparecer en el payload publico.
    expect(texto).not.toMatch(/\+?51\d{8,10}/);
    expect(texto).not.toContain("comercioWhatsapp");
    expect(texto).not.toContain("comercioTelefono");
  });

  test("el modulo de enlaces no toca la base de datos", () => {
    const codigo = fs.readFileSync(path.join(ROOT, "src/utils/whatsappLinks.ts"), "utf8");
    expect(codigo).not.toContain("db/");
    expect(codigo).not.toContain("from \"pg\"");
  });
});

describe.skipIf(!online)("WhatsApp - contacto con el servidor", () => {
  /**
   * Si el bot no tiene numero, el endpoint responde 503 (que es lo correcto:
   * sin destino no hay chat que abrir). Cuando pasa eso, el mensaje de error
   * lo dice: un "Expected 200, Received 503" a secas no ayuda a nadie.
   */
  async function pedirContacto(query: string): Promise<{ res: Response; data: any }> {
    const res = await fetch(`${BASE}/api/whatsapp/contacto?${query}`);
    const data: any = await res.json().catch(() => null);
    if (res.status === 503) {
      throw new Error(
        "El bot no tiene numero de WhatsApp configurado (503). Sin numero el " +
          "endpoint no puede armar el enlace, asi que este test no verifica nada. " +
          "En CI se siembra con `bun scripts/ci/seed-whatsapp-config.mjs`; en local, " +
          "configura un numero en el panel de WhatsApp (o en app_settings.whatsapp_config)."
      );
    }
    return { res, data };
  }

  test("responde sin token (es una ruta publica)", async () => {
    const { res, data } = await pedirContacto("dest=app");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(data.ok).toBe(true);
    expect(String(data.url).startsWith("whatsapp://")).toBe(true);
  });

  test("el destino elegido se respeta", async () => {
    const business: any = (await pedirContacto("dest=business")).data;
    expect(String(business.url).startsWith("whatsappbusiness://")).toBe(true);
    const web: any = (await pedirContacto("dest=web")).data;
    expect(String(web.url).startsWith("https://web.whatsapp.com/")).toBe(true);
  });

  test("una oferta inexistente no se inventa", async () => {
    const res = await fetch(`${BASE}/api/whatsapp/contacto?oferta=oferta_que_no_existe_xyz`);
    expect(res.status).toBe(404);
  });

  test("el tracking devolcido coincide con lo que se registro", async () => {
    const data: any = (await pedirContacto("dest=web")).data;
    expect(data.tracking).toBeDefined();
    expect(data.tracking.destino).toBe("web");
  });
});
