/**
 * El embudo de un usuario que escribe por PRIMERA VEZ a Yuddit.
 *
 * Que paso (2026-10-21, reportado por el dueno): iba a probar el alta desde
 * un numero nuevo. Reproducido contra el servidor local ANTES de que el
 * dueno gastara la prueba en produccion:
 *
 *   persona: "hola"
 *   bot:     "¡Hola! Para enviarte las mejores ofertas cerca de ti,
 *             respondeme: 1. Nombre 2. Edad 3. Distrito"
 *   persona: "Carlos, 28, Miraflores"
 *   bot:     "No encontramos ofertas para carlos 28 en Miraflores"   <-- MUERTO
 *
 * La persona se registraba bien (la zona quedava guardada) pero el bot
 * tomaba su RESPUESTA DE ALTA como una BUSQUEDA DE PRODUCTO: el nombre y
 * la edad se colaban en el filtro de busqueda y no encontraba nada. El
 * embudo se cerraba en el segundo mensaje, con un "no encontramos" como
 * unico resultado. La persona se iba sin ver ni una oferta.
 *
 * Estos tests son CONDUCTUALES: mandan los mensajes reales al bot (mismo
 * pipeline que Baileys) con un telefono NUEVO en cada caso.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);

/** Telefonos unicos por corrida: cada caso es un usuario distinto. */
let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

function soloDigitos(v: string | null | undefined): string {
  return String(v || "").replace(/\D/g, "");
}

interface SimResult {
  ok: boolean;
  respuestas: Array<{ tipo: string; texto: string }>;
}

/**
 * Cada usuario simulado viaja con su propia IP.
 *
 * El rate limit de `simulate-incoming` es de 30 mensajes por minuto y POR
 * IP (`bucket:ip`, con `x-forwarded-for` primero). La suite completa manda
 * mas de 30 mensajes en la misma ventana, asi que todos los archivos
 * comparten la misma IP y se pisan entre si: un 429 que no es un fallo del
 * codigo bajo prueba, sino de la suite corriendo junta.
 *
 * Darle una IP propia a este archivo lo hace INDEPENDIENTE del orden y del
 * resto de la suite. No se toca el helper global porque
 * `lead-qualified.test.ts` SI depende del 429 (prueba que el limite de
 * clics se aplica).
 */
let ipSecuencia = 0;
function ipPropia(): string {
  ipSecuencia += 1;
  // 203.0.113.0/24 es el rango de documentacion (RFC 5737): no es una IP real.
  return `203.0.113.${ipSecuencia}`;
}

async function simular(token: string, telefono: string, texto: string): Promise<SimResult> {
  const r = await post(
    "/api/whatsapp/simulate-incoming",
    { telefono, texto, pushName: "Alguien Nuevo" },
    token,
    { "X-Forwarded-For": ipPropia() },
  );
  expect(r.status).toBe(200);
  const j: any = await r.json();
  expect(j.ok).toBe(true);
  return j as SimResult;
}

function textoDe(res: SimResult): string {
  return res.respuestas.map((a) => a.texto).join("\n");
}

describe.skipIf(!online || !hayAdmin)("Bot: el alta de un usuario que escribe por primera vez", () => {
  test("A1: un numero nuevo recibe la solicitud de los datos que le faltan", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    const res = await simular(token!, telefonoNuevo(), "hola");
    const texto = textoDe(res);
    // El nombre ya se sabe (perfil de WhatsApp): se saluda con el nombre y
    // se piden SOLO edad y distrito. Pedir el nombre otra vez hacia perder un
    // dato a la persona.
    expect(texto).toContain("Alguien Nuevo");
    expect(texto).toContain("Edad");
    expect(texto).toContain("Distrito");
    expect(texto).not.toContain("*Nombre*");
    // Todavia no debe offering ofertas: primero necesita los datos.
    expect(texto).not.toContain("aquí tienes las 3 mejores ofertas");
  });

  test("A2: la respuesta de alta NO se trata como busqueda de producto", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    const res = await simular(token!, tel, "Carlos, 28, Miraflores");
    const texto = textoDe(res);

    // BUG: el bot respondia "No encontramos ofertas para carlos 28".
    // El nombre y la edad NO son un producto.
    expect(texto).not.toContain("No encontramos ofertas");
    expect(texto).not.toContain("carlos 28");
    expect(texto).not.toContain("No encontramos ofertas para");

    // Y ahora si: las ofertas de la zona, con su enlace firmado.
    expect(texto).toContain("Guardamos tu zona");
    expect(texto).toContain("Miraflores");
    const enlace = (texto.match(/https?:\/\/\S+\/c\/[^\s]+/) || [])[0] || "";
    expect(enlace).toContain("/c/");
    expect(enlace).toContain("u=");
    expect(enlace).toMatch(/[?&]s=[A-Za-z0-9_-]{8,}/);
  });

  test("A3: la zona, la edad y la etapa quedan guardadas en la audiencia", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    await simular(token!, tel, "Carlos, 28, Miraflores");

    const r = await get("/api/audience/users", token);
    expect(r.status).toBe(200);
    const cuerpo: any = await r.json();
    const lista: any[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo.users || cuerpo.data || []);

    const mio = lista.find(
      (u: any) => soloDigitos(u.telefono).endsWith(soloDigitos(tel).slice(-9)),
    );
    expect(mio).toBeTruthy();
    expect(mio.distrito).toBe("Miraflores");
    expect(mio.estado).toBe("activo");
    // La edad se guardo y la etapa dice que la zona quedo registrada.
    expect(Number(mio.utm?.edad)).toBe(28);
    expect(mio.utm?.etapa).toBe("zona_registrada");
    // Y NO se invento un correo (PR #20: la identidad es el numero).
    expect(mio.email == null || mio.email === "").toBe(true);
  });

  test("A4: si responde solo el distrito, tambien recibe las ofertas de la zona", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    const tel = telefonoNuevo();
    await simular(token!, tel, "hola");
    const res = await simular(token!, tel, "Miraflores");
    const texto = textoDe(res);

    // El distrito no es un producto: no puede buscarse.
    expect(texto).not.toContain("No encontramos ofertas");
    expect(texto).toContain("Guardamos tu zona");
    const enlace = (texto.match(/https?:\/\/\S+\/c\/[^\s]+/) || [])[0] || "";
    expect(enlace).toContain("/c/");
  });
});
