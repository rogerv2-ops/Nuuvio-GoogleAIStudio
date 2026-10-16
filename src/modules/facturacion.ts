import { SEED_CLICK_PACKS } from "../data/seedData.ts";
import { coreEvents } from "../core/events.ts";
import { coreSecurity } from "../core/security.ts";

export interface ClickPack {
  id: string;
  comercioId: string;
  totalClics: number;
  saldoClics: number;
  precioUnitario: number;
  montoTotal: number;
  estado: "activo" | "agotado" | "vencido";
  compradoEn: string;
}

class FacturacionModule {
  private packs: Map<string, ClickPack> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Inicializar con semillas iniciales
    SEED_CLICK_PACKS.forEach((p) => {
      this.packs.set(p.id, { ...(p as ClickPack) });
    });

    if (typeof window !== "undefined") {
      this.cargarDeAPI();
    }
  }

  /**
   * Carga los paquetes de clics desde PostgreSQL
   */
  async cargarDeDB(): Promise<ClickPack[]> {
    if (typeof window === "undefined") {
      try {
        const { getSetting } = await import("../db/repo.ts");
        const dbPacks = await getSetting("click_packs_list", null);
        if (Array.isArray(dbPacks) && dbPacks.length > 0) {
          this.packs.clear();
          dbPacks.forEach((p: ClickPack) => this.packs.set(p.id, p));
          this.notificar();
          return dbPacks;
        }
      } catch (err) {
        console.warn("[FacturacionModule] Error cargando packs desde PostgreSQL:", err);
      }
    }
    return this.listarPacks();
  }

  async cargarDeAPI(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/facturacion/packs");
        if (res.ok) {
          const data = await res.json();
          const lista = data.packs || data;
          if (Array.isArray(lista) && lista.length > 0) {
            this.cargarDeLista(lista);
          }
        }
      } catch (e) {
        // En frontend
      }
    }
  }

  cargarDeLista(lista: ClickPack[]): void {
    if (Array.isArray(lista) && lista.length > 0) {
      this.packs.clear();
      lista.forEach((p) => this.packs.set(p.id, p));
      this.notificar();
    }
  }

  async guardarEnDB(): Promise<void> {
    const lista = Array.from(this.packs.values());
    if (typeof window === "undefined") {
      try {
        const { saveSetting } = await import("../db/repo.ts");
        await saveSetting("click_packs_list", lista);
      } catch (err) {
        console.warn("[FacturacionModule] Error guardando packs en PostgreSQL:", err);
      }
    }
  }

  /**
   * Debita un clic facturable del saldo prepago del comercio
   */
  async debitarClic(comercioId: string): Promise<boolean> {
    // Buscar el pack activo más antiguo del comercio
    const packsComercio = Array.from(this.packs.values())
      .filter((p) => p.comercioId === comercioId && p.estado === "activo" && p.saldoClics > 0)
      .sort((a, b) => new Date(a.compradoEn).getTime() - new Date(b.compradoEn).getTime());

    if (packsComercio.length === 0) {
      // Si no tiene saldo prepago, creamos un pack base con saldo o permitimos descubierto controlado
      const nuevoPackId = `pack_auto_${Date.now()}`;
      const autoPack: ClickPack = {
        id: nuevoPackId,
        comercioId,
        totalClics: 50,
        saldoClics: 49,
        precioUnitario: 1.2,
        montoTotal: 60,
        estado: "activo",
        compradoEn: new Date().toISOString(),
      };
      this.packs.set(nuevoPackId, autoPack);
      await this.guardarEnDB();
      this.notificar();
      return true;
    }

    const pack = packsComercio[0];
    pack.saldoClics -= 1;
    if (pack.saldoClics <= 0) {
      pack.saldoClics = 0;
      pack.estado = "agotado";
    }

    coreEvents.emitir({
      tipoEvento: "clic_debitado",
      actorTipo: "comercio",
      actorId: comercioId,
      distrito: "Lima",
      origen: "redireccion_cpc",
      datos: { comercioId, packId: pack.id, nuevoSaldo: pack.saldoClics },
    });

    await this.guardarEnDB();
    this.notificar();
    return true;
  }

  obtenerSaldo(comercioId: string): number {
    return Array.from(this.packs.values())
      .filter((p) => p.comercioId === comercioId && p.estado === "activo")
      .reduce((acc, p) => acc + p.saldoClics, 0);
  }

  listarPacks(): ClickPack[] {
    return Array.from(this.packs.values());
  }

  suscribir(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notificar(): void {
    this.listeners.forEach((l) => l());
  }
}

export const facturacionModule = new FacturacionModule();
