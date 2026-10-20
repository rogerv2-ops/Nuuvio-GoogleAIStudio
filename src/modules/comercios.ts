/**
 * MODULO 6: comercios (esquema: com)
 * Alta de comercios con RUC y aprobación MANUAL de administración.
 * Sin aprobación manual, ningún comercio puede publicar ofertas.
 * Incluye CRM Kanban de 7 etapas (F-OPS-02).
 */
import { Merchant, MerchantKanbanItem, KanbanStage } from '../types';
import { coreEvents } from '../core/events';
import { coreSecurity } from '../core/security';

export interface ValidationChecklist {
  rucValido: boolean;
  negocioExiste: boolean;
  instagramReal: boolean;
  direccionValida: boolean;
  whatsappVerificado: boolean;
}

class ComerciosModule {
  private comercios: Map<string, Merchant> = new Map();
  private kanban: Map<string, MerchantKanbanItem> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Sin siembra: los comercios se cargan desde PostgreSQL / API.
    this.cargarDesdeServidor();
  }

  private async cargarDesdeServidor() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/comercios');
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.ok) return;
      if (Array.isArray(data.comercios) && data.comercios.length > 0) {
        this.comercios.clear();
        data.comercios.forEach((m: Merchant) => { if (m && m.id) this.comercios.set(m.id, m); });
      }
      const kanbanArr = Array.isArray(data.kanban)
        ? data.kanban.map((k: any) => (k && k.kanban ? k.kanban : k)).filter((k: any) => k && k.merchantId)
        : [];
      if (kanbanArr.length > 0) {
        this.kanban.clear();
        kanbanArr.forEach((k: MerchantKanbanItem) => this.kanban.set(k.merchantId, k));
      }
      this.notificar();
    } catch (e) {
      // Silencioso: sin sesion o sin red.
    }
  }

  public registrarComercio(datos: {
    ruc: string;
    nombreComercial: string;
    razonSocial: string;
    contactoNombre: string;
    telefono: string;
    email: string;
    direccion: string;
    distrito: string;
    provincia?: string;
    instagram?: string;
    categoria: string;
  }): { ok: boolean; comercio?: Merchant; error?: string } {
    const rucLimpio = datos.ruc.trim();
    if (rucLimpio.length !== 11 || !/^\d+$/.test(rucLimpio)) {
      return { ok: false, error: 'El RUC debe tener exactamente 11 dígitos numéricos.' };
    }

    // Verificar RUC duplicado
    for (const m of this.comercios.values()) {
      if (m.ruc === rucLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este número de RUC.' };
      }
    }

    const id = `merch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevoComercio: Merchant = {
      id,
      ruc: rucLimpio,
      nombreComercial: datos.nombreComercial,
      razonSocial: datos.razonSocial || datos.nombreComercial,
      contactoNombre: datos.contactoNombre,
      telefono: datos.telefono,
      email: datos.email,
      direccion: datos.direccion,
      distrito: datos.distrito,
      provincia: datos.provincia || 'Lima',
      lat: -12.12 + (Math.random() - 0.5) * 0.05,
      lng: -77.03 + (Math.random() - 0.5) * 0.05,
      instagram: datos.instagram || '',
      categoria: datos.categoria,
      estado: 'pendiente', // Siempre entra pendiente de aprobación manual
      registradoEn: new Date().toISOString()
    };

    this.comercios.set(id, nuevoComercio);
    this.kanban.set(id, {
      merchantId: id,
      etapa: 'en_validacion',
      notas: 'Nuevo registro desde web. Requiere checklist.',
      actualizadoEn: new Date().toISOString()
    });

    coreEvents.emitir({
      tipoEvento: 'comercio_registrado',
      actorTipo: 'comercio',
      actorId: id,
      distrito: datos.distrito,
      origen: 'web',
      datos: {
        ruc: rucLimpio,
        nombreComercial: datos.nombreComercial,
        categoria: datos.categoria
      }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'sistema',
      operadorNombre: 'Sistema',
      accion: 'Nuevo registro de comercio',
      entidad: 'comercio',
      entidadId: id,
      detalles: `Comercio ${datos.nombreComercial} (RUC: ${rucLimpio}) en cola de validación.`
    });

    this.notificar();
    return { ok: true, comercio: nuevoComercio };
  }

  public validarManualmente(comercioId: string, checklist: ValidationChecklist, operadorNombre: string = 'Super Admin'): boolean {
    const comercio = this.comercios.get(comercioId);
    if (!comercio) return false;

    const checklistAprobado = 
      checklist.rucValido &&
      checklist.negocioExiste &&
      checklist.instagramReal &&
      checklist.direccionValida &&
      checklist.whatsappVerificado;

    if (!checklistAprobado) return false;

    comercio.estado = 'activo';
    comercio.validadoEn = new Date().toISOString();
    comercio.validadoPor = operadorNombre;

    // Actualizar Kanban
    this.actualizarEtapaKanban(comercioId, 'activo', 'Aprobado con checklist manual completo.');

    coreEvents.emitir({
      tipoEvento: 'comercio_validado',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      distrito: comercio.distrito,
      origen: 'panel',
      datos: {
        comercioId,
        nombreComercial: comercio.nombreComercial,
        checklist
      }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre,
      accion: 'Aprobar comercio',
      entidad: 'comercio',
      entidadId: comercioId,
      detalles: `Checklist manual verificado: RUC ${comercio.ruc}, WhatsApp verificado, local existente.`
    });

    this.notificar();
    return true;
  }

  public rechazarComercio(comercioId: string, motivo: string, operadorNombre: string = 'Super Admin'): boolean {
    const comercio = this.comercios.get(comercioId);
    if (!comercio) return false;

    comercio.estado = 'rechazado';
    comercio.motivoRechazo = motivo;

    this.actualizarEtapaKanban(comercioId, 'perdido', `Rechazado: ${motivo}`);

    coreEvents.emitir({
      tipoEvento: 'comercio_rechazado',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      distrito: comercio.distrito,
      origen: 'panel',
      datos: { comercioId, motivo }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre,
      accion: 'Rechazar comercio',
      entidad: 'comercio',
      entidadId: comercioId,
      detalles: `Rechazado con motivo: ${motivo}`
    });

    this.notificar();
    return true;
  }

  public eliminarComercio(comercioId: string, operadorNombre: string = 'Super Admin'): boolean {
    const comercio = this.comercios.get(comercioId);
    if (!comercio) return false;

    this.comercios.delete(comercioId);
    this.kanban.delete(comercioId);

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre,
      accion: 'Eliminar comercio',
      entidad: 'comercio',
      entidadId: comercioId,
      detalles: `Comercio ${comercio.nombreComercial} (RUC ${comercio.ruc}) eliminado del directorio.`
    });

    this.notificar();
    return true;
  }

  public actualizarEtapaKanban(merchantId: string, etapa: KanbanStage, notas: string = '') {
    const item = this.kanban.get(merchantId) || {
      merchantId,
      etapa,
      notas,
      actualizadoEn: new Date().toISOString()
    };
    const etapaAnterior = item.etapa;
    item.etapa = etapa;
    if (notas) item.notas = notas;
    item.actualizadoEn = new Date().toISOString();
    this.kanban.set(merchantId, item);

    // Sincronizar estado operativo del comercio según etapa
    const comercio = this.comercios.get(merchantId);
    if (comercio) {
      if (etapa === 'activo' && comercio.estado !== 'activo') {
        comercio.estado = 'activo';
        comercio.validadoEn = new Date().toISOString();
        comercio.validadoPor = 'Super Admin';
      } else if (etapa === 'en_riesgo') {
        comercio.estado = 'en_riesgo';
      } else if (etapa === 'perdido') {
        comercio.estado = 'rechazado';
      } else if ((etapa === 'en_validacion' || etapa === 'registrado') && comercio.estado === 'rechazado') {
        comercio.estado = 'pendiente';
      }
    }

    coreEvents.emitir({
      tipoEvento: 'etapa_kanban_cambiada',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      origen: 'panel',
      datos: { merchantId, etapaAnterior, etapaNueva: etapa, notas: item.notas }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre: 'Super Admin',
      accion: 'Cambio etapa CRM Kanban',
      entidad: 'comercio',
      entidadId: merchantId,
      detalles: `Comercio ${comercio?.nombreComercial || merchantId} movido de '${etapaAnterior}' a '${etapa}'`
    });

    this.notificar();
  }

  public actualizarNotasKanban(merchantId: string, notas: string) {
    const item = this.kanban.get(merchantId);
    if (item) {
      item.notas = notas;
      item.actualizadoEn = new Date().toISOString();
      this.notificar();
    }
  }

  public registrarProspecto(datos: {
    nombreComercial: string;
    contactoNombre?: string;
    telefono?: string;
    distrito?: string;
    categoria?: string;
    etapa?: KanbanStage;
    notas?: string;
    email?: string;
    ruc?: string;
  }): Merchant {
    const nuevoId = `merch_${Date.now().toString().slice(-6)}`;
    const nuevoComercio: Merchant = {
      id: nuevoId,
      ruc: datos.ruc || `10${Math.floor(100000000 + Math.random() * 900000000)}`,
      nombreComercial: datos.nombreComercial.trim(),
      razonSocial: datos.nombreComercial.toUpperCase() + ' S.A.C.',
      contactoNombre: datos.contactoNombre?.trim() || 'Por asignar',
      telefono: datos.telefono?.trim() || '+51 900 000 000',
      email: datos.email?.trim() || `contacto@${nuevoId}.pe`,
      direccion: `Lima, ${datos.distrito || 'Miraflores'}`,
      distrito: datos.distrito || 'Miraflores',
      provincia: 'Lima',
      lat: -12.1215,
      lng: -77.0289,
      instagram: `@${datos.nombreComercial.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      categoria: datos.categoria || 'Gastronomía y Café',
      estado: datos.etapa === 'activo' ? 'activo' : datos.etapa === 'en_riesgo' ? 'en_riesgo' : datos.etapa === 'perdido' ? 'rechazado' : 'pendiente',
      registradoEn: new Date().toISOString()
    };

    this.comercios.set(nuevoId, nuevoComercio);
    const etapaInicial = datos.etapa || 'prospecto';
    this.kanban.set(nuevoId, {
      merchantId: nuevoId,
      etapa: etapaInicial,
      notas: datos.notas || 'Nuevo comercio ingresado al pipeline CRM',
      actualizadoEn: new Date().toISOString()
    });

    coreEvents.emitir({
      tipoEvento: 'comercio_registrado',
      actorTipo: 'gestion',
      actorId: 'admin_master_01',
      origen: 'panel',
      distrito: nuevoComercio.distrito,
      datos: { comercioId: nuevoId, nombreComercial: nuevoComercio.nombreComercial, etapa: etapaInicial }
    });

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre: 'Super Admin',
      accion: 'Crear Lead / Prospecto Kanban',
      entidad: 'comercio',
      entidadId: nuevoId,
      detalles: `Lead '${nuevoComercio.nombreComercial}' creado en etapa '${etapaInicial}'`
    });

    this.notificar();
    return nuevoComercio;
  }

  public cargarDeLista(comerciosLista: Merchant[], kanbanLista: MerchantKanbanItem[] = []): void {
    if (Array.isArray(comerciosLista) && comerciosLista.length > 0) {
      this.comercios.clear();
      comerciosLista.forEach(m => this.comercios.set(m.id, m));
    }
    if (Array.isArray(kanbanLista) && kanbanLista.length > 0) {
      this.kanban.clear();
      kanbanLista.forEach(k => this.kanban.set(k.merchantId, k));
    }
    this.notificar();
  }

  public obtenerComercio(id: string): Merchant | undefined {
    return this.comercios.get(id);
  }

  public obtenerPorTelefono(telefono: string): Merchant | undefined {
    const canon = (t: string): string => {
      let d = String(t || '').replace(/\D/g, '');
      if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
      return d;
    };
    const telLimpio = canon(telefono);
    if (!telLimpio) return undefined;
    for (const m of this.comercios.values()) {
      if (canon(m.telefono) === telLimpio) {
        return m;
      }
    }
    return undefined;
  }

  public listarComercios(): Merchant[] {
    return Array.from(this.comercios.values());
  }

  /** Recarga comercios y kanban desde la API. Necesario tras iniciar sesion:
   * el constructor carga al abrir la pagina (sin sesion -> 401 silencioso),
   * y el login no recarga la pagina. */
  public recargar(): void {
    this.cargarDesdeServidor();
  }

  public listarPendientes(): Merchant[] {
    return this.listarComercios().filter(m => m.estado === 'pendiente');
  }

  public getKanbanItems(): { comercio: Merchant; kanban: MerchantKanbanItem }[] {
    return this.listarComercios().map(m => ({
      comercio: m,
      kanban: this.kanban.get(m.id) || {
        merchantId: m.id,
        etapa: 'registrado',
        notas: '',
        actualizadoEn: m.registradoEn
      }
    }));
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

export const comerciosModule = new ComerciosModule();
