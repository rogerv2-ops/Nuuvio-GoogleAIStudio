/**
 * MODULO 12: analitica (esquema: ana)
 *
 * Los KPIs se miden en el SERVIDOR (que es el unico que puede ver la base) y
 * llegan por `GET /api/analitica/kpis`. Antes se calculaban aqui con
 * `coreEvents` (eventos EN MEMORIA del navegador) y con minimos inventados:
 * el panel mostraba 240 usuarios, 625 vistas y 12 ventas con la base vacia.
 *
 * North-Star Metric: Leads calificados entregados por semana.
 *
 * REGLA: si un numero no se puede medir, es `null`. La pantalla muestra
 * "sin medir". Un numero inventado es peor que un hueco: hides el dato
 * que falta y hace decidir sobre algo que no existe.
 */
import { coreEvents } from '../core/events';

export interface GlobalKPIs {
  /** Leads calificados de la ultima semana (la North-Star). */
  northStarLeadsSemanales: number;
  /** Vistas de oferta. `null` = todavia no se miden (no hay contador). */
  totalVistasOfertas: number | null;
  totalClicsContactar: number;
  /** CTR en %. `null` = no hay vistas medidas con las que calcularlo. */
  ctrPromedioGlobal: number | null;
  /** Ventas confirmadas. `null` = no hay donde registrarlas todavia. */
  ventasConfirmadas: number | null;
  comerciosActivos: number;
  ofertasActivas: number;
  usuariosRegistrados: number;
  /** Tiempo mediano de validacion. `null` = no se registra. */
  tiempoMedianoValidacionHoras: number | null;
}

export interface MerchantKPIs {
  comercioId: string;
  vistasTotales: number | null;
  clicsTotales: number;
  leadsCalificados: number;
  ctr: number | null;
  ventasConfirmadas: number | null;
  gastoTotalSoles: number;
}

type Escucha = () => void;

class AnaliticaModule {
  private globales: GlobalKPIs | null = null;
  private porComercio = new Map<string, MerchantKPIs>();
  private escuchas: Escucha[] = [];
  private cargando = false;

  /** `true` cuando los KPIs vienen de la base (no de un valor de ejemplo). */
  public get medido(): boolean {
    return this.globales !== null;
  }

  /**
   * Los KPIs globales medidos.
   *
   * Mientras no se han cargado devuelve un valor POR DEFECTO con `null` en
   * lo que no se puede medir, para que la pantalla pueda pintar "sin
   * medir" en vez de romperse.
   */
  public obtenerKPIsGlobales(): GlobalKPIs {
    if (this.globales) return this.globales;
    return {
      northStarLeadsSemanales: 0,
      totalVistasOfertas: null,
      totalClicsContactar: 0,
      ctrPromedioGlobal: null,
      ventasConfirmadas: null,
      comerciosActivos: 0,
      ofertasActivas: 0,
      usuariosRegistrados: 0,
      tiempoMedianoValidacionHoras: null,
    };
  }

  /** Los KPIs de un comercio (mismo criterio: `null` = sin medir). */
  public obtenerKPIsComercio(comercioId: string): MerchantKPIs {
    return (
      this.porComercio.get(comercioId) || {
        comercioId,
        vistasTotales: null,
        clicsTotales: 0,
        leadsCalificados: 0,
        ctr: null,
        ventasConfirmadas: null,
        gastoTotalSoles: 0,
      }
    );
  }

  /**
   * Pide los KPIs al servidor y avisa a quien este escuchando.
   *
   * Con la sesion ya activa: por eso la llama el panel al montar.
   */
  public async recargar(comercioId?: string): Promise<void> {
    this.cargando = true;
    try {
      const url = comercioId
        ? `/api/analitica/kpis?comercioId=${encodeURIComponent(comercioId)}`
        : '/api/analitica/kpis';
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      const cuerpo: any = await r.json().catch(() => null);
      if (!r.ok || !cuerpo?.ok || !cuerpo.metricas) {
        throw new Error(cuerpo?.error || `HTTP ${r.status}`);
      }
      if (comercioId) {
        const m = cuerpo.metricas;
        this.porComercio.set(comercioId, {
          comercioId: m.comercioId,
          vistasTotales: m.totalVistasOfertas ?? null,
          clicsTotales: Number(m.totalClicsContactar || 0),
          leadsCalificados: Number(m.leadsCalificados || 0),
          ctr: m.ctrPromedioGlobal ?? null,
          ventasConfirmadas: m.ventasConfirmadas ?? null,
          gastoTotalSoles: Number(m.gastoTotalSoles || 0),
        });
      } else {
        const m = cuerpo.metricas;
        this.globales = {
          northStarLeadsSemanales: Number(m.northStarLeadsSemanales || 0),
          totalVistasOfertas: m.totalVistasOfertas ?? null,
          totalClicsContactar: Number(m.totalClicsContactar || 0),
          ctrPromedioGlobal: m.ctrPromedioGlobal ?? null,
          ventasConfirmadas: m.ventasConfirmadas ?? null,
          comerciosActivos: Number(m.comerciosActivos || 0),
          ofertasActivas: Number(m.ofertasActivas || 0),
          usuariosRegistrados: Number(m.usuariosRegistrados || 0),
          tiempoMedianoValidacionHoras: m.tiempoMedianoValidacionHoras ?? null,
        };
      }
    } catch (e) {
      console.warn('[Analitica] No se pudieron cargar los KPIs:', e);
    } finally {
      this.cargando = false;
      this.notificar();
    }
  }

  /**
   * El embudo de conversion, con los numeros MEDIDOS.
   *
   * Las etapas que no se miden (las ventas) se omiten: un embudo con una
   * etapa inventada no es un embudo.
   */
  public obtenerEmbudoConversion(): { etapa: string; valor: number; porcentaje: number }[] {
    const k = this.globales;
    if (!k) return [];
    const etapas: { etapa: string; valor: number }[] = [];
    if (k.totalVistasOfertas !== null) {
      etapas.push({ etapa: 'Ofertas Vistas en WhatsApp / Web', valor: k.totalVistasOfertas });
    }
    etapas.push({ etapa: 'Interés / Clics en Contactar', valor: k.totalClicsContactar });
    etapas.push({ etapa: 'Leads Calificados (WhatsApp Abierto)', valor: k.northStarLeadsSemanales });
    if (k.ventasConfirmadas !== null) {
      etapas.push({ etapa: 'Ventas Confirmadas por Negocios', valor: k.ventasConfirmadas });
    }
    const base = etapas[0]?.valor || 0;
    return etapas.map((e) => ({
      ...e,
      porcentaje: base > 0 ? Math.round((e.valor / base) * 100) : 0,
    }));
  }

  public suscribir(escucha: Escucha): () => void {
    this.escuchas.push(escucha);
    return () => {
      this.escuchas = this.escuchas.filter((e) => e !== escucha);
    };
  }

  private notificar(): void {
    for (const e of this.escuchas) {
      try {
        e();
      } catch {
        // un listener que falla no puede tumbar a los demas
      }
    }
  }
}

export const analiticaModule = new AnaliticaModule();
