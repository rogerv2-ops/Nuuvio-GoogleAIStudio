/**
 * Puente del navegador con WhatsApp.
 *
 * La logica de los enlaces vive en `src/utils/whatsappLinks.ts` (modulo puro,
 * compartido con el servidor). Este archivo es la parte que SI necesita el
 * navegador: detectar la plataforma, pedir el destino al servidor y abrirlo.
 *
 * REGLA INQUEBRANTABLE (ver AGENTS.md): un enlace a WhatsApp siempre deja
 * elegir la app. En Android el sistema muestra el selector (WhatsApp /
 * WhatsApp Business) con el esquema nativo; en iOS y en la web el sistema no
 * ofrece selector, asi que la eleccion la pone la hoja de opciones.
 */
import {
  construirUrlWhatsApp,
  detectarPlataformaDesdeUA,
  normalizarDestino,
  opcionesWhatsAppPorPlataforma,
  type DestinoWhatsApp,
  type PlataformaWhatsApp,
} from './whatsappLinks';

export type { DestinoWhatsApp, PlataformaWhatsApp };

/** Plataforma del dispositivo actual. */
export function detectarPlataforma(): PlataformaWhatsApp {
  if (typeof navigator === 'undefined') return 'web';
  return detectarPlataformaDesdeUA(navigator.userAgent || '');
}

/** Opciones que la interfaz debe ofrecer segun la plataforma. */
export function opcionesWhatsApp(): ReturnType<typeof opcionesWhatsAppPorPlataforma> {
  return opcionesWhatsAppPorPlataforma(detectarPlataforma());
}

/**
 * Enlaces de un telefono ya conocido (uso interno del panel: el admin ya
 * tiene el numero en memoria). El numero NUNCA viaja por la red.
 */
export function generarLinksWhatsApp(telefono: string, texto = 'Ofertas') {
  const cleanPhone = String(telefono || '').replace(/\D/g, '');
  const plataforma = detectarPlataforma();
  return {
    cleanPhone,
    nativeUrl: construirUrlWhatsApp('app', plataforma, cleanPhone, texto),
    businessUrl: construirUrlWhatsApp('business', plataforma, cleanPhone, texto),
    webUrl: construirUrlWhatsApp('web', plataforma, cleanPhone, texto),
  };
}

/**
 * Pide al servidor el enlace de contacto. El servidor resuelve el numero en
 * el momento del clic: el telefono no esta en el HTML ni en el bundle, y la
 * peticion queda registrada con la oferta y con el destino que eligio la
 * persona.
 */
export async function resolverContactoWhatsApp(params: {
  ofertaId?: string | null;
  destino: DestinoWhatsApp;
}): Promise<{ ok: boolean; url?: string; error?: string }> {
  const query = new URLSearchParams();
  if (params.ofertaId) query.set('oferta', String(params.ofertaId));
  query.set('dest', normalizarDestino(params.destino));

  try {
    const res = await fetch(`/api/whatsapp/contacto?${query.toString()}`, { cache: 'no-store' });
    const data: any = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data?.url) {
      return { ok: false, error: data?.error || 'No pudimos abrir WhatsApp. Inténtalo de nuevo.' };
    }
    return { ok: true, url: String(data.url) };
  } catch {
    return { ok: false, error: 'No pudimos abrir WhatsApp. Revisa tu conexión e inténtalo de nuevo.' };
  }
}

/** Abre el enlace resuelto por el servidor. */
export async function abrirContactoWhatsApp(params: {
  ofertaId?: string | null;
  destino: DestinoWhatsApp;
}): Promise<{ ok: boolean; error?: string }> {
  const r = await resolverContactoWhatsApp(params);
  if (!r.ok || !r.url) return { ok: false, error: r.error };
  try {
    window.location.href = r.url;
    return { ok: true };
  } catch {
    return { ok: false, error: 'No pudimos abrir WhatsApp en este dispositivo.' };
  }
}

/**
 * Un toque en el boton de WhatsApp.
 *
 * - Android: un solo toque y el sistema muestra el selector de app
 *   (WhatsApp / WhatsApp Business). No mostramos hoja propia.
 * - iOS y web: el sistema no ofrece selector, asi que abrimos la hoja con las
 *   opciones (WhatsApp, WhatsApp Business, WhatsApp Web).
 */
export function alPulsarBotonWhatsApp(params: {
  ofertaId?: string | null;
  telefono?: string | null;
  texto?: string;
  onAbrirSelector: () => void;
  onError?: (mensaje: string) => void;
}): void {
  if (detectarPlataforma() === 'android') {
    if (params.telefono) {
      // Numero ya conocido (panel interno): el enlace se arma en el cliente.
      const url = construirUrlWhatsApp('app', 'android', params.telefono, params.texto);
      if (url) {
        window.location.href = url;
        return;
      }
      if (params.onError) params.onError('No hay un número de WhatsApp configurado para este contacto.');
      return;
    }
    void abrirContactoWhatsApp({ ofertaId: params.ofertaId, destino: 'app' }).then((r) => {
      if (!r.ok && params.onError) params.onError(r.error || 'No pudimos abrir WhatsApp.');
    });
    return;
  }
  params.onAbrirSelector();
}
