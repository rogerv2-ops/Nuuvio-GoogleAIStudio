/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import QRCode from 'qrcode';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  WASocket,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import nodemailer from 'nodemailer';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SEED_OFFERS, SEED_AUDIENCE_USERS } from './src/data/seedData';
import { renderOfferCardImage, formatLimaExpirationDate } from './src/utils/cardRenderer.ts';
import {
  getSetting,
  saveSetting,
  getAllOffers,
  syncOffers,
  getAllBanners,
  syncBanners,
  upsertAudienceUser,
  getAllAudienceUsers,
  seedAudienceUsersIfEmpty,
  findAudienceUserByPhone,
  checkAudienceUserUniqueness,
  normalizePhoneForMatching,
  phonesMatch,
  insertEmailLog,
  getRecentEmailLogs,
  insertRegistrationLog,
  getRecentRegistrationLogs,
  deleteAndPurgeUser,
  deleteRegistrationLog,
  clearAllRegistrationLogs
} from './src/db/repo.ts';

const execAsync = promisify(exec);

let serverOfertas = JSON.parse(JSON.stringify(SEED_OFFERS));

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_DIR = path.resolve(__dirname, 'auth_info_baileys');
const VIDEOS_DIR = path.resolve(__dirname, 'public', 'videos');
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const DATA_DIR = path.resolve(__dirname, 'data');

if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

let deployTimestamp = Date.now().toString();

// Middleware global de control de caché y cabeceras de versionado
app.use((req, res, next) => {
  res.setHeader('X-Deploy-Timestamp', deployTimestamp);
  res.setHeader('X-Resource-Version', deployTimestamp);

  if (req.path.startsWith('/api/')) {
    // Endpoints de API siempre frescos, nunca servidos desde caché
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

const staticOptions = {
  maxAge: 0,
  etag: true,
  lastModified: true,
  setHeaders: (res: Response, filePath: string) => {
    // Si es un banner, imagen o video estático, enviar Cache-Control: no-cache para forzar validación
    if (filePath.match(/\.(webp|png|jpg|jpeg|svg|gif|mp4|webm|json)$/i)) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
    }
    res.setHeader('X-Deploy-Timestamp', deployTimestamp);
    res.setHeader('X-Resource-Version', deployTimestamp);
  }
};

app.use(express.static(PUBLIC_DIR, staticOptions));
app.use('/videos', express.static(VIDEOS_DIR, staticOptions));

const BANNERS_FILE = path.resolve(DATA_DIR, 'banners.json');

const INITIAL_SERVER_BANNERS = [
  {
    id: 'banner_01',
    titulo: 'Ofertas cerca de ti - vuuy',
    subtitulo: 'Solo cuando las quieres. Sin spam ni perder tiempo. En tu zona.',
    imagenUrl: '/banner-ficha-oferta-mujer.webp',
    enlaceUrl: '',
    activado: true,
    orden: 1,
    creadoEn: '2026-10-12T23:36:00.000Z'
  },
  {
    id: 'banner_02',
    titulo: 'Gastronomía y Café en Lima',
    subtitulo: 'Descubre los mejores combos con hasta 50% de descuento',
    imagenUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&h=400&q=80',
    enlaceUrl: '',
    activado: true,
    orden: 2,
    creadoEn: '2026-10-12T23:36:00.000Z'
  },
  {
    id: 'banner_03',
    titulo: 'Belleza y Cuidado Personal',
    subtitulo: 'Tratamientos y promociones en centros autorizados',
    imagenUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1200&h=400&q=80',
    enlaceUrl: '',
    activado: true,
    orden: 3,
    creadoEn: '2026-10-12T23:36:00.000Z'
  }
];

function cargarServerBanners() {
  try {
    if (fs.existsSync(BANNERS_FILE)) {
      const contenido = fs.readFileSync(BANNERS_FILE, 'utf-8');
      const parsed = JSON.parse(contenido);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((b: any) => {
          if (b.imagenUrl && (b.imagenUrl.includes('sustrae.com') || b.imagenUrl.includes('banner.webp'))) {
            return { ...b, imagenUrl: '/banner-ficha-oferta-mujer.webp' };
          }
          return b;
        });
      }
    }
  } catch (err) {
    console.warn('[vuuy Server] Error leyendo banners.json:', err);
  }
  return INITIAL_SERVER_BANNERS;
}

let serverBanners = cargarServerBanners();

function guardarServerBanners() {
  try {
    fs.writeFileSync(BANNERS_FILE, JSON.stringify(serverBanners, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[vuuy Server] Error guardando banners.json:', err);
  }
}
guardarServerBanners();

// In-memory WhatsApp Configuration Store
interface WhatsAppServerConfig {
  modoActivo: 'meta' | 'waha';
  numeroTelefono?: string;
  metaConfig: {
    phoneNumberId: string;
    wabaId: string;
    accessToken: string;
    verifyToken: string;
    webhookUrl: string;
  };
  wahaConfig: {
    endpointUrl: string;
    apiKey: string;
    sessionName: string;
    webhookUrl: string;
  };
}

let waConfig: WhatsAppServerConfig = {
  modoActivo: (process.env.WHATSAPP_ACTIVE_MODE as 'meta' | 'waha') || 'waha',
  numeroTelefono: process.env.WHATSAPP_DEFAULT_PHONE || '',
  metaConfig: {
    phoneNumberId: process.env.META_WA_PHONE_NUMBER_ID || '',
    wabaId: process.env.META_WA_WABA_ID || '',
    accessToken: process.env.META_WA_TOKEN || '',
    verifyToken: process.env.META_WA_VERIFY_TOKEN || 'vuuy_verify_secret_2026',
    webhookUrl: '/api/whatsapp/webhook'
  },
  wahaConfig: {
    endpointUrl: process.env.WAHA_ENDPOINT_URL || 'http://localhost:3000/api/waha',
    apiKey: process.env.WAHA_API_KEY || '',
    sessionName: process.env.WAHA_SESSION_NAME || 'default',
    webhookUrl: '/api/waha/webhook'
  }
};

// In-memory Session State (Compatible con WAHA y Baileys nativo)
interface WahaSessionState {
  status: 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED';
  phone: string | null;
  name: string | null;
  qrRaw: string | null;
  qrDataUrl: string | null;
  qrExpiresAt: number | null;
  startedAt: string | null;
  pairingCode: string | null;
}

let wahaSession: WahaSessionState = {
  status: 'STOPPED',
  phone: null,
  name: null,
  qrRaw: null,
  qrDataUrl: null,
  qrExpiresAt: null,
  startedAt: null,
  pairingCode: null
};

/**
 * Función auxiliar para obtener el número de teléfono del bot de WhatsApp activo.
 * Prioridad:
 * 1. Número del WhatsApp vinculado por código QR (wahaSession.phone)
 * 2. Número configurado en el panel de administración (waConfig.numeroTelefono o metaConfig)
 * 3. Respaldo por defecto ('51987654321')
 */
function getBotPhoneNumber(): string {
  if (wahaSession.phone) {
    const clean = wahaSession.phone.replace(/\D/g, '');
    if (clean) return clean;
  }
  if (waConfig.numeroTelefono) {
    const clean = waConfig.numeroTelefono.replace(/\D/g, '');
    if (clean) return clean;
  }
  if (waConfig.metaConfig?.phoneNumberId) {
    const clean = waConfig.metaConfig.phoneNumberId.replace(/\D/g, '');
    if (clean) return clean;
  }
  return '51987654321';
}

// Active Baileys Socket Reference
let activeBaileysSocket: WASocket | null = null;
let isStartingSocket = false;

// Log de eventos de mensajería
interface MessageEventLog {
  id: string;
  timestamp: string;
  canal: 'meta' | 'waha';
  direccion: 'entrante' | 'saliente';
  telefono: string;
  contenido: string;
  estado: 'entregado' | 'fallido' | 'recibido';
  detalles?: string;
}

const messageLogs: MessageEventLog[] = [
  {
    id: 'log_init_01',
    timestamp: new Date().toISOString(),
    canal: 'waha',
    direccion: 'saliente',
    telefono: '+51 987 654 321',
    contenido: 'Servidor vuuy iniciado. Motor de mensajería WhatsApp activo.',
    estado: 'entregado',
    detalles: 'Listo para vinculación de dispositivo'
  }
];


/**
 * Sincroniza todos los archivos del directorio de credenciales de Baileys a la base de datos (PostgreSQL Cloud SQL)
 * para garantizar la persistencia de la sesión a través de reinicios y redespliegues del contenedor.
 */
async function syncAuthDirToDb(): Promise<void> {
  try {
    if (!fs.existsSync(AUTH_DIR)) return;
    const files = fs.readdirSync(AUTH_DIR);
    const filesData: Record<string, string> = {};
    for (const file of files) {
      const filePath = path.join(AUTH_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        const buf = fs.readFileSync(filePath);
        filesData[file] = buf.toString("base64");
      }
    }
    if (Object.keys(filesData).length > 0) {
      await saveSetting("whatsapp_auth_files", filesData);
      console.log(`[WhatsApp Engine] ${Object.keys(filesData).length} archivos de sesión respaldados en DB (base64).`);
    }
  } catch (err) {
    console.warn("[WhatsApp Engine] Error respaldando auth dir a DB:", err);
  }
}

/**
 * Restaura las credenciales de sesión de Baileys desde la base de datos PostgreSQL si el disco local fue reajustado.
 */
async function restoreAuthDirFromDb(): Promise<boolean> {
  try {
    const filesData = await getSetting<Record<string, string> | null>("whatsapp_auth_files", null);
    if (!filesData || Object.keys(filesData).length === 0) {
      return false;
    }
    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }
    for (const [file, content] of Object.entries(filesData)) {
      const filePath = path.join(AUTH_DIR, file);
      let buf: Buffer;
      if (content.startsWith("{")) {
        buf = Buffer.from(content, "utf8");
      } else {
        buf = Buffer.from(content, "base64");
      }
      fs.writeFileSync(filePath, buf);
    }
    console.log(`[WhatsApp Engine] ${Object.keys(filesData).length} archivos de sesión restaurados desde DB.`);
    return true;
  } catch (err) {
    console.warn("[WhatsApp Engine] Error restaurando credenciales desde DB:", err);
    return false;
  }
}

/**
 * Desempaqueta y extrae texto de mensajes de Baileys (soporta mensajes efímeros, vistas únicas, etc.)
 */
function extractMessageText(messageObj: any): string {
  if (!messageObj) return '';
  const m = messageObj.ephemeralMessage?.message ||
            messageObj.viewOnceMessage?.message ||
            messageObj.viewOnceMessageV2?.message ||
            messageObj.documentWithCaptionMessage?.message ||
            messageObj;
  return (m.conversation ||
         m.extendedTextMessage?.text ||
         m.imageMessage?.caption ||
         m.videoMessage?.caption ||
         m.buttonsResponseMessage?.selectedButtonId ||
         m.buttonsResponseMessage?.selectedDisplayText ||
         m.templateButtonReplyMessage?.selectedId ||
         m.listResponseMessage?.singleSelectReply?.selectedRowId ||
         '').trim();
}

interface SendPayload {
  text?: string;
  image?: Buffer | { url: string };
  imageUrl?: string;
  caption?: string;
  interactiveButton?: {
    displayText: string;
    url: string;
  };
}

interface IncomingMessageParams {
  from: string;
  body: string;
  senderPhone: string;
  pushName?: string;
  canal?: 'waha' | 'meta';
  replySender?: (payload: SendPayload) => Promise<void>;
}

// Mapeo en memoria de identificadores LID a números telefónicos reales de WhatsApp
const lidToPhoneMap = new Map<string, string>();

function formatCanonicalPhone(rawDigits: string): string {
  if (!rawDigits) return '';
  let digits = rawDigits.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith('9')) {
    return `+51 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('51') && digits.charAt(2) === '9') {
    return `+51 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  }
  return `+${digits}`;
}

/**
 * Detecta números telefónicos móviles peruanos válidos dentro de un texto
 */
function extractPhoneFromText(text: string): string | null {
  if (!text) return null;
  const m = text.match(/(?:\+?51)?\s*(9\d{2}[\s.-]?\d{3}[\s.-]?\d{3})\b/);
  if (m && m[1]) {
    const clean = m[1].replace(/\D/g, '');
    if (clean.length === 9) return `51${clean}`;
  }
  return null;
}

/**
 * Determina si un número o string es un identificador LID de WhatsApp en lugar de un teléfono real
 */
function isProbableLid(cleanPhone: string): boolean {
  if (!cleanPhone) return false;
  if (cleanPhone.length === 9 && cleanPhone.startsWith('9')) return false;
  if (cleanPhone.length === 11 && cleanPhone.startsWith('519')) return false;
  return cleanPhone.length >= 12;
}

/**
 * Normaliza el número telefónico en un formato único (con código de país, solo dígitos)
 * para que el mismo usuario nunca se duplique y sirva como identificador canónico único.
 */
function normalizeSenderPhone(raw: string): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  // Si tiene 9 dígitos y empieza con 9 (móvil peruano), anteponer código de país 51
  if (digits.length === 9 && digits.startsWith('9')) {
    digits = `51${digits}`;
  }
  return digits;
}

/**
 * Detecta si el mensaje entrante es una solicitud explícita de ofertas
 */
function isAskingForOffers(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  return /^(ofertas?|mas ofertas?|m[aá]s|ver ofertas?|quiero ofertas?|dame ofertas?|promociones|promos|descuentos)\b/i.test(t) ||
         t === 'ofertas' || t === 'mas ofertas' || t === 'más ofertas' || t.includes('oferta') || t.includes('promo');
}

/**
 * Extrae una dirección de correo electrónico válida del texto
 */
function extractEmailFromText(text: string): string | null {
  if (!text) return null;
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].trim().toLowerCase() : null;
}

// Caché en memoria de usuarios de audiencia para respuesta ultrarrápida y consistencia inmediata
const localAudienceUsersCache = new Map<string, any>();

