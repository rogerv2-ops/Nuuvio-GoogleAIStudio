/**
 * MODULO 3: core-events (esquema: evt)
 * El registro inmutable de todo lo que pasa. Es la única fuente para calcular KPIs.
 * Regla de oro: SOLO-AGREGAR (append-only).
 */
import { EventLog, ActorType } from '../types';

export interface EmitEventPayload {
  tipoEvento: string;
  actorTipo: ActorType;
  actorId: string;
  distrito?: string;
  provincia?: string;
  origen: 'whatsapp' | 'web' | 'correo' | 'panel' | 'sistema';
  datos?: Record<string, unknown>;
}

class CoreEvents {
  private eventos: EventLog[] = [];
  private listeners: ((evento: EventLog) => void)[] = [];

  constructor() {
    // Eventos iniciales de prueba para alimentar métricas históricas de Lima
    this.sembrarEventosIniciales();
  }

  public emitir(payload: EmitEventPayload): EventLog {
    const nuevoEvento: EventLog = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      tipoEvento: payload.tipoEvento,
      fechaHora: new Date().toISOString(),
      actorTipo: payload.actorTipo,
      actorId: payload.actorId,
      distrito: payload.distrito || 'Lima',
      provincia: payload.provincia || 'Lima',
      origen: payload.origen,
      datos: payload.datos || {}
    };

    // R8. INMUTABILIDAD: Solo agregar, nunca modificar ni eliminar
    this.eventos.unshift(nuevoEvento);

    // Notificar a observadores en tiempo real (analítica, puntos, etc.)
    this.listeners.forEach(fn => fn(nuevoEvento));

