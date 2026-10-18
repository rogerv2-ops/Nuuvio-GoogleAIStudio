/**
 * Utilidad de atribución UTM y Referidos/Afiliados para Yuddit
 * Captura y preserva los parámetros de campaña y afiliado desde la URL
 */
import { coreEvents } from '../core/events';

export interface AttributionData {
  afiliadoId?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  capturadoEn: string;
}

const STORAGE_KEY = 'vuuy_attribution_v1';

export function capturarAtribucionDeUrl(): AttributionData | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('afiliado') || params.get('invitadoPor');
    const source = params.get('utm_source');
    const medium = params.get('utm_medium');
    const campaign = params.get('utm_campaign');
    const term = params.get('utm_term');
    const content = params.get('utm_content');

    // Si no hay ningún parámetro en la URL, retornar lo que ya esté guardado en storage
    if (!ref && !source && !medium && !campaign && !term && !content) {
      return obtenerAtribucionGuardada();
    }

    const data: AttributionData = {
      afiliadoId: ref || undefined,
      utm_source: source || undefined,
      utm_medium: medium || undefined,
      utm_campaign: campaign || undefined,
      utm_term: term || undefined,
      utm_content: content || undefined,
      capturadoEn: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    // Registrar evento de visita de campaña en microkernel
    coreEvents.emitir({
      tipoEvento: 'visita_landing_utm',
      actorTipo: 'usuario',
      actorId: ref ? `ref_${ref}` : 'anonimo',
      origen: 'web',
      datos: {
        afiliadoId: ref,
        source,
        medium,
        campaign,
        url: window.location.href
      }
    });

    return data;
  } catch (e) {
    console.error('Error capturando atribución UTM:', e);
    return null;
  }
}

export function obtenerAtribucionGuardada(): AttributionData | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // ignore
  }
  return null;
}

export function limpiarAtribucionGuardada() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