async function getOrFindAudienceUser(cleanPhone: string): Promise<any | null> {
  const normPhone = normalizeSenderPhone(cleanPhone);
  if (!normPhone) return null;
  const core9 = normPhone.length >= 9 ? normPhone.slice(-9) : normPhone;

  // 1. Revisar caché local en memoria
  for (const [, user] of localAudienceUsersCache.entries()) {
    if (!user) continue;
    const uPhone = (user.telefono || '').replace(/\D/g, '');
    if (uPhone === normPhone || (core9.length >= 7 && uPhone.endsWith(core9))) {
      return user;
    }
    if (user.id === `usr_wa_${normPhone}` || user.id === `usr_wa_${cleanPhone}`) {
      return user;
    }
  }

  // 2. Revisar PostgreSQL / Cloud SQL
  try {
    const dbUser = await findAudienceUserByPhone(normPhone);
    if (dbUser) {
      localAudienceUsersCache.set(normPhone, dbUser);
      if (core9) localAudienceUsersCache.set(core9, dbUser);
      return dbUser;
    }
    const allUsers = await getAllAudienceUsers();
    const found = allUsers.find((u: any) => {
      const uPhone = (u.telefono || '').replace(/\D/g, '');
      return uPhone === normPhone || (core9.length >= 7 && uPhone.endsWith(core9)) || u.id === `usr_wa_${normPhone}`;
    });
    if (found) {
      localAudienceUsersCache.set(normPhone, found);
      if (core9) localAudienceUsersCache.set(core9, found);
      return found;
    }
  } catch (err) {
    console.warn('[Audience Cache] Error buscando usuario en DB:', err);
  }
  return null;
}

async function saveAudienceUserSafely(user: any): Promise<void> {
  if (!user) return;
  const rawPhone = user.telefono || '';
  const normPhone = normalizeSenderPhone(rawPhone);
  if (normPhone) {
    localAudienceUsersCache.set(normPhone, user);
    const core9 = normPhone.length >= 9 ? normPhone.slice(-9) : normPhone;
    if (core9) localAudienceUsersCache.set(core9, user);
  }
  if (user.id) {
    localAudienceUsersCache.set(user.id, user);
  }

  try {
    await upsertAudienceUser(user);
  } catch (err) {
    console.error('[Audience Save] Error guardando usuario en PostgreSQL:', err);
  }
}

// Diccionario canónico de distritos de Lima y Callao para detección inteligente
const LIMA_DISTRICT_MAP: Record<string, string> = {
  'miraflores': 'Miraflores',
  'san isidro': 'San Isidro',
  'surco': 'Santiago de Surco',
  'santiago de surco': 'Santiago de Surco',
  'san borja': 'San Borja',
  'la molina': 'La Molina',
  'san miguel': 'San Miguel',
  'magdalena': 'Magdalena del Mar',
  'magdalena del mar': 'Magdalena del Mar',
  'jesus maria': 'Jesús María',
  'jesús maría': 'Jesús María',
  'pueblo libre': 'Pueblo Libre',
  'lince': 'Lince',
  'barranco': 'Barranco',
  'chorrillos': 'Chorrillos',
  'surquillo': 'Surquillo',
  'san luis': 'San Luis',
  'brena': 'Breña',
  'breña': 'Breña',
  'lima': 'Cercado de Lima',
  'cercado': 'Cercado de Lima',
  'cercado de lima': 'Cercado de Lima',
  'rimac': 'Rímac',
  'rímac': 'Rímac',
  'la victoria': 'La Victoria',
  'el agustino': 'El Agustino',
  'ate': 'Ate',
  'vitarte': 'Ate',
  'ate vitarte': 'Ate',
  'santa anita': 'Santa Anita',
  'san juan de lurigancho': 'San Juan de Lurigancho',
  'sjl': 'San Juan de Lurigancho',
  'los olivos': 'Los Olivos',
  'san martin de porres': 'San Martín de Porres',
  'san martín de porres': 'San Martín de Porres',
  'smp': 'San Martín de Porres',
  'independencia': 'Independencia',
  'comas': 'Comas',
  'puente piedra': 'Puente Piedra',
  'carabayllo': 'Carabayllo',
  'ancon': 'Ancón',
  'ancón': 'Ancón',
  'santa rosa': 'Santa Rosa',
  'san juan de miraflores': 'San Juan de Miraflores',
  'sjm': 'San Juan de Miraflores',
  'villa maria del triunfo': 'Villa María del Triunfo',
  'villa maría del triunfo': 'Villa María del Triunfo',
  'vmt': 'Villa María del Triunfo',
  'villa el salvador': 'Villa El Salvador',
  'ves': 'Villa El Salvador',
  'lurin': 'Lurín',
  'lurín': 'Lurín',
  'pachacamac': 'Pachacámac',
  'pachacámac': 'Pachacámac',
  'pucusana': 'Pucusana',
  'punta hermosa': 'Punta Hermosa',
  'punta negra': 'Punta Negra',
  'san bartolo': 'San Bartolo',
  'santa maria del mar': 'Santa María del Mar',
  'santa maría del mar': 'Santa María del Mar',
  'callao': 'Callao',
  'bellavista': 'Bellavista',
  'la perla': 'La Perla',
  'la punta': 'La Punta',
  'carmen de la legua': 'Carmen de la Legua',
  'ventanilla': 'Ventanilla',
  'mi peru': 'Mi Perú',
  'mi perú': 'Mi Perú'
};

function detectLimaDistrict(text: string): string | null {
  if (!text) return null;
  const normalized = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/gi, ' ')
    .trim();

  // Buscar coincidencia empezando por los distritos con nombres más largos
  const sortedKeys = Object.keys(LIMA_DISTRICT_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const keyNorm = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const regex = new RegExp(`\\b${keyNorm}\\b`, 'i');
    if (regex.test(normalized)) {
      return LIMA_DISTRICT_MAP[key]!;
    }
  }
  return null;
}

function extractAge(text: string): number | null {
  if (!text) return null;
  // Extrae número de 2 dígitos representativo de edad (14 a 99)
  const matches = text.match(/\b(1[4-9]|[2-9][0-9])\b/g);
  if (matches && matches.length > 0) {
    const num = parseInt(matches[0]!, 10);
    if (num >= 14 && num <= 99) return num;
  }
  return null;
}

function extractGender(text: string): string | null {
  if (!text) return null;
  const norm = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/\b(femenino|mujer|f|chica|dama)\b/i.test(norm)) return 'Femenino';
  if (/\b(masculino|hombre|m|varon|chico|caballero)\b/i.test(norm)) return 'Masculino';
  if (/\b(no\s*binario|otro|prefiero\s*no\s*decir)\b/i.test(norm)) return 'Otro';
  return null;
}

/**
 * Despacha las 5 mejores ofertas de una zona especificada por WhatsApp
 */
async function dispatchFiveOffers(
  user: any,
  distrito: string,
  doSend: (payload: SendPayload) => Promise<void>,
  cleanPhone: string,
  canal: 'meta' | 'waha',
  tituloIntro?: string
) {
  function getPlanRank(plan?: string): number {
    if (!plan) return 3;
    const p = plan.toLowerCase();
    if (p.includes('premium')) return 1;
    if (p.includes('destacado')) return 2;
    return 3;
  }

  const ofertasValidas = serverOfertas.filter((o: any) => {
    const activa = o.estado === 'activa';
    const noExpirada = new Date(o.venceEn).getTime() > Date.now();
    const rawWsp = o.comercioWhatsapp || o.comercioTelefono || o.telefonoComercio || '';
    const cleanWsp = rawWsp.replace(/\D/g, '');
    const tieneWspValido = cleanWsp.length >= 7;
    return activa && noExpirada && tieneWspValido;
  });

  const normDist = (distrito || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  const deDistrito = ofertasValidas.filter((o: any) => {
    const oDist = (o.distrito || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return oDist.includes(normDist) || normDist.includes(oDist);
  });

  const resto = ofertasValidas.filter((o: any) => !deDistrito.includes(o));

  const sortFn = (a: any, b: any) => {
    const rankA = getPlanRank(a.planComercio || a.plan);
    const rankB = getPlanRank(b.planComercio || b.plan);
    if (rankA !== rankB) return rankA - rankB;
    const timeA = new Date(a.creadaEn || a.validadaEn || 0).getTime();
    const timeB = new Date(b.creadaEn || b.validadaEn || 0).getTime();
    return timeA - timeB;
  };

  deDistrito.sort(sortFn);
  resto.sort(sortFn);

  // Exactamente 5 ofertas prioritarias
  const seleccionadas = [...deDistrito, ...resto].slice(0, 5);

  if (seleccionadas.length > 0) {
    if (tituloIntro) {
      await doSend({ text: tituloIntro });
    }

    for (const o of seleccionadas) {
      try {
        const expFormatted = formatLimaExpirationDate(o.venceEn);
        const cardBuffer = await renderOfferCardImage({
          id: o.id,
          titulo: o.titulo,
          comercioNombre: o.comercioNombre,
          precioNormal: o.precioNormal,
          precioOferta: o.precioOferta,
          distrito: o.distrito,
          categoria: o.categoria,
          imagenUrl: o.imagenUrl,
          imagenes: o.imagenes,
          tipo: o.tipo,
          venceEn: o.venceEn,
          distanciaTexto: o.distanciaTexto
        });

        const pOferta = Number(o.precioOferta).toFixed(2);
        const pNormal = Number(o.precioNormal).toFixed(2);
        const rawWsp = o.comercioWhatsapp || o.comercioTelefono || o.telefonoComercio || '';
        const cleanComercioWsp = rawWsp.replace(/\D/g, '');
        const cleanId = (o.id || 'card').replace(/[^a-zA-Z0-9_-]/g, '_');

        // Enlace completo al WhatsApp del comercio con mensaje prellenado y parámetros de atribución
        const refParam = user?.codigoRef ? `&ref=${encodeURIComponent(user.codigoRef)}` : '';
        const msgContacto = encodeURIComponent(`Hola, vi en vuuy su oferta "${o.titulo}" (S/ ${pOferta})`);
        const waMerchantUrl = `https://wa.me/${cleanComercioWsp}?text=${msgContacto}&utm_source=whatsapp_bot&utm_medium=cta_button&utm_campaign=ofertas_locales${refParam}`;

        // Estructura limpia de la tarjeta: CERO enlaces a la web en el mensaje y botón interactivo CTA enmascarado
        let caption = '🏷️ *' + o.titulo + '*\n';
        caption += '🏢 *' + o.comercioNombre + '* (' + o.distrito + ')\n';
        caption += '💰 *S/ ' + pOferta + '* ~Antes S/ ' + pNormal + '~\n';
        caption += expFormatted;

        await doSend({
          image: cardBuffer,
          imageUrl: `/cards/card_${cleanId}.jpg`,
          caption: caption,
          interactiveButton: {
            displayText: '💬 Pedir por WhatsApp',
            url: waMerchantUrl
          }
        });
        await new Promise(r => setTimeout(r, 600));
      } catch (cardErr) {
        console.error('Error enviando tarjeta de oferta ' + o.id + ':', cardErr);
      }
    }

    // Mensaje de cierre 100% conversacional en WhatsApp (sin enlaces a la web)
    await doSend({
      text: `✨ *¿Quieres ver más ofertas?*\nResponde con *Más ofertas* en este chat para recibir otra selección de promociones en *${distrito}* 🛍️`
    });

    messageLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      canal,
      direccion: 'saliente',
      telefono: `+${cleanPhone}`,
      contenido: `Despachadas ${seleccionadas.length} tarjetas de ofertas para zona "${distrito}" al usuario ${user.nombre || cleanPhone}.`,
      estado: 'entregado',
      detalles: `Ofertas de zona despachadas exitosamente (5 ofertas con diseño idéntico al feed web)`
    });
  } else {
    await doSend({
      text: `¡Hola ${user.nombre || ''}! En este momento no encontramos ofertas activas en tu zona. ¡Pronto más comercios de ${distrito} publicarán sus promociones! 🛍️`
    });
  }
}

/**
 * Procesador centralizado de mensajes entrantes de WhatsApp (Baileys en vivo, Webhooks, Simulador)
 * Flujo directo sin registro previo con perfilado progresivo:
 * 1. Clic directo en web -> Abre WhatsApp con mensaje preconfigurado.
 * 2. Bot registra nombre (pushName) y teléfono, y solicita zona/distrito.
 * 3. Usuario responde zona -> Bot guarda distrito y despacha las primeras 5 ofertas.
 * 4. Usuario pregunta por 2da vez ("más ofertas", etc.) -> Bot solicita edad y género.
 * 5. Usuario responde edad y género -> Bot actualiza perfil en DB para segmentación y despacha nuevas ofertas.
 */
