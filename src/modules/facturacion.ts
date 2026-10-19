/**
 * MODULO 10: campanas-facturacion (esquema: cmp)
 * Modelo PPC por packs de clics (50, 100, 500).
 *
 * T4 / punto 3 de docs/auditoria-2026-10-19.md.
 *
 * ANTES: el saldo vivia en un `Map` en memoria y se persistia reescribiendo el
 * array completo en `app_settings.click_packs_list` (un read-modify-write por
 * cada clic). Dos clics concurrentes leian el mismo array, cada uno restaba en
 * su copia y el ultimo write pisaba al otro. En produccion se midio: 3 clics
 * facturables, 2 descuentos persistidos. El comentario decia "Debito atomico"
 * y no lo era.
 *
 * AHORA: la tabla `click_packs` es la fuente de verdad y el debito es UN solo
 * UPDATE atomico (ver `debitarClicAtomico` en src/db/repo.ts). Ya no se reescribe
 * ningun array.
 *
 * El `Map` queda solo como CACHE DE LECTURA para los consumidores sincronicos:
 * `comercioTieneSaldo` en server.ts corre dentro de `.filter()` y `.find()`, que
 * no pueden esperar un await, y pasarlo a async obligaria a reescribir tres
 * callbacks en server.ts minificado. Ese cache NUNCA decide un cobro: solo decide
 * si una oferta se muestra. Su desactualizacion es benigna por diseño (a lo sumo
 * se muestra una oferta cuyo pack acaba de agotarse). El error caro —cobrar de
 * menos— lo previene el SQL, no el cache.
 */
import { ClickPack } from '../types';
import { SEED_CLICK_PACKS } from '../data/seedData';
import { coreConfig } from '../core/config';
import { coreEvents } from '../core/events';
import {
  debitarClicAtomico,
  insertarClickPack,
  listarClickPacks,
  sembrarClickPacksSiVacio,
} from '../db/repo';

export interface ClickPackProductContribution {
  productoNombre: string;
  valorEstimado: number;
  unidadesAportadas: number;
}

export interface ResultadoDebito {
  exito: boolean;
  saldoRestante: number;
  facturacionActiva: boolean;
}

class FacturacionModule {
  private packs: Map<string, ClickPack> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Arranque pesimista: si la tabla todavia no se leyo (o la base no
    // responde), el cache queda con el seed en vez de quedar vacio. Vacio
    // significaria que `comercioTieneSaldo` devuelve false para todos y las
    // ofertas desaparecen del mosaico. `inicializar` pisa esto con la verdad
    // de la tabla en cuanto puede.
    SEED_CLICK_PACKS.forEach(p =>
      this.packs.set(p.id, { ...p, estado: p.estado === 'agotado' ? 'agotado' : 'activo' }),
    );
  }

  /**
   * Deja la tabla y el cache listos para operar.
   *
   * `blobLegacy` es el array que vivia en `app_settings.click_packs_list`. Se
   * migra UNA sola vez y solo si la tabla esta vacia: si ya hay filas, el blob
   * se ignora, porque a partir de aca la tabla manda. Se conserva la lectura del
   * blob como red de seguridad para no perder saldos reales al desplegar.
   */
  public async inicializar(blobLegacy: ClickPack[] | null): Promise<void> {
    const semilla =
      Array.isArray(blobLegacy) && blobLegacy.length > 0
        ? blobLegacy
        : (SEED_CLICK_PACKS as ClickPack[]);
    try {
      const sembrado = await sembrarClickPacksSiVacio(semilla);
      if (sembrado) console.log(`[Facturacion] click_packs sembrada con ${semilla.length} pack(s).`);
    } catch (e) {
      console.warn('[Facturacion] No se pudo sembrar click_packs:', e);
    }
    await this.recargarCache();
  }

  public async recargarCache(): Promise<void> {
    try {
      const packs = await listarClickPacks();
      if (packs.length === 0 && this.packs.size > 0) {
        console.warn(
          `[Facturacion] click_packs devolvio 0 filas pero el cache tiene ${this.packs.size} pack(s). ` +
            'Se conserva el cache a proposito: vaciarlo dejaria a TODOS los comercios sin saldo y ' +
            'sus ofertas desaparecerian del mosaico. Esto solo afecta lo que se MUESTRA, nunca un cobro. ' +
            'Si la tabla esta vacia de verdad, hay que revisar la migracion.',
        );
        return;
      }
      this.packs.clear();
      packs.forEach(p => this.packs.set(p.id, p));
      this.notificar();
    } catch (e) {
      // Si la tabla no existe o la base no responde, se CONSERVA el cache previo
      // (el seed del constructor). Antes de esto, un listado fallido devolvia []
      // y vaciaba el cache: todos los comercios quedaban sin saldo y el mosaico
      // se vaciaba. La lectura nunca debe degradar a "nadie tiene ofertas".
      console.warn(
        '[Facturacion] No se pudo leer click_packs; se conserva el cache anterior:',
        e,
      );
    }
  }

  /**
   * Debito de 1 clic (F-AUD-06). Ahora es asincrono y durable: cuando resuelve,
   * el descuento ya esta confirmado en la base.
   *
   * Si el modulo esta apagado (modo pruebas libres, regla D12), no se bloquea al
   * comercio: se descuenta si hay saldo y se devuelve exito igual.
   */
  public async debitarClic(comercioId: string): Promise<ResultadoDebito> {
    const facturacionActiva = coreConfig.moduloActivo('campanasFacturacion');

    const resultado = await debitarClicAtomico(comercioId);

    if (resultado.exito) {
      this.sincronizarCache(resultado.packId, resultado.saldoRestante);
      if (resultado.saldoRestante <= 0 && resultado.packId) {
        coreEvents.emitir({
          tipoEvento: 'pack_agotado',
          actorTipo: 'comercio',
          actorId: comercioId,
          origen: 'sistema',
          datos: { packId: resultado.packId },
        });
      }
      return { exito: true, saldoRestante: resultado.saldoRestante, facturacionActiva };
    }

    coreEvents.emitir({
      tipoEvento: 'pack_agotado',
      actorTipo: 'comercio',
      actorId: comercioId,
      origen: 'sistema',
      datos: { motivo: 'Saldo de clics en cero' },
    });

    if (!facturacionActiva) {
      return { exito: true, saldoRestante: 999, facturacionActiva: false };
    }
    return { exito: false, saldoRestante: 0, facturacionActiva: true };
  }

  /**
   * Refleja en el cache el resultado que ya confirmo la base. No inventa el
   * saldo: lo copia del RETURNING del UPDATE.
   */
  private sincronizarCache(packId: string | null, saldoRestante: number): void {
    if (!packId) return;
    const pack = this.packs.get(packId);
    if (!pack) {
      // La tabla tiene un pack que el cache no conoce (lo creo otra instancia).
      void this.recargarCache();
      return;
    }
    pack.saldoClics = Math.min(pack.saldoClics, saldoRestante);
    pack.estado = pack.saldoClics <= 0 ? 'agotado' : 'activo';
    this.notificar();
  }

  public async comprarPack(params: {
    comercioId: string;
    cantidadClics: 50 | 100 | 500;
    metodoPago: 'yape_plin' | 'transferencia' | 'aporte_productos';
    aporteProductos?: ClickPackProductContribution;
  }): Promise<ClickPack> {
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

    // Se persiste primero: un pack que solo existe en memoria es exactamente el
    // bug que este cambio elimina.
    await insertarClickPack(nuevoPack);
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
