import { SEED_MERCHANTS } from "../data/seedData.ts";
import { coreEvents } from "../core/events.ts";
import { coreSecurity } from "../core/security.ts";

export interface Merchant {
  id: string;
  ruc: string;
  nombreComercial: string;
  razonSocial: string;
  contactoNombre: string;
  telefono: string;
  email: string;
  direccion: string;
  distrito: string;
  provincia: string;
  lat: number;
  lng: number;
  instagram: string;
  categoria: string;
  estado: "pendiente" | "activo" | "rechazado" | "en_riesgo";
  registradoEn: string;
  validadoEn?: string;
  validadoPor?: string;
  motivoRechazo?: string;
}

export interface KanbanItem {
  merchantId: string;
  etapa: "registrado" | "prospecto" | "en_validacion" | "activo" | "en_riesgo" | "perdido";
  notas: string;
  actualizadoEn: string;
}

export interface ChecklistValidacion {
  rucValido: boolean;
  negocioExiste: boolean;
  instagramReal: boolean;
  direccionValida: boolean;
  whatsappVerificado: boolean;
}

class ComerciosModule {
  public comercios: Map<string, Merchant> = new Map<string, Merchant>();
  public kanban: Map<string, KanbanItem> = new Map<string, KanbanItem>();
  private listeners: (() => void)[] = [];

  constructor() {
    SEED_MERCHANTS.forEach((m: any) => {
      this.comercios.set(m.id, { ...(m as Merchant) });
      this.kanban.set(m.id, {
        merchantId: m.id,
        etapa: m.estado === "activo" ? "activo" : "en_validacion",
        notas: `Semilla inicial del comercio ${m.nombreComercial}`,
        actualizadoEn: m.registradoEn,
      });
    });

    if (typeof window !== "undefined") {
      this.cargarDeAPI();
    }
  }

  async cargarDeDB(): Promise<{ comercios: Merchant[]; kanban: KanbanItem[] }> {
    if (typeof window === "undefined") {
      try {
        const { getPersistedMerchants, getPersistedKanban } = await import("../db/repo.ts");
        const dbMerchants = await getPersistedMerchants();
        const dbKanban = await getPersistedKanban();
        if (dbMerchants && dbMerchants.length > 0) {
          this.cargarDeLista(dbMerchants as Merchant[], (dbKanban || []) as KanbanItem[]);
        }
      } catch (err) {
        console.warn("[ComerciosModule] Error cargando desde PostgreSQL:", err);
      }
    } else {
      await this.cargarDeAPI();
    }
    return {
      comercios: this.listarComercios(),
      kanban: Array.from(this.kanban.values()),
    };
  }

