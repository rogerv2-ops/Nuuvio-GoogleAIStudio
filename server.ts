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
import { SEED_OFFERS } from './src/data/seedData';

let serverOfertas = JSON.parse(JSON.stringify(SEED_OFFERS));

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const AUTH_DIR = path.resolve(__dirname, 'auth_info_baileys');

app.use(express.json());

// In-memory WhatsApp Configuration Store
interface WhatsAppServerConfig {
  modoActivo: 'meta' | 'waha';
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

    sock.ev.on('creds.update', saveCreds);

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
        wahaSession.phone = phoneClean ? `+${phoneClean}` : '+51 987 654 321';
        wahaSession.name = sock.user?.name || 'vuuy Bot';
        wahaSession.qrDataUrl = null;
        wahaSession.qrRaw = null;
        wahaSession.qrExpiresAt = null;
        wahaSession.pairingCode = null;

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

    // Escuchar mensajes entrantes reales
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.key.fromMe && msg.message) {
          const from = msg.key.remoteJid || '';
          if (from.endsWith('@g.us')) continue; // Ignorar grupos por ahora

          const senderPhone = from.replace('@s.whatsapp.net', '');
          const body = msg.message.conversation ||
                       msg.message.extendedTextMessage?.text ||
                       msg.message.imageMessage?.caption ||
                       '';

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

          // Respuesta automática con ofertas activas aprobadas si el usuario escribe "Oferta"
          if (body.toLowerCase().includes('oferta')) {
            try {
              const ofertasActivas = serverOfertas
                .filter((o: any) => o.estado === 'activa' && new Date(o.venceEn).getTime() > Date.now())
                .sort((a: any, b: any) => new Date(b.validadaEn || b.creadaEn).getTime() - new Date(a.validadaEn || a.creadaEn).getTime())
                .slice(0, 7);

              let textoRespuesta = `¡Hola! 👋 Bienvenido a *vuuy*. Aquí tienes las últimas ofertas aprobadas y activas en Lima:\n\n`;
              if (ofertasActivas.length > 0) {
                ofertasActivas.forEach((o: any, index: number) => {
                  textoRespuesta += `${index + 1}. 🏷️ *${o.titulo}* — ${o.comercioNombre} (${o.distrito}) · S/ ${o.precioOferta.toFixed(2)} (Antes S/ ${o.precioNormal.toFixed(2)})\n`;
                });
                textoRespuesta += `\n_Para ver la lista completa y pedir tu oferta, visita nuestro portal web._`;
              } else {
                textoRespuesta = `¡Hola! 👋 Bienvenido a *vuuy*. En este momento no tenemos ofertas activas en la zona. ¡Sigue atento a nuestras novedades!`;
              }

              await sock.sendMessage(from, { text: textoRespuesta });

              messageLogs.unshift({
                id: `log_${Date.now() + 1}`,
                timestamp: new Date().toISOString(),
                canal: 'waha',
                direccion: 'saliente',
                telefono: `+${senderPhone}`,
                contenido: `Catálogo de ${ofertasActivas.length} ofertas activas despachado automáticamente.`,
                estado: 'entregado',
                detalles: 'Respuesta dinámica con ofertas aprobadas a comando Oferta'
              });
            } catch (err) {
              console.error('Error enviando respuesta automática:', err);
            }
          }
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
  res.json({
    ok: true,
    config: waConfig,
    wahaSession: {
      status: wahaSession.status,
      phone: wahaSession.phone,
      name: wahaSession.name,
      startedAt: wahaSession.startedAt,
      pairingCode: wahaSession.pairingCode
    }
  });
});

