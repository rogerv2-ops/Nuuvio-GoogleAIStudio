/**
 * MODULO 6: comercios (esquema: com)
 * Alta de comercios con RUC y aprobación MANUAL de administración.
 * Sin aprobación manual, ningún comercio puede publicar ofertas.
 * Incluye CRM Kanban de 7 etapas (F-OPS-02).
 */
import { Merchant, MerchantKanbanItem, KanbanStage, KanbanColumn } from '../types';
import { coreEvents } from '../core/events';
import { coreSecurity } from '../core/security';

/**
 * Columnas por defecto del Kanban. Coinciden con las 7 etapas historicas
 * (ids 'prospecto'..'perdido') para que los comercios ya guardados sigan
 * cayendo en su columna. El admin puede agregar y quitar columnas; la
 * configuracion se persiste en app_settings.kanban_columns.
 */
export const KANBAN_COLUMNAS_DEFAULT: KanbanColumn[] = [
  { id: 'prospecto', title: 'Prospectos', subtitulo: 'Nuevos leads / prospección', color: 'sky', rol: null },
  { id: 'contactado', title: 'Contactados', subtitulo: 'Primer contacto / demo', color: 'indigo', rol: null },
  { id: 'registrado', title: 'Registrados', subtitulo: 'Completó registro / RUC', color: 'amber', rol: null },
  { id: 'en_validacion', title: 'En Validación', subtitulo: 'Revisión manual / checklist', color: 'purple', rol: null },
  { id: 'activo', title: 'Activos', subtitulo: 'Publicando ofertas en vivo', color: 'emerald', rol: 'activo' },
  { id: 'en_riesgo', title: 'En Riesgo', subtitulo: 'Sin ofertas / reactivación', color: 'rose', rol: 'riesgo' },
  { id: 'perdido', title: 'Perdidos', subtitulo: 'Inactivos o rechazados', color: 'stone', rol: 'perdido' }
];

