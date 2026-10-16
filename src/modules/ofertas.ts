import { SEED_OFFERS } from "../data/seedData.ts";
import { comerciosModule } from "./comercios.ts";
import { coreEvents } from "../core/events.ts";
import { coreSecurity } from "../core/security.ts";

export interface Offer {
  id: string;
  codigoUrl: string;
  comercioId: string;
  comercioNombre: string;
  comercioWhatsapp: string;
  titulo: string;
  descripcion: string;
  tipo: string;
  precioNormal: number;
  precioOferta: number;
  stock?: number;
  categoria: string;
  distrito: string;
  provincia: string;
  lat: number;
  lng: number;
  imagenes: string[];
  venceEn: string;
  estado: string;
  likes?: number;
  vistas: number;
  clics: number;
  leadsCalificados: number;
  videoUrl?: string;
  videoAspectRatio?: string;
  videoEstado?: string;
  videoPrompt?: string;
  creadaEn: string;
  validadaEn?: string;
  validadaPor?: string;
  motivoRechazo?: string;
}

export interface BuscarOfertasParams {
  usuarioId: string;
  distrito: string;
  categorias?: string[];
  limite?: number;
}

class OfertasModule {
  private ofertas: Map<string, Offer> = new Map<string, Offer>();
  private ofertasVistasPorUsuario: Map<string, Set<string>> = new Map<string, Set<string>>();
  private ultimaPublicacionComercio: Map<string, number> = new Map<string, number>();
  private listeners: (() => void)[] = [];

  constructor() {
    SEED_OFFERS.forEach((o: any) => this.ofertas.set(o.id, { ...(o as Offer) }));
    if (typeof window !== "undefined") {
      this.cargarDeAPI();
    }
  }

  async cargarDeDB(): Promise<Offer[]> {
    if (typeof window === "undefined") {
      try {
        const { getAllOffers } = await import("../db/repo.ts");
        const dbOffers = await getAllOffers();
        if (dbOffers && dbOffers.length > 0) {
          this.ofertas.clear();
          dbOffers.forEach((o: any) => this.ofertas.set(o.id, o as Offer));
          this.notificar();
          return dbOffers as Offer[];
        }
      } catch (err) {
        console.warn("[OfertasModule] Error cargando ofertas desde PostgreSQL:", err);
      }
    } else {
      await this.cargarDeAPI();
    }
    return this.listarOfertas();
  }

