import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Building2, Kanban, ShieldAlert, CheckCircle2, UserCheck, 
  Search, Filter, Plus, ChevronLeft, ChevronRight, X, Phone, 
  MapPin, MessageCircle, Save, ShoppingCart, Activity, 
  FileText, ArrowRight, ExternalLink, Sparkles, AlertCircle, GripVertical, Trash2
} from 'lucide-react';
import { comerciosModule, ValidationChecklist } from '../../../modules/comercios';
import { vistaComoModule } from '../../../modules/vistaComo';
import { ofertasModule } from '../../../modules/ofertas';
import { clicsAtribucionModule } from '../../../modules/clics';
import { facturacionModule } from '../../../modules/facturacion';
import { alPulsarBotonWhatsApp } from '../../../utils/whatsappNative';
import { WhatsAppChooser } from '../../WhatsAppChooser';
import { Merchant, KanbanStage, Offer } from '../../../types';
import { DISTRITOS_LIMA, CATEGORIAS_OFERTAS } from '../../../data/seedData';
import { CrmVentasView } from '../../CrmVentasView';

interface ComerciosDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const ComerciosDomainView: React.FC<ComerciosDomainViewProps> = ({ subruta, onNavegar }) => {
  const [version, setVersion] = useState(0);

  // Estados de Pipeline Kanban (7 etapas)
  const [etapaKanbanSeleccionada, setEtapaKanbanSeleccionada] = useState<KanbanStage | 'todas'>('todas');
  const [busquedaKanban, setBusquedaKanban] = useState('');
  const [distritoFiltroKanban, setDistritoFiltroKanban] = useState<string>('todos');
  const [arrastrandoId, setArrastrandoId] = useState<string | null>(null);
  const [columnaDestinoHover, setColumnaDestinoHover] = useState<KanbanStage | null>(null);
  const [notificacionKanban, setNotificacionKanban] = useState<string | null>(null);

  // Modal para registrar nuevo lead
  const [modalNuevoLeadAbierto, setModalNuevoLeadAbierto] = useState(false);
  const [nuevoLeadForm, setNuevoLeadForm] = useState({
    nombreComercial: '',
    contactoNombre: '',
    telefono: '',
    distrito: 'Miraflores',
    categoria: 'Gastronomía y Café',
    etapa: 'prospecto' as KanbanStage,
    notas: '',
    ruc: '',
    email: ''
  });

  // Ficha 360 de comercio (modal / drawer)
  const [comercioFicha360Id, setComercioFicha360Id] = useState<string | null>(() => {
    // Si la subruta es /gestion/comercios/:id
    if (subruta && subruta.startsWith('/gestion/comercios/') &&
        !['/gestion/comercios/pipeline', '/gestion/comercios/aprobaciones', '/gestion/comercios/activos', '/gestion/comercios/actividades', '/gestion/comercios/ventas-confirmadas'].includes(subruta)) {
      return subruta.replace('/gestion/comercios/', '');
    }
    return null;
  });
  // Hoja de eleccion de app de WhatsApp (el panel ya conoce el numero: no va al servidor)
  const [chooserAdminAbierto, setChooserAdminAbierto] = useState(false);
  const [notasEdicion, setNotasEdicion] = useState<string>('');
  const [guardandoNotas, setGuardandoNotas] = useState(false);

  // Checklist de validación con RUC
  const [checklist, setChecklist] = useState<Record<string, ValidationChecklist>>({});
  const [motivoRechazo, setMotivoRechazo] = useState<string>('');
  const [comercioRechazarId, setComercioRechazarId] = useState<string | null>(null);