  async cargarDeAPI(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/comercios");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.comercios)) {
            this.cargarDeLista(data.comercios, data.kanban || []);
          }
        }
      } catch (e) {
        console.warn("[ComerciosModule Client] Error al consultar /api/comercios:", e);
      }
    }
  }

  cargarDeLista(comerciosLista: Merchant[], kanbanLista: KanbanItem[] = []): void {
    if (Array.isArray(comerciosLista) && comerciosLista.length > 0) {
      this.comercios.clear();
      comerciosLista.forEach((m: Merchant) => this.comercios.set(m.id, m));
    }
    if (Array.isArray(kanbanLista) && kanbanLista.length > 0) {
      this.kanban.clear();
      kanbanLista.forEach((k: KanbanItem) => this.kanban.set(k.merchantId, k));
    }
    this.notificar();
  }

  async guardarEnDB(): Promise<void> {
    const merchantsList: Merchant[] = Array.from(this.comercios.values());
    const kanbanList: KanbanItem[] = Array.from(this.kanban.values());

    if (typeof window === "undefined") {
      try {
        const { savePersistedMerchants, savePersistedKanban } = await import("../db/repo.ts");
        await savePersistedMerchants(merchantsList);
        await savePersistedKanban(kanbanList);
      } catch (e) {
        console.warn("[ComerciosModule] Error guardando en Cloud SQL PostgreSQL:", e);
      }
    } else {
      try {
        await fetch("/api/comercios/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comercios: merchantsList, kanban: kanbanList }),
        });
      } catch (e) {
        console.warn("[ComerciosModule Client] Error sincronizando comercios:", e);
      }
    }
  }

  registrarComercio(datos: {
    ruc: string;
    nombreComercial: string;
    razonSocial?: string;
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
      return { ok: false, error: "El RUC debe tener exactamente 11 dígitos numéricos." };
    }

    for (const m of Array.from(this.comercios.values())) {
      if (m.ruc === rucLimpio) {
        return { ok: false, error: "Ya existe un comercio registrado con este número de RUC." };
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
      provincia: datos.provincia || "Lima",
      lat: -12.12 + (Math.random() - 0.5) * 0.05,
      lng: -77.03 + (Math.random() - 0.5) * 0.05,
      instagram: datos.instagram || "",
      categoria: datos.categoria,
      estado: "pendiente",
      registradoEn: new Date().toISOString(),
    };

    this.comercios.set(id, nuevoComercio);
    this.kanban.set(id, {
      merchantId: id,
      etapa: "en_validacion",
      notas: "Nuevo registro desde web. Requiere checklist.",
      actualizadoEn: new Date().toISOString(),
    });

    coreEvents.emitir({
      tipoEvento: "comercio_registrado",
      actorTipo: "comercio",
      actorId: id,
      distrito: datos.distrito,
      origen: "web",
      datos: {
        ruc: rucLimpio,
        nombreComercial: datos.nombreComercial,
        categoria: datos.categoria,
      },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "sistema",
      operadorNombre: "Sistema",
      accion: "Nuevo registro de comercio",
      entidad: "comercio",
      entidadId: id,
      detalles: `Comercio ${datos.nombreComercial} (RUC: ${rucLimpio}) en cola de validación.`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();

    return { ok: true, comercio: nuevoComercio };
  }

  validarManualmente(comercioId: string, checklist: ChecklistValidacion, operadorNombre = "Super Admin"): boolean {
    const comercio = this.comercios.get(comercioId);
    if (!comercio) return false;

    const checklistAprobado =
      checklist.rucValido &&
      checklist.negocioExiste &&
      checklist.instagramReal &&
      checklist.direccionValida &&
      checklist.whatsappVerificado;

    if (!checklistAprobado) return false;

    comercio.estado = "activo";
    comercio.validadoEn = new Date().toISOString();
    comercio.validadoPor = operadorNombre;

    this.actualizarEtapaKanban(comercioId, "activo", "Aprobado con checklist manual completo.");

    coreEvents.emitir({
      tipoEvento: "comercio_validado",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      distrito: comercio.distrito,
      origen: "panel",
      datos: { comercioId, nombreComercial: comercio.nombreComercial, checklist },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre,
      accion: "Aprobar comercio",
      entidad: "comercio",
      entidadId: comercioId,
      detalles: `Checklist manual verificado: RUC ${comercio.ruc}, WhatsApp verificado, local existente.`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  rechazarComercio(comercioId: string, motivo: string, operadorNombre = "Super Admin"): boolean {
    const comercio = this.comercios.get(comercioId);
    if (!comercio) return false;

    comercio.estado = "rechazado";
    comercio.motivoRechazo = motivo;

    this.actualizarEtapaKanban(comercioId, "perdido", `Rechazado: ${motivo}`);

    coreEvents.emitir({
      tipoEvento: "comercio_rechazado",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      distrito: comercio.distrito,
      origen: "panel",
      datos: { comercioId, motivo },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre,
      accion: "Rechazar comercio",
      entidad: "comercio",
      entidadId: comercioId,
      detalles: `Rechazado con motivo: ${motivo}`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return true;
  }

  actualizarEtapaKanban(merchantId: string, etapa: KanbanItem["etapa"], notas = ""): void {
    const item = this.kanban.get(merchantId) || {
      merchantId,
      etapa,
      notas,
      actualizadoEn: new Date().toISOString(),
    };

    const etapaAnterior = item.etapa;
    item.etapa = etapa;
    if (notas) item.notas = notas;
    item.actualizadoEn = new Date().toISOString();
    this.kanban.set(merchantId, item);

    const comercio = this.comercios.get(merchantId);
    if (comercio) {
      if (etapa === "activo" && comercio.estado !== "activo") {
        comercio.estado = "activo";
        comercio.validadoEn = new Date().toISOString();
        comercio.validadoPor = "Super Admin";
      } else if (etapa === "en_riesgo") {
        comercio.estado = "en_riesgo";
      } else if (etapa === "perdido") {
        comercio.estado = "rechazado";
      } else if ((etapa === "en_validacion" || etapa === "registrado") && comercio.estado === "rechazado") {
        comercio.estado = "pendiente";
      }
    }

    coreEvents.emitir({
      tipoEvento: "etapa_kanban_cambiada",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      origen: "panel",
      datos: { merchantId, etapaAnterior, etapaNueva: etapa, notas: item.notas },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre: "Super Admin",
      accion: "Cambio etapa CRM Kanban",
      entidad: "comercio",
      entidadId: merchantId,
      detalles: `Comercio ${comercio?.nombreComercial || merchantId} movido de '${etapaAnterior}' a '${etapa}'`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
  }

  actualizarNotasKanban(merchantId: string, notas: string): void {
    const item = this.kanban.get(merchantId);
    if (item) {
      item.notas = notas;
      item.actualizadoEn = new Date().toISOString();
      this.guardarEnDB().catch(() => {});
      this.notificar();
    }
  }

  registrarProspecto(datos: {
    nombreComercial: string;
    ruc?: string;
    distrito?: string;
    telefono?: string;
    email?: string;
    contactoNombre?: string;
    categoria?: string;
    etapa?: KanbanItem["etapa"];
    notas?: string;
  }): Merchant {
    const nuevoId = `merch_${Date.now().toString().slice(-6)}`;
    const nuevoComercio: Merchant = {
      id: nuevoId,
      ruc: datos.ruc || `10${Math.floor(100000000 + Math.random() * 900000000)}`,
      nombreComercial: datos.nombreComercial.trim(),
      razonSocial: datos.nombreComercial.toUpperCase() + " S.A.C.",
      contactoNombre: datos.contactoNombre?.trim() || "Por asignar",
      telefono: datos.telefono?.trim() || "+51 900 000 000",
      email: datos.email?.trim() || `contacto@${nuevoId}.pe`,
      direccion: `Lima, ${datos.distrito || "Miraflores"}`,
      distrito: datos.distrito || "Miraflores",
      provincia: "Lima",
      lat: -12.1215,
      lng: -77.0289,
      instagram: `@${datos.nombreComercial.toLowerCase().replace(/[^a-z0-9]/g, "")}`,
      categoria: datos.categoria || "Gastronomía y Café",
      estado:
        datos.etapa === "activo"
          ? "activo"
          : datos.etapa === "en_riesgo"
          ? "en_riesgo"
          : datos.etapa === "perdido"
          ? "rechazado"
          : "pendiente",
      registradoEn: new Date().toISOString(),
    };

    this.comercios.set(nuevoId, nuevoComercio);
    const etapaInicial = datos.etapa || "prospecto";
    this.kanban.set(nuevoId, {
      merchantId: nuevoId,
      etapa: etapaInicial,
      notas: datos.notas || "Nuevo comercio ingresado al pipeline CRM",
      actualizadoEn: new Date().toISOString(),
    });

    coreEvents.emitir({
      tipoEvento: "comercio_registrado",
      actorTipo: "gestion",
      actorId: "admin_master_01",
      origen: "panel",
      distrito: nuevoComercio.distrito,
      datos: {
        comercioId: nuevoId,
        nombreComercial: nuevoComercio.nombreComercial,
        etapa: etapaInicial,
      },
    });

    coreSecurity.registrarAuditoria({
      operadorId: "admin_master_01",
      operadorNombre: "Super Admin",
      accion: "Crear Lead / Prospecto Kanban",
      entidad: "comercio",
      entidadId: nuevoId,
      detalles: `Lead '${nuevoComercio.nombreComercial}' creado en etapa '${etapaInicial}'`,
    });

    this.guardarEnDB().catch(() => {});
    this.notificar();
    return nuevoComercio;
  }

  obtenerComercio(id: string): Merchant | undefined {
    return this.comercios.get(id);
  }

  obtenerPorTelefono(telefono: string): Merchant | undefined {
    const telLimpio = telefono.replace(/[\s+-]/g, "");
    for (const m of Array.from(this.comercios.values())) {
      const mTelLimpio = m.telefono.replace(/[\s+-]/g, "");
      if (mTelLimpio === telLimpio || mTelLimpio.endsWith(telLimpio) || telLimpio.endsWith(mTelLimpio)) {
        return m;
      }
    }
    return undefined;
  }

  listarComercios(): Merchant[] {
    return Array.from(this.comercios.values());
  }

  listarPendientes(): Merchant[] {
    return this.listarComercios().filter((m: Merchant) => m.estado === "pendiente");
  }

  getKanbanItems(): { comercio: Merchant; kanban: KanbanItem }[] {
    return this.listarComercios().map((m: Merchant) => ({
      comercio: m,
      kanban: this.kanban.get(m.id) || {
        merchantId: m.id,
        etapa: "registrado",
        notas: "",
        actualizadoEn: m.registradoEn,
      },
    }));
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

export const comerciosModule = new ComerciosModule();
