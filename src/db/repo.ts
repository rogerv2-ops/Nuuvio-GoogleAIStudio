import { db } from './index.ts';
import { appSettings, offers, banners, audienceUsers, emailLogs, registrationLogs } from './schema.ts';
import { eq, desc } from 'drizzle-orm';

/**
 * Obtener una configuración persistente (por ejemplo, 'email_config' o 'whatsapp_config')
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const rows = await db.select().from(appSettings).where(eq(appSettings.key, key));
    if (rows.length > 0 && rows[0].value) {
      return JSON.parse(rows[0].value) as T;
    }
    return defaultValue;
  } catch (error) {
    console.error(`[DB Repo] Error al obtener setting '${key}':`, error);
    return defaultValue;
  }
}

/**
 * Guardar o actualizar una configuración persistente
 */
export async function saveSetting<T>(key: string, value: T): Promise<void> {
  try {
    const valString = JSON.stringify(value);
    await db.insert(appSettings)
      .values({
        key,
        value: valString,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: valString,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error(`[DB Repo] Error al guardar setting '${key}':`, error);
    throw new Error(`Failed to save setting '${key}'`, { cause: error });
  }
}

/**
 * Obtener todas las ofertas desde PostgreSQL
 */
export async function getAllOffers(): Promise<any[]> {
  try {
    const rows = await db.select().from(offers);
    return rows.map((r) => ({
      ...r,
      precioNormal: Number(r.precioNormal),
      precioOferta: Number(r.precioOferta),
      lat: Number(r.lat),
      lng: Number(r.lng),
      vistas: r.vistas || 0,
      clics: r.clics || 0,
      leadsCalificados: r.leadsCalificados || 0,
    }));
  } catch (error) {
    console.error('[DB Repo] Error al obtener ofertas:', error);
    return [];
  }
}

/**
 * Sincronizar o guardar lista de ofertas en PostgreSQL
 */
export async function syncOffers(offersList: any[]): Promise<void> {
  try {
    for (const o of offersList) {
      await db.insert(offers)
        .values({
          id: o.id,
          codigoUrl: o.codigoUrl || `oferta-${o.id}`,
          comercioId: o.comercioId || 'comercio-default',
          comercioNombre: o.comercioNombre || 'Comercio vuuy',
          comercioWhatsapp: o.comercioWhatsapp || '51987654321',
          titulo: o.titulo || '',
          descripcion: o.descripcion || '',
          tipo: o.tipo || 'descuento_porcentaje',
          precioNormal: String(o.precioNormal ?? 0),
          precioOferta: String(o.precioOferta ?? 0),
          stock: o.stock ?? null,
          categoria: o.categoria || 'Gastronomía y Café',
          distrito: o.distrito || 'Miraflores',
          provincia: o.provincia || 'Lima',
          lat: String(o.lat ?? -12.12),
          lng: String(o.lng ?? -77.03),
          imagenes: o.imagenes || [],
          venceEn: o.venceEn || new Date(Date.now() + 30 * 86400000).toISOString(),
          estado: o.estado || 'activa',
          vistas: o.vistas || 0,
          clics: o.clics || 0,
          leadsCalificados: o.leadsCalificados || 0,
          videoUrl: o.videoUrl || null,
          creadaEn: o.creadaEn || new Date().toISOString(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: offers.id,
          set: {
            titulo: o.titulo || '',
            descripcion: o.descripcion || '',
            precioNormal: String(o.precioNormal ?? 0),
            precioOferta: String(o.precioOferta ?? 0),
            stock: o.stock ?? null,
            categoria: o.categoria || '',
            distrito: o.distrito || '',
            provincia: o.provincia || '',
            lat: String(o.lat ?? -12.12),
            lng: String(o.lng ?? -77.03),
            imagenes: o.imagenes || [],
            venceEn: o.venceEn || new Date().toISOString(),
            estado: o.estado || 'activa',
            vistas: o.vistas || 0,
            clics: o.clics || 0,
            leadsCalificados: o.leadsCalificados || 0,
            videoUrl: o.videoUrl || null,
            updatedAt: new Date(),
          },
        });
    }
  } catch (error) {
    console.error('[DB Repo] Error sincronizando ofertas:', error);
    throw new Error('Failed to sync offers', { cause: error });
  }
}

/**
 * Obtener banners
 */
export async function getAllBanners(): Promise<any[]> {
  try {
    const rows = await db.select().from(banners);
    return rows;
  } catch (error) {
    console.error('[DB Repo] Error al obtener banners:', error);
    return [];
  }
}

/**
 * Guardar banners
 */
export async function syncBanners(bannerList: any[]): Promise<void> {
  try {
    for (const b of bannerList) {
      await db.insert(banners)
        .values({
          id: b.id,
          titulo: b.titulo,
          subtitulo: b.subtitulo,
          imagenUrl: b.imagenUrl,
          enlaceUrl: b.enlaceUrl || null,
          activado: b.activado !== false,
          orden: b.orden || 1,
        })
        .onConflictDoUpdate({
          target: banners.id,
          set: {
            titulo: b.titulo,
            subtitulo: b.subtitulo,
            imagenUrl: b.imagenUrl,
            enlaceUrl: b.enlaceUrl || null,
            activado: b.activado !== false,
            orden: b.orden || 1,
          },
        });
    }
  } catch (error) {
    console.error('[DB Repo] Error sincronizando banners:', error);
    throw new Error('Failed to sync banners', { cause: error });
  }
}

/**
 * Guardar o actualizar usuario de audiencia
 */
export async function upsertAudienceUser(user: any): Promise<void> {
  try {
    await db.insert(audienceUsers)
      .values({
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        apellido: user.apellido || null,
        telefono: user.telefono || null,
        distrito: user.distrito || null,
        provincia: user.provincia || null,
        ciudad: user.ciudad || null,
        emailVerificado: !!user.emailVerificado,
        verificationToken: user.verificationToken || null,
        codigoRef: user.codigoRef || null,
        puntosSaldo: user.puntosSaldo || 0,
        estado: user.estado || 'pendiente',
        categoriasInteres: user.categoriasInteres || [],
        consentimientos: user.consentimientos || {},
        utm: user.utm || {},
        registradoEn: user.registradoEn || new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: audienceUsers.id,
        set: {
          email: user.email,
          nombre: user.nombre,
          apellido: user.apellido || null,
          telefono: user.telefono || null,
          distrito: user.distrito || null,
          provincia: user.provincia || null,
          ciudad: user.ciudad || null,
          emailVerificado: !!user.emailVerificado,
          verificationToken: user.verificationToken || null,
          puntosSaldo: user.puntosSaldo || 0,
          estado: user.estado || 'pendiente',
          categoriasInteres: user.categoriasInteres || [],
          consentimientos: user.consentimientos || {},
          utm: user.utm || {},
        },
      });
  } catch (error) {
    console.error('[DB Repo] Error guardando audience user:', error);
    throw new Error('Failed to upsert audience user', { cause: error });
  }
}

/**
 * Obtener todos los usuarios de audiencia
 */

/**
 * Normalizar teléfono para coincidencia robusta (ignora código de país repetido, ceros y formato)
 */
export function normalizePhoneForMatching(raw: string): { digits: string; core9: string } {
  if (!raw) return { digits: '', core9: '' };
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Manejo de código de país duplicado como 5151...
  if (digits.startsWith('5151') && digits.length >= 13) {
    digits = digits.slice(2);
  }
  // Si comienza con 0 y tiene 10 dígitos (ej: 0987654321)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = digits.slice(1);
  }
  const core9 = digits.length >= 9 ? digits.slice(-9) : digits;
  return { digits, core9 };
}

/**
 * Compara dos números de teléfono con alta tolerancia a formatos internacionales y locales
 */
export function phonesMatch(phoneA: string, phoneB: string): boolean {
  const normA = normalizePhoneForMatching(phoneA);
  const normB = normalizePhoneForMatching(phoneB);
  if (!normA.digits || !normB.digits) return false;
  if (normA.digits === normB.digits) return true;
  if (normA.digits.endsWith(normB.digits) || normB.digits.endsWith(normA.digits)) return true;
  if (normA.core9.length >= 7 && normA.core9 === normB.core9) return true;
  return false;
}

/**
 * Buscar un usuario registrado por su número de teléfono
 */
export async function findAudienceUserByPhone(phone: string): Promise<any | null> {
  try {
    const norm = normalizePhoneForMatching(phone);
    if (!norm.digits) return null;
    const allUsers = await getAllAudienceUsers();
    const found = allUsers.find((u: any) => {
      if (!u.telefono) return false;
      return phonesMatch(u.telefono, phone);
    });
    return found || null;
  } catch (error) {
    console.error("[DB Repo] Error buscando usuario por teléfono:", error);
    return null;
  }
}

export async function getAllAudienceUsers(): Promise<any[]> {
  try {
    return await db.select().from(audienceUsers);
  } catch (error) {
    console.error('[DB Repo] Error consultando audience users:', error);
    return [];
  }
}

/**
 * Sembrar usuarios iniciales de audiencia si la tabla está vacía
 */
export async function seedAudienceUsersIfEmpty(seedList: any[]): Promise<void> {
  try {
    const existing = await getAllAudienceUsers();
    if (existing.length === 0 && seedList.length > 0) {
      console.log(`[DB Repo] Sembrando ${seedList.length} usuarios de audiencia en Cloud SQL...`);
      for (const u of seedList) {
        await upsertAudienceUser(u);
      }
      console.log(`[DB Repo] ${seedList.length} usuarios de audiencia sembrados en Cloud SQL exitosamente.`);
    }
  } catch (error) {
    console.error('[DB Repo] Error sembrando audience users en Cloud SQL:', error);
  }
}

/**
 * Guardar log de correo en base de datos
 */
export async function insertEmailLog(logItem: any): Promise<void> {
  try {
    await db.insert(emailLogs)
      .values({
        id: logItem.id || `elog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        toEmail: logItem.to || '',
        subject: logItem.subject || '',
        provider: logItem.provider || 'simulated',
        status: logItem.status || 'simulado',
        timestamp: logItem.timestamp || new Date().toISOString(),
        verificationToken: logItem.verificationToken || null,
        verificationLink: logItem.verificationLink || null,
        whatsappLink: logItem.whatsappLink || null,
        error: logItem.error || null,
      });
  } catch (error) {
    console.error('[DB Repo] Error guardando log de correo:', error);
  }
}

/**
 * Obtener logs de correo
 */
export async function getRecentEmailLogs(limitCount = 50): Promise<any[]> {
  try {
    const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.createdAt)).limit(limitCount);
    return rows.map((r) => ({
      id: r.id,
      to: r.toEmail,
      subject: r.subject,
      provider: r.provider,
      status: r.status,
      timestamp: r.timestamp,
      verificationToken: r.verificationToken,
      verificationLink: r.verificationLink,
      whatsappLink: r.whatsappLink,
      error: r.error,
    }));
  } catch (error) {
    console.error('[DB Repo] Error obteniendo logs de correo:', error);
    return [];
  }
}

/**
 * Verificar unicidad de email y teléfono en la base de datos de audiencia
 */
export async function checkAudienceUserUniqueness(email: string, phone: string): Promise<{ exists: boolean; isEmailDuplicate: boolean; isPhoneDuplicate: boolean }> {
  try {
    const cleanEmail = (email || '').trim().toLowerCase();
    const rows = await getAllAudienceUsers();
    
    let isEmailDuplicate = false;
    let isPhoneDuplicate = false;

    for (const r of rows) {
      if (cleanEmail && r.email && r.email.trim().toLowerCase() === cleanEmail) {
        isEmailDuplicate = true;
      }
      if (phone && r.telefono && phonesMatch(r.telefono, phone)) {
        isPhoneDuplicate = true;
      }
    }

    return {
      exists: isEmailDuplicate || isPhoneDuplicate,
      isEmailDuplicate,
      isPhoneDuplicate
    };
  } catch (error) {
    console.error('[DB Repo] Error al verificar unicidad de usuario:', error);
    return { exists: false, isEmailDuplicate: false, isPhoneDuplicate: false };
  }
}

// Fallback en memoria de logs de registro
const inMemoryRegLogs: any[] = [];

/**
 * Guardar intento de registro en log de auditoría
 */
export async function insertRegistrationLog(logData: {
  email: string;
  telefono?: string;
  nombre?: string;
  status: 'success' | 'error';
  resultDetails?: string;
}): Promise<void> {
  const item = {
    id: `reglog_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: (logData.email || '').trim().toLowerCase(),
    telefono: logData.telefono || '',
    nombre: logData.nombre || '',
    status: logData.status,
    resultDetails: logData.resultDetails || (logData.status === 'success' ? 'Registro completado exitosamente' : 'Error en el proceso de registro'),
    timestamp: new Date().toISOString(),
  };

  inMemoryRegLogs.unshift(item);
  if (inMemoryRegLogs.length > 200) inMemoryRegLogs.pop();

  try {
    await db.insert(registrationLogs).values({
      id: item.id,
      email: item.email,
      telefono: item.telefono,
      nombre: item.nombre,
      status: item.status,
      resultDetails: item.resultDetails,
      timestamp: item.timestamp,
    });
  } catch (error) {
    console.error('[DB Repo] Error guardando log de registro en PostgreSQL:', error);
  }
}

/**
 * Obtener logs de auditoría de intentos de registro
 */
export async function getRecentRegistrationLogs(limitCount = 100): Promise<any[]> {
  try {
    const rows = await db.select().from(registrationLogs).orderBy(desc(registrationLogs.createdAt)).limit(limitCount);
    if (rows.length > 0) {
      return rows.map((r) => ({
        id: r.id,
        email: r.email,
        telefono: r.telefono || '',
        nombre: r.nombre || '',
        status: r.status,
        resultDetails: r.resultDetails || '',
        timestamp: r.timestamp,
        createdAt: r.createdAt,
      }));
    }
  } catch (error) {
    console.error('[DB Repo] Error consultando logs de registro en DB, usando fallback:', error);
  }

  return inMemoryRegLogs.slice(0, limitCount);
}

/**
 * Eliminar un usuario de audiencia y purgar todos sus rastros (email_logs y registration_logs)
 */
export async function deleteAndPurgeUser(params: { id?: string; email?: string; telefono?: string }): Promise<{
  userDeleted: boolean;
  emailLogsDeleted: boolean;
  regLogsDeleted: boolean;
}> {
  let userDeleted = false;
  let emailLogsDeleted = false;
  let regLogsDeleted = false;

  const targetId = params.id ? params.id.trim() : '';
  const targetEmail = params.email ? params.email.trim().toLowerCase() : '';

  try {
    if (targetId) {
      await db.delete(audienceUsers).where(eq(audienceUsers.id, targetId));
      userDeleted = true;
    } else if (targetEmail) {
      await db.delete(audienceUsers).where(eq(audienceUsers.email, targetEmail));
      userDeleted = true;
    }
  } catch (error) {
    console.error('[DB Repo] Error borrando usuario de DB:', error);
  }

  if (targetEmail) {
    try {
      await db.delete(emailLogs).where(eq(emailLogs.toEmail, targetEmail));
      emailLogsDeleted = true;
    } catch (error) {
      console.error('[DB Repo] Error borrando emailLogs:', error);
    }

    try {
      await db.delete(registrationLogs).where(eq(registrationLogs.email, targetEmail));
      regLogsDeleted = true;
    } catch (error) {
      console.error('[DB Repo] Error borrando registrationLogs:', error);
    }

    // Limpiar de la memoria ram fallback
    for (let i = inMemoryRegLogs.length - 1; i >= 0; i--) {
      if (inMemoryRegLogs[i]?.email === targetEmail) {
        inMemoryRegLogs.splice(i, 1);
      }
    }
  }

  return { userDeleted, emailLogsDeleted, regLogsDeleted };
}

/**
 * Eliminar un log específico de registro por ID o por email
 */
export async function deleteRegistrationLog(idOrEmail: string): Promise<boolean> {
  const query = idOrEmail.trim();
  try {
    await db.delete(registrationLogs).where(
      eq(registrationLogs.id, query)
    );
    if (query.includes('@')) {
      await db.delete(registrationLogs).where(
        eq(registrationLogs.email, query.toLowerCase())
      );
    }
  } catch (error) {
    console.error('[DB Repo] Error eliminando log de registro:', error);
  }

  for (let i = inMemoryRegLogs.length - 1; i >= 0; i--) {
    if (inMemoryRegLogs[i]?.id === query || inMemoryRegLogs[i]?.email === query.toLowerCase()) {
      inMemoryRegLogs.splice(i, 1);
    }
  }

  return true;
}

/**
 * Limpiar todos los logs de auditoría de registro (Modo Pruebas)
 */
export async function clearAllRegistrationLogs(): Promise<boolean> {
  try {
    await db.delete(registrationLogs);
  } catch (error) {
    console.error('[DB Repo] Error limpiando todos los registrationLogs:', error);
  }
  inMemoryRegLogs.length = 0;
  return true;
}