  async cargarDeAPI(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/ofertas");
        if (res.ok) {
          const data = await res.json();
          const lista = data.ofertas || data;
          if (Array.isArray(lista) && lista.length > 0) {
            this.cargarDeLista(lista);
          }
        }
      } catch (e) {
        console.warn("[OfertasModule Client] Error al consultar /api/ofertas:", e);
      }
    }
  }

  cargarDeLista(lista: Offer[]): void {
    if (Array.isArray(lista) && lista.length > 0) {
      this.ofertas.clear();
      lista.forEach((o: Offer) => this.ofertas.set(o.id, o));
      this.notificar();
    }
  }

  async guardarEnDB(): Promise<void> {
    const lista: Offer[] = Array.from(this.ofertas.values());
    if (typeof window === "undefined") {
      try {
        const { syncOffers } = await import("../db/repo.ts");
        await syncOffers(lista);
      } catch (err) {
        console.warn("[OfertasModule Server] Error persistiendo ofertas en PostgreSQL:", err);
      }
    } else {
      try {
        await fetch("/api/ofertas/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ofertas: lista }),
        });
      } catch (e) {
        console.warn("[OfertasModule Client] Error sincronizando ofertas:", e);
      }
    }
  }

  buscarOfertasCercanas(params: BuscarOfertasParams): { ofertas: Offer[]; hayMas: boolean } {
    const ahora = new Date().toISOString();
    const vistas: Set<string> = this.ofertasVistasPorUsuario.get(params.usuarioId) || new Set<string>();
    const limite = params.limite || 5;

    const allOffers: Offer[] = Array.from(this.ofertas.values());
    let candidatas: Offer[] = allOffers.filter((o: Offer) => {
      const estaActiva = o.estado === "activa";
      const noVencida = o.venceEn > ahora;
      const noVista = !vistas.has(o.id);
      return estaActiva && noVencida && noVista;
    });

    if (candidatas.length === 0) {
      candidatas = allOffers.filter((o: Offer) => o.estado === "activa" && o.venceEn > ahora);
      vistas.clear();
      this.ofertasVistasPorUsuario.set(params.usuarioId, vistas);
    }

    candidatas.sort((a: Offer, b: Offer) => {
      const aDistrito = a.distrito.toLowerCase() === params.distrito.toLowerCase() ? 1 : 0;
      const bDistrito = b.distrito.toLowerCase() === params.distrito.toLowerCase() ? 1 : 0;
      if (aDistrito !== bDistrito) return bDistrito - aDistrito;

      const aCat = params.categorias?.includes(a.categoria) ? 1 : 0;
      const bCat = params.categorias?.includes(b.categoria) ? 1 : 0;
      if (aCat !== bCat) return bCat - aCat;

      const fechaA = new Date(a.validadaEn || a.creadaEn).getTime();
      const fechaB = new Date(b.validadaEn || b.creadaEn).getTime();
      return fechaB - fechaA;
    });

    const seleccionadas = candidatas.slice(0, limite);
    seleccionadas.forEach((o: Offer, index: number) => {
      vistas.add(o.id);
      o.vistas = (o.vistas || 0) + 1;
      coreEvents.emitir({
        tipoEvento: "oferta_mostrada",
        actorTipo: "sistema",
        actorId: params.usuarioId,
        distrito: o.distrito,
        origen: "whatsapp",
        datos: { ofertaId: o.id, posicion: index + 1, comercioId: o.comercioId },
      });
    });

    this.ofertasVistasPorUsuario.set(params.usuarioId, vistas);
    this.guardarEnDB().catch(() => {});
    this.notificar();

    return { ofertas: seleccionadas, hayMas: candidatas.length > limite };
  }

  crearOferta(datos: {
    comercioId: string;
    titulo: string;
    descripcion: string;
    tipo: string;
    precioNormal: number;
    precioOferta: number;
    stock?: number;
    categoria: string;
    imagenes: string[];
    diasVencimiento?: number;
    videoUrl?: string;
    videoAspectRatio?: string;
    videoEstado?: string;
    videoPrompt?: string;
  }): { ok: boolean; oferta?: Offer; error?: string } {
    const comercio = comerciosModule.obtenerComercio(datos.comercioId);
    if (!comercio || comercio.estado !== "activo") {
      return { ok: false, error: "El comercio no existe o no se encuentra aprobado para publicar." };
    }

    if (datos.descripcion.length > 150) {
      return { ok: false, error: "La descripción excede el límite estricto de 150 caracteres." };
    }
    if (datos.precioOferta >= datos.precioNormal) {
      return { ok: false, error: "El precio de oferta debe ser menor al precio normal." };
    }
    if (datos.imagenes.length === 0) {
      return { ok: false, error: "Debes incluir al menos 1 foto para la portada de WhatsApp." };
    }

    const imagenesLimpias = datos.imagenes.slice(0, 3);
    const dias = Math.min(datos.diasVencimiento || 30, 30);
    const fechaVence = new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString();
    const id = `ofr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = datos.titulo
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const codigoUrl = `${slug}-${Math.floor(100 + Math.random() * 900)}`;

    const nuevaOferta: Offer = {
      id,
      codigoUrl,
      comercioId: comercio.id,
      comercioNombre: comercio.nombreComercial,
      comercioWhatsapp: comercio.telefono,
      titulo: datos.titulo,
      descripcion: datos.descripcion,
      tipo: datos.tipo,
      precioNormal: datos.precioNormal,
      precioOferta: datos.precioOferta,
      stock: datos.stock,
      categoria: datos.categoria,
      distrito: comercio.distrito,
      provincia: comercio.provincia,
      lat: comercio.lat,
      lng: comercio.lng,
      imagenes: imagenesLimpias,
      venceEn: fechaVence,
      estado: "en_validacion",
      creadaEn: new Date().toISOString(),
      vistas: 0,
      clics: 0,
      leadsCalificados: 0,
      likes: 0,
      videoUrl: datos.videoUrl,
      videoAspectRatio: datos.videoAspectRatio || (datos.videoUrl ? "9:16" : undefined),
      videoEstado: datos.videoEstado || (datos.videoUrl ? "completado" : undefined),
      videoPrompt: datos.videoPrompt,
    };

    this.ofertas.set(id, nuevaOferta);
    this.ultimaPublicacionComercio.set(datos.comercioId, Date.now());

    coreEvents.emitir({
      tipoEvento: "oferta_enviada",
      actorTipo: "comercio",
      actorId: comercio.id,
      distrito: comercio.distrito,
      origen: "whatsapp",
      datos: {
        ofertaId: id,
        titulo: datos.titulo,
        precioNormal: datos.precioNormal,
        precioOferta: datos.precioOferta,
      },
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();

    return { ok: true, oferta: nuevaOferta };
  }

  activarOferta(ofertaId: string, operadorNombre = "Super Admin"): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.estado = "activa";
    oferta.validadaEn = new Date().toISOString();
    oferta.validadaPor = operadorNombre;

    coreEvents.emitir({
      tipoEvento: "oferta_activada",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      distrito: oferta.distrito,
      origen: "panel",
      datos: { ofertaId, titulo: oferta.titulo },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre,
      accion: "Activar oferta",
      entidad: "oferta",
      entidadId: ofertaId,
      detalles: `Oferta "${oferta.titulo}" aprobada y publicada en PostgreSQL.`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  rechazarOferta(ofertaId: string, motivo: string, operadorNombre = "Super Admin"): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.estado = "rechazada";
    oferta.motivoRechazo = motivo;

    coreEvents.emitir({
      tipoEvento: "oferta_rechazada",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      distrito: oferta.distrito,
      origen: "panel",
      datos: { ofertaId, motivo },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre,
      accion: "Rechazar oferta",
      entidad: "oferta",
      entidadId: ofertaId,
      detalles: `Oferta rechazada con motivo: ${motivo}`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  pausarOferta(ofertaId: string): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.estado = oferta.estado === "activa" ? "pausada" : "activa";
    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  actualizarOfertaVideo(ofertaId: string, videoUrl: string, aspectRatio = "9:16", prompt?: string): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.videoUrl = videoUrl;
    oferta.videoAspectRatio = aspectRatio;
    oferta.videoEstado = "completado";
    if (prompt) oferta.videoPrompt = prompt;

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  obtenerOferta(id: string): Offer | undefined {
    return this.ofertas.get(id);
  }

  obtenerPorCodigoUrl(codigoUrl: string): Offer | undefined {
    for (const o of Array.from(this.ofertas.values())) {
      if (o.codigoUrl === codigoUrl) return o;
    }
    return undefined;
  }

  listarOfertas(): Offer[] {
    return Array.from(this.ofertas.values());
  }

  listarOfertasActivas(): Offer[] {
    const ahora = new Date().toISOString();
    return Array.from(this.ofertas.values())
      .filter((o: Offer) => o.estado === "activa" && o.venceEn > ahora)
      .sort((a: Offer, b: Offer) => {
        const fechaA = new Date(a.validadaEn || a.creadaEn).getTime();
        const fechaB = new Date(b.validadaEn || b.creadaEn).getTime();
        return fechaB - fechaA;
      });
  }

  listarOfertasPorComercio(comercioId: string): Offer[] {
    return this.listarOfertas().filter((o: Offer) => o.comercioId === comercioId);
  }

  listarPendientesModeracion(): Offer[] {
    return this.listarOfertas().filter((o: Offer) => o.estado === "en_validacion");
  }

  calcularDistanciaAproxKm(distritoUsuario: string, distritoOferta: string): number {
    if (distritoUsuario.toLowerCase() === distritoOferta.toLowerCase()) return 0.8;
    const adyacentes: Record<string, string[]> = {
      Miraflores: ["San Isidro", "Barranco", "Surco", "San Borja"],
      Barranco: ["Miraflores", "Surco", "Chorrillos"],
      "San Isidro": ["Miraflores", "Lince", "Magdalena", "Jesús María", "San Borja"],
      "Santiago de Surco": ["Miraflores", "Barranco", "San Borja", "La Molina"],
    };
    if (adyacentes[distritoUsuario]?.includes(distritoOferta)) return 2.4;
    return 4.6;
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

export const ofertasModule = new OfertasModule();
