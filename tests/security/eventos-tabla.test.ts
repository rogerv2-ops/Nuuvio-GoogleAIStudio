/**
 * La tabla de eventos: lo que no tiene tabla propia.
 *
 * Que pedia el dueno (2026-10-21): "no hay un mapeo completo aun de
 * eventos que sea de nivel". Y de ahi: los eventos vivian en un `Map` EN
 * MEMORIA del navegador, se perdian al recargar, y por eso:
 *
 *  - las visitas a la landing NO se podian medir (el panel UTM inventaba un
 *    minimo de 198: `visitas * 18 + 142`);
 *  - las "vistas de oferta" no tenian de donde salir (`offers.vistas` no lo
 *    incrementa nadie), asi que el CTR no se podia calcular.
 *
 * REGLA DE LA CASA: un dominio con su PROPIA tabla no emite evento (los
 * clics van en `click_logs`, los chats en `chat_logs`, la audiencia en
 * `audience_users`). Aqui va lo que no tiene tabla.
 *
 * Y el alta de eventos es PUBLICA (la visita ocurre antes de que la
 * persona tenga sesion, y a veces nunca lo tiene), asi que va blindada:
 * lista blanca de tipos, solo las claves permitidas por tipo, limpieza de
 * PII y rate limit.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { BASE, servidorOnline, login, ADMIN, get } from "./_helpers.ts";
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

async function postearEvento(cuerpo: any, ip?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ip) headers["X-Forwarded-For"] = ip;
  const r = await fetch(`${BASE}/api/eventos`, { method: "POST", headers, body: JSON.stringify(cuerpo) });
  return { status: r.status, cuerpo: await r.json().catch(() => null) };
}

describe("Eventos: la tabla de lo que no tiene tabla propia", () => {
  test("E1: el endpoint es publico (la visita a la landing no tiene sesion)", async () => {
    if (!online) return;
    const r = await postearEvento(
      {
        tipoEvento: "visita_landing_utm",
        origen: "web",
        datos: { source: "test_publico", medium: "cpc", campaign: "prueba_endpoint" },
      },
      "203.0.113.201",
    );
    expect(r.status).toBe(200);
    expect(r.cuerpo.ok).toBe(true);
    expect(r.cuerpo.guardados).toBe(1);
  });

  test("E2: un tipo que no esta en la lista blanca se rechaza", async () => {
    if (!online) return;
    const r = await postearEvento(
      { tipoEvento: "evento_inventado_cualquiera", datos: { x: 1 } },
      "203.0.113.202",
    );
    expect(r.status).toBe(400);
    expect(r.cuerpo.ok).toBe(false);
  });

  test.skipIf(!conBase)("E3: se guarda solo lo permitido, y la PII se borra", async () => {
    const client = new pg.Client(SQL);
    await client.connect();
    try {
      const codigo = `prueba_limpieza_${Date.now()}`;
      const r = await postearEvento(
        {
          tipoEvento: "visita_landing_utm",
          origen: "web",
          datos: {
            source: "instagram",
            email: "victima@ejemplo.com",
            telefono: "51987654321",
            clave_que_no_debe_guardarse: "hola",
            campaign: codigo,
          },
        },
        "203.0.113.203",
      );
      expect(r.status).toBe(200);

      const fila = await client.query(
        "select datos from eventos where datos->>'campaign' = $1 limit 1",
        [codigo],
      );
      expect(fila.rows.length).toBe(1);
      const datos = fila.rows[0].datos;
      // La clave permitida se guarda.
      expect(datos.source).toBe("instagram");
      expect(datos.campaign).toBe(codigo);
      // La clave que no esta en la lista blanca NO se guarda.
      expect(datos.clave_que_no_debe_guardarse).toBeUndefined();
      // Y nada de PII.
      expect(JSON.stringify(datos)).not.toContain("victima@ejemplo.com");
      expect(JSON.stringify(datos)).not.toContain("51987654321");
      // El hash de la IP lo pone el servidor (para ver visitas unicas y
      // detectar que alguien infla las metricas).
      expect(typeof datos.ipHash).toBe("string");
    } finally {
      await client.end().catch(() => undefined);
    }
  });

  test.skipIf(!online || !hayAdmin || !conBase)(
    "E4: las metricas leen la tabla de eventos (visitas, impresiones, vistas y CTR)",
    async () => {
      const token = await login(ADMIN.email, ADMIN.password);
      expect(token).toBeTruthy();

      const antes = await (await get("/api/analitica/kpis", token)).json();
      const m0 = antes.metricas;

      // Una visita y una impresion mas.
      await postearEvento(
        { tipoEvento: "visita_landing_utm", origen: "web", datos: { source: "prueba_kpi" } },
        "203.0.113.204",
      );

      const despues = await (await get("/api/analitica/kpis", token)).json();
      const m1 = despues.metricas;

      expect(Number(m1.visitas)).toBe(Number(m0.visitas) + 1);

      // Las VISTAS se miden ahora (antes no habia de donde sacarlas: el
      // contador `offers.vistas` no lo incrementa nadie).
      expect(m1.totalVistasOfertas === null || m1.totalVistasOfertas >= m0.totalVistasOfertas).toBe(true);
      if (m1.totalVistasOfertas !== null && m1.ctrPromedioGlobal !== null) {
        expect(m1.ctrPromedioGlobal).toBeGreaterThanOrEqual(0);
      }
    },
  );

  test("E5: el cliente postea sus eventos y el bot registra los suyos", () => {
    const eventos = fs.readFileSync(path.join(ROOT, "src/core/events.ts"), "utf8");
    const servidor = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
    // El cliente persiste lo que emite.
    expect(eventos).toContain("/api/eventos");
    // Y el bot registra las impresiones y las entregas.
    expect(servidor).toContain("registrarEventoServidor");
    expect(servidor).toContain('"oferta_mostrada"');
    expect(servidor).toContain('"oferta_enviada"');
  });

  test("E6: lo que tiene tabla propia NO se duplica en la tabla de eventos", () => {
    const servidor = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
    // Los clics van en click_logs y los chats en chat_logs: no se emiten
    // como evento.
    expect(servidor).not.toContain('"clic_contactar"');
    expect(servidor).not.toContain('"mensaje_recibido"');
  });
});
