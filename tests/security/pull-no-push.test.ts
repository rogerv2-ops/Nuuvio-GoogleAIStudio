/**
 * YUDDIT ES PULL, NO PUSH.
 *
 * Decision del dueno (2026-10-21): "yuddit es pull, no push, solo responde
 * consultas a los usuarios... tengo que estar presente en todo el flujo que
 * implique a los usuarios".
 *
 * Este test es el que hace que la regla no se olvide: escanea el TEXTO QUE
 * VE LA PERSONA y falla si vuelve a aparecer una promesa de envio proactivo.
 *
 * QUE ES PULL
 *
 * La persona escribe al bot (o se registra en la web) y el bot responde.
 * La persona pide ofertas, el bot las manda.
 *
 * QUE NO ES PUSH
 *
 * El negocio inicia el contacto: campañas, "te avisamos cuando haya ofertas
 * nuevas", resumen diario, recordatorios, avisos de que algo nuevo apareció.
 *
 * Este test NO mira que el bot mande o no mande: mira lo que PROMETE. Un
 * "te avisaremos" es una promesa de push, y una promesa de push es una
 * mentira si el bot nunca empuja.
 */
import { test, expect, describe } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "../..");

/** Sin comentarios: los comentarios documentan el cambio (y citan el texto viejo). */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
}

/**
 * Promesas de envio proactivo. Aparece en el texto que ve la persona.
 * Se listan por separado las que son "vigilar" (frases que el negocio
 * usaria para prometer un push).
 */
const PROMESAS_DE_PUSH: { patron: RegExp; porque: string }[] = [
  { patron: /te avisaremos/i, porque: "promete avisar" },
  { patron: /te avisar[ée]\b/i, porque: "promete avisar" },
  { patron: /te avisamos cuando/i, porque: "promete avisar" },
  { patron: /te notificaremos/i, porque: "promete notificar" },
  { patron: /te escribimos\b/i, porque: "promete escribir" },
  { patron: /te mandaremos/i, porque: "promete mandar" },
  { patron: /recibir[áa]s m[áa]s (ofertas|mensajes|notificaciones)/i, porque: "promete recibir" },
  { patron: /cuando entren ofertas/i, porque: "promete avisar de ofertas nuevas" },
  { patron: /te avisamos\b/i, porque: "promete avisar" },
  { patron: /pr[óo]ximo (resumen|env[ií]o)/i, porque: "promete un envio" },
];

/** Archivos con texto que ve la persona. */
const ARCHIVOS_DE_USUARIO = [
  "src/utils/botMensajes.ts",
  "server.ts",
  "src/core/messaging.ts",
];

describe("Pull, no push: el bot no promete envios proactivos", () => {
  test("P1: ningun texto que ve la persona promete un envio proactivo", () => {
    const fallos: string[] = [];
    for (const relativo of ARCHIVOS_DE_USUARIO) {
      const ruta = path.join(ROOT, relativo);
      if (!fs.existsSync(ruta)) continue;
      const texto = sinComentarios(fs.readFileSync(ruta, "utf8"));
      for (const { patron, porque } of PROMESAS_DE_PUSH) {
        const m = texto.match(patron);
        if (m) {
          const i = m.index!;
          fallos.push(
            `${relativo}: "${m[0]}" (${porque}) — ...${texto
              .slice(Math.max(0, i - 60), i + 60)
              .replace(/\s+/g, " ")}...`,
          );
        }
      }
    }
    expect(fallos.join("\n")).toBe("");
  });

  test("P2: el mensaje de 'ya te mostre todas' NO promete un aviso futuro", () => {
    const server = fs.readFileSync(path.join(ROOT, "server.ts"), "utf8");
    // El texto exacto que ve la persona cuando ya vio todas las ofertas.
    const m = server.match(/const _yaVistas=`([^`]+)`/);
    expect(m).toBeTruthy();
    const mensaje = m![1];
    expect(mensaje).toContain("Ya te mostré todas las ofertas");
    expect(mensaje).toContain("unas horas");
    // Y NO promete avisarle cuando entren ofertas nuevas.
    expect(mensaje).not.toContain("te aviso");
    expect(mensaje).not.toContain("te avisaremos");
    expect(mensaje).not.toContain("cuando entren");
  });

  test("P3: el opt-out significa 'dejar de responder', no 'dejar de notificar'", () => {
    const bot = fs.readFileSync(path.join(ROOT, "src/utils/botMensajes.ts"), "utf8");
    const linea = sinComentarios(bot).match(/export function lineaOptOut\(\)[\s\S]*?return \(([\s\S]*?)\);/);
    expect(linea).toBeTruthy();
    const texto = linea![1];
    expect(texto).toContain("BAJA");
    // No promete que le dejen de mandar cosas: no hay nada que mandar.
    expect(texto).not.toMatch(/recibir[áa]s/i);
    expect(texto).toMatch(/no te respondamos/i);
  });

  test("P4: el digest es el canal de CORREO, no un push del bot", () => {
    // Decision del dueno (2026-10-21): "el digest es por correo, anotalo y
    // despreocupate". O sea: el digest es el unico envio proactivo de
    // Yuddit, con consentimiento explicito, y la regla de pull/no-push es del
    // bot de WhatsApp. Este test verifica que la distincion quede ESCRITA,
    // para que nadie la lea al reves dentro seis meses.
    const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
    expect(agents).toMatch(/digest es el otro canal/i);
    expect(agents).toMatch(/consentimientos\.correo/);
    expect(agents).toMatch(/regla de pull\/no-push es del bot de WhatsApp/i);
  });

  test("P5: la regla esta escrita en AGENTS.md (lo lee todo agente)", () => {
    const agents = fs.readFileSync(path.join(ROOT, "AGENTS.md"), "utf8");
    expect(agents).toContain("PULL, no PUSH");
    expect(agents).toContain("solo RESPONDE consultas");
    // Y dice que hay un test que la vigila: este.
    expect(agents).toContain("pull-no-push.test.ts");
  });
});
