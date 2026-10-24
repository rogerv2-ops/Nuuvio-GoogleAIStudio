/**
 * Rutas del embudo de prerregistro de comercios (landing yuddit.com).
 *
 * QUÉ HACE: captura el interés de comercios antes del alta formal. No crea
 * comercios ni cuentas, no publica ofertas y NO envía correos (el boletín
 * requiere autorización expresa; el adaptador Resend/SMTP queda inactivo).
 *
 * DECISIONES DE NEGOCIO REGISTRADAS (WhatsApp 2026-10-24):
 *  - Densidad primero: piloto Miraflores; otras zonas se aceptan y quedan
 *    marcadas zona_objetivo="expansion" (aprobado por 👍 a las 11:13:47).
 *  - 17 categorías con texto exacto (src/utils/categoriasCaptacion.ts).
 *  - Instagram y TikTok: OPCIONALES, su ausencia no bloquea (13:09:26).
 *  - PENDIENTE a la 13:07: si "todos obligatorios salvo ubigeo" aplica al
 *    boletín (añadiría RUC/dirección/pin) o solo al alta OS. La
 *    obligatoriedad vive en CAMPOS_REQUERIDOS para ajustarse sin migración.
 *
 * ANTI-ABUSO: rate-limit por IP (bucket propio, además del global /api),
 * dedupe por correo con respuesta idempotente (no revela existencia ni pisa
 * datos) y honeypot.
 *
 * BAJA: sin login, por enlace con token individual. GET muestra una
 * confirmación y NO muta nada (los prefetch/escáneres de enlaces no pueden
 * dar de baja); la baja real exige el POST explícito del formulario. El
 * token viaja en la respuesta del registro (y luego en el correo del
 * boletín); en la tabla queda solo su hash sha256 y NUNCA sale en la
 * exportación CSV ni en el JSON admin. Sin vencimiento mientras no exista
 * el primer boletín; si se decide rotación se añade sin cambiar el esquema.
 *
 * DEDUPE, CONSENTIMIENTO Y ORÁCULO: la respuesta pública es SIEMPRE la
 * misma ({ok:true, bajaUrl}) para no revelar si el correo ya existía: a un
 * duplicado se le devuelve un enlace con token aleatorio NO guardado
 * (inerte). El enlace real solo lo recibe quien registra un correo nuevo.
 * El dedupe NUNCA renueva consentimiento, estado ni token del registro
 * existente. Y una baja NO se revierte por un POST anónimo con checkbox:
 * cualquiera puede escribir un correo ajeno. La reactivación exige probar
 * el control del correo (confirmación por email) o un proceso autorizado;
 * como no hay envíos autorizados, queda PENDIENTE e inactiva por ahora.
 *
 * REGISTRO: el módulo se activa solo si process.env.EMBUDO_PREREGISTRO==="1"
 * (ver server.ts): en producción el endpoint no existe hasta decisión
 * explícita de despliegue; en CI está activo para los tests de contrato.
 */
import crypto from "crypto";
import {
  insertarPreregistro,
  obtenerPreregistroPorCorreoIdx,
  marcarBajaPreregistroPorTokenHash,
  listarPreregistros,
} from "../db/repos/preregistros.ts";
import { esCategoriaCaptacion } from "../utils/categoriasCaptacion.ts";
import { filaCsv } from "../utils/csv.ts";
import { normalizarTextoBusqueda } from "../utils/textoBusqueda.ts";
import { htmlLandingEmbudo } from "../utils/embudoLanding.ts";

// PENDIENTE copy de campaña: el texto visible del consentimiento y su
// finalidad exacta se fijan cuando Roger apruebe el copy. La versión se
// guarda con cada registro para saber qué aceptó cada comercio.
const CONSENT_VERSION = "v1-placeholder";
const CONSENT_FINALIDAD = "aviso_lanzamiento_yuddit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Obligatoriedad PENDIENTE de cierre (ver cabecera). Ajustar aquí no
// requiere migración: la tabla admite nulos en los campos no esenciales.
const CAMPOS_REQUERIDOS = ["nombreComercial", "responsable", "correo", "distritoZona", "categoria"] as const;

