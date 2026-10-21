/**
 * MODULO 11: digest (esquema: dgs)
 * Resumen diario matutino por correo y notificación push PWA.
 * NUNCA se envía por WhatsApp (ahorro de costos y cero spam).
 */
import { Offer } from '../types';
import { coreEvents } from '../core/events';
import { ofertasModule } from './ofertas';
import { usuariosModule } from './usuarios';

export interface DigestLogEntry {
  id: string;
  fecha: string;
  distrito: string;
  destinatariosCount: number;
  ofertasCount: number;
  ofertasTitulos: string[];
  canal: 'correo' | 'push';
}

class DigestModule {
  private historialEnvios: DigestLogEntry[] = [
    {
      id: 'dgs_01',
      fecha: '2026-10-09',
      distrito: 'Miraflores',
      destinatariosCount: 48,
      ofertasCount: 3,
      ofertasTitulos: [
        'Bowl Acai Orgánico + Café Pasado',
        'Dúo de Baos Panceta Glaseada',
        'Chalina 100% Baby Alpaca Suave'
      ],
      canal: 'correo'
    }
  ];

  private listeners: (() => void)[] = [];

  /**
   * Generación y envío simulado del digest diario matutino
   *
   * El digest es el canal de CORREO: es el unico envio proactivo de
   * Yuddit, con consentimiento explicito (`consentimientos.correo`). La regla
   * de "pull, no push" es del bot de WhatsApp.
   */
  public ejecutarDigestMatutino(distrito: string = 'Miraflores'): {
    ofertas: Offer[];
    usuariosAlcanzados: number;
    mensajeResultado: string;
  } {
    const usuarios = usuariosModule.listarUsuarios().filter(u =>
      u.estado === 'activo' &&
      u.consentimientos.correo &&
      u.distrito.toLowerCase() === distrito.toLowerCase()
    );

    const { ofertas } = ofertasModule.buscarOfertasCercanas({
      usuarioId: 'digest_system',
      distrito,
      limite: 3
    });

    const entry: DigestLogEntry = {
      id: `dgs_${Date.now()}`,
      fecha: new Date().toISOString().split('T')[0],
      distrito,
      destinatariosCount: Math.max(1, usuarios.length),
      ofertasCount: ofertas.length,
      ofertasTitulos: ofertas.map(o => o.titulo),
      canal: 'correo'
    };

    this.historialEnvios.unshift(entry);

    coreEvents.emitir({
      tipoEvento: 'digest_enviado',
      actorTipo: 'sistema',
      actorId: 'digest_runner',
      distrito,
      origen: 'correo',
      datos: {
        destinatarios: entry.destinatariosCount,
        ofertasIds: ofertas.map(o => o.id)
      }
    });

    this.notificar();

    return {
      ofertas,
      usuariosAlcanzados: entry.destinatariosCount,
      mensajeResultado: `Resumen diario enviado exitosamente a ${entry.destinatariosCount} usuarios en ${distrito} con ${ofertas.length} ofertas destacadas.`
    };
  }

  public getHistorial(): DigestLogEntry[] {
    return [...this.historialEnvios];
  }

  public suscribir(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notificar() {
    this.listeners.forEach(l => l());
  }
}

export const digestModule = new DigestModule();