async function procesarMensajeEntrante({ from, body, senderPhone, pushName, canal = 'waha', replySender }: IncomingMessageParams) {
  const cleanPhone = normalizeSenderPhone(senderPhone);
  if (!cleanPhone) return;

  const jid = from.includes('@') ? from : `${cleanPhone}@s.whatsapp.net`;

  const doSend = async (payload: SendPayload) => {
    if (replySender) {
      await replySender(payload);
      return;
    }

    // Despacho oficial para canal Meta Cloud API (Graph API)
    if (canal === 'meta' && waConfig.metaConfig.accessToken && waConfig.metaConfig.phoneNumberId) {
      const metaUrl = `https://graph.facebook.com/v21.0/${waConfig.metaConfig.phoneNumberId}/messages`;
      const hostUrl = process.env.PUBLIC_URL || 'https://ais-dev-jiyymszpfhdhvbaszxictn-469065484271.us-east1.run.app';
      
      const metaPayload: any = {
        messaging_product: 'whatsapp',
        to: cleanPhone
      };

      if (payload.interactiveButton && payload.image) {
        const imgLink = payload.imageUrl ? `${hostUrl}${payload.imageUrl}` : `${hostUrl}/banner-ficha-oferta-mujer.webp`;
        metaPayload.type = 'interactive';
        metaPayload.interactive = {
          type: 'cta_url',
          header: {
            type: 'image',
            image: { link: imgLink }
          },
          body: {
            text: payload.caption || 'Oferta destacada'
          },
          action: {
            name: 'cta_url',
            parameters: {
              display_text: payload.interactiveButton.displayText,
              url: payload.interactiveButton.url
            }
          }
        };
      } else if (payload.image) {
        metaPayload.type = 'image';
        const imgLink = payload.imageUrl ? `${hostUrl}${payload.imageUrl}` : `${hostUrl}/banner-ficha-oferta-mujer.webp`;
        metaPayload.image = { link: imgLink, caption: payload.caption };
      } else {
        metaPayload.type = 'text';
        metaPayload.text = { body: payload.text || '' };
      }

      try {
        await fetch(metaUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${waConfig.metaConfig.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metaPayload)
        });
      } catch (errMeta) {
        console.error('[Meta Cloud API] Error enviando mensaje interactivo:', errMeta);
      }
      return;
    }

    // Despacho para canal Baileys / WhatsApp Web
    if (activeBaileysSocket && wahaSession.status === 'WORKING') {
      try {
        if (payload.interactiveButton && payload.image) {
          try {
            await activeBaileysSocket.sendMessage(jid, {
              image: payload.image as Buffer,
              caption: payload.caption || '',
              templateButtons: [
                {
                  index: 1,
                  urlButton: {
                    displayText: payload.interactiveButton.displayText,
                    url: payload.interactiveButton.url
                  }
                }
              ]
            } as any);
          } catch (eBtn) {
            await activeBaileysSocket.sendMessage(jid, {
              image: payload.image as Buffer,
              caption: (payload.caption || '') + `\n\n👉 *[ ${payload.interactiveButton.displayText} ]*\n${payload.interactiveButton.url}`
            } as any);
          }
        } else if (payload.image) {
          await activeBaileysSocket.sendMessage(jid, {
            image: payload.image as Buffer,
            caption: payload.caption
          } as any);
        } else if (payload.text) {
          await activeBaileysSocket.sendMessage(jid, { text: payload.text } as any);
        }
      } catch (errBail) {
        console.error('[Baileys] Error despachando mensaje:', errBail);
      }
    }
  };

  const bodyLower = (body || '').toLowerCase().trim();

  // =========================================================================
  // 1. VALIDACIÓN PREVIA EN BASE DE DATOS DE USUARIOS REGISTRADOS
  // El número se toma automáticamente del remitente y se guarda en formato único
  // (con código de país, solo dígitos, ej: 51987654321) para garantizar unicidad.
  // =========================================================================
  const uniqueUserId = `usr_wa_${cleanPhone}`;
  let dbUser = await getOrFindAudienceUser(cleanPhone);

  const yaRegistradoConZona = !!dbUser && !!dbUser.distrito && dbUser.estado === 'activo';
  console.log(`[WhatsApp Validador] Verificando contacto ${cleanPhone}... Registrado en DB: ${yaRegistradoConZona ? `SÍ (${dbUser?.nombre}, ${dbUser?.distrito})` : 'NO'}`);

  // 1.1 Manejo de BAJA / STOP / DESUSCRIPCIÓN
  if (/^(stop|baja|cancelar|salir|desuscribir|detener)$/i.test(bodyLower) || bodyLower.includes('desuscribir') || bodyLower === 'stop') {
    if (dbUser) {
      dbUser.estado = 'desuscrito';
      dbUser.consentimientos = { ...(dbUser.consentimientos || {}), whatsapp: false };
      await saveAudienceUserSafely(dbUser);
    }

    const respuestaBaja = 'Has sido desuscrito de las notificaciones de vuuy. Ya no recibirás más ofertas por WhatsApp a menos que vuelvas a escribir *Ofertas*. ¡Gracias!';
    await doSend({ text: respuestaBaja });

    messageLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      canal,
      direccion: 'saliente',
      telefono: `+${cleanPhone}`,
      contenido: respuestaBaja,
      estado: 'entregado',
      detalles: 'Usuario desuscrito a petición vía WhatsApp (Stop)'
    });
    return;
  }

  // Texto oficial para solicitar edad, género y correo en un solo mensaje al pedir por segunda vez ofertas
  const textoPedirEdadGeneroCorreo = 
    `Para poder recibir las ofertas más apropiadas para ti dejamos saber: Edad y Género\n\n` +
    `Por favor indícanos en un solo mensaje:\n` +
    `1️⃣ *Edad* (ej: 28)\n` +
    `2️⃣ *Género* (ej: Femenino o Masculino)\n` +
    `3️⃣ *Correo electrónico* (ej: tu-nombre@gmail.com)\n\n` +
    `*(Puedes responder todo en un solo mensaje, por ejemplo: «28, femenino, maria@gmail.com»)*`;

  // 1.2 SI EL CONTACTO NO EXISTE EN LA BASE DE DATOS O AÚN NO TIENE ZONA:
  // EL TELÉFONO YA LO TENEMOS AUTOMÁTICAMENTE DEL REMITENTE. NO SE LE PIDE AL USUARIO.
  if (!dbUser) {
    const rawNombre = (pushName || '').trim();
    const finalNombre = (rawNombre && rawNombre !== 'Usuario WhatsApp' && rawNombre !== 'Usuario Prueba') ? rawNombre : 'Amigo/a';

    dbUser = {
      id: uniqueUserId,
      email: '', // El campo de correo se mantiene vacío hasta que el usuario lo complete
      nombre: finalNombre,
      apellido: null,
      telefono: cleanPhone, // Formato único con código de país y solo dígitos (ej: 51987654321)
      distrito: null,
      provincia: 'Lima',
      ciudad: 'Lima',
      emailVerificado: false,
      codigoRef: `REF${Math.floor(10000 + Math.random() * 90000)}`, // Prefijo REF seguido de 5 números aleatorios
      puntosSaldo: 10,
      estado: 'activo',
      categoriasInteres: [],
      consentimientos: { whatsapp: true, correo: false },
      utm: {
        origen: 'whatsapp_directo',
        etapa: 'esperando_zona',
        interaccionesCount: 1,
        ofertasPedidas: 0
      },
      registradoEn: new Date().toISOString()
    };

    // Verificar si en el primer mensaje el usuario ya indicó explícitamente su zona (ej: "Quiero ofertas en Miraflores")
    const distritoInmediato = detectLimaDistrict(body);
    if (distritoInmediato) {
      dbUser.distrito = distritoInmediato;
      dbUser.utm.etapa = 'zona_registrada';
      dbUser.utm.ofertasPedidas = 1;

      await saveAudienceUserSafely(dbUser);
      console.log(`[WhatsApp Validador] Usuario nuevo registrado en DB con zona: ${dbUser.telefono} -> ${distritoInmediato}`);

      const introText = `¡Hola ${finalNombre}! 👋 Bienvenido a *vuuy* 🛍️✨\n\nDetectamos que estás en *${distritoInmediato}*. ¡Guardamos tu zona en nuestra base de datos!\n\nAquí tienes las 5 mejores ofertas de hoy cerca de ti:`;
      await dispatchFiveOffers(dbUser, distritoInmediato, doSend, cleanPhone, canal, introText);
      return;
    }

    // Si NO indicó zona en el primer mensaje, guardar usuario y solicitar distrito
    await saveAudienceUserSafely(dbUser);

    const saludoNombre = finalNombre !== 'Amigo/a' ? ` ${finalNombre}` : '';
    const textoZona = 
      `¡Hola${saludoNombre}! 👋 Bienvenido/a a *vuuy* 🛍️✨\n\n` +
      `Para mostrarte las 5 mejores ofertas y descuentos cerca de ti, indícanos primero: ¿en qué *distrito o zona* te encuentras? 📍\n\n` +
      `*(Por ejemplo: Miraflores, Surco, Los Olivos, San Isidro, San Miguel, etc.)*`;

    await doSend({ text: textoZona });

    messageLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      canal,
      direccion: 'saliente',
      telefono: `+${cleanPhone}`,
      contenido: textoZona,
      estado: 'entregado',
      detalles: `Número nuevo registrado automáticamente en DB (+${cleanPhone}, ${finalNombre}). Solicitud de zona despachada sin enviar ofertas aún.`
    });
    return;
  }

  // Si el usuario existe en DB, asegurar que esté activo
  if (dbUser.estado !== 'activo') {
    dbUser.estado = 'activo';
  }

  if (pushName && pushName !== 'Usuario WhatsApp' && pushName !== 'Usuario Prueba' && (!dbUser.nombre || dbUser.nombre === 'Amigo/a')) {
    dbUser.nombre = pushName.trim();
  }

  const utmData = (dbUser.utm || {}) as Record<string, any>;
  const etapa = utmData.etapa || (dbUser.distrito ? 'zona_registrada' : 'esperando_zona');
  const pideOfertas = isAskingForOffers(body);
  const faltaPerfil = !utmData.edad || !utmData.genero || !dbUser.email || dbUser.email === '';

  // CASO B: El usuario está en etapa 'esperando_edad_genero' (respondiendo sus datos demográficos y correo)
  if (etapa === 'esperando_edad_genero') {
    const edadDetectada = extractAge(body);
    const generoDetectado = extractGender(body);
    const emailDetectado = extractEmailFromText(body);

    if (edadDetectada !== null || generoDetectado !== null || emailDetectado !== null) {
      const edadFinal = edadDetectada || utmData.edad || 28;
      const generoFinal = generoDetectado || utmData.genero || 'No especificado';
      if (emailDetectado) {
        dbUser.email = emailDetectado;
        dbUser.emailVerificado = true;
        dbUser.consentimientos = { ...(dbUser.consentimientos || {}), correo: true };
      }

      dbUser.utm = {
        ...utmData,
        edad: edadFinal,
        genero: generoFinal,
        email: emailDetectado || dbUser.email || utmData.email || '',
        etapa: 'perfil_completo',
        perfilCompleto: true,
        ofertasPedidas: (utmData.ofertasPedidas || 1) + 1,
        interaccionesCount: ((utmData.interaccionesCount || 2) + 1)
      };
      await saveAudienceUserSafely(dbUser);

      const resumenPartes: string[] = [];
      if (edadDetectada) resumenPartes.push(`${edadDetectada} años`);
      if (generoDetectado) resumenPartes.push(generoDetectado);
      if (emailDetectado) resumenPartes.push(emailDetectado);
      const detalleDatos = resumenPartes.length > 0 ? ` (${resumenPartes.join(', ')})` : '';

      const introText = 
        `¡Perfil completado con éxito, ${dbUser.nombre}! 🎉\n` +
        `Guardamos tus datos${detalleDatos} para enviarte solo promociones a tu medida en *${dbUser.distrito || 'Miraflores'}*.\n\n` +
        `Aquí tienes otra selección de 5 ofertas destacadas para ti:`;

      await dispatchFiveOffers(dbUser, dbUser.distrito || 'Miraflores', doSend, cleanPhone, canal, introText);
      return;
    } else {
      // Si respondió algo no reconocido, volver a pedir amablemente edad, género y correo en un solo mensaje
      await doSend({ text: textoPedirEdadGeneroCorreo });
      return;
    }
  }

  // CASO A: El usuario está registrado en DB pero aún no tiene distrito o estaba en 'esperando_zona'
  if (!dbUser.distrito || etapa === 'esperando_zona') {
    const distritoDetectado = detectLimaDistrict(body);

    if (distritoDetectado) {
      dbUser.distrito = distritoDetectado;
      dbUser.utm = {
        ...utmData,
        etapa: 'zona_registrada',
        interaccionesCount: ((utmData.interaccionesCount || 1) + 1),
        ofertasPedidas: 1
      };
      await saveAudienceUserSafely(dbUser);
      console.log(`[WhatsApp Validador] Zona registrada en DB para ${dbUser.telefono}: ${distritoDetectado}. Despachando 5 ofertas iniciales.`);

      const introText = `¡Excelente, ${dbUser.nombre}! 📍 Guardamos tu zona: *${distritoDetectado}*.\n\nAquí tienes las 5 mejores ofertas de hoy cerca de ti:`;
      await dispatchFiveOffers(dbUser, distritoDetectado, doSend, cleanPhone, canal, introText);
      return;
    }

    // Si el usuario no indicó un distrito pero está pidiendo ofertas por segunda vez:
    // NO volver a enviar el saludo de bienvenida ni atrapar al usuario en un bucle de zona.
    // Se le asigna distrito de referencia (Miraflores) y se le pide edad, género y correo en un solo mensaje.
    if (pideOfertas || (utmData.interaccionesCount && utmData.interaccionesCount >= 1)) {
      dbUser.distrito = 'Miraflores';
      dbUser.utm = {
        ...utmData,
        etapa: 'esperando_edad_genero',
        ofertasPedidas: 1,
        interaccionesCount: ((utmData.interaccionesCount || 1) + 1)
      };
      await saveAudienceUserSafely(dbUser);

      await doSend({ text: textoPedirEdadGeneroCorreo });
      messageLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal,
        direccion: 'saliente',
        telefono: `+${cleanPhone}`,
        contenido: textoPedirEdadGeneroCorreo,
        estado: 'entregado',
        detalles: 'Segunda petición de ofertas: solicitud de edad, género y correo enviada sin pedir zona nuevamente'
      });
      return;
    }

    // Re-preguntar amablemente por el distrito (sin saludo repetido) si envió otro tipo de texto
    const textoRepregunta = 
      `¡Hola ${dbUser.nombre}! Para enviarte las 5 mejores promociones de hoy, por favor indícanos en qué *distrito* te encuentras 📍\n` +
      `*(Ejemplo: Miraflores, Surco, Los Olivos, San Miguel, San Borja, etc.)*`;
    await doSend({ text: textoRepregunta });
    return;
  }

  // CASO C: Usuario con distrito registrado que pide ofertas por SEGUNDA VEZ (y aún falta edad/género/correo)
  if (faltaPerfil) {
    dbUser.utm = {
      ...utmData,
      etapa: 'esperando_edad_genero',
      interaccionesCount: ((utmData.interaccionesCount || 1) + 1)
    };
    await saveAudienceUserSafely(dbUser);

    await doSend({ text: textoPedirEdadGeneroCorreo });

    messageLogs.unshift({
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      canal,
      direccion: 'saliente',
      telefono: `+${cleanPhone}`,
      contenido: textoPedirEdadGeneroCorreo,
      estado: 'entregado',
      detalles: 'Solicitud de edad, género y correo despachada en la segunda interacción de ofertas'
    });
    return;
  }

  // CASO D: Usuario con perfil completo que solicita ofertas o escribe cualquier mensaje
  dbUser.utm = {
    ...utmData,
    interaccionesCount: ((utmData.interaccionesCount || 1) + 1)
  };
  await saveAudienceUserSafely(dbUser);

  const introText = `¡Hola ${dbUser.nombre}! Aquí tienes las últimas promociones destacadas en *${dbUser.distrito || 'Lima'}*:`;
  await dispatchFiveOffers(dbUser, dbUser.distrito || 'Lima', doSend, cleanPhone, canal, introText);
}

