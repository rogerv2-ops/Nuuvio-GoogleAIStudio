/**
 * MODULO 10: campanas-facturacion (esquema: cmp)
 * Modelo PPC por packs de clics (50, 100, 500).
 * Nace construida completa pero con INTERRUPTOR APAGADO para pruebas libres (D12).
 */
import { ClickPack } from '../types';
import { SEED_CLICK_PACKS } from '../data/seedData';
import { coreConfig } from '../core/config';
import { coreEvents } from '../core/events';

export interface ClickPackProductContribution {
  productoNombre: string;
  valorEstimado: number;
  unidadesAportadas: number;
}

class FacturacionModule {
  private packs: Map<string, ClickPack> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    SEED_CLICK_PACKS.forEach(p => this.packs.set(p.id, { ...p }));
  }

  /**
   * Débito atómico de 1 clic (F-AUD-06):
   * Si el módulo está activo, descuenta del saldo del pack.
   * Si está apagado (modo de prueba libre), no bloquea al comercio.
   */
  public debitarClic(comercioId: string): { exito: boolean; saldoRestante: number; facturacionActiva: boolean } {
    const facturacionActiva = coreConfig.moduloActivo('campanasFacturacion');

    // Buscar pack activo con saldo
    const packActivo = Array.from(this.packs.values()).find(
      p => p.comercioId === comercioId && p.saldoClics > 0
    );

    if (!facturacionActiva) {
      // Modo pruebas libres: si hay pack se actualiza estadísticamente sin bloquear
      if (packActivo) {
        packActivo.saldoClics = Math.max(0, packActivo.saldoClics - 1);
        this.notificar();
      }
      return { exito: true, saldoRestante: packActivo ? packActivo.saldoClics : 999, facturacionActiva: false };
    }

    if (!packActivo || packActivo.saldoClics <= 0) {
      coreEvents.emitir({
        tipoEvento: 'pack_agotado',
        actorTipo: 'comercio',
        actorId: comercioId,
        origen: 'sistema',
        datos: { motivo: 'Saldo de clics en cero' }
      });
      return { exito: false, saldoRestante: 0, facturacionActiva: true };
    }

    packActivo.saldoClics -= 1;
    if (packActivo.saldoClics === 0) {
      packActivo.estado = 'agotado';
      coreEvents.emitir({
        tipoEvento: 'pack_agotado',
        actorTipo: 'comercio',
        actorId: comercioId,
        origen: 'sistema',
        datos: { packId: packActivo.id }
      });
    }

    this.notificar();
    return { exito: true, saldoRestante: packActivo.saldoClics, facturacionActiva: true };
  }

  public comprarPack(params: {
    comercioId: string;
    cantidadClics: 50 | 100 | 500;
    metodoPago: 'yape_plin' | 'transferencia' | 'aporte_productos';
    aporteProductos?: ClickPackProductContribution;
  }): ClickPack {
    const precios: Record<number, number> = {
      50: Number(coreConfig.obtenerValor('precio_pack_50', 70)),
      100: Number(coreConfig.obtenerValor('precio_pack_100', 120)),
      500: Number(coreConfig.obtenerValor('precio_pack_500', 500))
    };

    const precioBase = precios[params.cantidadClics] || 120;
    const descuentoProductos = params.aporteProductos 
      ? Math.min(precioBase * 0.30, params.aporteProductos.valorEstimado * params.aporteProductos.unidadesAportadas)
      : 0;

    const montoFinal = Math.max(0, precioBase - descuentoProductos);

    const id = `pack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevoPack: ClickPack = {
      id,
      comercioId: params.comercioId,
      totalClics: params.cantidadClics,
      saldoClics: params.cantidadClics,
      precioUnitario: Number((montoFinal / params.cantidadClics).toFixed(2)),
      montoTotal: montoFinal,
      estado: 'activo',
      compradoEn: new Date().toISOString()
    };

    this.packs.set(id, nuevoPack);

    coreEvents.emitir({
      tipoEvento: 'pack_comprado',
      actorTipo: 'comercio',
      actorId: params.comercioId,
      origen: 'panel',
      datos: {
        packId: id,
        totalClics: params.cantidadClics,
        monto: montoFinal,
        metodo: params.metodoPago,
        descuentoProductos
      }
    });

    this.notificar();
    return nuevoPack;
  }

  public obtenerSaldoComercio(comercioId: string): number {
    let saldoTotal = 0;
    for (const p of this.packs.values()) {
      if (p.comercioId === comercioId && p.estado === 'activo') {
        saldoTotal += p.saldoClics;
      }
    }
    return saldoTotal;
  }

  public listarPacksPorComercio(comercioId: string): ClickPack[] {
    return Array.from(this.packs.values()).filter(p => p.comercioId === comercioId);
  }

  public listarTodosLosPacks(): ClickPack[] {
    return Array.from(this.packs.values());
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

export const facturacionModule = new FacturacionModule();