  const kanbanScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = comerciosModule.suscribir(() => setVersion(v => v + 1));
    return () => unsub();
  }, []);

  const kanbanItems = useMemo(() => comerciosModule.getKanbanItems(), [version]);
  const comerciosPendientes = useMemo(() => comerciosModule.listarPendientes(), [version]);
  const comerciosTodos = useMemo(() => comerciosModule.listarComercios(), [version]);

  // Si la subruta cambió y trae un id específico
  useEffect(() => {
    if (subruta && subruta.startsWith('/gestion/comercios/') && 
        !['/gestion/comercios/pipeline', '/gestion/comercios/aprobaciones', '/gestion/comercios/activos', '/gestion/comercios/actividades', '/gestion/comercios/ventas-confirmadas'].includes(subruta)) {
      const id = subruta.replace('/gestion/comercios/', '');
      setComercioFicha360Id(id);
    }
  }, [subruta]);

  // Etapas del Kanban
  const KANBAN_STAGES: {
    stage: KanbanStage;
    title: string;
    subtitulo: string;
    badgeColor: string;
    borderColor: string;
    headerBg: string;
    hoverBg: string;
    dotColor: string;
  }[] = [
    {
      stage: 'prospecto',
      title: 'Prospectos',
      subtitulo: 'Nuevos leads / prospección',
      badgeColor: 'bg-sky-100 text-sky-800 border-sky-200',
      borderColor: 'border-sky-300',
      headerBg: 'bg-sky-50/80',
      hoverBg: 'bg-sky-100/50',
      dotColor: 'bg-sky-500'
    },
    {
      stage: 'contactado',
      title: 'Contactados',
      subtitulo: 'Primer contacto / demo',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      borderColor: 'border-indigo-300',
      headerBg: 'bg-indigo-50/80',
      hoverBg: 'bg-indigo-100/50',
      dotColor: 'bg-indigo-500'
    },
    {
      stage: 'registrado',
      title: 'Registrados',
      subtitulo: 'Completó registro / RUC',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      borderColor: 'border-amber-300',
      headerBg: 'bg-amber-50/80',
      hoverBg: 'bg-amber-100/50',
      dotColor: 'bg-amber-500'
    },
    {
      stage: 'en_validacion',
      title: 'En Validación',
      subtitulo: 'Revisión manual / checklist',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      borderColor: 'border-purple-300',
      headerBg: 'bg-purple-50/80',
      hoverBg: 'bg-purple-100/50',
      dotColor: 'bg-purple-500'
    },
    {
      stage: 'activo',
      title: 'Activos',
      subtitulo: 'Publicando ofertas en vivo',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      borderColor: 'border-emerald-300',
      headerBg: 'bg-emerald-50/80',
      hoverBg: 'bg-emerald-100/50',
      dotColor: 'bg-emerald-500'
    },
    {
      stage: 'en_riesgo',
      title: 'En Riesgo',
      subtitulo: 'Sin ofertas / reactivación',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
      borderColor: 'border-rose-300',
      headerBg: 'bg-rose-50/80',
      hoverBg: 'bg-rose-100/50',
      dotColor: 'bg-rose-500'
    },
    {
      stage: 'perdido',
      title: 'Perdidos',
      subtitulo: 'Inactivos o rechazados',
      badgeColor: 'bg-stone-200 text-stone-700 border-stone-300',
      borderColor: 'border-stone-300',
      headerBg: 'bg-stone-100/80',
      hoverBg: 'bg-stone-200/50',
      dotColor: 'bg-stone-400'
    }
  ];

  const handleMoverEtapa = (merchantId: string, nuevaEtapa: KanbanStage) => {
    const comercio = comerciosModule.obtenerComercio(merchantId);
    if (!comercio) return;
    comerciosModule.actualizarEtapaKanban(merchantId, nuevaEtapa);
    const etapaConfig = KANBAN_STAGES.find(s => s.stage === nuevaEtapa);
    setNotificacionKanban(`"${comercio.nombreComercial}" movido a ${etapaConfig?.title || nuevaEtapa}`);
    setTimeout(() => setNotificacionKanban(null), 3500);
  };

  const handleAbrirFicha360 = (comercio: Merchant) => {
    setComercioFicha360Id(comercio.id);
    const kItem = kanbanItems.find(k => k.comercio.id === comercio.id);
    setNotasEdicion(kItem?.kanban.notas || '');
  };

  const handleGuardarNotas = () => {
    if (!comercioFicha360Id) return;
    setGuardandoNotas(true);
    comerciosModule.actualizarNotasKanban(comercioFicha360Id, notasEdicion);
    setTimeout(() => {
      setGuardandoNotas(false);
      setNotificacionKanban('Notas CRM actualizadas.');
      setTimeout(() => setNotificacionKanban(null), 3000);
    }, 300);
  };

  const getChecklistFor = (id: string): ValidationChecklist => {
    return checklist[id] || {
      rucValido: false,
      negocioExiste: false,
      instagramReal: false,
      direccionValida: false,
      whatsappVerificado: false
    };
  };

  const setChecklistItem = (id: string, item: keyof ValidationChecklist, val: boolean) => {
    const actual = getChecklistFor(id);
    setChecklist({
      ...checklist,
      [id]: {
        ...actual,
        [item]: val
      }
    });
  };

  const handleAprobarComercio = (comercioId: string) => {
    const cl = getChecklistFor(comercioId);
    const aprobado = comerciosModule.validarManualmente(comercioId, cl, 'Super Admin');
    if (aprobado) {
      setNotificacionKanban('¡Comercio aprobado exitosamente! Habilitado para publicar ofertas.');
      setTimeout(() => setNotificacionKanban(null), 3500);
    } else {
      alert('Debes marcar y verificar todos los ítems del checklist de validación manual.');
    }
  };

  const handleRechazarComercioSubmit = (comercioId: string) => {
    if (!motivoRechazo.trim()) {
      alert('Ingresa el motivo del rechazo.');
      return;
    }
    comerciosModule.rechazarComercio(comercioId, motivoRechazo, 'Super Admin');
    setComercioRechazarId(null);
    setMotivoRechazo('');
    setNotificacionKanban('Comercio rechazado y registrado.');
    setTimeout(() => setNotificacionKanban(null), 3500);
  };

  const handleEliminarComercio = async (comercioId: string, nombre: string) => {
    if (!window.confirm(`¿Eliminar definitivamente "${nombre}"? Esta acción no se puede deshacer.`)) return;
    const ok = comerciosModule.eliminarComercio(comercioId, 'Super Admin');
    if (!ok) {
      alert('No se encontró el comercio.');
      return;
    }
    try {
      await fetch(`/api/comercios/${encodeURIComponent(comercioId)}`, { method: 'DELETE' });
    } catch (e) {
      // La UI ya lo removio; si falla la red el borrado no se confirmo en el servidor.
    }
    setComercioFicha360Id(null);
    setNotificacionKanban(`Comercio "${nombre}" eliminado.`);
    setTimeout(() => setNotificacionKanban(null), 3500);
  };

  const handleCrearNuevoLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoLeadForm.nombreComercial.trim()) return;

    const nuevo = comerciosModule.registrarProspecto({
      nombreComercial: nuevoLeadForm.nombreComercial,
      contactoNombre: nuevoLeadForm.contactoNombre,
      telefono: nuevoLeadForm.telefono,
      distrito: nuevoLeadForm.distrito,
      categoria: nuevoLeadForm.categoria,
      etapa: nuevoLeadForm.etapa,
      notas: nuevoLeadForm.notas,
      ruc: nuevoLeadForm.ruc,
      email: nuevoLeadForm.email
    });

    setModalNuevoLeadAbierto(false);
    setNuevoLeadForm({
      nombreComercial: '',
      contactoNombre: '',
      telefono: '',
      distrito: 'Miraflores',
      categoria: 'Gastronomía y Café',
      etapa: 'prospecto',
      notas: '',
      ruc: '',
      email: ''
    });
    setNotificacionKanban(`Lead "${nuevo.nombreComercial}" agregado al pipeline.`);
    setTimeout(() => setNotificacionKanban(null), 3500);
  };

  const desplazarKanban = (dir: 'izq' | 'der') => {
    if (!kanbanScrollRef.current) return;
    const offset = dir === 'izq' ? -350 : 350;
    kanbanScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  const comercioFicha360 = comercioFicha360Id ? comerciosTodos.find(c => c.id === comercioFicha360Id) : null;
  const ofertasDelComercioFicha: Offer[] = comercioFicha360Id ? ofertasModule.listarOfertasPorComercio(comercioFicha360Id) : [];
  const ventasDelComercioFicha = comercioFicha360Id ? clicsAtribucionModule.listarVentasPorComercio(comercioFicha360Id) : [];
  const saldoPpcFicha = comercioFicha360Id ? facturacionModule.obtenerSaldoComercio(comercioFicha360Id) : 0;

  // Enrutamiento de subpáginas
  const esPipeline = subruta === '/gestion/comercios/pipeline';
  const esAprobaciones = subruta === '/gestion/comercios/aprobaciones';
  const esActivos = subruta === '/gestion/comercios/activos';
  const esActividades = subruta === '/gestion/comercios/actividades';
  const esVentas = subruta === '/gestion/comercios/ventas-confirmadas';
  const esResumen = !esPipeline && !esAprobaciones && !esActivos && !esActividades && !esVentas;

  return (
    <div className="space-y-6">
      {/* Subnavegación de Sección */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/comercios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Resumen CRM</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comercios/pipeline')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esPipeline
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Kanban className="w-3.5 h-3.5" />
          <span>Pipeline (7 Etapas)</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comercios/aprobaciones')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esAprobaciones
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Aprobación RUC</span>
          {comerciosPendientes.length > 0 && (
            <span className="px-1.5 py-0.2 bg-rose-500 text-white text-[10px] rounded-full font-bold">
              {comerciosPendientes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => onNavegar('/gestion/comercios/activos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esActivos
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Comercios Activos</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comercios/actividades')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esActividades
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Actividades & Seguimiento</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/comercios/ventas-confirmadas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esVentas
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          <span>Ventas Confirmadas</span>
        </button>
      </div>

      {/* Banner de Notificación */}
      {notificacionKanban && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notificacionKanban}</span>
          </div>
          <button onClick={() => setNotificacionKanban(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 1. RESUMEN COMERCIOS CRM */}
      {esResumen && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">
                  Consola de Comercios CRM
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Pipeline comercial, validación fiscal SUNAT con RUC, comercios activos y ventas confirmadas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavegar('/gestion/comercios/pipeline')}
                  className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Abrir Pipeline Kanban
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Comercios Totales</span>
                <div className="text-2xl font-black text-stone-900 mt-1">{comerciosTodos.length}</div>
                <span className="text-[10px] text-stone-500">En todas las etapas</span>
              </div>
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200/70">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Por Validar RUC</span>
                <div className="text-2xl font-black text-amber-900 mt-1">{comerciosPendientes.length}</div>
                <span className="text-[10px] text-amber-700">Checklist pendiente</span>
              </div>
              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200/70">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Comercios Activos</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">
                  {comerciosTodos.filter(c => c.estado === 'activo').length}
                </div>
                <span className="text-[10px] text-emerald-700">Habilitados en la red</span>
              </div>
              <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-200/70">
                <span className="text-[10px] font-bold text-indigo-800 uppercase">Ventas Reportadas</span>
                <div className="text-2xl font-black text-indigo-900 mt-1">
                  {clicsAtribucionModule.listarTodasLasVentas().length}
                </div>
                <span className="text-[10px] text-indigo-700">Con código personal</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PIPELINE KANBAN (7 ETAPAS CON DRAG & DROP) */}
      {(esPipeline || esResumen) && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-stone-900">
                  Pipeline CRM de Adquisición de Comercios
                </h3>
                <span className="bg-[#1B4332] text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-2xs">
                  7 Etapas
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Arrastra y suelta las tarjetas entre etapas (Drag & Drop) o haz clic en cualquier comercio para abrir su Ficha 360.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="hidden sm:flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200/80">
                <button
                  onClick={() => desplazarKanban('izq')}
                  title="Desplazar a la izquierda"
                  className="p-1.5 hover:bg-white text-stone-600 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-semibold text-stone-500 px-1">Columnas</span>
                <button
                  onClick={() => desplazarKanban('der')}
                  title="Desplazar a la derecha"
                  className="p-1.5 hover:bg-white text-stone-600 rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setModalNuevoLeadAbierto(true)}
                className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Nuevo Prospecto / Lead</span>
              </button>
            </div>
          </div>

          {/* Filtros de Pipeline */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200/70">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, contacto o notas..."
                value={busquedaKanban}
                onChange={(e) => setBusquedaKanban(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-stone-500">Distrito:</span>
              <select
                value={distritoFiltroKanban}
                onChange={(e) => setDistritoFiltroKanban(e.target.value)}
                className="bg-white border border-stone-200 rounded-xl text-xs text-stone-700 py-1.5 px-2.5 focus:outline-none"
              >
                <option value="todos">Todos los distritos</option>
                {DISTRITOS_LIMA.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tablero Kanban Scrollable */}
          <div
            ref={kanbanScrollRef}
            className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-thin select-none min-h-[480px]"
          >
            {KANBAN_STAGES.map(col => {
              const itemsEnColumna = kanbanItems.filter(k => {
                if (k.kanban.etapa !== col.stage) return false;
                if (distritoFiltroKanban !== 'todos' && k.comercio.distrito.toLowerCase() !== distritoFiltroKanban.toLowerCase()) return false;
                if (busquedaKanban) {
                  const q = busquedaKanban.toLowerCase();
                  const coincideNombre = k.comercio.nombreComercial.toLowerCase().includes(q);
                  const coincideContacto = k.comercio.contactoNombre.toLowerCase().includes(q);
                  const coincideNotas = (k.kanban.notas || '').toLowerCase().includes(q);
                  if (!coincideNombre && !coincideContacto && !coincideNotas) return false;
                }
                return true;
              });

              const isOver = columnaDestinoHover === col.stage;

              return (
                <div
                  key={col.stage}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setColumnaDestinoHover(col.stage);
                  }}
                  onDragLeave={() => {
                    if (columnaDestinoHover === col.stage) setColumnaDestinoHover(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setColumnaDestinoHover(null);
                    if (arrastrandoId) {
                      handleMoverEtapa(arrastrandoId, col.stage);
                      setArrastrandoId(null);
                    }
                  }}
                  className={`w-72 shrink-0 rounded-2xl flex flex-col border transition-colors ${
                    isOver ? 'bg-emerald-50/70 border-emerald-400' : 'bg-stone-50/80 border-stone-200/80'
                  }`}
                >
                  {/* Encabezado Columna */}
                  <div className={`p-3 rounded-t-2xl border-b flex items-center justify-between ${col.headerBg} border-stone-200/70`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dotColor}`} />
                      <span className="font-bold text-xs text-stone-900">{col.title}</span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white border border-stone-200 text-stone-700">
                      {itemsEnColumna.length}
                    </span>
                  </div>

                  {/* Lista de Tarjetas */}
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[600px]">
                    {itemsEnColumna.length === 0 ? (
                      <div className="py-8 text-center text-stone-400 text-[11px]">
                        Sin comercios
                      </div>
                    ) : (
                      itemsEnColumna.map(kItem => (
                        <div
                          key={kItem.comercio.id}
                          draggable
                          onDragStart={() => setArrastrandoId(kItem.comercio.id)}
                          onDragEnd={() => setArrastrandoId(null)}
                          onClick={() => handleAbrirFicha360(kItem.comercio)}
                          className="bg-white p-3 rounded-xl border border-stone-200/80 hover:border-emerald-500/50 shadow-2xs hover:shadow-xs transition-all cursor-grab active:cursor-grabbing space-y-2 group"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-xs font-bold text-stone-900 group-hover:text-emerald-800 transition-colors">
                                {kItem.comercio.nombreComercial}
                              </h4>
                              <span className="text-[10px] text-stone-400 block">{kItem.comercio.distrito} · {kItem.comercio.categoria}</span>
                            </div>
                            <GripVertical className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 shrink-0" />
                          </div>

                          {kItem.kanban.notas && (
                            <p className="text-[11px] text-stone-500 line-clamp-2 bg-stone-50 p-1.5 rounded-lg border border-stone-100">
                              {kItem.kanban.notas}
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px]">
                            <span className="text-stone-500 flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              {kItem.comercio.telefono}
                            </span>
                            <span className="text-emerald-700 font-bold group-hover:underline">
                              Ficha 360 →
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. APROBACIÓN DE COMERCIOS CON RUC */}
      {esAprobaciones && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Aprobación de Comercios con RUC ({comerciosPendientes.length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Checklist manual canónico de validación con SUNAT antes de permitir la publicación de ofertas.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {comerciosPendientes.length === 0 ? (
              <div className="py-12 text-center text-stone-400 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="font-bold text-stone-700">No hay comercios pendientes de aprobación.</p>
                <p className="text-[11px]">Todos los comercios registrados han sido revisados y procesados.</p>
              </div>
            ) : (
              comerciosPendientes.map(c => {
                const cl = getChecklistFor(c.id);
                return (
                  <div key={c.id} className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-bold text-stone-900">{c.nombreComercial}</h4>
                        <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5">
                          <span>RUC: <strong className="font-mono text-stone-800">{c.ruc}</strong></span>
                          <span>·</span>
                          <span>Contacto: {c.contactoNombre}</span>
                          <span>·</span>
                          <span>{c.distrito}</span>
                        </div>
                      </div>
                      <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full w-fit">
                        Pendiente Validación
                      </span>
                    </div>

                    {/* Checklist */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2 border-t border-stone-200/60">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-stone-200 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cl.rucValido}
                          onChange={(e) => setChecklistItem(c.id, 'rucValido', e.target.checked)}
                          className="rounded text-emerald-700"
                        />
                        <span>RUC SUNAT Válido</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-stone-200 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cl.negocioExiste}
                          onChange={(e) => setChecklistItem(c.id, 'negocioExiste', e.target.checked)}
                          className="rounded text-emerald-700"
                        />
                        <span>Negocio Real</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-stone-200 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cl.instagramReal}
                          onChange={(e) => setChecklistItem(c.id, 'instagramReal', e.target.checked)}
                          className="rounded text-emerald-700"
                        />
                        <span>Redes / Web</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-stone-200 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cl.direccionValida}
                          onChange={(e) => setChecklistItem(c.id, 'direccionValida', e.target.checked)}
                          className="rounded text-emerald-700"
                        />
                        <span>Dirección Lima</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 bg-white rounded-xl border border-stone-200 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={cl.whatsappVerificado}
                          onChange={(e) => setChecklistItem(c.id, 'whatsappVerificado', e.target.checked)}
                          className="rounded text-emerald-700"
                        />
                        <span>WhatsApp Conf.</span>
                      </label>
                    </div>

                    {/* Botones de Aprobación */}
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        onClick={() => setComercioRechazarId(c.id)}
                        className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                      >
                        Rechazar
                      </button>
                      <button
                        onClick={() => handleAprobarComercio(c.id)}
                        className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                      >
                        Aprobar Comercio
                      </button>
                    </div>

                    {/* Caja de Rechazo */}
                    {comercioRechazarId === c.id && (
                      <div className="p-3 bg-rose-50 rounded-xl space-y-2 border border-rose-100">
                        <input
                          type="text"
                          value={motivoRechazo}
                          onChange={e => setMotivoRechazo(e.target.value)}
                          placeholder="Motivo del rechazo (ej. RUC no habido en SUNAT)..."
                          className="w-full p-2 text-xs border border-rose-200 rounded-lg bg-white"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRechazarComercioSubmit(c.id)}
                            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                          >
                            Confirmar Rechazo
                          </button>
                          <button
                            onClick={() => setComercioRechazarId(null)}
                            className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-medium rounded-lg cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. COMERCIOS ACTIVOS */}
      {esActivos && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Directorio de Comercios Activos ({comerciosTodos.filter(c => c.estado === 'activo').length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Aliados comerciales habilitados para publicar promociones en la red Yuddit.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">Comercio</th>
                  <th className="pb-2.5">RUC SUNAT</th>
                  <th className="pb-2.5">Distrito</th>
                  <th className="pb-2.5">Contacto</th>
                  <th className="pb-2.5">Ofertas Activas</th>
                  <th className="pb-2.5 text-right">Ficha 360</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {comerciosTodos.filter(c => c.estado === 'activo').map(c => {
                  const ofertasCount = ofertasModule.listarOfertasPorComercio(c.id).filter((o: Offer) => o.estado === 'activa').length;
                  return (
                    <tr 
                      key={c.id} 
                      onClick={() => handleAbrirFicha360(c)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-semibold text-stone-900">
                        {c.nombreComercial}
                        <span className="block text-[11px] text-stone-400 font-normal">{c.categoria}</span>
                      </td>
                      <td className="py-3 font-mono text-stone-700">{c.ruc}</td>
                      <td className="py-3 text-stone-600">{c.distrito}</td>
                      <td className="py-3 text-stone-600 font-mono text-[11px]">{c.telefono}</td>
                      <td className="py-3 font-bold text-emerald-800">{ofertasCount} ofertas</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAbrirFicha360(c);
                            }}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[11px] font-semibold"
                          >
                            Ver 360
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              vistaComoModule.entrar(c.id);
                            }}
                            title={`Ver el panel de ${c.nombreComercial} como si fuera su dueño`}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-semibold"
                          >
                            Entrar como
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleEliminarComercio(c.id, c.nombreComercial);
                            }}
                            title="Eliminar comercio"
                            aria-label={`Eliminar ${c.nombreComercial}`}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. ACTIVIDADES Y SEGUIMIENTO */}
      {esActividades && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Actividades y Seguimiento Comercial CRM
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Historial de contactos, compromisos y bitácora de notas de prospección en Lima.
            </p>
          </div>

          <div className="space-y-3">
            {kanbanItems.filter(k => k.kanban.notas).map(kItem => (
              <div 
                key={kItem.comercio.id}
                onClick={() => handleAbrirFicha360(kItem.comercio)}
                className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70 hover:border-emerald-500/50 cursor-pointer transition-all space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-900">{kItem.comercio.nombreComercial}</span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 bg-stone-200 text-stone-700 rounded-full">
                    {kItem.kanban.etapa}
                  </span>
                </div>
                <p className="text-xs text-stone-600 bg-white p-2.5 rounded-lg border border-stone-100">
                  {kItem.kanban.notas}
                </p>
                <div className="text-[10px] text-stone-400 flex items-center justify-between">
                  <span>Contacto: {kItem.comercio.contactoNombre} ({kItem.comercio.telefono})</span>
                  <span className="text-emerald-700 font-bold">Abrir Ficha 360 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. VENTAS CONFIRMADAS */}
      {esVentas && (
        <CrmVentasView />
      )}

      {/* MODAL: FICHA 360 DE COMERCIO */}
      {comercioFicha360 && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Ficha 360 del Comercio
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-1">
                  {comercioFicha360.nombreComercial}
                </h3>
                <p className="text-xs text-stone-500">{comercioFicha360.razonSocial}</p>
              </div>
              <button
                onClick={() => setComercioFicha360Id(null)}
                className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Fila de Datos Básicos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">RUC SUNAT</span>
                <span className="font-mono font-bold text-stone-800">{comercioFicha360.ruc}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Contacto</span>
                <span className="font-semibold text-stone-800">{comercioFicha360.contactoNombre}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">WhatsApp</span>
                <button
                  onClick={() => alPulsarBotonWhatsApp({
                    telefono: comercioFicha360.telefono,
                    texto: 'Ofertas',
                    onAbrirSelector: () => setChooserAdminAbierto(true)
                  })}
                  className="font-semibold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>{comercioFicha360.telefono}</span>
                </button>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Distrito</span>
                <span className="font-semibold text-stone-800">{comercioFicha360.distrito}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Categoría</span>
                <span className="font-semibold text-stone-800">{comercioFicha360.categoria}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Saldo PPC</span>
                <span className="font-bold text-sky-700">{saldoPpcFicha} clics</span>
              </div>
            </div>

            {/* Mover Etapa en Pipeline */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 block">
                Etapa en el Pipeline CRM:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {KANBAN_STAGES.map(s => {
                  const kItem = kanbanItems.find(k => k.comercio.id === comercioFicha360.id);
                  const esActual = kItem?.kanban.etapa === s.stage;
                  return (
                    <button
                      key={s.stage}
                      type="button"
                      onClick={() => handleMoverEtapa(comercioFicha360.id, s.stage)}
                      className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                        esActual
                          ? 'bg-[#1B4332] text-white border-[#1B4332]'
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {s.title}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notas CRM */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-stone-700 flex items-center justify-between">
                <span>Notas de Seguimiento & Compromisos:</span>
                <span className="text-[10px] text-stone-400 font-normal">Bitácora interna</span>
              </label>
              <textarea
                rows={3}
                value={notasEdicion}
                onChange={(e) => setNotasEdicion(e.target.value)}
                placeholder="Escribe acuerdos comerciales, hora de llamada, documentos pendientes..."
                className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            {/* Ofertas Activas del Comercio */}
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <h4 className="text-xs font-bold text-stone-700">Ofertas en Catálogo ({ofertasDelComercioFicha.length})</h4>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {ofertasDelComercioFicha.length === 0 ? (
                  <p className="text-[11px] text-stone-400">Este comercio aún no tiene ofertas cargadas.</p>
                ) : (
                  ofertasDelComercioFicha.map(o => (
                    <div key={o.id} className="p-2 bg-stone-50 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-semibold text-stone-800 truncate">{o.titulo}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        o.estado === 'activa' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {o.estado}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Ventas Confirmadas */}
            <div className="pt-2 border-t border-stone-100 space-y-2">
              <h4 className="text-xs font-bold text-stone-700">Ventas Informadas por el Comercio ({ventasDelComercioFicha.length})</h4>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {ventasDelComercioFicha.length === 0 ? (
                  <p className="text-[11px] text-stone-400">Sin ventas informadas con código personal.</p>
                ) : (
                  ventasDelComercioFicha.map(v => (
                    <div key={v.id} className="p-2 bg-stone-50 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-mono text-stone-700">Cód: {v.codigoPersonal}</span>
                      <span className="font-bold text-emerald-800">S/. {v.montoVenta?.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Botones Ficha 360 */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setComercioFicha360Id(null)}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  onClick={() => void handleEliminarComercio(comercioFicha360.id, comercioFicha360.nombreComercial)}
                  className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-semibold flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
              <button
                type="button"
                disabled={guardandoNotas}
                onClick={handleGuardarNotas}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{guardandoNotas ? 'Guardando...' : 'Guardar Notas CRM'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO LEAD */}
      {modalNuevoLeadAbierto && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCrearNuevoLeadSubmit}
            className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-base font-black text-stone-900">Nuevo Lead para el Pipeline</h3>
              <button
                type="button"
                onClick={() => setModalNuevoLeadAbierto(false)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Nombre Comercial *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Café La Esquina"
                  value={nuevoLeadForm.nombreComercial}
                  onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, nombreComercial: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej. Renzo Ramos"
                    value={nuevoLeadForm.contactoNombre}
                    onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, contactoNombre: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">WhatsApp</label>
                  <input
                    type="text"
                    placeholder="+51 987 654 321"
                    value={nuevoLeadForm.telefono}
                    onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, telefono: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Distrito</label>
                  <select
                    value={nuevoLeadForm.distrito}
                    onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, distrito: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                  >
                    {DISTRITOS_LIMA.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Categoría</label>
                  <select
                    value={nuevoLeadForm.categoria}
                    onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, categoria: e.target.value })}
                    className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                  >
                    {CATEGORIAS_OFERTAS.map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Notas Comerciales</label>
                <textarea
                  rows={2}
                  placeholder="Canal de prospección, requerimientos, fecha de llamada..."
                  value={nuevoLeadForm.notas}
                  onChange={(e) => setNuevoLeadForm({ ...nuevoLeadForm, notas: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setModalNuevoLeadAbierto(false)}
                className="px-3.5 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl"
              >
                Guardar Lead
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Hoja de eleccion de app de WhatsApp (iOS y web). En Android el
          selector lo pone el sistema. */}
      <WhatsAppChooser
        abierto={chooserAdminAbierto}
        onCerrar={() => setChooserAdminAbierto(false)}
        telefono={comercioFicha360?.telefono || null}
        texto="Ofertas"
        titulo="Contactar al comercio"
      />
    </div>
  );
};