const corto = (v: unknown, max = 200): string => String(v ?? "").trim().slice(0, max);
const normalizarCorreo = (v: unknown): string => corto(v, 254).toLowerCase();
const hashToken = (t: string): string => crypto.createHash("sha256").update(t).digest("hex");

export function registrarRutasPreregistros(app: any, ctx: any): void {
  const { rateLimit, requireAdmin } = ctx;

  // Landing del embudo. Ruta propia (NO sustituye la raíz: ese paso requiere
  // aprobación explícita). Marca real desde app_settings via ctx.getLandingLogo.
  app.get("/registro-comercio", rateLimit("embudo_landing", 60, 60000), (_req: any, res: any) => {
    const logo = typeof ctx.getLandingLogo === "function" ? ctx.getLandingLogo() : null;
    res
      .type("text/html")
      .send(htmlLandingEmbudo({
        logoUrl: logo && typeof logo.imagenUrl === "string" ? logo.imagenUrl : "",
        logoAltoPx: logo && typeof logo.altoPx === "number" ? logo.altoPx : 40,
      }));
  });



  app.post("/api/preregistros", rateLimit("preregistros", 5, 60000), async (req: any, res: any) => {
    try {
      const b = req.body || {};
      // Honeypot: los bots rellenan "empresa" (campo invisible); humanos no.
      if (b.empresa) return res.json({ ok: true });

      const nombreComercial = corto(b.nombreComercial);
      const responsable = corto(b.responsable);
      const correo = normalizarCorreo(b.correo);
      const distritoZona = corto(b.distritoZona, 120);
      const categoria = corto(b.categoria, 80);
      const whatsapp = corto(b.whatsapp, 40) || null;
      const instagram = corto(b.instagram, 80) || null;
      const tiktok = corto(b.tiktok, 80) || null;

      const valores: Record<string, string | null> = {
        nombreComercial, responsable, correo, distritoZona, categoria, whatsapp, instagram, tiktok,
      };
      for (const campo of CAMPOS_REQUERIDOS) {
        if (!valores[campo]) {
          return res.status(400).json({ ok: false, error: `Falta el campo obligatorio: ${campo}` });
        }
      }
      if (!EMAIL_RE.test(correo)) {
        return res.status(400).json({ ok: false, error: "Correo inválido" });
      }
      if (!esCategoriaCaptacion(categoria)) {
        return res.status(400).json({ ok: false, error: "Categoría inválida" });
      }
      if (b.consentimientoEmail !== true) {
        return res.status(400).json({ ok: false, error: "Se requiere el consentimiento para recibir el boletín" });
      }

      // Anti-oráculo: exista o no, la respuesta tiene la misma forma. A un
      // correo ya registrado (activo o en baja) se le da un enlace INERTE:
      // token aleatorio que no se guarda y no da de baja nada. Su registro
      // no se toca: ni consentimiento, ni estado, ni token. Una baja solo se
      // revierte con un proceso que pruebe el control del correo (pendiente,
      // no implementado mientras no haya envíos autorizados).
      const existente = await obtenerPreregistroPorCorreoIdx(correo);
      if (existente) {
        const tokenInerte = crypto.randomBytes(24).toString("hex");
        return res.json({ ok: true, bajaUrl: "/api/preregistros/baja?token=" + tokenInerte });
      }

      const token = crypto.randomBytes(24).toString("hex");
      const bajaUrl = "/api/preregistros/baja?token=" + token;
      const zonaObjetivo = normalizarTextoBusqueda(distritoZona).includes("miraflores") ? "piloto" : "expansion";

      await insertarPreregistro({
        id: "pre_" + crypto.randomBytes(9).toString("hex"),
        nombreComercial,
        responsable,
        correo,
        correoIdx: correo,
        whatsapp,
        distritoZona,
        zonaObjetivo,
        categoria,
        instagram,
        tiktok,
        consentimientoEmail: true,
        consentimientoTextoVersion: CONSENT_VERSION,
        consentimientoFinalidad: CONSENT_FINALIDAD,
        bajaTokenHash: hashToken(token),
        origen: corto(b.origen, 60) || "landing-yuddit.com",
      });
      // El enlace de baja se entrega UNA vez, en la respuesta del propio
      // registro (hasta que exista el correo del boletín que lo lleve).
      return res.json({ ok: true, bajaUrl });
    } catch (err) {
      console.error("[preregistros] Error en POST /api/preregistros:", err);
      return res.status(500).json({ ok: false, error: "Error interno" });
    }
  });

  // GET de baja: SOLO muestra la confirmación. Nunca muta: los prefetch y
  // escáneres de enlaces de los clientes de correo hacen GET.
  app.get("/api/preregistros/baja", rateLimit("preregistros_baja", 20, 60000), async (req: any, res: any) => {
    const token = String(req.query.token || "");
    if (!/^[a-f0-9]{48}$/.test(token)) {
      return res.status(400).type("text/html").send("<!doctype html><title>yuddit</title><p>Enlace inválido.</p>");
    }
    return res
      .type("text/html")
      .send(
        "<!doctype html><html lang=es><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>" +
          "<title>yuddit - baja del boletín</title>" +
          "<body style='font-family:sans-serif;max-width:430px;margin:60px auto;padding:0 22px'>" +
          "<h1 style='font-size:22px'>¿Darte de baja del boletín?</h1>" +
          "<p style='color:#555'>Dejarás de recibir el aviso de lanzamiento de yuddit. Tus datos de prerregistro se conservan marcados como baja.</p>" +
          "<form method=post action='/api/preregistros/baja'>" +
          "<input type=hidden name=token value='" + token + "'>" +
          "<button style='padding:13px 18px;background:#111;color:#C8FF3D;border:0;border-radius:10px;font-weight:700'>Sí, darme de baja</button>" +
          "</form></body>"
      );
  });

  // POST de baja: la ÚNICA vía que muta. Respuesta genérica: no confirma si
  // el token existe. El token viaja en el cuerpo del formulario same-origin.
  app.post("/api/preregistros/baja", rateLimit("preregistros_baja", 10, 60000), async (req: any, res: any) => {
    try {
      const token = String((req.body && req.body.token) || "");
      if (!/^[a-f0-9]{48}$/.test(token)) {
        return res.status(400).json({ ok: false, error: "Enlace inválido" });
      }
      await marcarBajaPreregistroPorTokenHash(hashToken(token));
      return res.json({ ok: true });
    } catch (err) {
      console.error("[preregistros] Error en baja:", err);
      return res.status(500).json({ ok: false, error: "Error interno" });
    }
  });

  app.get("/api/admin/preregistros", requireAdmin, async (_req: any, res: any) => {
    try {
      const lista = await listarPreregistros();
      // El hash del token de baja no sale de la base: no lo necesita el panel.
      const limpia = lista.map((p: any) => {
        const { bajaTokenHash, ...resto } = p;
        return resto;
      });
      res.json({ ok: true, preregistros: limpia });
    } catch (err) {
      console.error("[preregistros] Error listando:", err);
      res.status(500).json({ ok: false, error: "Error interno" });
    }
  });

  // Exportación CSV para el boletín. Las celdas van escapadas contra
  // formula injection (src/utils/csv.ts): mezcla datos escritos por terceros.
  app.get("/api/admin/preregistros.csv", requireAdmin, async (_req: any, res: any) => {
    try {
      const lista = await listarPreregistros();
      const cabecera = [
        "id", "nombre_comercial", "responsable", "correo", "whatsapp",
        "distrito_zona", "zona_objetivo", "categoria", "instagram", "tiktok",
        "consentimiento_texto_version", "consentimiento_finalidad", "consentimiento_ts",
        "estado_aviso", "origen", "created_at",
      ];
      const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");
      const lineas = [filaCsv(cabecera)].concat(
        lista.map((p: any) =>
          filaCsv([
            p.id, p.nombreComercial, p.responsable, p.correo, p.whatsapp,
            p.distritoZona, p.zonaObjetivo, p.categoria, p.instagram, p.tiktok,
            p.consentimientoTextoVersion, p.consentimientoFinalidad, iso(p.consentimientoTs),
            p.estadoAviso, p.origen, iso(p.createdAt),
          ])
        )
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="preregistros.csv"');
      res.send("﻿" + lineas.join("\n"));
    } catch (err) {
      console.error("[preregistros] Error exportando CSV:", err);
      res.status(500).json({ ok: false, error: "Error interno" });
    }
  });
}
