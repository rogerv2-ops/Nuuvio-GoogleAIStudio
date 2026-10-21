/**
 * El copy del bot y el opt-out (politica de WhatsApp de Meta).
 *
 * Que pidio el dueno (2026-10-21, probando el flujo en vivo):
 *
 *  1. "solo veo que pide el nombre, cuando ya el nombre debe capturarse
 *      automaticamente". El bot ya recibe el nombre en el perfil de
 *      WhatsApp: pedirlo otra vez hace que la persona escriba de menos.
 *  2. "en este mensaje hay que dar un saludo mas amistoso/cordial".
 *  3. "al entregar cada oferta hay que agregar alguna frase de opt-out,
 *      que tenemos que definir y debe ser muy amable pero solo para cumplir
 *      con las politicas de meta".
 *
 * Y un hallazgo que aparece al medir: la BAJA NO SE SOSTENIA. Despues de
 * "BAJA" el usuario quedaba en `desuscrito`, pero al siguiente mensaje
 * CUALQUIER mensaje el bot lo reactivaba solo (`estado = "activo"`).
 * O sea: prometer "escribe BAJA y te sacamos de la lista" era falso, y
 * ademas cualquier campana futura habria contactado a gente que pidio la
 * baja.
 *
 * Estos tests son CONDUCTUALES: mandan los mensajes reales al bot (mismo
 * pipeline que Baileys) con un telefono NUEVO en cada caso.
 */
import { test, expect, describe } from "bun:test";
import { BASE, servidorOnline, login, ADMIN, post, get } from "./_helpers.ts";

const online = await servidorOnline();
const hayAdmin = Boolean(ADMIN.email && ADMIN.password);

let secuencia = 0;
function telefonoNuevo(): string {
  secuencia += 1;
  const base = String(Date.now() % 100000000).padStart(8, "0");
  return `+519${base.slice(0, 7)}${secuencia % 10}`;
}

/**
 * IP propia por llamada: el rate limit de `simulate-incoming` es de 30 por
 * minuto y POR IP, y la suite completa lo comparte. Aislar este archivo lo
 * hace independiente del resto.
 */
let ipSecuencia = 0;
function ipPropia(): string {
  ipSecuencia += 1;
  return `203.0.113.${100 + ipSecuencia}`;
}

interface SimResult {
  ok: boolean;
  respuestas: Array<{ tipo: string; texto: string }>;
}

async function simular(token: string, telefono: string, texto: string): Promise<SimResult> {
  const r = await post(
    "/api/whatsapp/simulate-incoming",
    { telefono, texto, pushName: "Roger Vasquez" },
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

async function estadoEnAudiencia(token: string, telefono: string): Promise<any | null> {
  const r = await get("/api/audience/users", token);
  const cuerpo: any = await r.json();
  const lista: any[] = Array.isArray(cuerpo) ? cuerpo : (cuerpo.users || cuerpo.data || []);
  const digitos = telefono.replace(/\D/g, "");
  return (
    lista.find((u: any) => String(u.telefono || "").replace(/\D/g, "").endsWith(digitos.slice(-9))) ||
    null
  );
}

describe.skipIf(!online || !hayAdmin)("Bot: copy del saludo y opt-out", () => {
  test("C1: el saludo usa el nombre y NO vuelve a pedirlo", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    expect(token).toBeTruthy();

    const res = await simular(token!, telefonoNuevo(), "hola");
    const texto = textoDe(res);

    // El nombre viene del perfil de WhatsApp: se saluda con el nombre.
    expect(texto).toContain("Roger Vasquez");
    expect(texto).toContain("Qué gusto saludarte");

    // Y NO se pide el nombre: ya se sabe.
    expect(texto).not.toContain("*Nombre*");
    expect(texto).not.toContain("ej: Carlos");

    // Solo se pide lo que falta.
    expect(texto).toContain("*Edad*");
    expect(texto).toContain("*Distrito*");
  });

  test("C2: el ejemplo del mensaje se adapta a lo que se pide", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const res = await simular(token!, telefonoNuevo(), "hola");
    const texto = textoDe(res);
    // Con el nombre conocido el ejemplo es "28, Miraflores" (no "Carlos, 28, ...").
    expect(texto).toContain('"28, Miraflores"');
    expect(texto).not.toContain('"Carlos, 28, Miraflores"');
  });

  test("C3: toda entrega de oferta lleva la linea de opt-out", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const tel = telefonoNuevo();

    // Alta: el mosaico con las ofertas de la zona.
    await simular(token!, tel, "hola");
    const alta = await simular(token!, tel, "55, Miraflores");
    const textoAlta = textoDe(alta);
    expect(textoAlta).toContain("Guardamos tu zona");
    expect(textoAlta).toContain("BAJA");

    // El "BAJA" tiene que ser la palabra que el bot ENTIENDE de verdad.
    expect(textoAlta).toMatch(/escribe \*BAJA\*/i);
  });

  test("C4: la baja se SOSTIENE (no la revive cualquier mensaje)", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const tel = telefonoNuevo();

    await simular(token!, tel, "hola");
    await simular(token!, tel, "55, Miraflores");

    const baja = await simular(token!, tel, "BAJA");
    expect(textoDe(baja)).toContain("desuscrito");

    let estado = await estadoEnAudiencia(token!, tel);
    expect(estado).toBeTruthy();
    expect(estado.estado).toBe("desuscrito");
    expect(estado.consentimientos?.whatsapp).toBe(false);

    // Un mensaje cualquiera NO lo reactiva.
    const despues = await simular(token!, tel, "hola");
    expect(textoDe(despues)).toContain("baja");

    estado = await estadoEnAudiencia(token!, tel);
    expect(estado?.estado).toBe("desuscrito");
    expect(estado?.consentimientos?.whatsapp).toBe(false);
  });

  test("C5: 'OFERTAS' reactiva de forma explicita", async () => {
    const token = await login(ADMIN.email, ADMIN.password);
    const tel = telefonoNuevo();

    await simular(token!, tel, "hola");
    await simular(token!, tel, "55, Miraflores");
    await simular(token!, tel, "BAJA");

    const vuelve = await simular(token!, tel, "ofertas");
    const textoVuelve = textoDe(vuelve);
    // La re-suscripcion es lo que se comprueba aqui (abajo, en el estado).
    // Las ofertas NO vuelven: esa persona ya las vio en el alta, y la
    // ventana de 24h no permite reenviarlas (ver ventana-24h.test.ts).
    // Lo que no puede ser es el silencio: el bot responde.
    expect(textoVuelve.length).toBeGreaterThan(0);
    expect(textoVuelve).toContain("Ya te mostré todas las ofertas");

    const estado = await estadoEnAudiencia(token!, tel);
    expect(estado?.estado).toBe("activo");
    expect(estado?.consentimientos?.whatsapp).toBe(true);
  });
});