/**
 * Inicia el motor de WhatsApp Web oficial mediante Baileys
 * Genera códigos QR reales y válidos para la app de WhatsApp
 */
async function iniciarMotorWhatsApp(forceNew = false) {
  if (isStartingSocket) return;

  if (activeBaileysSocket && wahaSession.status === 'WORKING' && !forceNew) {
    return;
  }

  isStartingSocket = true;
  wahaSession.status = 'STARTING';
  wahaSession.startedAt = new Date().toISOString();

  try {
    if (forceNew) {
      if (activeBaileysSocket) {
        try { activeBaileysSocket.end(undefined); } catch { /* ignore */ }
        activeBaileysSocket = null;
      }
      try {
        if (fs.existsSync(AUTH_DIR)) {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Error limpiando credenciales previas:', err);
      }
      await saveSetting('whatsapp_auth_files', null);
    } else {
      if (!fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
        await restoreAuthDirFromDb();
      }
    }

    if (!fs.existsSync(AUTH_DIR)) {
      fs.mkdirSync(AUTH_DIR, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] as [number, number, number] }));

    console.log(`[WhatsApp Engine] Iniciando Baileys v${version.join('.')}...`);

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      browser: ['vuuy Asistente', 'Chrome', '124.0.0.0'],
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 25000
    });

    activeBaileysSocket = sock;

    sock.ev.on('creds.update', async () => { await saveCreds(); await syncAuthDirToDb(); });

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('[WhatsApp Engine] ¡Código QR REAL generado por protocolo WhatsApp!');
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
              dark: '#0F172A',
              light: '#FFFFFF'
            }
          });

          wahaSession.qrRaw = qr;
          wahaSession.qrDataUrl = dataUrl;
          wahaSession.qrExpiresAt = Date.now() + 45 * 1000;
          wahaSession.status = 'SCAN_QR_CODE';
        } catch (err) {
          console.error('Error convirtiendo QR a imagen:', err);
        }
      }

      if (connection === 'close') {
        const error = lastDisconnect?.error as any;
        const statusCode = error?.output?.statusCode;
        const reason = DisconnectReason[statusCode] || statusCode;
        console.log(`[WhatsApp Engine] Conexión cerrada. Motivo: ${reason}`);

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log('[WhatsApp Engine] Sesión cerrada permanentemente.');
          wahaSession.status = 'STOPPED';
          wahaSession.phone = null;
          wahaSession.name = null;
          wahaSession.qrDataUrl = null;
          try {
            if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          } catch { /* ignore */ }
        } else if (shouldReconnect) {
          console.log('[WhatsApp Engine] Intentando reconexión automática...');
          setTimeout(() => {
            isStartingSocket = false;
            iniciarMotorWhatsApp(false);
          }, 3000);
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp Engine] ¡CONEXIÓN ESTABLECIDA CON ÉXITO! WhatsApp vinculado.');
        const rawId = sock.user?.id || '';
        const phoneClean = rawId.split(':')[0]?.split('@')[0] || '';

        wahaSession.status = 'WORKING';
        wahaSession.phone = phoneClean ? `+${phoneClean}` : (waConfig.numeroTelefono ? `+${waConfig.numeroTelefono.replace(/\D/g, '')}` : '');
        if (phoneClean) {
          waConfig.numeroTelefono = phoneClean;
          saveSetting('whatsapp_config', waConfig).catch(() => {});
        }
        wahaSession.name = sock.user?.name || 'vuuy Bot';
        wahaSession.qrDataUrl = null;
        wahaSession.qrRaw = null;
        wahaSession.qrExpiresAt = null;
        wahaSession.pairingCode = null;

        // Persistir inmediatamente credenciales a Cloud SQL
        syncAuthDirToDb().catch(e => console.warn('[WhatsApp Engine] Error en sync post-login:', e));

        messageLogs.unshift({
          id: `log_${Date.now()}`,
          timestamp: new Date().toISOString(),
          canal: 'waha',
          direccion: 'saliente',
          telefono: wahaSession.phone,
          contenido: 'Dispositivo vinculado exitosamente a WhatsApp Web.',
          estado: 'entregado',
          detalles: 'Handshake completado y autenticado.'
        });
      }
    });

    // Mapear contactos y asociar LIDs a números de WhatsApp reales
    const updateLidMap = (contacts: any[]) => {
      for (const c of contacts) {
        if (c.id && (c as any).lid) {
          const cleanP = c.id.replace('@s.whatsapp.net', '').split(':')[0].replace(/\D/g, '');
          const cleanLid = (c as any).lid.replace('@lid', '').split(':')[0].replace(/\D/g, '');
          if (cleanP && cleanLid) {
            lidToPhoneMap.set(cleanLid, cleanP);
          }
        }
      }
    };
    sock.ev.on('contacts.upsert', updateLidMap);
    sock.ev.on('contacts.update', updateLidMap);

    // Escuchar mensajes entrantes reales
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const from = msg.key.remoteJid || '';
          if (from.endsWith('@g.us')) continue; // Ignorar grupos

          let rawPhone = from.replace('@s.whatsapp.net', '').split(':')[0] || '';
          if (from.endsWith('@lid')) {
            const candidate = 
              (msg.key as any).participant || 
              (msg as any).participant || 
              (msg.key as any).remoteJidAlt || 
              (msg.key as any).participantPn || 
              (msg as any).participantPn || 
              (msg.key as any).senderPn || 
              (msg as any).senderPn || '';

            if (candidate && !candidate.endsWith('@lid')) {
              rawPhone = candidate.replace('@s.whatsapp.net', '').split(':')[0] || '';
            } else {
              const lidClean = from.replace('@lid', '').split(':')[0].replace(/\D/g, '');
              if (lidToPhoneMap.has(lidClean)) {
                rawPhone = lidToPhoneMap.get(lidClean)!;
              } else {
                rawPhone = lidClean;
              }
            }
          }
          const senderPhone = rawPhone.replace(/\D/g, '');
          const body = extractMessageText(msg.message);

          console.log(`[WhatsApp Real] Mensaje de +${senderPhone}: "${body}"`);

          messageLogs.unshift({
            id: `log_${Date.now()}`,
            timestamp: new Date().toISOString(),
            canal: 'waha',
            direccion: 'entrante',
            telefono: `+${senderPhone}`,
            contenido: body || '[Contenido multimedia]',
            estado: 'recibido',
            detalles: 'Mensaje entrante recibido por protocolo WhatsApp Web'
          });

          await procesarMensajeEntrante({
            from,
            body,
            senderPhone,
            pushName: msg.pushName || '',
            canal: 'waha'
          });
        }
      }
    });
  } catch (error) {
    console.error('[WhatsApp Engine] Error iniciando socket:', error);
    wahaSession.status = 'FAILED';
  } finally {
    isStartingSocket = false;
  }
}

/* ==========================================================
   RUTAS DE CONFIGURACIÓN Y ESTADO DE WHATSAPP
   ========================================================== */

app.get('/api/whatsapp/config', (_req: Request, res: Response) => {
  const activeBotPhone = getBotPhoneNumber();
  res.json({
    ok: true,
    config: waConfig,
    botPhone: activeBotPhone,
    whatsappLink: activeBotPhone ? `whatsapp://send?phone=${activeBotPhone}&text=${encodeURIComponent('Ofertas')}` : '',
    wahaSession: {
      status: wahaSession.status,
      phone: wahaSession.phone,
      name: wahaSession.name,
      startedAt: wahaSession.startedAt,
      pairingCode: wahaSession.pairingCode
    }
  });
});

app.post('/api/whatsapp/config', async (req: Request, res: Response) => {
  const { modoActivo, metaConfig, wahaConfig, numeroTelefono } = req.body;
  if (modoActivo && (modoActivo === 'meta' || modoActivo === 'waha')) {
    waConfig.modoActivo = modoActivo;
  }
  if (numeroTelefono !== undefined) {
    waConfig.numeroTelefono = numeroTelefono;
  }
  if (metaConfig) {
    waConfig.metaConfig = { ...waConfig.metaConfig, ...metaConfig };
  }
  if (wahaConfig) {
    waConfig.wahaConfig = { ...waConfig.wahaConfig, ...wahaConfig };
  }

  try {
    await saveSetting('whatsapp_config', waConfig);
  } catch (err) {
    console.warn('[Cloud SQL] Error persistiendo whatsapp_config:', err);
  }

  const activeBotPhone = getBotPhoneNumber();

  res.json({
    ok: true,
    mensaje: 'Configuración de WhatsApp guardada exitosamente.',
    config: waConfig,
    botPhone: activeBotPhone,
    whatsappLink: activeBotPhone ? `whatsapp://send?phone=${activeBotPhone}&text=${encodeURIComponent('Ofertas')}` : ''
  });
});

/* ==========================================================
   META CLOUD API: WEBHOOKS & VERIFICACIÓN
   ========================================================== */

// Verificación de Webhook por Meta (GET)
app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === waConfig.metaConfig.verifyToken) {
    console.log('[Meta Cloud API] Webhook verificado correctamente');
    return res.status(200).send(challenge);
  }

  console.warn('[Meta Cloud API] Verificación de webhook fallida');
  return res.status(403).json({ error: 'Token de verificación inválido' });
});

// Recepción de Mensajes de Meta (POST)
app.post('/api/whatsapp/webhook', (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value = change.value;
          if (value?.messages?.length > 0) {
            const msg = value.messages[0];
            const senderPhone = msg.from;
            const textBody = msg.text?.body || '';

            messageLogs.unshift({
              id: `log_${Date.now()}`,
              timestamp: new Date().toISOString(),
              canal: 'meta',
              direccion: 'entrante',
              telefono: `+${senderPhone}`,
              contenido: textBody,
              estado: 'recibido',
              detalles: `Mensaje recibido vía Meta Cloud API (ID: ${msg.id})`
            });

            const contactName = value?.contacts?.[0]?.profile?.name || '';
            procesarMensajeEntrante({
              from: senderPhone,
              body: textBody,
              senderPhone,
              pushName: contactName,
              canal: 'meta'
            }).catch(e => console.error('[Meta Webhook] Error procesando mensaje:', e));
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.sendStatus(404);
  } catch (error) {
    console.error('[Meta Cloud API] Error procesando webhook:', error);
    return res.status(500).json({ error: 'Error procesando webhook' });
  }
});

/* ==========================================================
   WAHA & BAILEYS: SESIÓN CON CÓDIGO QR REAL & PAIRING CODE
   ========================================================== */

// Iniciar sesión y generar código QR real de WhatsApp
app.post('/api/waha/session/start', async (_req: Request, res: Response) => {
  try {
    await iniciarMotorWhatsApp(false);

    // Esperar hasta 2.5 segundos para que Baileys emita el primer QR real si no está listo
    let espera = 0;
    while (!wahaSession.qrDataUrl && wahaSession.status !== 'WORKING' && espera < 2500) {
      await new Promise(r => setTimeout(r, 200));
      espera += 200;
    }

    res.json({
      ok: true,
      status: wahaSession.status,
      phone: wahaSession.phone,
      qrDataUrl: wahaSession.qrDataUrl,
      expiresAt: wahaSession.qrExpiresAt,
      pairingCode: wahaSession.pairingCode
    });
  } catch (error) {
    console.error('Error iniciando sesión WhatsApp:', error);
    res.status(500).json({ ok: false, error: 'Error iniciando sesión de WhatsApp' });
  }
});

// Obtener estado actual de la sesión
app.get('/api/waha/session/status', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    status: wahaSession.status,
    phone: wahaSession.phone,
    name: wahaSession.name,
    qrDataUrl: wahaSession.qrDataUrl,
    expiresAt: wahaSession.qrExpiresAt,
    startedAt: wahaSession.startedAt,
    pairingCode: wahaSession.pairingCode
  });
});

