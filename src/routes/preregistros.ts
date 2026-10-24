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
 * BAJA: endpoint público sin login, por enlace con token individual. El
 * token viaja solo en el futuro correo; en la tabla queda su hash sha256.
 * Sin vencimiento mientras no exista el primer boletín; si se decide
 * rotación se añade expiración sin cambiar el esquema.
 *
 * REGISTRO: el módulo se activa solo si process.env.EMBUDO_PREREGISTRO==="1"
 * (ver server.ts): en producción el endpoint no existe hasta decisión
 * explícita de despliegue; en CI está activo para los tests de contrato.
 */
import crypto from "crypto";
import {
  insertarPreregistro,
  buscarPreregistroPorCorreoIdx,
  marcarBajaPreregistroPorTokenHash,
  listarPreregistros,
} from "../db/repos/preregistros.ts";
import { esCategoriaCaptacion } from "../utils/categoriasCaptacion.ts";
import { filaCsv } from "../utils/csv.ts";
import { normalizarTextoBusqueda } from "../utils/textoBusqueda.ts";

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

      // Dedupe: si el correo ya existe, misma respuesta sin pisar datos.
      const existente = await buscarPreregistroPorCorreoIdx(correo);
      if (existente) return res.json({ ok: true });

      const token = crypto.randomBytes(24).toString("hex");
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
      return res.json({ ok: true });
    } catch (err) {
      console.error("[preregistros] Error en POST /api/preregistros:", err);
      return res.status(500).json({ ok: false, error: "Error interno" });
    }
  });

  // Baja pública sin login. Respuesta genérica: no confirma si el token existe.
  app.get("/api/preregistros/baja", rateLimit("preregistros_baja", 10, 60000), async (req: any, res: any) => {
    try {
      const token = String(req.query.token || "");
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
      res.json({ ok: true, preregistros: lista });
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
