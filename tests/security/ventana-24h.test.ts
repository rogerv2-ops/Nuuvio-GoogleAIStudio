/**
 * La ventana de 24h del bot: no repetir ofertas y no contar dos veces el
 * mismo clic.
 *
 * Que reporto el dueno (2026-10-21): "el flujo del sistema al envia las
 * ofertas indica de forma critica que no puede enviar las mismas ofertas que
 * ya le envio a un usuario en una ventana de 24 horas, y el clic tampoco se
 * vuelve a contar en esa ventana".
 *
 * LO QUE SE MEDIO ANTES DE ARREGLARLO
 *
 * 1. El bot reenviaba las mismas ofertas. El filtro usaba
 *    `user.utm.vistasIds` (una lista SIN fecha de "vistas alguna vez") y
 *    cuando no quedaban ofertas nuevas hacia un RESET que volvia a mandar
 *    todo. Medido: tres pedidos seguidos de "ofertas" -> la misma oferta las
 *    tres veces.
 *
 * 2. El clic se contaba N veces. `oferta.clics` sumaba en cada clic,
 *    incluso los repetidos, y `registerOfferClick` insertaba una fila por
 *    clic (no por interes). Medido: tres clics de la misma persona en 24
 *    segundos -> TRES filas en click_logs, tres codigos de canje distintos y
 *    la oferta con +3 clics.
 *
 * 3. De paso: la tabla `eventos` guardaba el telefono en texto plano en
 *    `actor_id` (la audiencia lo cifra y usa un indice ciego). El
 *    `actor_id` ahora es el indice ciego, y las filas que ya estaban se
 *    sanean al arrancar.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";
import pg from "pg";

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

let ipSecuencia = 0;
function ipPropia(): string {
  ipSecuencia += 1;
  return `203.0.113.${190 + (ipSecuencia % 9)}`;
}

async function simular(token: string, telefono: string, texto: string): Promise<string> {
  const r = await post(
    "/api/whatsapp/simulate-incoming",
    { telefono, texto, pushName: "Ventana 24h" },
    token,
    { "X-Forwarded-For": ipPropia() },
  );
  expect(r.status).toBe(200);
  const j: any = await r.json();
  return (j.respuestas || []).map((x: any) => x.texto || "").join("\n");
}

function titulosOfertas(texto: string): string[] {
  return (texto.match(/\d️⃣ \*([^*]+)\*/g) || []).map((s) =>
    s.replace(/\d️⃣ \*/g, "").replace(/\*/g, ""),
  );
}

describe("Ventana de 24h: no repetir ofertas y no contar dos veces el clic", () => {
  test.skipIf(!online || !hayAdmin)(
    "V1: el bot NO reenvia las mismas ofertas dentro de la ventana",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const tel = telefonoNuevo();
      await simular(token!, tel, "hola");
      const primera = await simular(token!, tel, "Carlos, 28, Miraflores");
      const vistas = titulosOfertas(primera);
      expect(vistas.length).toBeGreaterThan(0);

      // La segunda vez, en la ventana: no se repite ninguna.
      const segunda = await simular(token!, tel, "ofertas");
      for (const titulo of vistas) {
        expect(segunda, `repitio "${titulo}"`).not.toContain(titulo);
      }
      // Y lo dice con franqueza (decision del dueno).
      expect(segunda).toContain("Ya te mostré todas las ofertas");
      expect(segunda.toLowerCase()).toContain("unas horas");
    },
  );

  test.skipIf(!online || !hayAdmin || !conBase)(
    "V2: el clic NO se cuenta dos veces en la ventana",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      const tel = telefonoNuevo();

      await simular(token!, tel, "hola");
      const mosaic = await simular(token!, tel, "Carlos, 28, Miraflores");
      const enlaces = [...mosaic.matchAll(/https?:\/\/\S+\/c\/\S+/g)].map((m) => m[0]);
      expect(enlaces.length).toBeGreaterThan(0);
      const enlace = enlaces[0];
      const ofertaId = enlace.match(/\/c\/([^?]+)/)![1];

      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const antes = await client.query(
          "select coalesce(sum(clics),0)::int as c from offers where id = $1",
          [ofertaId],
        );

        // Tres clics del mismo enlace, con la misma persona.
        for (let i = 0; i < 3; i++) {
          const r = await fetch(enlace, { redirect: "manual" });
          expect(r.status).toBe(302);
        }

        const filas = await client.query(
          "select facturable, codigo_canje from click_logs where usuario_telefono = $1 and oferta_id = $2 order by creado_en",
          [tel.replace(/\D/g, ""), ofertaId],
        );
        // UN interes -> UNA fila (antes: tres).
        expect(filas.rows.length).toBe(1);
        // Y el mismo codigo de canje (no tres distintos).
        expect(filas.rows[0].codigo_canje).toBeTruthy();

        const despues = await client.query(
          "select coalesce(sum(clics),0)::int as c from offers where id = $1",
          [ofertaId],
        );
        // El contador de la oferta sube UNA vez, no tres.
        expect(Number(despues.rows[0].c) - Number(antes.rows[0].c)).toBe(1);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );

  test.skipIf(!online || !hayAdmin || !conBase)(
    "V3: los eventos guardan el indice ciego, no el telefono",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      const tel = telefonoNuevo();
      await simular(token!, tel, "hola");
      await simular(token!, tel, "Carlos, 28, Miraflores");

      const client = new pg.Client(SQL);
      await client.connect();
      try {
        const r = await client.query(
          "select actor_id from eventos where tipo_evento = 'oferta_mostrada' order by creado_en desc limit 5",
        );
        expect(r.rows.length).toBeGreaterThan(0);
        for (const fila of r.rows) {
          const actor = String(fila.actor_id || "");
          // Un indice ciego: 64 hex. Un telefono: 9-15 digitos.
          expect(actor).toMatch(/^[0-9a-f]{64}$/);
          expect(actor).not.toMatch(/^\d{9,15}$/);
        }
        // Y en toda la tabla no queda ningun actor que sea un telefono.
        const planos = await client.query(
          "select count(*)::int as n from eventos where actor_id ~ '^\\d{9,15}$'",
        );
        expect(Number(planos.rows[0].n)).toBe(0);
      } finally {
        await client.end().catch(() => undefined);
      }
    },
  );

  test.skipIf(!online || !hayAdmin)(
    "V4: una peticion EXPLICITA siempre se responde (la ventana es del envio proactivo)",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      const tel = telefonoNuevo();
      await simular(token!, tel, "hola");
      const mosaic = await simular(token!, tel, "Carlos, 28, Miraflores");
      const ofertaTitulo = titulosOfertas(mosaic)[0];

      // La persona vuelve a pedir ESA oferta por el flujo del boton: se
      // responde (es una peticion suya), aunque ya se la habiamos mandado.
      const otra = await simular(token!, tel, `quiero ver las ofertas de Yuddit: ${ofertaTitulo}`);
      expect(otra).toContain(ofertaTitulo);
    },
  );
});
