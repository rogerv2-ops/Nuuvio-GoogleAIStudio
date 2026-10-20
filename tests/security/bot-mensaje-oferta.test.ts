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
});