    return nuevoEvento;
  }

  public consultar(filtros?: {
    tipoEvento?: string;
    actorTipo?: ActorType;
    actorId?: string;
    distrito?: string;
    limite?: number;
  }): EventLog[] {
    let resultado = [...this.eventos];

    if (filtros?.tipoEvento) {
      resultado = resultado.filter(e => e.tipoEvento === filtros.tipoEvento);
    }
    if (filtros?.actorTipo) {
      resultado = resultado.filter(e => e.actorTipo === filtros.actorTipo);
    }
    if (filtros?.actorId) {
      resultado = resultado.filter(e => e.actorId === filtros.actorId);
    }
    if (filtros?.distrito) {
      resultado = resultado.filter(e => e.distrito?.toLowerCase() === filtros.distrito?.toLowerCase());
    }

    if (filtros?.limite) {
      resultado = resultado.slice(0, filtros.limite);
    }

    return resultado;
  }

  public contar(tipoEvento: string, filtroDistrito?: string): number {
    return this.consultar({ tipoEvento, distrito: filtroDistrito }).length;
  }

  public suscribir(listener: (evento: EventLog) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private sembrarEventosIniciales() {
    const fechaBase = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    
    const eventosSemilla: EmitEventPayload[] = [
      {
        tipoEvento: 'usuario_registrado',
        actorTipo: 'usuario',
        actorId: 'usr_demo_01',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { nombre: 'Carlos Vásquez', email: 'carlos.vasquez@gmail.com' }
      },
      {
        tipoEvento: 'comercio_aprobado',
        actorTipo: 'gestion',
        actorId: 'admin_master_01',
        distrito: 'Barranco',
        origen: 'panel',
        datos: { comercioId: 'merch_01', nombreComercial: 'La Bodega Verde' }
      },
      {
        tipoEvento: 'oferta_activada',
        actorTipo: 'gestion',
        actorId: 'admin_master_01',
        distrito: 'Barranco',
        origen: 'panel',
        datos: { ofertaId: 'ofr_01', titulo: 'Bowl Acai Orgánico + Café Pasado' }
      },
      {
        tipoEvento: 'oferta_solicitada',
        actorTipo: 'usuario',
        actorId: 'usr_demo_01',
        distrito: 'Miraflores',
        origen: 'whatsapp',
        datos: { numeroDelDia: 1 }
      },
      {
        tipoEvento: 'oferta_mostrada',
        actorTipo: 'sistema',
        actorId: 'usr_demo_01',
        distrito: 'Barranco',
        origen: 'whatsapp',
        datos: { ofertaId: 'ofr_01', posicion: 1 }
      },
      {
        tipoEvento: 'clic_contactar',
        actorTipo: 'usuario',
        actorId: 'usr_demo_01',
        distrito: 'Barranco',
        origen: 'whatsapp',
        datos: {
          ofertaId: 'ofr_01',
          comercioId: 'merch_01',
          codigoPersonal: 'CV88-91',
          facturable: true
        }
      },
      {
        tipoEvento: 'venta_confirmada',
        actorTipo: 'comercio',
        actorId: 'merch_01',
        distrito: 'Barranco',
        origen: 'panel',
        datos: { codigoPersonal: 'CV88-91', ofertaId: 'ofr_01' }
      },
      // Eventos Semilla de Rastreo UTM y Enlaces Compartidos
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'anonimo_1',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { source: 'instagram', medium: 'paid_social', campaign: 'promo_gastronomia_lima', url: 'https://nuuvio.ai.studio/?utm_source=instagram&utm_medium=paid_social&utm_campaign=promo_gastronomia_lima' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_01',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { utm: { source: 'instagram', medium: 'paid_social', campaign: 'promo_gastronomia_lima' } }
      },
      {
        tipoEvento: 'clic_compartir',
        actorTipo: 'usuario',
        actorId: 'usr_demo_01',
        distrito: 'Miraflores',
        origen: 'whatsapp',
        datos: { ofertaId: 'ofr_01', codigoRef: 'VUUY-CV88' }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'ref_VUUY-CV88',
        distrito: 'Barranco',
        origen: 'web',
        datos: { afiliadoId: 'VUUY-CV88', source: 'whatsapp', medium: 'chat_share', campaign: 'amigos_vuuy_ofertas' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_02',
        distrito: 'Barranco',
        origen: 'web',
        datos: { invitadoPor: 'VUUY-CV88', utm: { source: 'whatsapp', medium: 'chat_share', campaign: 'amigos_vuuy_ofertas' } }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'anonimo_2',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { source: 'facebook', medium: 'social_post', campaign: 'ofertas_barranco_miraflores' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_03',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { utm: { source: 'facebook', medium: 'social_post', campaign: 'ofertas_barranco_miraflores' } }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'anonimo_3',
        distrito: 'San Isidro',
        origen: 'web',
        datos: { source: 'tiktok', medium: 'creator_bio', campaign: 'foodies_lima_noche' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_04',
        distrito: 'San Isidro',
        origen: 'web',
        datos: { utm: { source: 'tiktok', medium: 'creator_bio', campaign: 'foodies_lima_noche' } }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'anonimo_4',
        distrito: 'Surco',
        origen: 'web',
        datos: { source: 'google', medium: 'cpc', campaign: 'ofertas_restaurantes_lima' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_05',
        distrito: 'Surco',
        origen: 'web',
        datos: { utm: { source: 'google', medium: 'cpc', campaign: 'ofertas_restaurantes_lima' } }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'ref_VUUY-CV88_2',
        distrito: 'Barranco',
        origen: 'web',
        datos: { afiliadoId: 'VUUY-CV88', source: 'whatsapp', medium: 'chat_share', campaign: 'amigos_vuuy_ofertas' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_06',
        distrito: 'Barranco',
        origen: 'web',
        datos: { invitadoPor: 'VUUY-CV88', utm: { source: 'whatsapp', medium: 'chat_share', campaign: 'amigos_vuuy_ofertas' } }
      },
      {
        tipoEvento: 'clic_compartir',
        actorTipo: 'usuario',
        actorId: 'usr_demo_02',
        distrito: 'Barranco',
        origen: 'web',
        datos: { ofertaId: 'ofr_02', codigoRef: 'VUUY-LR26' }
      },
      {
        tipoEvento: 'visita_landing_utm',
        actorTipo: 'usuario',
        actorId: 'ref_VUUY-LR26',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { afiliadoId: 'VUUY-LR26', source: 'tiktok', medium: 'creator_bio', campaign: 'foodies_lima_noche' }
      },
      {
        tipoEvento: 'usuario_registrado_utm',
        actorTipo: 'usuario',
        actorId: 'usr_demo_08',
        distrito: 'Miraflores',
        origen: 'web',
        datos: { invitadoPor: 'VUUY-LR26', utm: { source: 'tiktok', medium: 'creator_bio', campaign: 'foodies_lima_noche' } }
      }
    ];

    eventosSemilla.forEach((ev, idx) => {
      this.eventos.push({
        id: `evt_init_${idx + 1}`,
        tipoEvento: ev.tipoEvento,
        fechaHora: new Date(fechaBase.getTime() + idx * 3600000 * 8).toISOString(),
        actorTipo: ev.actorTipo,
        actorId: ev.actorId,
        distrito: ev.distrito || 'Lima',
        provincia: 'Lima',
        origen: ev.origen,
        datos: ev.datos || {}
      });
    });
  }
}

export const coreEvents = new CoreEvents();