const KANBAN_COLORES: KanbanColumn['color'][] = ['sky', 'indigo', 'amber', 'purple', 'emerald', 'rose', 'stone', 'teal', 'orange', 'cyan'];

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
  private kanbanColumns: KanbanColumn[] = KANBAN_COLUMNAS_DEFAULT.map(c => ({ ...c }));
  private listeners: (() => void)[] = [];

  constructor() {
    // Sin siembra: los comercios se cargan desde PostgreSQL / API.
    this.cargarDesdeServidor();
  }

  private async cargarDesdeServidor() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/comercios');
      if (res.status === 401) {
        // La sesion del navegador esta muerta (revocada/expirada): alinear el
        // cliente con el servidor y volver al login en vez de fallar en silencio.
        coreSecurity.invalidarSesionLocal();
        return;
      }
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
      if (Array.isArray(data.kanbanColumns) && data.kanbanColumns.length > 0) {
        this.kanbanColumns = data.kanbanColumns;
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

    // RUC, correo y WhatsApp son unicos entre comercios: ningun comercio
    // puede duplicar uno de estos tres datos (pedido del dueno, 2026-10-23).
    const emailLimpio = (datos.email || '').trim().toLowerCase();
    const telLimpio = this.canonTelefono(datos.telefono);
    for (const m of this.comercios.values()) {
      if (m.ruc === rucLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este número de RUC.' };
      }
      if (emailLimpio && (m.email || '').trim().toLowerCase() === emailLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este correo.' };
      }
      if (telLimpio && this.canonTelefono(m.telefono) === telLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este número de WhatsApp.' };
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

    // Sincronizar estado operativo del comercio según el rol de la columna.
    // El rol lo define la columna configurable; si no tiene rol, se cae al
    // comportamiento historico por id para no romper datos existentes.
    const columnaDestino = this.kanbanColumns.find(c => c.id === etapa);
    const rol = columnaDestino?.rol ?? (etapa === 'activo' ? 'activo' : etapa === 'en_riesgo' ? 'riesgo' : etapa === 'perdido' ? 'perdido' : null);
    const comercio = this.comercios.get(merchantId);
    if (comercio) {
      if (rol === 'activo' && comercio.estado !== 'activo') {
        comercio.estado = 'activo';
        comercio.validadoEn = new Date().toISOString();
        comercio.validadoPor = 'Super Admin';
      } else if (rol === 'riesgo') {
        comercio.estado = 'en_riesgo';
      } else if (rol === 'perdido') {
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
  }): { ok: boolean; comercio?: Merchant; error?: string } {
    const rucLimpio = (datos.ruc || '').trim();
    const emailLimpio = (datos.email || '').trim().toLowerCase();
    const telLimpio = this.canonTelefono(datos.telefono);

    // Misma regla que el registro publico: RUC, correo y WhatsApp son unicos
    // entre comercios (pedido del dueno, 2026-10-23).
    for (const m of this.comercios.values()) {
      if (rucLimpio && m.ruc === rucLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este número de RUC.' };
      }
      if (emailLimpio && (m.email || '').trim().toLowerCase() === emailLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este correo.' };
      }
      if (telLimpio && this.canonTelefono(m.telefono) === telLimpio) {
        return { ok: false, error: 'Ya existe un comercio registrado con este número de WhatsApp.' };
      }
    }

    const nuevoId = `merch_${Date.now().toString().slice(-6)}`;
    const nuevoComercio: Merchant = {
      id: nuevoId,
      ruc: datos.ruc?.trim() || '',
      nombreComercial: datos.nombreComercial.trim(),
      razonSocial: '',
      contactoNombre: datos.contactoNombre?.trim() || '',
      telefono: datos.telefono?.trim() || '',
      email: datos.email?.trim() || '',
      direccion: datos.distrito ? `Lima, ${datos.distrito}` : '',
      distrito: datos.distrito || '',
      provincia: 'Lima',
      lat: -12.1215,
      lng: -77.0289,
      instagram: '',
      categoria: datos.categoria || '',
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
    return { ok: true, comercio: nuevoComercio };
  }

  public cargarDeLista(comerciosLista: Merchant[], kanbanLista: MerchantKanbanItem[] = [], columnasLista: KanbanColumn[] = []): void {
    if (Array.isArray(comerciosLista) && comerciosLista.length > 0) {
      this.comercios.clear();
      comerciosLista.forEach(m => this.comercios.set(m.id, m));
    }
    if (Array.isArray(kanbanLista) && kanbanLista.length > 0) {
      this.kanban.clear();
      kanbanLista.forEach(k => this.kanban.set(k.merchantId, k));
    }
    if (Array.isArray(columnasLista) && columnasLista.length > 0) {
      this.kanbanColumns = columnasLista;
    }
    this.notificar();
  }

  /** Columnas (etapas) actuales del Kanban, en orden. */
  public listarColumnasKanban(): KanbanColumn[] {
    return this.kanbanColumns.map(c => ({ ...c }));
  }

  /** Reemplaza la configuracion de columnas (viene del servidor al recargar). */
  public cargarColumnasKanban(columnas: KanbanColumn[]): void {
    if (Array.isArray(columnas) && columnas.length > 0) {
      this.kanbanColumns = columnas;
      this.notificar();
    }
  }

  /** Agrega una columna al final del tablero. */
  public agregarColumnaKanban(titulo: string): { ok: boolean; columna?: KanbanColumn; error?: string } {
    const t = String(titulo || '').trim();
    if (!t) return { ok: false, error: 'El título de la columna es obligatorio.' };
    if (this.kanbanColumns.some(c => c.title.toLowerCase() === t.toLowerCase())) {
      return { ok: false, error: `Ya existe una columna llamada "${t}".` };
    }
    const id = 'col_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const color = KANBAN_COLORES[this.kanbanColumns.length % KANBAN_COLORES.length];
    const columna: KanbanColumn = { id, title: t, subtitulo: '', color, rol: null };
    this.kanbanColumns.push(columna);

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre: 'Super Admin',
      accion: 'Agregar columna Kanban',
      entidad: 'kanban',
      entidadId: id,
      detalles: `Columna '${t}' agregada al pipeline CRM.`
    });

    this.notificar();
    return { ok: true, columna };
  }

  /**
   * Quita una columna. Se bloquea si todavia tiene comercios: primero hay
   * que moverlos (decision del dueno, 2026-10-23). Nunca se borra el ultimo.
   */
  public eliminarColumnaKanban(id: string): { ok: boolean; error?: string } {
    const columna = this.kanbanColumns.find(c => c.id === id);
    if (!columna) return { ok: false, error: 'Columna no encontrada.' };
    if (this.kanbanColumns.length <= 1) {
      return { ok: false, error: 'Debe quedar al menos una columna en el tablero.' };
    }
    const ocupados = this.listarComercios().filter(m => (this.kanban.get(m.id)?.etapa || '') === id);
    if (ocupados.length > 0) {
      const nombres = ocupados.slice(0, 3).map(m => `"${m.nombreComercial}"`).join(', ');
      const resto = ocupados.length > 3 ? ` y ${ocupados.length - 3} más` : '';
      return {
        ok: false,
        error: `No se puede quitar "${columna.title}": todavía tiene ${ocupados.length} comercio(s) (${nombres}${resto}). Movélos a otra columna primero.`
      };
    }
    this.kanbanColumns = this.kanbanColumns.filter(c => c.id !== id);

    coreSecurity.registrarAuditoria({
      operadorId: 'admin_master_01',
      operadorNombre: 'Super Admin',
      accion: 'Quitar columna Kanban',
      entidad: 'kanban',
      entidadId: id,
      detalles: `Columna '${columna.title}' quitada del pipeline CRM.`
    });

    this.notificar();
    return { ok: true };
  }

  public obtenerComercio(id: string): Merchant | undefined {
    return this.comercios.get(id);
  }

  public obtenerPorTelefono(telefono: string): Merchant | undefined {
    const telLimpio = this.canonTelefono(telefono);
    if (!telLimpio) return undefined;
    for (const m of this.comercios.values()) {
      if (this.canonTelefono(m.telefono) === telLimpio) {
        return m;
      }
    }
    return undefined;
  }

  /** Canoniza un telefono para comparar: solo digitos, sin prefijo 51. */
  private canonTelefono(t: string | undefined | null): string {
    let d = String(t || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('51')) d = d.slice(2);
    return d;
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
