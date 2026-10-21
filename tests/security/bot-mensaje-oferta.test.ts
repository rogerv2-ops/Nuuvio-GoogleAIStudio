/**
 * El bot tiene que entender el mensaje que manda el boton "Lo quiero" de la
 * web y NO tratar ese texto como una busqueda.
 *
 * Que pasó (2026-10-20, reportado por el dueno): el dueno hizo clic en una
 * oferta de la web y escribio al bot:
 *
 *   Hola, quiero ver las ofertas de Yuddit: Duo de Baos Panceta Glaseada +
 *   Cerveza (ref duo-baos-nikkei-san-isidro). Mi codigo es NV-LDKZKS
 *
 * y recibio:
 *
 *   🔎 Encontramos estas ofertas para hola yuddit duo baos panceta glaseada
 *      + cerveza (ref codigo es nv-ldkzks en San Isidro:
 *   1️⃣ Duo de Baos Panceta Glaseada + Cerveza - S/ 34.00
 *   👇 Elige la oferta que quieres ver:   (mosaico con botones)
 *
 * Tres bugs combinados:
 *
 *  B1. El bot NO reconocia el mensaje del boton. El boton dice
 *      "quiero VER LAS ofertas" y el bot buscaba "quiero [la] oferta".
 *      Como no matchea, cae al flujo de BUSQUEDA generica.
 *  B2. Al buscar, garpa el mensaje entero: el termino quedo
 *      "hola yuddit duo baos ... (ref codigo es nv-ldkzks" y el bot lo
 *      echoa en su respuesta.
 *  B3. El codigo de referido (NV-LDKZKS) NUNCA se registraba: viaja en el
 *      mensaje pero el bot no lo lee en ningun lado, asi que el clic de la
 *      web no se acreditaba a nadie.
 *
 * Estos tests son CONDUCTUALES: mandan el mensaje real al bot (mismo
 * pipeline que Baileys) y miran que responde. La comprobacion de codigo
 * (que el bot no muestre el texto crudo) va sobre la respuesta real.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";
import { construirMensajeContactoWhatsApp } from "../../src/utils/whatsappLinks.ts";
import pg from "pg";

const ROOT = path.resolve(import.meta.dir, "../..");
const WHATSAPP = fs.readFileSync(path.join(ROOT, "src/utils/whatsappLinks.ts"), "utf8");

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

const TITULO = "Dúo de Baos Panceta Glaseada + Cerveza";
const REF = "duo-baos-nikkei-san-isidro";
const DISTRITO = "San Isidro";

function soloDigitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

describe("Bot: el mensaje del boton 'Lo quiero' no se trata como busqueda", () => {
  test("P1: el parser lee titulo, ref y codigo del mensaje del boton", () => {
    // El mensaje que arma el boton (ver whatsappLinks.ts).
    expect(WHATSAPP).toContain("quiero ver las ofertas de Yuddit");

    const mensaje = construirMensajeContactoWhatsApp({
      titulo: TITULO,
      ref: REF,
      codigoCanje: "NV-LDKZKS",
    });
    // Lo que el bot tiene que poder leer de ese mensaje.
    expect(mensaje).toContain("quiero ver las ofertas de Yuddit");
    expect(mensaje).toContain("(ref " + REF + ")");
    expect(mensaje).toContain("Mi codigo es NV-LDKZKS");
  });

  test.skipIf(!online || !hayAdmin)(
    "P2: el bot responde con la OFERTA, no con una busqueda del texto crudo",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      // Oferta de prueba con el mismo `ref` que usa el boton.
      const ofertaId = `of_test_boton_${Date.now()}`;
      const sync = await post(
        "/api/ofertas/sync",
        {
          ofertas: [
            {
              id: ofertaId,
              codigoUrl: REF,
              comercioId: "merch_01",
              comercioNombre: "Bao Bar Nikkei",
              comercioWhatsapp: "+51987654321",
              titulo: TITULO,
              descripcion: "Oferta de prueba del boton Lo quiero",
              categoria: "gastronomia",
              precioNormal: "50",
              precioOferta: "34",
              distrito: DISTRITO,
              estado: "activa",
              venceEn: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
            },
          ],
        },
        token,
      );
      expect(sync.status).toBe(200);

      const tel = telefonoNuevo();
      const mensaje = construirMensajeContactoWhatsApp({
        titulo: TITULO,
        ref: REF,
        codigoCanje: "NV-LDKZKS",
      });
      const res = await post(
        "/api/whatsapp/simulate-incoming",
        { telefono: tel, texto: mensaje, pushName: "Roger Vasquez" },
        token,
      );
      expect(res.status).toBe(200);
      const body: any = await res.json();
      const texto = (body.respuestas || []).map((r: any) => r.texto || "").join(" | ");

      // B1: responde con la OFERTA concreta (confirma zona de la oferta).
      expect(texto).toContain(TITULO);
      expect(texto).toContain(DISTRITO);

      // B2: NO muestra el texto crudo del mensaje. Ni el saludo del boton,
      // ni el codigo de referido, ni el "ref".
      expect(texto).not.toContain("hola yuddit");
      expect(texto).not.toContain("NV-LDKZKS");
      expect(texto).not.toContain("nv-ldkzks");
      expect(texto).not.toContain(REF);
      // Y NO es una busqueda ("Encontramos estas ofertas para ...").
      expect(texto).not.toContain("Encontramos estas ofertas para");

      // B4: tras confirmar la zona, la oferta sale con el ENLACE firmado
      // EN EL TEXTO, no con un boton.
      //
      // Antes decia "Toca el boton de abajo" y mandaba un boton CTA. Baileys
      // v7 descarta los botones EN SILENCIO (el texto sale, el boton no, y no
      // hay error), asi que la persona recibia la oferta y no tenia como
      // abrirla: cero forma de llegar al comercio.
      const confirm = await post(
        "/api/whatsapp/simulate-incoming",
        { telefono: tel, texto: "sí", pushName: "Roger Vasquez" },
        token,
      );
      expect(confirm.status).toBe(200);
      const bodyConfirm: any = await confirm.json();
      const textoOferta = (bodyConfirm.respuestas || []).map((r: any) => r.texto || "").join(" | ");

      expect(textoOferta).toContain(TITULO);
      const enlace = (textoOferta.match(/https?:\/\/\S+\/c\/[^\s]+/) || [])[0] || "";
      expect(enlace).toContain(`/c/${ofertaId}`);
      expect(enlace).toContain("u=");
      // La firma HMAC es lo que hace FACTURABLE el clic: sin ella el enlace
      // abre igual pero no se cobra. Tiene que venir.
      expect(enlace).toMatch(/[?&]s=[A-Za-z0-9_-]{8,}/);
      // Y no puede seguir prometiendo un boton que no existe.
      expect(textoOferta).not.toContain("Toca el botón de abajo");
    },
  );

  test.skipIf(!online || !hayAdmin || !conBase)(
    "P3: el codigo de referido del mensaje se atribuye al comercio del clic",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const lista = await get("/api/ofertas", token);
      const cuerpo: any = await lista.json();
      const ofertas: any[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo.ofertas || cuerpo.data || []);
      const oferta = ofertas.find((o: any) => o.codigoUrl === REF);
      expect(oferta).toBeTruthy();

      // El clic de la web se registro como "anonimo" con este codigo: eso
      // es lo que el bot tiene que completar cuando la persona escribe.
      const codigo = `NV-TEST${Date.now() % 1000000}`;
      const client = new pg.Client(SQL);
      await client.connect();
      try {
        await client.query(
          `insert into click_logs (id,oferta_id,comercio_id,usuario_telefono,codigo_canje,facturable,creado_en)
           values ($1,$2,$3,'anonimo',$4,false,now())
           on conflict (id) do update set usuario_telefono='anonimo', codigo_canje=$4, facturable=false`,
          [`clk_test_${Date.now()}`, oferta.id, oferta.comercioId || "merch_01", codigo],
        );

        const tel = telefonoNuevo();
        const mensaje = construirMensajeContactoWhatsApp({
          titulo: TITULO,
          ref: REF,
          codigoCanje: codigo,
        });
        const res = await post(
          "/api/whatsapp/simulate-incoming",
          { telefono: tel, texto: mensaje, pushName: "Lead Referido" },
          token,
        );
        expect(res.status).toBe(200);

        // B3: el click "anonimo" ahora tiene el telefono de la persona.
        const fila = await client.query(
          "select usuario_telefono, comercio_id, facturable from click_logs where codigo_canje=$1",
          [codigo],
        );
        expect(fila.rows.length).toBe(1);
        expect(fila.rows[0].usuario_telefono).not.toBe("anonimo");
        expect(fila.rows[0].usuario_telefono).toContain(soloDigitos(tel).slice(-9));
        expect(fila.rows[0].comercio_id).toBe(oferta.comercioId || "merch_01");
        // Y NO se debita saldo con este camino: solo los enlaces firmados
        // (/c/:id?u=&s=) facturan.
        expect(fila.rows[0].facturable).toBe(false);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );

  test.skipIf(!online || !hayAdmin || !conBase)(
    "P4: el mismo interes NO se cuenta dos veces (clics y leads de la oferta)",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const ofertaId = `of_test_dc_${Date.now()}`;
      const codigoUrl = `test-dc-${Date.now()}`;
      await post(
        "/api/ofertas/sync",
        {
          ofertas: [
            {
              id: ofertaId,
              codigoUrl,
              comercioId: "merch_01",
              comercioNombre: "Prueba",
              comercioWhatsapp: "+51987654321",
              titulo: "Oferta Prueba Doble Conteo",
              categoria: "gastronomia",
              precioNormal: "50",
              precioOferta: "30",
              distrito: DISTRITO,
              estado: "activa",
              venceEn: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
            },
          ],
        },
        token,
      );

      // 1) El clic en la web ("Lo quiero"): el servidor lo registra como
      //    "anonimo" y devuelve el codigo de canje.
      const resContacto = await fetch(
        `${BASE}/api/whatsapp/contacto?oferta=${ofertaId}&dest=app`,
        { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" } },
      );
      const contacto: any = await resContacto.json();
      const codigo = String(contacto?.tracking?.codigoCanje || "");
      expect(codigo).toMatch(/^NV-[A-Z0-9]{6}$/);

      // 2) La persona escribe al bot con ese codigo.
      const tel = telefonoNuevo();
      await post(
        "/api/whatsapp/simulate-incoming",
        {
          telefono: tel,
          texto: construirMensajeContactoWhatsApp({
            titulo: "Oferta Prueba Doble Conteo",
            ref: codigoUrl,
            codigoCanje: codigo,
          }),
          pushName: "Test",
        },
        token,
      );

      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const antes = await client.query(
          "select clics, leads_calificados from offers where id=$1",
          [ofertaId],
        );
        const clicsTrasMensaje = Number(antes.rows[0]?.clics || 0);
        const leadsTrasMensaje = Number(antes.rows[0]?.leads_calificados || 0);

        // El clic de la web se ATRIBUYE (ya no es "anonimo")...
        const atrib = await client.query(
          "select usuario_telefono from click_logs where codigo_canje=$1",
          [codigo],
        );
        expect(atrib.rows.length).toBe(1);
        expect(atrib.rows[0].usuario_telefono).not.toBe("anonimo");

        // ...pero NO suma un clic ni un lead de la oferta: el contador sube
        // UNA sola vez, en el camino facturable (/c/:id con firma). Si se
        // sumara aqui, la misma persona contaria 2 clics y 2 leads, y el
        // comercio pagaria por un solo interes real.
        expect(clicsTrasMensaje).toBe(0);
        expect(leadsTrasMensaje).toBe(0);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );
});

/**
 * El motor de WhatsApp (Baileys v7) YA NO manda botones interactivos.
 *
 * Que paso (2026-10-21, reportado por el dueno): el bot respondio con la
 * oferta y el texto "Toca el boton de abajo", pero el boton nunca llego.
 *
 * La causa no era un error de envio: `templateButtons` y `buttons` no
 * existen en el tipo `AnyMessageContent` de Baileys v7. La libreria toma el
 * `text` (valido) e IGNORA el resto de la llave. Resultado: mensaje enviado,
 * ninguna excepcion, y el enlace que factura se pierde en el camino.
 *
 * Regla que deja este incidente: todo enlace accionable va EN EL TEXTO.
 * WhatsApp lo linkifica solo. Un boton es opcional; un enlace que no llega
 * es un lead que no existe.
 */