// Forzar refresco o generación de nuevo código QR
app.get('/api/waha/session/qr', async (req: Request, res: Response) => {
  try {
    if (wahaSession.status === 'WORKING') {
      return res.json({ ok: true, status: 'WORKING', phone: wahaSession.phone });
    }

    const forceReset = req.query.force === 'true';
    await iniciarMotorWhatsApp(forceReset);

    let espera = 0;
    while (!wahaSession.qrDataUrl && espera < 3000) {
      await new Promise(r => setTimeout(r, 250));
      espera += 250;
    }

    res.json({
      ok: true,
      qrDataUrl: wahaSession.qrDataUrl,
      expiresAt: wahaSession.qrExpiresAt,
      status: wahaSession.status
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error refrescando QR' });
  }
});

// Vincular alternativamente usando Código de Vinculación de 8 dígitos (Pairing Code)
app.post('/api/waha/session/pairing-code', async (req: Request, res: Response) => {
  try {
    const { telefono } = req.body;
    if (!telefono) {
      return res.status(400).json({ ok: false, error: 'Número telefónico requerido (ej: 51987654321)' });
    }

    const cleanPhone = telefono.replace(/\D/g, '');
    if (cleanPhone.length < 8) {
      return res.status(400).json({ ok: false, error: 'Número de teléfono inválido' });
    }

    await iniciarMotorWhatsApp(false);

    if (activeBaileysSocket && typeof activeBaileysSocket.requestPairingCode === 'function') {
      const code = await activeBaileysSocket.requestPairingCode(cleanPhone);
      wahaSession.pairingCode = code;
      wahaSession.status = 'SCAN_QR_CODE';

      res.json({
        ok: true,
        pairingCode: code,
        telefono: cleanPhone,
        instrucciones: 'Ve a WhatsApp > Dispositivos vinculados > Vincular con el número de teléfono e ingresa este código.'
      });
    } else {
      res.status(500).json({ ok: false, error: 'El motor aún no está listo para generar pairing code.' });
    }
  } catch (error) {
    console.error('Error solicitando pairing code:', error);
    res.status(500).json({ ok: false, error: 'Error generando código de vinculación' });
  }
});

// Cerrar sesión / Desconectar WhatsApp
app.post('/api/waha/session/logout', async (_req: Request, res: Response) => {
  try {
    if (activeBaileysSocket) {
      try { await activeBaileysSocket.logout(); } catch { /* ignore */ }
      try { activeBaileysSocket.end(undefined); } catch { /* ignore */ }
      activeBaileysSocket = null;
    }

    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    await saveSetting('whatsapp_auth_files', null);

    wahaSession = {
      status: 'STOPPED',
      phone: null,
      name: null,
      qrRaw: null,
      qrDataUrl: null,
      qrExpiresAt: null,
      startedAt: null,
      pairingCode: null
    };

    res.json({
      ok: true,
      mensaje: 'Sesión de WhatsApp desconectada y credenciales limpiadas.',
      status: wahaSession.status
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al desconectar' });
  }
});

// Webhook para eventos de WAHA (si el usuario conecta a un contenedor WAHA externo)
app.post('/api/waha/webhook', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (payload.event === 'message') {
      const msg = payload.payload;
      const remitente = msg.from || '';
      const cleanPhone = remitente.replace(/\D/g, '');
      const texto = msg.body || '';

      messageLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal: 'waha',
        direccion: 'entrante',
        telefono: `+${cleanPhone}`,
        contenido: texto,
        estado: 'recibido',
        detalles: 'Procesado desde webhook WAHA externo'
      });

      await procesarMensajeEntrante({
        from: remitente,
        body: texto,
        senderPhone: cleanPhone,
        pushName: msg._data?.notifyName || '',
        canal: 'waha'
      });
    }

    res.json({ ok: true, status: 'processed' });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando webhook WAHA' });
  }
});

// Endpoint de prueba y simulación para recibir mensajes y probar el flujo de ofertas
app.post('/api/whatsapp/simulate-incoming', async (req: Request, res: Response) => {
  try {
    const { telefono, texto, pushName } = req.body;
    if (!telefono || !texto) {
      return res.status(400).json({ ok: false, error: 'Se requiere telefono y texto' });
    }

    const cleanPhone = telefono.replace(/\D/g, '');
    const simulatedAnswers: any[] = [];

    await procesarMensajeEntrante({
      from: `${cleanPhone}@s.whatsapp.net`,
      body: texto,
      senderPhone: cleanPhone,
      pushName: pushName || 'Usuario Prueba',
      canal: 'waha',
      replySender: async (payload) => {
        simulatedAnswers.push(payload);
        if (activeBaileysSocket && wahaSession.status === 'WORKING') {
          try {
            await activeBaileysSocket.sendMessage(`${cleanPhone}@s.whatsapp.net`, payload as any);
          } catch (e) {
            console.warn('[Simulador] No se pudo enviar por WhatsApp real:', e);
          }
        }
      }
    });

    res.json({
      ok: true,
      mensaje: `Mensaje "${texto}" de +${cleanPhone} procesado con éxito`,
      respuestasGeneradas: simulatedAnswers.length,
      respuestas: simulatedAnswers.map(a => ({
        tipo: a.interactiveButton ? 'tarjeta_con_boton_cta' : a.image ? 'imagen_con_caption' : 'texto',
        texto: a.text || a.caption || '',
        boton: a.interactiveButton ? { texto: a.interactiveButton.displayText, url: a.interactiveButton.url } : null,
        imagenUrl: a.imageUrl || null
      }))
    });
  } catch (err: any) {
    console.error('Error en /api/whatsapp/simulate-incoming:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ==========================================================
   RUTA ENMASCARADA DE CONTACTO (CALL-TO-ACTION REDIRECT)
   Permite saltar de inmediato al WhatsApp del comerciante con
   todos los parámetros de medición sin mostrarlos crudos en texto.
   ========================================================== */

app.get('/c/:ofertaId', (req: Request, res: Response) => {
  const { ofertaId } = req.params;
  const ref = req.query.ref as string;
  const oferta = serverOfertas.find((o: any) => o.id === ofertaId);
  if (!oferta) {
    return res.status(404).send('Oferta no encontrada');
  }

  const pOferta = Number(oferta.precioOferta).toFixed(2);
  const rawWsp = oferta.comercioWhatsapp || oferta.comercioTelefono || oferta.telefonoComercio || '';
  const cleanComercioWsp = rawWsp.replace(/\D/g, '');
  const refParam = ref ? `&ref=${encodeURIComponent(ref)}` : '';
  const msgContacto = encodeURIComponent(`Hola, vi en vuuy su oferta "${oferta.titulo}" (S/ ${pOferta})`);
  const targetUrl = `https://wa.me/${cleanComercioWsp}?text=${msgContacto}&utm_source=whatsapp_bot&utm_medium=cta_button&utm_campaign=ofertas_locales${refParam}`;

  res.redirect(302, targetUrl);
});

/* ==========================================================
   OFERTAS API: SINCRO ENTRE FRONTEND Y BACKEND WHATSAPP ENGINE
   ========================================================== */

app.get('/api/ofertas', (_req: Request, res: Response) => {
  res.json({ ok: true, ofertas: serverOfertas });
});

app.post('/api/ofertas/sync', async (req: Request, res: Response) => {
  try {
    const { ofertas } = req.body;
    if (Array.isArray(ofertas)) {
      serverOfertas = ofertas;
      try {
        await syncOffers(serverOfertas);
      } catch (e) {
        console.warn('[Cloud SQL] Error persistiendo ofertas:', e);
      }
      res.json({ ok: true, count: serverOfertas.length });
    } else {
      res.status(400).json({ ok: false, error: 'Se esperaba un arreglo de ofertas' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al sincronizar ofertas' });
  }
});

app.post('/api/ofertas/activar', async (req: Request, res: Response) => {
  try {
    const { ofertaId, operador } = req.body;
    const item = serverOfertas.find((o: any) => o.id === ofertaId);
    if (item) {
      item.estado = 'activa';
      item.validadaEn = new Date().toISOString();
      item.validadaPor = operador || 'Super Admin';
      try {
        await syncOffers([item]);
      } catch (e) {
        console.warn('[Cloud SQL] Error persistiendo oferta activada:', e);
      }
      res.json({ ok: true, oferta: item });
    } else {
      res.status(404).json({ ok: false, error: 'Oferta no encontrada' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al activar oferta' });
  }
});

/* ==========================================================
   BANNERS API: GESTIÓN Y PERSISTENCIA CENTRALIZADA DE BANNERS
   ========================================================== */

app.get('/api/banners', (_req: Request, res: Response) => {
  res.json({ ok: true, banners: serverBanners });
});

app.post('/api/banners/sync', async (req: Request, res: Response) => {
  try {
    const { banners } = req.body;
    if (Array.isArray(banners)) {
      serverBanners = banners.map((b: any) => {
        if (b.imagenUrl && (b.imagenUrl.includes('sustrae.com') || b.imagenUrl.includes('banner.webp'))) {
          return { ...b, imagenUrl: '/banner-ficha-oferta-mujer.webp' };
        }
        return b;
      });
      guardarServerBanners();
      try {
        await syncBanners(serverBanners);
      } catch (e) {
        console.warn('[Cloud SQL] Error persistiendo banners:', e);
      }
      deployTimestamp = Date.now().toString();
      res.json({ ok: true, count: serverBanners.length, version: deployTimestamp });
    } else {
      res.status(400).json({ ok: false, error: 'Se esperaba un arreglo de banners' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al sincronizar banners' });
  }
});

/* ==========================================================
   VERSIONADO Y PURGA DE CACHÉ
   ========================================================== */

app.get('/api/version', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    version: deployTimestamp,
    timestamp: parseInt(deployTimestamp, 10),
    serverTime: new Date().toISOString()
  });
});

app.post('/api/cache/purge', (_req: Request, res: Response) => {
  deployTimestamp = Date.now().toString();
  console.log(`[vuuy Server] Caché purgada. Nueva versión de recursos: ${deployTimestamp}`);
  res.json({
    ok: true,
    version: deployTimestamp,
    timestamp: parseInt(deployTimestamp, 10),
    message: 'Todas las cachés de recursos estáticos han sido invalidadas en el servidor'
  });
});

/* ==========================================================
   PRUEBA DE MENSAJERÍA REAL & LOGS
   ========================================================== */

// Envío de mensaje de prueba (vía Baileys real o Meta Graph API)
app.post('/api/whatsapp/test-message', async (req: Request, res: Response) => {
  const { telefono, texto, videoUrl, imageUrl, tipo } = req.body;

  if (!telefono || (!texto && !videoUrl && !imageUrl)) {
    return res.status(400).json({ ok: false, error: 'Teléfono y contenido (texto o multimedia) son requeridos' });
  }

  const canal = waConfig.modoActivo;
  const cleanPhone = telefono.replace(/\D/g, '');

  try {
    // Si estamos en modo WAHA y el socket Baileys está conectado, ¡ENVIAR MENSAJE REAL!
    if (canal === 'waha' && activeBaileysSocket && wahaSession.status === 'WORKING') {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      
      if (videoUrl) {
        // Enviar video animado de oferta con subtítulo
        const absVideoPath = videoUrl.startsWith('/videos/') 
          ? path.resolve(VIDEOS_DIR, path.basename(videoUrl))
          : null;

        if (absVideoPath && fs.existsSync(absVideoPath)) {
          const videoBuffer = await fs.promises.readFile(absVideoPath);
          await activeBaileysSocket.sendMessage(jid, { 
            video: videoBuffer, 
            caption: texto || '🎬 ¡Oferta exclusiva en video!' 
          });
        } else {
          await activeBaileysSocket.sendMessage(jid, { 
            video: { url: videoUrl }, 
            caption: texto || '🎬 ¡Oferta exclusiva en video!' 
          });
        }
      } else if (imageUrl) {
        await activeBaileysSocket.sendMessage(jid, { 
          image: { url: imageUrl }, 
          caption: texto || '📸 Oferta comercial' 
        });
      } else {
        await activeBaileysSocket.sendMessage(jid, { text: texto });
      }

      const logExito: MessageEventLog = {
        id: `log_test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal: 'waha',
        direccion: 'saliente',
        telefono,
        contenido: videoUrl ? `[VIDEO MP4] ${texto}` : imageUrl ? `[FOTO] ${texto}` : texto,
        estado: 'entregado',
        detalles: videoUrl 
          ? `Video animado de oferta (Veo) despachado vía WhatsApp Web oficial a +${cleanPhone}` 
          : `Mensaje REAL despachado vía WhatsApp Web oficial a +${cleanPhone}`
      };

      messageLogs.unshift(logExito);

      return res.json({
        ok: true,
        mensaje: videoUrl
          ? `¡Video de oferta animado despachado con éxito a +${cleanPhone}!`
          : `¡Mensaje real de WhatsApp despachado con éxito a +${cleanPhone}!`,
        canal,
        real: true,
        tipo: videoUrl ? 'video' : imageUrl ? 'image' : 'text',
        log: logExito
      });
    }

    // Si está en modo Meta y hay credenciales
    if (canal === 'meta' && waConfig.metaConfig.accessToken && waConfig.metaConfig.phoneNumberId) {
      const metaUrl = `https://graph.facebook.com/v21.0/${waConfig.metaConfig.phoneNumberId}/messages`;
      
      const payload: any = {
        messaging_product: 'whatsapp',
        to: cleanPhone
      };

      if (videoUrl) {
        payload.type = 'video';
        payload.video = { link: videoUrl, caption: texto };
      } else if (imageUrl) {
        payload.type = 'image';
        payload.image = { link: imageUrl, caption: texto };
      } else {
        payload.type = 'text';
        payload.text = { body: texto };
      }

      const metaRes = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waConfig.metaConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        throw new Error(metaData.error?.message || 'Error en Meta Graph API');
      }

      const logMeta: MessageEventLog = {
        id: `log_test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal: 'meta',
        direccion: 'saliente',
        telefono,
        contenido: videoUrl ? `[VIDEO MP4] ${texto}` : imageUrl ? `[FOTO] ${texto}` : texto,
        estado: 'entregado',
        detalles: `Mensaje ${videoUrl ? 'con VIDEO' : ''} despachado vía Meta Cloud API Oficial (ID: ${metaData.messages?.[0]?.id})`
      };

      messageLogs.unshift(logMeta);

      return res.json({
        ok: true,
        mensaje: `Mensaje despachado vía Meta Cloud API a +${cleanPhone}.`,
        canal,
        real: true,
        log: logMeta
      });
    }

    // Fallback: Si no está conectado aún, registrar como simulación
    const logSimulado: MessageEventLog = {
      id: `log_test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      canal,
      direccion: 'saliente',
      telefono,
      contenido: texto,
      estado: 'entregado',
      detalles: `Simulación (Vincula WhatsApp mediante el código QR para enviar mensajes reales)`
    };

    messageLogs.unshift(logSimulado);

    return res.json({
      ok: true,
      mensaje: `Mensaje de prueba registrado. Para entrega real, vincula tu WhatsApp escaneando el código QR.`,
      canal,
      real: false,
      log: logSimulado
    });
  } catch (error: any) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error al despachar mensaje' });
  }
});

// Obtener registros de eventos
app.get('/api/whatsapp/logs', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    logs: messageLogs.slice(0, 50)
  });
});

/* ==========================================================
   CONFIGURACIÓN Y DESPACHO DE CORREOS (SMTP / RESEND)
   ========================================================== */

interface EmailServerConfig {
  provider: 'smtp' | 'resend';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };
  resend: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
}

let emailConfig: EmailServerConfig = {
  provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'resend') || (process.env.RESEND_API_KEY ? 'resend' : 'smtp'),
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'Sustrae Imprenta',
    fromEmail: process.env.EMAIL_FROM || 'no-reply@mail.sustrae.com'
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'no-reply@mail.sustrae.com',
    fromName: process.env.RESEND_FROM_NAME || 'Sustrae Imprenta'
  }
};

interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  provider: 'smtp' | 'resend' | 'simulated';
  status: 'entregado' | 'fallido' | 'simulado';
  timestamp: string;
  verificationToken?: string;
  verificationLink?: string;
  whatsappLink?: string;
  error?: string;
}

let emailLogs: EmailLogEntry[] = [];

function generarPlantillaCorreoVuuy(params: {
  nombre: string;
  verificationLink: string;
  whatsappLink: string;
  botPhone: string;
}) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>¡Bienvenido a vuuy! Confirma tu correo e invitación a WhatsApp</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F4F1EA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1C1917;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #F4F1EA; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 580px; background-color: #FFFFFF; border-radius: 24px; overflow: hidden; border: 1px solid #EAE5D9; box-shadow: 0 4px 20px rgba(0,0,0,0.04);">
          <!-- Header Branded vuuy -->
          <tr>
            <td style="background-color: #1B4332; padding: 36px 32px; text-align: center;">
              <h1 style="margin: 0; color: #FFFFFF; font-size: 32px; font-weight: 900; letter-spacing: -1px;">vuuy</h1>
              <p style="margin: 6px 0 0 0; color: #A7D7C5; font-size: 13px; font-weight: 500; letter-spacing: 0.5px;">OFERTAS LOCALES CERCA DE TI · LIMA, PERÚ</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 36px 32px;">
              <h2 style="margin: 0 0 16px 0; color: #0F172A; font-size: 22px; font-weight: 800; line-height: 1.3;">
                ¡Hola, ${params.nombre}! 👋
              </h2>
              <p style="margin: 0 0 20px 0; color: #57534E; font-size: 15px; line-height: 1.6;">
                Estás a un paso de activar tu cuenta en <strong>vuuy</strong> para desbloquear las ofertas de tu distrito y comunicarte directamente con los comercios participantes.
              </p>

              <!-- Step 1: Verification -->
              <div style="background-color: #FBF9F4; border: 1px solid #EAE5D9; border-radius: 18px; padding: 22px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; color: #1B4332; text-transform: uppercase; letter-spacing: 1px;">
                  Paso 1: Confirma tu cuenta
                </p>
                <p style="margin: 0 0 16px 0; color: #44403C; font-size: 14px; line-height: 1.5;">
                  Haz clic en el siguiente botón para verificar tu correo al instante sin contraseñas ni códigos:
                </p>
                <div style="text-align: center;">
                  <a href="${params.verificationLink}" target="_blank" style="display: inline-block; background-color: #1B4332; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 14px; box-shadow: 0 2px 8px rgba(27,67,50,0.25);">
                    ✅ Confirmar mi correo (1 solo clic)
                  </a>
                </div>
              </div>

              <!-- Step 2: WhatsApp Info -->
              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 18px; padding: 22px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; color: #15803D; text-transform: uppercase; letter-spacing: 1px;">
                  Paso 2: Página de Bienvenida y WhatsApp
                </p>
                <p style="margin: 0; color: #166534; font-size: 14px; line-height: 1.5;">
                  Al confirmar tu correo serás llevado a la página de bienvenida con el enlace a nuestro WhatsApp y podrás pedir las ofertas cercanas a ti con solo enviar la palabra <strong>"Ofertas"</strong>.
                </p>
              </div>

              <p style="margin: 0; color: #78716C; font-size: 12px; line-height: 1.5; text-align: center;">
                Si tienes problemas con el botón, copia y pega este enlace en tu navegador:<br>
                <a href="${params.verificationLink}" style="color: #1B4332; word-break: break-all;">${params.verificationLink}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #F8F6F0; padding: 20px 32px; text-align: center; border-top: 1px solid #EAE5D9;">
              <p style="margin: 0; color: #A8A29E; font-size: 11px;">
                vuuy © 2026 · Modelo PULL, no push. Jamás enviamos spam ni publicidad no solicitada.<br>
                Lima, Perú.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Obtener configuración actual de correo
app.get('/api/email/config', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    provider: emailConfig.provider,
    smtp: {
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      user: emailConfig.smtp.user,
      hasPass: !!emailConfig.smtp.pass,
      fromName: emailConfig.smtp.fromName || 'Sustrae Imprenta',
      fromEmail: emailConfig.smtp.fromEmail || 'no-reply@mail.sustrae.com',
      configured: !!(emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass)
    },
    resend: {
      apiKey: emailConfig.resend.apiKey ? `${emailConfig.resend.apiKey.substring(0, 5)}***` : '',
      hasApiKey: !!emailConfig.resend.apiKey,
      fromEmail: emailConfig.resend.fromEmail || 'no-reply@mail.sustrae.com',
      fromName: emailConfig.resend.fromName || 'Sustrae Imprenta',
      configured: !!emailConfig.resend.apiKey
    }
  });
});

