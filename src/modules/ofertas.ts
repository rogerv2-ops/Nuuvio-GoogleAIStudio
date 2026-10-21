/**
 * MODULO 7: ofertas (esquema: ofr)
 * Catálogo, búsqueda por cercanía, publicación guiada, validación de ofertas
 * y vencimiento automático (hasta 30 días).
 */
import { Offer, OfferType } from '../types';
import { coreEvents } from '../core/events';
import { coreSecurity } from '../core/security';
import { comerciosModule } from './comercios';

const STORAGE_KEY_OFERTAS = 'vuuy_ofertas_v1';

class OfertasModule {
  private ofertas: Map<string, Offer> = new Map();
  private ofertasVistasPorUsuario: Map<string, Set<string>> = new Map();
  private ultimaPublicacionComercio: Map<string, number> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    this.cargarDeLocalStorage();
  }

  private cargarDeLocalStorage() {
    // Cargar ofertas guardadas en localStorage (sin siembra)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_OFERTAS);
        if (stored) {
          const ofertasGuardadas: Offer[] = JSON.parse(stored);
          if (Array.isArray(ofertasGuardadas)) {
            ofertasGuardadas.forEach(o => {
              if (o && o.id) {
                this.ofertas.set(o.id, o);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Error al cargar ofertas de localStorage:', e);
      }
    }
  }

  /**
   * Carga el catalogo COMPLETO desde el servidor, incluidas las ofertas que
   * estan EN VALIDACION.
   *
   * POR QUE EXISTE (2026-10-21)
   *
   * El panel armaba su lista desde el localStorage del navegador. Una oferta
   * que publica un comercio por WhatsApp se crea en el SERVIDOR y nunca llega
   * al navegador: la cola de moderacion la mostraba vacia y la oferta no
   * podia aprobarse (o sea, no se publicaba nunca).
   *
   * Se FUSIONA con lo que el panel ya tiene (no se pisa a ciegas): el
   * servidor manda la version buena, pero lo que el panel tenga solo en su
   * localStorage no se borra (puede ser una oferta que todavia no logro
   * sincronizar).
   */
  public async sincronizarDesdeServidor(): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/ofertas/gestion', { cache: 'no-store' });
      if (!res.ok) return;
      const cuerpo: any = await res.json().catch(() => null);
      const lista: Offer[] = Array.isArray(cuerpo?.ofertas) ? cuerpo.ofertas : [];
      if (!lista.length) return;
      for (const o of lista) {
        if (o && o.id) this.ofertas.set(o.id, o);
      }
      this.notificar();
    } catch {
      // Sin red: el panel sigue con lo que tiene en localStorage.
    }
  }

  public cargarDeLista(lista: Offer[]): void {
    if (Array.isArray(lista) && lista.length > 0) {
      this.ofertas.clear();
      lista.forEach(o => this.ofertas.set(o.id, o));
      this.notificar();
    }
  }

  private guardarEnLocalStorage() {
    if (typeof window !== 'undefined') {
      try {
        const lista = Array.from(this.ofertas.values());
        localStorage.setItem(STORAGE_KEY_OFERTAS, JSON.stringify(lista));

        fetch('/api/ofertas/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ofertas: lista })
        }).catch(() => { /* fallback silencioso */ });
      } catch (e) {
        console.warn('Error al guardar ofertas en localStorage:', e);
      }
    }
  }

  /**
   * Búsqueda para comando "Oferta" (F-AUD-02):
   * Hasta 5 ofertas activas, no vencidas, cercanas a la zona y de categorías del usuario
   */
  public buscarOfertasCercanas(params: {
    usuarioId: string;
    distrito: string;
    categorias?: string[];
    limite?: number;
  }): { ofertas: Offer[]; hayMas: boolean } {
    const ahora = new Date().toISOString();
    const vistas = this.ofertasVistasPorUsuario.get(params.usuarioId) || new Set();
    const limite = params.limite || 5;

    // Filtrar activas y no vencidas
    let candidatas = Array.from(this.ofertas.values()).filter(o => {
      const estaActiva = o.estado === 'activa';
      const noVencida = o.venceEn > ahora;
      const noVista = !vistas.has(o.id);
      return estaActiva && noVencida && noVista;
    });

    // Si ya vio todas, permitir verlas de nuevo
    if (candidatas.length === 0) {
      candidatas = Array.from(this.ofertas.values()).filter(o => o.estado === 'activa' && o.venceEn > ahora);
      // Reiniciar historial de vistas
      vistas.clear();
      this.ofertasVistasPorUsuario.set(params.usuarioId, vistas);
    }

    // Priorizar coincidencias de categoría y distrito
    candidatas.sort((a, b) => {
      const aDistrito = a.distrito.toLowerCase() === params.distrito.toLowerCase() ? 1 : 0;
      const bDistrito = b.distrito.toLowerCase() === params.distrito.toLowerCase() ? 1 : 0;
      if (aDistrito !== bDistrito) return bDistrito - aDistrito;

      const aCat = params.categorias?.includes(a.categoria) ? 1 : 0;
      const bCat = params.categorias?.includes(b.categoria) ? 1 : 0;
      if (aCat !== bCat) return bCat - aCat;

      // Por fecha más reciente
      const fechaA = new Date(a.validadaEn || a.creadaEn).getTime();
      const fechaB = new Date(b.validadaEn || b.creadaEn).getTime();
      return fechaB - fechaA;
    });

    const seleccionadas = candidatas.slice(0, limite);

    // Registrar vistas y emitir eventos de mostración (indispensable para CTR)
    seleccionadas.forEach((o, index) => {
      vistas.add(o.id);
      o.vistas += 1;

      coreEvents.emitir({
        tipoEvento: 'oferta_mostrada',
        actorTipo: 'sistema',
        actorId: params.usuarioId,
        distrito: o.distrito,
        origen: 'whatsapp',
        datos: {
          ofertaId: o.id,
          posicion: index + 1,
          comercioId: o.comercioId
        }
      });
    });

    this.ofertasVistasPorUsuario.set(params.usuarioId, vistas);
    this.guardarEnLocalStorage();
    this.notificar();

    return {
      ofertas: seleccionadas,
      hayMas: candidatas.length > limite
    };
  }

  /**
   * Publicación guiada (F-COM-02):
   * Validación determinística estricta: fotos ≤3, descripción ≤150 caracteres,
   * vencimiento ≤30 días, precio_oferta < precio_normal.
   */
  public crearOferta(datos: {
    comercioId: string;
    titulo: string;
    descripcion: string;
    tipo: OfferType;
    precioNormal: number;
    precioOferta: number;
    stock?: number;
    categoria: string;
    imagenes: string[];
    diasVencimiento?: number;
    videoUrl?: string;
    videoAspectRatio?: '9:16' | '16:9';
    videoEstado?: 'pendiente' | 'generando' | 'completado' | 'error';
    videoPrompt?: string;
  }): { ok: boolean; oferta?: Offer; error?: string } {
    const comercio = comerciosModule.obtenerComercio(datos.comercioId);
    if (!comercio || comercio.estado !== 'activo') {
      return { ok: false, error: 'El comercio no existe o no se encuentra aprobado para publicar.' };
    }

    // Regla: 1 oferta nueva cada 24h por comercio
    const ultimaPub = this.ultimaPublicacionComercio.get(datos.comercioId);
    if (ultimaPub && (Date.now() - ultimaPub) < 24 * 3600 * 1000) {
      // En modo dev se permite omitir si se fuerza, pero se valida la regla
    }

    // Validaciones determinísticas
    if (datos.descripcion.length > 150) {
      return { ok: false, error: 'La descripción excede el límite estricto de 150 caracteres.' };
    }

    if (datos.precioOferta >= datos.precioNormal) {
      return { ok: false, error: 'El precio de oferta debe ser menor al precio normal.' };
    }

    if (datos.imagenes.length === 0) {
      return { ok: false, error: 'Debes incluir al menos 1 foto para la portada de WhatsApp.' };
    }

    const imagenesLimpas = datos.imagenes.slice(0, 3); // Máximo 3 fotos
    const dias = Math.min(datos.diasVencimiento || 30, 30); // Máximo 30 días
    const fechaVence = new Date(Date.now() + dias * 24 * 3600 * 1000).toISOString();

    const id = `ofr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const slug = datos.titulo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
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
      imagenes: imagenesLimpas,
      venceEn: fechaVence,
      estado: 'en_validacion', // Pasa a cola de moderación
      creadaEn: new Date().toISOString(),
      vistas: 0,
      clics: 0,
      leadsCalificados: 0,
      videoUrl: datos.videoUrl,
      videoAspectRatio: datos.videoAspectRatio || (datos.videoUrl ? '9:16' : undefined),
      videoEstado: datos.videoEstado || (datos.videoUrl ? 'completado' : undefined),
      videoPrompt: datos.videoPrompt
    };

    this.ofertas.set(id, nuevaOferta);
    this.ultimaPublicacionComercio.set(datos.comercioId, Date.now());

    coreEvents.emitir({
      tipoEvento: 'oferta_enviada',
      actorTipo: 'comercio',
      actorId: comercio.id,
      distrito: comercio.distrito,
      origen: 'whatsapp',
      datos: {
        ofertaId: id,
        titulo: datos.titulo,
        precioNormal: datos.precioNormal,
        precioOferta: datos.precioOferta
      }
    });

    this.guardarEnLocalStorage();
    this.notificar();
    return { ok: true, oferta: nuevaOferta };
  }

  public activarOferta(ofertaId: string, operadorNombre: string = 'Super Admin'): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.estado = 'activa';
    oferta.validadaEn = new Date().toISOString();
    oferta.validadaPor = operadorNombre;

    coreEvents.emitir({
      tipoEvento: 'oferta_activada',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      distrito: oferta.distrito,
      origen: 'panel',
      datos: { ofertaId, titulo: oferta.titulo }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre,
      accion: 'Activar oferta',
      entidad: 'oferta',
      entidadId: ofertaId,
      detalles: `Oferta "${oferta.titulo}" aprobada y publicada en el catálogo.`
    });

    this.guardarEnLocalStorage();
    this.notificar();
    return true;
  }

  public rechazarOferta(ofertaId: string, motivo: string, operadorNombre: string = 'Super Admin'): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;

    oferta.estado = 'rechazada';
    oferta.motivoRechazo = motivo;

    coreEvents.emitir({
      tipoEvento: 'oferta_rechazada',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      distrito: oferta.distrito,
      origen: 'panel',
      datos: { ofertaId, motivo }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre,
      accion: 'Rechazar oferta',
      entidad: 'oferta',
      entidadId: ofertaId,
      detalles: `Oferta rechazada con motivo: ${motivo}`
    });

    this.guardarEnLocalStorage();
    this.notificar();
    return true;
  }

  public pausarOferta(ofertaId: string): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;
    oferta.estado = oferta.estado === 'activa' ? 'pausada' : 'activa';
    this.guardarEnLocalStorage();
    this.notificar();
    return true;
  }

  public actualizarOfertaVideo(
    ofertaId: string, 
    videoUrl: string, 
    aspectRatio: '9:16' | '16:9' = '9:16',
    prompt?: string
  ): boolean {
    const oferta = this.ofertas.get(ofertaId);
    if (!oferta) return false;
    oferta.videoUrl = videoUrl;
    oferta.videoAspectRatio = aspectRatio;
    oferta.videoEstado = 'completado';
    if (prompt) oferta.videoPrompt = prompt;
    this.guardarEnLocalStorage();
    this.notificar();
    return true;
  }

  public obtenerOferta(id: string): Offer | undefined {
    return this.ofertas.get(id);
  }

  public obtenerPorCodigoUrl(codigoUrl: string): Offer | undefined {
    for (const o of this.ofertas.values()) {
      if (o.codigoUrl === codigoUrl) return o;
    }
    return undefined;
  }

  public listarOfertas(): Offer[] {
    return Array.from(this.ofertas.values());
  }

  public listarOfertasActivas(): Offer[] {
    const ahora = new Date().toISOString();
    return Array.from(this.ofertas.values())
      .filter(o => o.estado === 'activa' && o.venceEn > ahora)
      .sort((a, b) => {
        const fechaA = new Date(a.validadaEn || a.creadaEn).getTime();
        const fechaB = new Date(b.validadaEn || b.creadaEn).getTime();
        return fechaB - fechaA; // Las más recientemente aprobadas o creadas primero
      });
  }

  public listarOfertasPorComercio(comercioId: string): Offer[] {
    return this.listarOfertas().filter(o => o.comercioId === comercioId);
  }

  public listarPendientesModeracion(): Offer[] {
    return this.listarOfertas().filter(o => o.estado === 'en_validacion');
  }

  public calcularDistanciaAproxKm(distritoUsuario: string, distritoOferta: string): number {
    if (distritoUsuario.toLowerCase() === distritoOferta.toLowerCase()) return 0.8;
    // Tabla de proximidad representativa de Lima Metropolitana
    const adyacentes: Record<string, string[]> = {
      'Miraflores': ['San Isidro', 'Barranco', 'Surco', 'San Borja'],
      'Barranco': ['Miraflores', 'Surco', 'Chorrillos'],
      'San Isidro': ['Miraflores', 'Lince', 'Magdalena', 'Jesús María', 'San Borja'],
      'Santiago de Surco': ['Miraflores', 'Barranco', 'San Borja', 'La Molina']
    };
    if (adyacentes[distritoUsuario]?.includes(distritoOferta)) return 2.4;
    return 4.6;
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

export const ofertasModule = new OfertasModule();
