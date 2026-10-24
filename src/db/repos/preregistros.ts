/**
 * Capa de datos — preregistros del embudo de comercios (landing yuddit.com).
 *
 * Dominio nuevo (2026-10-24): interesados que dejan sus datos en la landing
 * ANTES del alta formal. Un prerregistro NO es un comercio: no crea cuenta,
 * no publica ofertas y no migra solo. La conversión al alta requiere validar
 * mappings con yuddit OS y recabar faltantes (RUC, sede) y consentimientos
 * propios del alta.
 *
 * El correo se guarda en claro porque ES el canal del boletín (hay que poder
 * escribirle). `correoIdx` (minúsculas, sin espacios) sostiene el dedupe.
 * El token de baja se guarda HASHEADO (sha256): una lectura de la tabla no
 * entrega enlaces de baja activos.
 */
import { db } from "../index.ts";
import { preregistros } from "../schema.ts";
import { eq, desc } from "drizzle-orm";

export interface NuevoPreregistro {
  id: string;
  nombreComercial: string;
  responsable: string;
  correo: string;
  correoIdx: string;
  whatsapp: string | null;
  distritoZona: string;
  zonaObjetivo: string;
  categoria: string;
  instagram: string | null;
  tiktok: string | null;
  consentimientoEmail: boolean;
  consentimientoTextoVersion: string;
  consentimientoFinalidad: string;
  bajaTokenHash: string;
  origen: string;
}

export async function insertarPreregistro(p: NuevoPreregistro) {
  await db.insert(preregistros).values({
    id: p.id,
    nombreComercial: p.nombreComercial,
    responsable: p.responsable,
    correo: p.correo,
    correoIdx: p.correoIdx,
    whatsapp: p.whatsapp,
    distritoZona: p.distritoZona,
    zonaObjetivo: p.zonaObjetivo,
    categoria: p.categoria,
    instagram: p.instagram,
    tiktok: p.tiktok,
    consentimientoEmail: p.consentimientoEmail,
    consentimientoTextoVersion: p.consentimientoTextoVersion,
    consentimientoFinalidad: p.consentimientoFinalidad,
    bajaTokenHash: p.bajaTokenHash,
    origen: p.origen,
  });
}

export async function buscarPreregistroPorCorreoIdx(correoIdx: string) {
  const r = await db
    .select({ id: preregistros.id })
    .from(preregistros)
    .where(eq(preregistros.correoIdx, correoIdx))
    .limit(1);
  return r[0] ?? null;
}

/** Marca baja por hash del token. Devuelve el id afectado o null si el token no existe. */
export async function marcarBajaPreregistroPorTokenHash(tokenHash: string) {
  const r = await db
    .update(preregistros)
    .set({ estadoAviso: "baja", updatedAt: new Date() })
    .where(eq(preregistros.bajaTokenHash, tokenHash))
    .returning({ id: preregistros.id });
  return r[0] ?? null;
}

export async function listarPreregistros() {
  return db.select().from(preregistros).orderBy(desc(preregistros.createdAt));
}