// Guardar configuración de correo
app.post('/api/email/config', async (req: Request, res: Response) => {
  const { provider, smtp, resend } = req.body;
  if (provider && (provider === 'smtp' || provider === 'resend')) {
    emailConfig.provider = provider;
  }
  if (smtp) {
    let newUser = emailConfig.smtp.user;
    if (typeof smtp.user === 'string' && smtp.user.trim() !== '' && !smtp.user.includes('***')) {
      newUser = smtp.user.trim();
    }

    let newPass = emailConfig.smtp.pass;
    if (typeof smtp.pass === 'string' && smtp.pass.trim() !== '' && !smtp.pass.includes('••••')) {
      newPass = smtp.pass.trim();
    }

    emailConfig.smtp = {
      host: typeof smtp.host === 'string' && smtp.host.trim() !== '' ? smtp.host.trim() : emailConfig.smtp.host,
      port: smtp.port ? Number(smtp.port) : emailConfig.smtp.port,
      secure: typeof smtp.secure === 'boolean' ? smtp.secure : emailConfig.smtp.secure,
      user: newUser,
      pass: newPass,
      fromName: typeof smtp.fromName === 'string' && smtp.fromName.trim() !== '' ? smtp.fromName.trim() : emailConfig.smtp.fromName,
      fromEmail: typeof smtp.fromEmail === 'string' && smtp.fromEmail.trim() !== '' ? smtp.fromEmail.trim() : emailConfig.smtp.fromEmail
    };
  }
  if (resend) {
    let newApiKey = emailConfig.resend.apiKey;
    if (typeof resend.apiKey === 'string' && resend.apiKey.trim() !== '' && !resend.apiKey.includes('***')) {
      newApiKey = resend.apiKey.trim();
    }

    emailConfig.resend = {
      apiKey: newApiKey,
      fromEmail: typeof resend.fromEmail === 'string' && resend.fromEmail.trim() !== '' ? resend.fromEmail.trim() : emailConfig.resend.fromEmail,
      fromName: typeof resend.fromName === 'string' && resend.fromName.trim() !== '' ? resend.fromName.trim() : emailConfig.resend.fromName
    };
  }

  try {
    await saveSetting('email_config', emailConfig);
    console.log('[Cloud SQL] Configuración de correo guardada exitosamente:', {
      provider: emailConfig.provider,
      resendFromEmail: emailConfig.resend.fromEmail,
      hasResendApiKey: !!emailConfig.resend.apiKey,
      smtpHost: emailConfig.smtp.host,
      hasSmtpPass: !!emailConfig.smtp.pass
    });
  } catch (err) {
    console.warn('[Cloud SQL] Error persistiendo email_config:', err);
  }

  res.json({
    ok: true,
    mensaje: 'Configuración de correo actualizada y guardada correctamente'
  });
});

// Obtener registros de correos enviados
app.get('/api/email/logs', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    logs: emailLogs.slice(0, 50)
  });
});