describe("El envio por Baileys no depende de botones que el motor descarta", () => {
  const SERVER = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");

  test("no se le piden botones a Baileys (v7 los ignora en silencio)", () => {
    expect(SERVER).not.toContain("templateButtons");
    // La unica llave `buttons:` que queda es la de Meta Cloud API, que si
    // soporta botones (`cta_url` / `reply`). Si aparece otra, es Baileys.
    const botonesMeta = SERVER.match(/action:\{buttons:/g) || [];
    const todas = SERVER.match(/buttons:/g) || [];
    expect(todas.length).toBe(botonesMeta.length);
    expect(SERVER).toContain("cta_url");
  });

  test("el bot avisa en el log si alguien intenta mandar un boton por Baileys", () => {
    // No basta con no usarlos: si alguien los vuelve a usar, el log tiene que
    // decirlo. El bug original fue justamente un silencio.
    expect(SERVER).toContain("'buttons' ignorado");
    expect(SERVER).toContain("'interactiveButton' ignorado");
  });

  test("la oferta y el mosaico llevan el enlace /c/ dentro del texto", () => {
    // El enlace firmado es el unico camino que factura (regla de cobro).
    const oferta = SERVER.slice(
      SERVER.indexOf("async function enviarOfertaEspecifica"),
      SERVER.indexOf("__name(enviarOfertaEspecifica"),
    );
    expect(oferta).toContain("${trackingUrl}");
    // El mosaico calculaba el trackingUrl y no lo usaba en el caption: las
    // ofertas se veian y no se podian abrir.
    const mosaico = SERVER.slice(
      SERVER.indexOf("combinedCaption +="),
      SERVER.indexOf("Responde con *Más ofertas*"),
    );
    expect(mosaico).toContain("trackingUrl");
  });
});
