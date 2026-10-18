/**
 * MODULO 9: puntos-referidos (esquema: pts)
 * El motor viral: puntos por compartir y registro de referidos,
 * marketplace de recompensas y canje con código alfanumérico único de 8 caracteres.
 */
import { PointsMovement, Reward, Redemption } from '../types';
import { SEED_REWARDS } from '../data/seedData';
import { coreEvents } from '../core/events';

class PuntosModule {
  private movimientos: PointsMovement[] = [];

  private recompensas: Map<string, Reward> = new Map();
  private canjes: Map<string, Redemption> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    SEED_REWARDS.forEach(r => this.recompensas.set(r.id, { ...r }));
  }

  public obtenerSaldo(usuarioId: string): number {
    return this.movimientos
      .filter(m => m.usuarioId === usuarioId)
      .reduce((acc, m) => acc + m.cantidad, 0);
  }

  public acreditarPuntos(params: {
    usuarioId: string;
    cantidad: number;
    motivo: 'compartir' | 'referido_registrado' | 'ajuste_gestion';
    referenciaId?: string;
  }): number {
    const id = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevoMovimiento: PointsMovement = {
      id,
      usuarioId: params.usuarioId,
      cantidad: params.cantidad,
      motivo: params.motivo,
      referenciaId: params.referenciaId,
      fecha: new Date().toISOString()
    };

    this.movimientos.unshift(nuevoMovimiento);

    coreEvents.emitir({
      tipoEvento: 'puntos_ganados',
      actorTipo: 'usuario',
      actorId: params.usuarioId,
      origen: 'sistema',
      datos: {
        cantidad: params.cantidad,
        motivo: params.motivo,
        referenciaId: params.referenciaId
      }
    });

    this.notificar();
    return this.obtenerSaldo(params.usuarioId);
  }

  public listarRecompensas(distrito?: string): Reward[] {
    const activas = Array.from(this.recompensas.values()).filter(r => r.estado === 'activa');
    if (distrito) {
      return activas.filter(r => r.distrito.toLowerCase() === distrito.toLowerCase());
    }
    return activas;
  }

  public solicitarCanje(params: {
    rewardId: string;
    usuarioId: string;
    usuarioNombre: string;
  }): { ok: boolean; canje?: Redemption; error?: string } {
    const reward = this.recompensas.get(params.rewardId);
    if (!reward || reward.estado !== 'activa' || reward.stock <= 0) {
      return { ok: false, error: 'Recompensa no disponible o stock agotado.' };
    }

    const saldo = this.obtenerSaldo(params.usuarioId);
    if (saldo < reward.puntosRequeridos) {
      return { ok: false, error: `Saldo insuficiente. Tienes ${saldo} puntos y requieres ${reward.puntosRequeridos}.` };
    }

    // Descontar puntos en libro de movimientos
    const idMov = `mov_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.movimientos.unshift({
      id: idMov,
      usuarioId: params.usuarioId,
      cantidad: -reward.puntosRequeridos,
      motivo: 'canje',
      referenciaId: reward.id,
      fecha: new Date().toISOString()
    });

    // Descontar stock
    reward.stock -= 1;
    if (reward.stock === 0) reward.estado = 'agotada';

    // Generar código alfanumérico único de 8 caracteres (H20)
    const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }

    const canjeId = `cnj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevoCanje: Redemption = {
      id: canjeId,
      codigo,
      rewardId: reward.id,
      rewardTitulo: reward.titulo,
      usuarioId: params.usuarioId,
      usuarioNombre: params.usuarioNombre,
      comercioId: reward.comercioId,
      puntosUsados: reward.puntosRequeridos,
      estado: 'emitido',
      emitidoEn: new Date().toISOString()
    };

    this.canjes.set(codigo, nuevoCanje);

    coreEvents.emitir({
      tipoEvento: 'recompensa_canjeada',
      actorTipo: 'usuario',
      actorId: params.usuarioId,
      distrito: reward.distrito,
      origen: 'whatsapp',
      datos: {
        codigo,
        rewardId: reward.id,
        puntosUsados: reward.puntosRequeridos,
        comercioId: reward.comercioId
      }
    });

    this.notificar();
    return { ok: true, canje: nuevoCanje };
  }

  public validarCodigoCanje(codigo: string, comercioId: string): { ok: boolean; canje?: Redemption; error?: string } {
    const codLimpio = codigo.trim().toUpperCase();
    const canje = this.canjes.get(codLimpio);

    if (!canje) {
      return { ok: false, error: 'Código de canje no encontrado o inválido.' };
    }

    if (canje.comercioId !== comercioId) {
      return { ok: false, error: 'Este código de canje pertenece a otro comercio.' };
    }

    if (canje.estado === 'usado') {
      return { ok: false, error: `Este código ya fue entregado el ${new Date(canje.usadoEn!).toLocaleDateString()}.` };
    }

    canje.estado = 'usado';
    canje.usadoEn = new Date().toISOString();

    coreEvents.emitir({
      tipoEvento: 'codigo_validado',
      actorTipo: 'comercio',
      actorId: comercioId,
      origen: 'panel',
      datos: { codigo: codLimpio, resultado: 'ok' }
    });

    this.notificar();
    return { ok: true, canje };
  }

  public listarCanjesPorComercio(comercioId: string): Redemption[] {
    return Array.from(this.canjes.values()).filter(c => c.comercioId === comercioId);
  }

  public listarCanjesPorUsuario(usuarioId: string): Redemption[] {
    return Array.from(this.canjes.values()).filter(c => c.usuarioId === usuarioId);
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

export const puntosModule = new PuntosModule();