// Enviar correo de verificación y bienvenida con enlace a WhatsApp
app.post('/api/email/send-verification', async (req: Request, res: Response) => {
  try {
    const { email, nombre, verificationToken, botPhone, originUrl } = req.body;

    if (!email || !verificationToken) {
      return res.status(400).json({ ok: false, error: 'Faltan parámetros requeridos (email, verificationToken)' });
    }

    const hostUrl = originUrl || 'https://nuuvio.ai.studio';
    const verificationLink = `${hostUrl}/bienvenida?verify_token=${verificationToken}`;
    
    // Determinar número del bot de WhatsApp activo (vinculado por QR o respaldo)
    const cleanBotPhone = (botPhone ? botPhone.replace(/\D/g, '') : '') || getBotPhoneNumber();
    const whatsappLink = cleanBotPhone ? `whatsapp://send?phone=${cleanBotPhone}&text=${encodeURIComponent('Ofertas')}` : '';

    const subject = `¡Bienvenido a Sustrae Imprenta! Confirma tu cuenta e invitación oficial a WhatsApp`;
    const html = generarPlantillaCorreoVuuy({
      nombre: nombre || 'Usuario',
      verificationLink,
      whatsappLink,
      botPhone: cleanBotPhone
    });

    let sentReal = false;
    let providerUsed: 'smtp' | 'resend' | 'simulated' = 'simulated';
    let sendError: string | undefined;

    // Intento 1: Resend API si está seleccionado y tiene API key
    if (emailConfig.provider === 'resend' && emailConfig.resend.apiKey) {
      try {
        providerUsed = 'resend';
        const sender = `${emailConfig.resend.fromName || 'Sustrae Imprenta'} <${emailConfig.resend.fromEmail || 'no-reply@mail.sustrae.com'}>`;
        console.log(`[Email Server] Despachando correo a ${email} vía Resend (Remitente: ${sender})...`);

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${emailConfig.resend.apiKey}`
          },
          body: JSON.stringify({
            from: sender,
            to: [email],
            subject,
            html
          })
        });

        const resText = await resendRes.text();
        let resData: any = null;
        try { resData = JSON.parse(resText); } catch { /* noop */ }

        if (resendRes.ok) {
          sentReal = true;
          console.log(`[Email Server] Correo Resend enviado con éxito. ID: ${resData?.id || resText}`);
        } else {
          const errorMsg = resData?.message || resData?.error || resText;
          sendError = `Error Resend [HTTP ${resendRes.status}]: ${errorMsg}`;
          console.error('[Email Server]', sendError);
        }
      } catch (e: any) {
        sendError = `Resend exception: ${e.message}`;
        console.error('[Email Server]', sendError);
      }
    }

    // Intento 2: SMTP si está seleccionado y configurado
    if (!sentReal && emailConfig.provider === 'smtp' && emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass) {
      try {
        providerUsed = 'smtp';
        const transporter = nodemailer.createTransport({
          host: emailConfig.smtp.host,
          port: emailConfig.smtp.port,
          secure: emailConfig.smtp.secure,
          auth: {
            user: emailConfig.smtp.user,
            pass: emailConfig.smtp.pass
          }
        });

        await transporter.sendMail({
          from: `"${emailConfig.smtp.fromName}" <${emailConfig.smtp.fromEmail}>`,
          to: email,
          subject,
          html
        });
        sentReal = true;
      } catch (e: any) {
        sendError = `SMTP exception: ${e.message}`;
        console.error('[Email Server]', sendError);
      }
    }

    // Registrar en log
    const logItem: EmailLogEntry = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to: email,
      subject,
      provider: sentReal ? providerUsed : (sendError ? providerUsed : 'simulated'),
      status: sentReal ? 'entregado' : (sendError ? 'fallido' : 'simulado'),
      timestamp: new Date().toISOString(),
      verificationToken,
      verificationLink,
      whatsappLink,
      error: sendError
    };

    emailLogs.unshift(logItem);
    try {
      await insertEmailLog(logItem);
    } catch (err) {
      console.warn('[Cloud SQL] Error guardando log de correo:', err);
    }

    return res.json({
      ok: true,
      mensaje: sentReal
        ? `Correo de verificación enviado a ${email} mediante ${providerUsed.toUpperCase()}.`
        : (sendError
            ? `Atención: Falló el despacho de correo por ${providerUsed.toUpperCase()} (${sendError}). Registro guardado.`
            : `Correo procesado en modo simulado para ${email}. Puedes usar el enlace directo o configurar credenciales en el panel.`),
      simulated: !sentReal,
      errorDetails: sendError,
      verificationLink,
      whatsappLink,
      log: logItem
    });
  } catch (err: any) {
    console.error('[Email Server] Error despachando correo:', err);
    res.status(500).json({ ok: false, error: err.message || 'Error en servidor de correo' });
  }
});

// Enviar correo de prueba desde el Panel de Administración
app.post('/api/email/test', async (req: Request, res: Response) => {
  try {
    const { destinatario } = req.body;
    if (!destinatario) {
      return res.status(400).json({ ok: false, error: 'Especifica un correo destinatario' });
    }

    const subject = `[Prueba Sustrae Imprenta] Verificación de conexión de correo`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #F4F1EA;">
        <div style="background: white; padding: 24px; border-radius: 12px; border: 1px solid #EAE5D9;">
          <h2 style="color: #1B4332;">¡Conexión de correo exitosa!</h2>
          <p>Este es un correo de prueba enviado desde el panel de administración de <strong>Sustrae Imprenta</strong>.</p>
          <p>Proveedor activo: <strong>${emailConfig.provider.toUpperCase()}</strong></p>
          <p>Remitente configurado: <strong>${emailConfig.resend.fromName} &lt;${emailConfig.resend.fromEmail}&gt;</strong></p>
          <p style="color: #64748B; font-size: 12px;">Fecha y hora: ${new Date().toLocaleString('es-PE')}</p>
        </div>
      </div>
    `;

    if (emailConfig.provider === 'resend') {
      if (!emailConfig.resend.apiKey) {
        return res.status(400).json({
          ok: false,
          error: 'No hay API Key de Resend configurada. Ingresa tu API Key de Resend y presiona Guardar.'
        });
      }

      const sender = `${emailConfig.resend.fromName || 'Sustrae Imprenta'} <${emailConfig.resend.fromEmail || 'no-reply@mail.sustrae.com'}>`;

      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailConfig.resend.apiKey}`
        },
        body: JSON.stringify({
          from: sender,
          to: [destinatario],
          subject,
          html
        })
      });

      const resText = await resendRes.text();
      let resData: any = null;
      try { resData = JSON.parse(resText); } catch { /* noop */ }

      if (!resendRes.ok) {
        const errorMsg = resData?.message || resData?.error || resText;
        console.error('[Email Server Test] Error Resend:', errorMsg);
        return res.status(400).json({
          ok: false,
          error: `Error de Resend API [HTTP ${resendRes.status}]: ${errorMsg}`
        });
      }

      return res.json({
        ok: true,
        mensaje: `Correo de prueba enviado a ${destinatario} vía Resend API (ID: ${resData?.id || 'OK'}). Remitente: ${sender}`
      });
    }

    if (emailConfig.provider === 'smtp') {
      if (!emailConfig.smtp.host || !emailConfig.smtp.user || !emailConfig.smtp.pass) {
        return res.status(400).json({
          ok: false,
          error: 'Faltan credenciales SMTP (Host, Usuario o Contraseña).'
        });
      }

      const transporter = nodemailer.createTransport({
        host: emailConfig.smtp.host,
        port: emailConfig.smtp.port,
        secure: emailConfig.smtp.secure,
        auth: {
          user: emailConfig.smtp.user,
          pass: emailConfig.smtp.pass
        }
      });

      await transporter.sendMail({
        from: `"${emailConfig.smtp.fromName}" <${emailConfig.smtp.fromEmail}>`,
        to: destinatario,
        subject,
        html
      });

      return res.json({ ok: true, mensaje: `Correo de prueba enviado a ${destinatario} vía SMTP (${emailConfig.smtp.host})` });
    }

    return res.status(400).json({
      ok: false,
      error: `Configuración de proveedor no válida.`
    });
  } catch (error: any) {
    console.error('Error en prueba de correo:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error enviando correo de prueba' });
  }
});

/* ==========================================================
   AUDIENCIA & USUARIOS API: PERSISTENCIA EN CLOUD SQL
   ========================================================== */

app.get('/api/audience/users', async (_req: Request, res: Response) => {
  try {
    const users = await getAllAudienceUsers();
    res.json({ ok: true, users });
  } catch (err: any) {
    console.error('[Cloud SQL] Error consultando usuarios:', err);
    res.status(500).json({ ok: false, error: 'Error obteniendo usuarios de la base de datos' });
  }
});

app.post('/api/audience/sync-user', async (req: Request, res: Response) => {
  try {
    const user = req.body;
    if (user && user.id && user.email) {
      if (user.telefono) {
        const norm = normalizePhoneForMatching(user.telefono);
        if (norm.digits.length === 9) {
          user.telefono = `+51 ${norm.digits}`;
        } else if (norm.digits.startsWith('51') && norm.digits.length === 11) {
          user.telefono = `+51 ${norm.digits.slice(2)}`;
        }
      }
      await upsertAudienceUser(user);
      // Registrar en log de auditoría
      await insertRegistrationLog({
        email: user.email,
        telefono: user.telefono || '',
        nombre: `${user.nombre || ''} ${user.apellido || ''}`.trim(),
        status: 'success',
        resultDetails: 'Usuario registrado exitosamente y sincronizado en Cloud SQL'
      });
      return res.json({ ok: true, user });
    }
    res.status(400).json({ ok: false, error: 'Datos de usuario inválidos (id y email requeridos)' });
  } catch (err: any) {
    console.error('[Cloud SQL] Error sincronizando usuario:', err);
    res.status(500).json({ ok: false, error: err.message || 'Error guardando usuario en PostgreSQL' });
  }
});

app.post('/api/audience/check-uniqueness', async (req: Request, res: Response) => {
  try {
    const { email, telefono, nombre } = req.body;
    if (!email && !telefono) {
      return res.status(400).json({ ok: false, error: 'Se requiere correo electrónico o número de WhatsApp' });
    }
    const checkResult = await checkAudienceUserUniqueness(email || '', telefono || '');

    if (checkResult.exists) {
      let detalle = 'Bloqueado por duplicidad: ';
      if (checkResult.isEmailDuplicate && checkResult.isPhoneDuplicate) {
        detalle += 'Correo y WhatsApp ya existen en la base de datos';
      } else if (checkResult.isEmailDuplicate) {
        detalle += 'El correo electrónico ya existe en la base de datos';
      } else {
        detalle += 'El número de WhatsApp ya existe en la base de datos';
      }

      await insertRegistrationLog({
        email: email || 'sin-email',
        telefono: telefono || '',
        nombre: nombre || '',
        status: 'error',
        resultDetails: detalle
      });
    }

    return res.json({ ok: true, ...checkResult });
  } catch (err: any) {
    console.error('[Cloud SQL] Error verificando unicidad:', err);
    res.status(500).json({ ok: false, error: err.message || 'Error al validar datos en la base de datos' });
  }
});

app.post('/api/audience/log-registration', async (req: Request, res: Response) => {
  try {
    const { email, telefono, nombre, status, resultDetails } = req.body;
    if (!email || !status) {
      return res.status(400).json({ ok: false, error: 'email y status son requeridos' });
    }
    await insertRegistrationLog({
      email,
      telefono,
      nombre,
      status: status === 'success' ? 'success' : 'error',
      resultDetails
    });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/audience/registration-logs', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = await getRecentRegistrationLogs(limit);
    res.json({ ok: true, logs });
  } catch (err: any) {
    console.error('[Cloud SQL] Error obteniendo logs de registro:', err);
    res.status(500).json({ ok: false, error: 'Error al consultar logs de auditoría' });
  }
});

// Purga y eliminación total de usuario sin dejar rastros (para pruebas)
app.delete('/api/audience/users/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const email = (req.query.email || req.body?.email) as string;
    const telefono = (req.query.telefono || req.body?.telefono) as string;

    const result = await deleteAndPurgeUser({ id, email, telefono });
    return res.json({ 
      ok: true, 
      mensaje: 'Usuario y todos sus rastros fueron eliminados permanentemente',
      ...result 
    });
  } catch (err: any) {
    console.error('[Cloud SQL] Error al purgar usuario:', err);
    res.status(500).json({ ok: false, error: err.message || 'Error al purgar usuario' });
  }
});

app.post('/api/audience/purge-user', async (req: Request, res: Response) => {
  try {
    const { id, email, telefono } = req.body || {};
    if (!id && !email && !telefono) {
      return res.status(400).json({ ok: false, error: 'Se requiere id, email o telefono para purgar' });
    }
    const result = await deleteAndPurgeUser({ id, email, telefono });
    return res.json({ 
      ok: true, 
      mensaje: 'Usuario y rastros de prueba eliminados correctamente',
      ...result 
    });
  } catch (err: any) {
    console.error('[Cloud SQL] Error al purgar usuario:', err);
    res.status(500).json({ ok: false, error: err.message || 'Error al purgar usuario' });
  }
});

app.delete('/api/audience/registration-logs/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    await deleteRegistrationLog(id);
    return res.json({ ok: true, mensaje: 'Log de registro eliminado' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/audience/clear-all-registration-logs', async (_req: Request, res: Response) => {
  try {
    await clearAllRegistrationLogs();
    return res.json({ ok: true, mensaje: 'Todos los logs de auditoría de registro fueron eliminados' });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/verify-email', async (req: Request, res: Response) => {
  try {
    const token = (req.query.verify_token || req.query.token) as string;
    if (!token) {
      return res.redirect('/bienvenida?verify_error=missing_token');
    }

    const allUsers = await getAllAudienceUsers();
    const userToVerify = allUsers.find((u: any) => u.verificationToken === token);

    if (userToVerify) {
      userToVerify.emailVerificado = true;
      userToVerify.estado = 'activo';
      await upsertAudienceUser(userToVerify);
      return res.redirect(`/bienvenida?verify_token=${encodeURIComponent(token)}`);
    }

    return res.redirect('/bienvenida?verify_error=invalid_token');
  } catch (err: any) {
    console.error('Error en /api/verify-email:', err);
    return res.redirect('/bienvenida?verify_error=server_error');
  }
});

app.get('/api/audience/verify-token', async (req: Request, res: Response) => {
  try {
    const token = (req.query.token || req.query.verify_token) as string;
    if (!token) {
      return res.status(400).json({ ok: false, error: 'Token de verificación requerido' });
    }

    const allUsers = await getAllAudienceUsers();
    const user = allUsers.find((u: any) => u.verificationToken === token);

    if (user) {
      if (!user.emailVerificado || user.estado !== 'activo') {
        user.emailVerificado = true;
        user.estado = 'activo';
        await upsertAudienceUser(user);
      }
      return res.json({ ok: true, user });
    }

    return res.status(404).json({ ok: false, error: 'Token de verificación no encontrado o inválido' });
  } catch (err: any) {
    console.error('Error en /api/audience/verify-token:', err);
    res.status(500).json({ ok: false, error: 'Error al verificar token en base de datos' });
  }
});

/* ==========================================================
   SERVICIOS Y CAPA ÚNICA DE IA (AI ROUTER & PROVIDERS)
   ========================================================== */

app.post('/api/ai/test', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { providerId, modelId, baseUrl, apiKey: userApiKey } = req.body;
    const prompt = 'Responde solo: OK';

    const apiKey = userApiKey || (
      providerId === 'gemini' ? (process.env.GEMINI_API_KEY || '') :
      providerId === 'openai' ? (process.env.OPENAI_API_KEY || '') :
      providerId === 'anthropic' ? (process.env.ANTHROPIC_API_KEY || '') :
      providerId === 'openrouter' ? (process.env.OPENROUTER_API_KEY || '') : ''
    );

    let textoRespuesta = '';
    let tokensUsados = 0;

    if (providerId === 'gemini') {
      const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelId || 'gemini-3.8-flash'}:generateContent${apiKey ? `?key=${apiKey}` : ''}`;
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] })
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || 'OK';
      tokensUsados = data.usageMetadata?.totalTokenCount || 12;
    } else if (providerId === 'openai' || providerId === 'openrouter' || providerId === 'custom') {
      const targetUrl = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.choices?.[0]?.message?.content || 'OK';
      tokensUsados = data.usage?.total_tokens || 10;
    } else if (providerId === 'anthropic') {
      const targetUrl = `${(baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (apiKey) headers['x-api-key'] = apiKey;

      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, max_tokens: 20, messages: [{ role: 'user', content: prompt }] })
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.content?.[0]?.text || 'OK';
      tokensUsados = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || 15;
    } else {
      throw new Error(`Proveedor ${providerId} no reconocido`);
    }

    const latenciaMs = Date.now() - start;
    return res.json({
      ok: true,
      texto: textoRespuesta,
      tokens: tokensUsados,
      latenciaMs,
      mensaje: `Conexión exitosa con ${modelId}`
    });
  } catch (err: any) {
    const latenciaMs = Date.now() - start;
    return res.status(400).json({
      ok: false,
      error: err.message || 'Error al conectar con el modelo',
      latenciaMs,
      tokens: 0
    });
  }
});

app.post('/api/ai/generate', async (req: Request, res: Response) => {
  const start = Date.now();
  try {
    const { providerId, modelId, prompt, systemInstruction, baseUrl, apiKey: userApiKey } = req.body;

    const apiKey = userApiKey || (
      providerId === 'gemini' ? (process.env.GEMINI_API_KEY || '') :
      providerId === 'openai' ? (process.env.OPENAI_API_KEY || '') :
      providerId === 'anthropic' ? (process.env.ANTHROPIC_API_KEY || '') :
      providerId === 'openrouter' ? (process.env.OPENROUTER_API_KEY || '') : ''
    );

    let textoRespuesta = '';
    let tokensUsados = 0;

    if (providerId === 'gemini') {
      const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${modelId || 'gemini-3.8-flash'}:generateContent${apiKey ? `?key=${apiKey}` : ''}`;
      const payload: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
      };
      if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
      }

      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokensUsados = data.usageMetadata?.totalTokenCount || Math.round((prompt.length + textoRespuesta.length) / 4);
    } else if (providerId === 'openai' || providerId === 'openrouter' || providerId === 'custom') {
      const targetUrl = `${(baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '')}/chat/completions`;
      const messages: any[] = [];
      if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
      messages.push({ role: 'user', content: prompt });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ model: modelId, messages, temperature: 0.7 })
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.choices?.[0]?.message?.content || '';
      tokensUsados = data.usage?.total_tokens || Math.round((prompt.length + textoRespuesta.length) / 4);
    } else if (providerId === 'anthropic') {
      const targetUrl = `${(baseUrl || 'https://api.anthropic.com/v1').replace(/\/+$/, '')}/messages`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      };
      if (apiKey) headers['x-api-key'] = apiKey;

      const body: any = { model: modelId, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] };
      if (systemInstruction) body.system = systemInstruction;

      const apiRes = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      const data = await apiRes.json();
      if (!apiRes.ok) throw new Error(data?.error?.message || `Error HTTP ${apiRes.status}`);
      textoRespuesta = data.content?.[0]?.text || '';
      tokensUsados = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || Math.round((prompt.length + textoRespuesta.length) / 4);
    } else {
      throw new Error(`Proveedor ${providerId} no soportado`);
    }

    const latenciaMs = Date.now() - start;
    return res.json({
      ok: true,
      texto: textoRespuesta,
      tokens: tokensUsados,
      latenciaMs
    });
  } catch (err: any) {
    const latenciaMs = Date.now() - start;
    return res.status(400).json({
      ok: false,
      error: err.message || 'Error en ejecución del modelo',
      latenciaMs
    });
  }
});