app.post('/api/whatsapp/config', (req: Request, res: Response) => {
  const { modoActivo, metaConfig, wahaConfig } = req.body;
  if (modoActivo && (modoActivo === 'meta' || modoActivo === 'waha')) {
    waConfig.modoActivo = modoActivo;
  }
  if (metaConfig) {
    waConfig.metaConfig = { ...waConfig.metaConfig, ...metaConfig };
  }
  if (wahaConfig) {
    waConfig.wahaConfig = { ...waConfig.wahaConfig, ...wahaConfig };
  }

  res.json({
    ok: true,
    mensaje: 'Configuración de WhatsApp guardada exitosamente.',
    config: waConfig
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
app.get('/api/waha/session/qr', async (_req: Request, res: Response) => {
  try {
    if (wahaSession.status === 'WORKING') {
      return res.json({ ok: true, status: 'WORKING', phone: wahaSession.phone });
    }

    // Reiniciar socket para forzar nuevo handshake QR
    await iniciarMotorWhatsApp(true);

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
app.post('/api/waha/webhook', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    if (payload.event === 'message') {
      const msg = payload.payload;
      const remitente = msg.from;
      const texto = msg.body;

      messageLogs.unshift({
        id: `log_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal: 'waha',
        direccion: 'entrante',
        telefono: remitente,
        contenido: texto,
        estado: 'recibido',
        detalles: 'Procesado desde webhook WAHA externo'
      });
    }

    res.json({ ok: true, status: 'processed' });
  } catch (error) {
    res.status(500).json({ error: 'Error procesando webhook WAHA' });
  }
});

/* ==========================================================
   OFERTAS API: SINCRO ENTRE FRONTEND Y BACKEND WHATSAPP ENGINE
   ========================================================== */

app.get('/api/ofertas', (_req: Request, res: Response) => {
  res.json({ ok: true, ofertas: serverOfertas });
});

app.post('/api/ofertas/sync', (req: Request, res: Response) => {
  try {
    const { ofertas } = req.body;
    if (Array.isArray(ofertas)) {
      serverOfertas = ofertas;
      res.json({ ok: true, count: serverOfertas.length });
    } else {
      res.status(400).json({ ok: false, error: 'Se esperaba un arreglo de ofertas' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al sincronizar ofertas' });
  }
});

app.post('/api/ofertas/activar', (req: Request, res: Response) => {
  try {
    const { ofertaId, operador } = req.body;
    const item = serverOfertas.find((o: any) => o.id === ofertaId);
    if (item) {
      item.estado = 'activa';
      item.validadaEn = new Date().toISOString();
      item.validadaPor = operador || 'Super Admin';
      res.json({ ok: true, oferta: item });
    } else {
      res.status(404).json({ ok: false, error: 'Oferta no encontrada' });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error al activar oferta' });
  }
});

/* ==========================================================
   PRUEBA DE MENSAJERÍA REAL & LOGS
   ========================================================== */

// Envío de mensaje de prueba (vía Baileys real o Meta Graph API)
app.post('/api/whatsapp/test-message', async (req: Request, res: Response) => {
  const { telefono, texto } = req.body;

  if (!telefono || !texto) {
    return res.status(400).json({ ok: false, error: 'Teléfono y texto son requeridos' });
  }

  const canal = waConfig.modoActivo;
  const cleanPhone = telefono.replace(/\D/g, '');

  try {
    // Si estamos en modo WAHA y el socket Baileys está conectado, ¡ENVIAR MENSAJE REAL!
    if (canal === 'waha' && activeBaileysSocket && wahaSession.status === 'WORKING') {
      const jid = `${cleanPhone}@s.whatsapp.net`;
      await activeBaileysSocket.sendMessage(jid, { text: texto });

      const logExito: MessageEventLog = {
        id: `log_test_${Date.now()}`,
        timestamp: new Date().toISOString(),
        canal: 'waha',
        direccion: 'saliente',
        telefono,
        contenido: texto,
        estado: 'entregado',
        detalles: `Mensaje REAL despachado vía WhatsApp Web oficial a +${cleanPhone}`
      };

      messageLogs.unshift(logExito);

      return res.json({
        ok: true,
        mensaje: `¡Mensaje real de WhatsApp despachado con éxito a +${cleanPhone}!`,
        canal,
        real: true,
        log: logExito
      });
    }

    // Si está en modo Meta y hay credenciales
    if (canal === 'meta' && waConfig.metaConfig.accessToken && waConfig.metaConfig.phoneNumberId) {
      const metaUrl = `https://graph.facebook.com/v21.0/${waConfig.metaConfig.phoneNumberId}/messages`;
      const metaRes = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${waConfig.metaConfig.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: texto }
        })
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
        contenido: texto,
        estado: 'entregado',
        detalles: `Mensaje despachado vía Meta Cloud API Oficial (ID: ${metaData.messages?.[0]?.id})`
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
  provider: (process.env.EMAIL_PROVIDER as 'smtp' | 'resend') || 'smtp',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    fromName: process.env.EMAIL_FROM_NAME || 'vuuy Ofertas',
    fromEmail: process.env.EMAIL_FROM || 'notificaciones@vuuy.pe'
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    fromName: process.env.RESEND_FROM_NAME || 'vuuy Ofertas'
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

              <!-- Step 2: WhatsApp Invitation -->
              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 18px; padding: 22px; margin-bottom: 24px;">
                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 800; color: #15803D; text-transform: uppercase; letter-spacing: 1px;">
                  Paso 2: Invitación Oficial a WhatsApp
                </p>
                <p style="margin: 0 0 16px 0; color: #166534; font-size: 14px; line-height: 1.5;">
                  Únete a nuestro canal interactivo de WhatsApp enviando la palabra <strong>Oferta</strong> para recibir promociones personalizadas según tu ubicación:
                </p>
                <div style="text-align: center;">
                  <a href="${params.whatsappLink}" target="_blank" style="display: inline-block; background-color: #25D366; color: #FFFFFF; font-size: 14px; font-weight: 800; text-decoration: none; padding: 14px 28px; border-radius: 14px; box-shadow: 0 2px 8px rgba(37,211,102,0.25);">
                    💬 Abrir WhatsApp y Pedir Ofertas
                  </a>
                </div>
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
      user: emailConfig.smtp.user ? `${emailConfig.smtp.user.substring(0, 3)}***` : '',
      fromName: emailConfig.smtp.fromName,
      fromEmail: emailConfig.smtp.fromEmail,
      configured: !!(emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass)
    },
    resend: {
      fromEmail: emailConfig.resend.fromEmail,
      fromName: emailConfig.resend.fromName,
      configured: !!emailConfig.resend.apiKey
    }
  });
});

// Guardar configuración de correo
app.post('/api/email/config', (req: Request, res: Response) => {
  const { provider, smtp, resend } = req.body;
  if (provider && (provider === 'smtp' || provider === 'resend')) {
    emailConfig.provider = provider;
  }
  if (smtp) {
    emailConfig.smtp = {
      ...emailConfig.smtp,
      ...smtp,
      // Si la contraseña viene vacía, conservar la anterior
      pass: smtp.pass || emailConfig.smtp.pass
    };
  }
  if (resend) {
    emailConfig.resend = {
      ...emailConfig.resend,
      ...resend,
      apiKey: resend.apiKey || emailConfig.resend.apiKey
    };
  }

  res.json({
    ok: true,
    mensaje: 'Configuración de correo actualizada correctamente'
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
    const verificationLink = `${hostUrl}/?verify_token=${verificationToken}`;
    
    // Determinar número del bot de WhatsApp activo
    const phoneRaw = botPhone || wahaSession.phone || waConfig.metaConfig.phoneNumberId || '51987654321';
    const cleanBotPhone = phoneRaw.replace(/\D/g, '') || '51987654321';
    const whatsappLink = `https://wa.me/${cleanBotPhone}?text=${encodeURIComponent('Oferta')}`;

    const subject = `¡Bienvenido a vuuy! Confirma tu cuenta e invitación oficial a WhatsApp`;
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
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${emailConfig.resend.apiKey}`
          },
          body: JSON.stringify({
            from: `${emailConfig.resend.fromName} <${emailConfig.resend.fromEmail}>`,
            to: [email],
            subject,
            html
          })
        });

        if (resendRes.ok) {
          sentReal = true;
        } else {
          const errBody = await resendRes.text();
          sendError = `Resend error: ${errBody}`;
          console.warn('[Email Server]', sendError);
        }
      } catch (e: any) {
        sendError = `Resend exception: ${e.message}`;
        console.warn('[Email Server]', sendError);
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
        console.warn('[Email Server]', sendError);
      }
    }

    // Registrar en log
    const logItem: EmailLogEntry = {
      id: `eml_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      to: email,
      subject,
      provider: sentReal ? providerUsed : 'simulated',
      status: sentReal ? 'entregado' : 'simulado',
      timestamp: new Date().toISOString(),
      verificationToken,
      verificationLink,
      whatsappLink,
      error: sendError
    };

    emailLogs.unshift(logItem);

    return res.json({
      ok: true,
      mensaje: sentReal
        ? `Correo de verificación enviado a ${email} mediante ${providerUsed.toUpperCase()}.`
        : `Correo procesado en modo simulado para ${email}. Puedes usar el enlace directo o configurar credenciales SMTP/Resend en el panel.`,
      simulated: !sentReal,
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

    const subject = `[Prueba vuuy] Verificación de conexión de correo`;
    const html = `
      <div style="font-family: sans-serif; padding: 20px; background: #F4F1EA;">
        <div style="background: white; padding: 24px; border-radius: 12px; border: 1px solid #EAE5D9;">
          <h2 style="color: #1B4332;">¡Conexión de correo exitosa!</h2>
          <p>Este es un correo de prueba enviado desde tu panel de administración de <strong>vuuy</strong>.</p>
          <p>Proveedor activo: <strong>${emailConfig.provider.toUpperCase()}</strong></p>
          <p style="color: #64748B; font-size: 12px;">Fecha y hora: ${new Date().toLocaleString()}</p>
        </div>
      </div>
    `;

    if (emailConfig.provider === 'resend' && emailConfig.resend.apiKey) {
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${emailConfig.resend.apiKey}`
        },
        body: JSON.stringify({
          from: `${emailConfig.resend.fromName} <${emailConfig.resend.fromEmail}>`,
          to: [destinatario],
          subject,
          html
        })
      });

      if (!resendRes.ok) {
        const errText = await resendRes.text();
        return res.status(400).json({ ok: false, error: `Error Resend: ${errText}` });
      }

      return res.json({ ok: true, mensaje: `Correo de prueba enviado a ${destinatario} vía Resend API` });
    }

    if (emailConfig.provider === 'smtp' && emailConfig.smtp.host && emailConfig.smtp.user && emailConfig.smtp.pass) {
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
      error: `No hay credenciales activas configuradas para ${emailConfig.provider.toUpperCase()}. Configura host/usuario/contraseña o Resend API Key.`
    });
  } catch (error: any) {
    console.error('Error en prueba de correo:', error);
    res.status(500).json({ ok: false, error: error.message || 'Error enviando correo de prueba' });
  }
});

/* ==========================================================
   INTEGRACIÓN VITE & SERVIDOR WEB
   ========================================================== */

async function startServer() {
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
  });
}

startServer();