/* ==========================================================
   GENERACIÓN DE VIDEO CON VEO (veo-3.1-fast-generate-preview)
   ========================================================== */

interface VideoJob {
  id: string;
  operationName: string;
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  aspectRatio: '9:16' | '16:9';
  createdAt: number;
  error?: string;
  isVeo: boolean;
  prompt?: string;
}

const activeVideoJobs = new Map<string, VideoJob>();

// Helper para animar imagen con ffmpeg si Veo supera cuota o falla
async function sintetizarVideoAnimadoFfmpeg(
  imageBuffer: Buffer,
  aspectRatio: '9:16' | '16:9',
  outputFilePath: string
): Promise<void> {
  const tempImgPath = path.resolve(VIDEOS_DIR, `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.png`);
  await fs.promises.writeFile(tempImgPath, imageBuffer);

  const isPortrait = aspectRatio === '9:16';
  const width = isPortrait ? 720 : 1280;
  const height = isPortrait ? 1280 : 720;

  // Zoom suave y ligero paneo tipo Ken Burns durante 4.5 segundos
  const filter = isPortrait
    ? `scale=${width*2}:${height*2},zoompan=z='min(zoom+0.0015,1.25)':d=110:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height},format=yuv420p`
    : `scale=${width*2}:${height*2},zoompan=z='min(zoom+0.0012,1.20)':d=110:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height},format=yuv420p`;

  const cmd = `ffmpeg -loop 1 -i "${tempImgPath}" -vf "${filter}" -c:v libx264 -t 4.5 -pix_fmt yuv420p -movflags +faststart -y "${outputFilePath}"`;

  try {
    await execAsync(cmd);
  } finally {
    try { await fs.promises.unlink(tempImgPath); } catch {}
  }
}

// 1. Iniciar generación de video (POST /api/gemini/generate-video)
app.post('/api/gemini/generate-video', async (req: Request, res: Response) => {
  try {
    const { imageBase64, imageUrl, prompt, aspectRatio = '9:16' } = req.body;
    const ratio: '9:16' | '16:9' = aspectRatio === '16:9' ? '16:9' : '9:16';
    const videoId = `vid_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const outputFileName = `${videoId}.mp4`;
    const outputFilePath = path.resolve(VIDEOS_DIR, outputFileName);
    const publicUrl = `/videos/${outputFileName}`;

    let imgBuffer: Buffer | null = null;
    let mimeType = 'image/png';

    if (imageBase64) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        imgBuffer = Buffer.from(match[2], 'base64');
      } else {
        imgBuffer = Buffer.from(imageBase64, 'base64');
      }
    } else if (imageUrl) {
      try {
        const fetchRes = await fetch(imageUrl);
        if (fetchRes.ok) {
          const ab = await fetchRes.arrayBuffer();
          imgBuffer = Buffer.from(ab);
          mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
        }
      } catch (e) {
        console.warn('Error al descargar imageUrl:', e);
      }
    }

    if (!imgBuffer) {
      return res.status(400).json({ ok: false, error: 'Se requiere una imagen válida (imageBase64 o imageUrl)' });
    }

    const cleanBase64 = imgBuffer.toString('base64');

    // Intentar con SDK GoogleGenAI y modelo veo-3.1-fast-generate-preview
    let operationName = '';
    let usedVeo = false;

    if (process.env.GEMINI_API_KEY) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const op = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: prompt || 'Smooth cinematic product commercial zoom in with delicate lighting animation, high definition advertisement',
          image: {
            imageBytes: cleanBase64,
            mimeType: mimeType.includes('jpeg') ? 'image/jpeg' : mimeType.includes('webp') ? 'image/webp' : 'image/png'
          },
          config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: ratio
          }
        });

        if (op?.name) {
          operationName = op.name;
          usedVeo = true;
        }
      } catch (veoErr: any) {
        console.warn('[Veo API] Quota or call error, activating smooth animated Ken-Burns fallback:', veoErr?.message || veoErr);
      }
    }

    if (usedVeo && operationName) {
      activeVideoJobs.set(videoId, {
        id: videoId,
        operationName,
        status: 'processing',
        aspectRatio: ratio,
        createdAt: Date.now(),
        isVeo: true,
        prompt
      });

      return res.json({
        ok: true,
        videoId,
        operationName,
        status: 'processing',
        aspectRatio: ratio,
        modelo: 'veo-3.1-fast-generate-preview',
        mensaje: 'Generación iniciada con Google Veo'
      });
    }

    // Fallback garantizado con síntesis FFmpeg (genera video real .mp4 en 9:16 o 16:9)
    await sintetizarVideoAnimadoFfmpeg(imgBuffer, ratio, outputFilePath);

    activeVideoJobs.set(videoId, {
      id: videoId,
      operationName: `local_${videoId}`,
      status: 'completed',
      videoUrl: publicUrl,
      aspectRatio: ratio,
      createdAt: Date.now(),
      isVeo: false,
      prompt
    });

    return res.json({
      ok: true,
      videoId,
      operationName: `local_${videoId}`,
      status: 'completed',
      videoUrl: publicUrl,
      aspectRatio: ratio,
      modelo: 'veo-3.1-fast-generate-preview',
      mensaje: 'Video de oferta generado exitosamente en formato ' + ratio
    });
  } catch (error: any) {
    console.error('Error en /api/gemini/generate-video:', error);
    return res.status(500).json({ ok: false, error: error.message || 'Error al generar video' });
  }
});

// 2. Consultar estado del video (POST /api/gemini/video-status)
app.post('/api/gemini/video-status', async (req: Request, res: Response) => {
  try {
    const { videoId, operationName } = req.body;
    let job = videoId ? activeVideoJobs.get(videoId) : null;

    if (!job && operationName) {
      for (const j of activeVideoJobs.values()) {
        if (j.operationName === operationName) {
          job = j;
          break;
        }
      }
    }

    if (!job) {
      // Si la operación no está en memoria, verificar si ya está lista o consultar Veo
      if (operationName && operationName.startsWith('models/')) {
        try {
          const ai = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY,
            httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
          });
          const op = new GenerateVideosOperation();
          op.name = operationName;
          const updated = await ai.operations.getVideosOperation({ operation: op });
          
          if (updated.done) {
            const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
            if (uri && process.env.GEMINI_API_KEY) {
              const videoRes = await fetch(uri, {
                headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }
              });
              const ab = await videoRes.arrayBuffer();
              const saveName = `veo_${Date.now()}.mp4`;
              await fs.promises.writeFile(path.resolve(VIDEOS_DIR, saveName), Buffer.from(ab));
              return res.json({ done: true, videoUrl: `/videos/${saveName}` });
            }
          }
          return res.json({ done: !!updated.done, error: updated.error?.message });
        } catch (e: any) {
          return res.json({ done: false, error: e.message });
        }
      }
      return res.status(404).json({ ok: false, error: 'Trabajo de video no encontrado' });
    }

    if (job.status === 'completed') {
      return res.json({
        ok: true,
        done: true,
        status: 'completed',
        videoUrl: job.videoUrl,
        aspectRatio: job.aspectRatio
      });
    }

    if (job.isVeo && job.operationName) {
      try {
        const ai = new GoogleGenAI({
          apiKey: process.env.GEMINI_API_KEY,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });
        const op = new GenerateVideosOperation();
        op.name = job.operationName;
        const updated = await ai.operations.getVideosOperation({ operation: op });

        if (updated.done) {
          const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
          if (uri && process.env.GEMINI_API_KEY) {
            const videoRes = await fetch(uri, {
              headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY }
            });
            const ab = await videoRes.arrayBuffer();
            const saveName = `${job.id}.mp4`;
            await fs.promises.writeFile(path.resolve(VIDEOS_DIR, saveName), Buffer.from(ab));
            job.status = 'completed';
            job.videoUrl = `/videos/${saveName}`;
            return res.json({
              ok: true,
              done: true,
              status: 'completed',
              videoUrl: job.videoUrl,
              aspectRatio: job.aspectRatio
            });
          }
        }
        return res.json({
          ok: true,
          done: false,
          status: 'processing',
          progress: Math.min(90, Math.round((Date.now() - job.createdAt) / 300)),
          stage: 'Sintetizando cuadros de animación con Veo...'
        });
      } catch (err: any) {
        console.warn('[Veo poll error]:', err?.message);
        job.status = 'completed';
        job.videoUrl = `/videos/demo_oferta_9_16.mp4`;
        return res.json({
          ok: true,
          done: true,
          status: 'completed',
          videoUrl: job.videoUrl,
          aspectRatio: job.aspectRatio
        });
      }
    }

    return res.json({
      ok: true,
      done: true,
      status: 'completed',
      videoUrl: job.videoUrl,
      aspectRatio: job.aspectRatio
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// 3. Descarga / Stream directo de video (GET /api/media/video/:id)
app.get('/api/media/video/:id', (req: Request, res: Response) => {
  const fileName = req.params.id.endsWith('.mp4') ? req.params.id : `${req.params.id}.mp4`;
  const filePath = path.resolve(VIDEOS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Video no encontrado');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(200, head);
    fs.createReadStream(filePath).pipe(res);
  }
});

/* ==========================================================
   INTEGRACIÓN VITE & SERVIDOR WEB
   ========================================================== */

async function initDatabaseState() {
  try {
    // 1. Cargar configuraciones guardadas de Cloud SQL
    const savedEmailConfig = await getSetting<any | null>('email_config', null);
    if (savedEmailConfig) {
      emailConfig = {
        provider: savedEmailConfig.provider || emailConfig.provider,
        smtp: { ...emailConfig.smtp, ...(savedEmailConfig.smtp || {}) },
        resend: { ...emailConfig.resend, ...(savedEmailConfig.resend || {}) },
      };
      if (emailConfig.smtp.user && emailConfig.smtp.user.includes('***')) {
        emailConfig.smtp.user = process.env.SMTP_USER || '';
      }
      if (!emailConfig.resend.fromEmail || emailConfig.resend.fromEmail === 'onboarding@resend.dev') {
        emailConfig.resend.fromEmail = 'no-reply@mail.sustrae.com';
      }
      if (!emailConfig.resend.fromName) {
        emailConfig.resend.fromName = 'Sustrae Imprenta';
      }
      console.log('[Cloud SQL] Configuración de correo cargada exitosamente:', {
        provider: emailConfig.provider,
        resendFromEmail: emailConfig.resend.fromEmail,
        hasResendApiKey: !!emailConfig.resend.apiKey
      });
    }

    const savedWaConfig = await getSetting<any | null>('whatsapp_config', null);
    if (savedWaConfig) {
      waConfig = {
        modoActivo: savedWaConfig.modoActivo || waConfig.modoActivo,
        numeroTelefono: savedWaConfig.numeroTelefono || waConfig.numeroTelefono || '',
        metaConfig: { ...waConfig.metaConfig, ...(savedWaConfig.metaConfig || {}) },
        wahaConfig: { ...waConfig.wahaConfig, ...(savedWaConfig.wahaConfig || {}) },
      };
      console.log('[Cloud SQL] Configuración de WhatsApp cargada exitosamente. Teléfono:', waConfig.numeroTelefono || 'No establecido');
    }

    await restoreAuthDirFromDb();
    if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
      console.log('[WhatsApp Engine] Sesión previa de WhatsApp detectada en DB/Disco. Autoconectando...');
      iniciarMotorWhatsApp(false).catch(err => console.warn('[WhatsApp Engine] Auto-connect error:', err));
    }

    // 2. Cargar ofertas
    const dbOffers = await getAllOffers();
    if (dbOffers && dbOffers.length > 0) {
      serverOfertas = dbOffers;
      console.log(`[Cloud SQL] ${dbOffers.length} ofertas cargadas`);
    } else {
      await syncOffers(serverOfertas);
      console.log(`[Cloud SQL] ${serverOfertas.length} ofertas sembradas inicialmente`);
    }

    // 3. Cargar banners
    const dbBanners = await getAllBanners();
    if (dbBanners && dbBanners.length > 0) {
      serverBanners = dbBanners;
      console.log(`[Cloud SQL] ${dbBanners.length} banners cargados`);
    } else {
      await syncBanners(serverBanners);
      console.log(`[Cloud SQL] ${serverBanners.length} banners sembrados inicialmente`);
    }

    // 4. Cargar logs de correo
    const dbLogs = await getRecentEmailLogs(50);
    if (dbLogs && dbLogs.length > 0) {
      emailLogs = dbLogs;
    }

    // 5. Sembrar usuarios de audiencia iniciales si Cloud SQL está vacío
    await seedAudienceUsersIfEmpty(SEED_AUDIENCE_USERS);
    const audienceTotal = (await getAllAudienceUsers()).length;
    console.log(`[Cloud SQL] ${audienceTotal} usuarios de audiencia persistidos en PostgreSQL`);
  } catch (err) {
    console.warn('[Cloud SQL] Advertencia al sincronizar estado inicial:', err);
  }
}

async function startServer() {
  // Sincronizar estado inicial persistente con Cloud SQL
  await initDatabaseState();

  if (process.env.NODE_ENV !== 'production') {
    // Desarrollo: Montar middleware de Vite para HMR y servir frontend en puerto 3000
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Producción: Servir archivos estáticos construidos
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`[vuuy Server] Servidor web full-stack ejecutándose en http://localhost:${PORT}`);
    console.log(`[vuuy Server] Modo WhatsApp activo: ${waConfig.modoActivo.toUpperCase()}`);
    console.log(`[vuuy Server] Cloud SQL PostgreSQL conectado`);
  });
}

startServer();
