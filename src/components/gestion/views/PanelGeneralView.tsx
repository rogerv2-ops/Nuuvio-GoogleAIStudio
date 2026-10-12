import React, { useState } from 'react';
import { 
  BarChart3, Users, Building2, Tag, CreditCard, Send, Settings,
  AlertCircle, CheckCircle2, ArrowRight, ShieldAlert, Sparkles,
  MessageCircle, ExternalLink, Activity, Clock, ShieldCheck,
  TrendingUp, PhoneCall, HelpCircle, Layers
} from 'lucide-react';
import { comerciosModule } from '../../../modules/comercios';
import { ofertasModule } from '../../../modules/ofertas';
import { analiticaModule } from '../../../modules/analitica';
import { clicsAtribucionModule } from '../../../modules/clics';
import { coreConfig } from '../../../core/config';
import { coreEvents } from '../../../core/events';
import { usuariosModule } from '../../../modules/usuarios';
import { facturacionModule } from '../../../modules/facturacion';

interface PanelGeneralViewProps {
  onNavegar: (ruta: string) => void;
}

export const PanelGeneralView: React.FC<PanelGeneralViewProps> = ({ onNavegar }) => {
  const [mostrarExplicacionModelo, setMostrarExplicacionModelo] = useState(false);

  const kpis = analiticaModule.calcularKPIsGlobales();
  const comerciosPendientes = comerciosModule.listarPendientes();
  const ofertasPendientes = ofertasModule.listarPendientesModeracion();
  const kanbanItems = comerciosModule.getKanbanItems();
  const comerciosEnRiesgo = kanbanItems.filter(k => k.kanban.etapa === 'en_riesgo');
  const facturacionPpcActiva = coreConfig.moduloActivo('campanasFacturacion');
  const ventasConfirmadas = clicsAtribucionModule.listarTodasLasVentas();
  const usuarios = usuariosModule.listarUsuarios();
  const eventosRecientes = coreEvents.consultar({ limite: 8 });
  const packs = facturacionModule.listarTodosLosPacks();

  const totalClicsSaldo = packs.reduce((acc, p) => acc + p.saldoClics, 0);

  // Determinar alertas accionables prioritarias
  const alertas = [
    {
      tipo: 'urgente',
      condicion: ofertasPendientes.length > 0,
      titulo: `${ofertasPendientes.length} ${ofertasPendientes.length === 1 ? 'oferta pendiente' : 'ofertas pendientes'} de moderación`,
      descripcion: 'Requieren verificación de imagen 4:5 y reglas de publicación antes de entrar al catálogo en vivo.',
      accionTexto: 'Moderar Ofertas',
      ruta: '/gestion/ofertas/moderacion',
      icono: ShieldAlert,
      color: 'bg-rose-50 border-rose-200 text-rose-900',
      btnColor: 'bg-rose-700 hover:bg-rose-800 text-white'
    },
    {
      tipo: 'atencion',
      condicion: comerciosPendientes.length > 0,
      titulo: `${comerciosPendientes.length} ${comerciosPendientes.length === 1 ? 'comercio espera' : 'comercios esperan'} validación con RUC`,
      descripcion: 'Revisión manual de RUC SUNAT y ubicación antes de autorizar la carga de promociones.',
      accionTexto: 'Aprobar Comercios',
      ruta: '/gestion/comercios/aprobaciones',
      icono: Building2,
      color: 'bg-amber-50 border-amber-200 text-amber-900',
      btnColor: 'bg-amber-700 hover:bg-amber-800 text-white'
    },
    {
      tipo: 'seguimiento',
      condicion: comerciosEnRiesgo.length > 0,
      titulo: `${comerciosEnRiesgo.length} comercios en riesgo en el Pipeline`,
      descripcion: 'Comercios sin ofertas activas que requieren reactivación comercial por WhatsApp.',
      accionTexto: 'Ver Pipeline',
      ruta: '/gestion/comercios/pipeline',
      icono: AlertCircle,
      color: 'bg-purple-50 border-purple-200 text-purple-900',
      btnColor: 'bg-purple-700 hover:bg-purple-800 text-white'
    }
  ].filter(a => a.condicion);

  return (
    <div className="space-y-6">
      {/* 1. Header con Resumen de Negocio y Reglas Operativas */}
      <div className="bg-gradient-to-br from-slate-900 via-[#0F172A] to-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-sm border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Consola General CRM & ERP
              </span>
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                facturacionPpcActiva
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/80 text-amber-300 border-amber-800'
              }`}>
                {facturacionPpcActiva ? 'PPC Cobro Activo (Producción)' : 'PPC en Modo Prueba Libre (D12)'}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Centro de Mando de vuuy · Red Lima
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              vuuy es un asistente de WhatsApp que genera <strong>leads calificados para comercios</strong>. 
              Los usuarios solicitan ofertas cuando las necesitan; <em>no enviamos ofertas masivas invasivas</em>. 
              Visualiza en tiempo real la captación, el pipeline de comercios y la atribución comercial.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMostrarExplicacionModelo(!mostrarExplicacionModelo)}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
            >
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>{mostrarExplicacionModelo ? 'Ocultar bases del modelo' : '¿Cómo opera el modelo?'}</span>
            </button>
          </div>
        </div>

        {/* Modalidad explicativa colapsable */}
        {mostrarExplicacionModelo && (
          <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 animate-in fade-in">
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="font-bold text-emerald-400 block mb-1">1. Generación de Leads</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Un clic de contacto abre el WhatsApp del comercio con la oferta elegida. No garantiza de inmediato una venta, pero conecta al cliente interesado.
              </p>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="font-bold text-amber-400 block mb-1">2. Ventas Confirmadas</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Son resultados que el comercio informa introduciendo el código personal de 8 dígitos del usuario. No son ingresos de vuuy sino métricas de efectividad.
              </p>
            </div>
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/60">
              <span className="font-bold text-sky-400 block mb-1">3. Ingresos Propios</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Proceden exclusivamente de los paquetes PPC comprados por los comercios cuando el módulo de cobro esté habilitado.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 2. Sección: QUÉ ATENDER HOY (Alertas y Tareas Urgentes) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-black text-stone-900 tracking-tight">
              Qué atender hoy
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {alertas.length} {alertas.length === 1 ? 'pendiente' : 'pendientes'}
            </span>
          </div>
          <span className="text-xs text-stone-400">Prioridad operativa en tiempo real</span>
        </div>

        {alertas.length === 0 ? (
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 flex items-center gap-3 text-emerald-900 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">¡Operación al día!</p>
              <p className="text-emerald-700 text-[11px]">No hay ofertas pendientes de moderación ni comercios esperando aprobación en este momento.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {alertas.map((al, idx) => {
              const Icono = al.icono;
              return (
                <div key={idx} className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 ${al.color}`}>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-white/80 shadow-2xs shrink-0">
                      <Icono className="w-5 h-5 text-current" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm">{al.titulo}</h3>
                      <p className="text-[11px] opacity-80 mt-0.5 leading-relaxed">{al.descripcion}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavegar(al.ruta)}
                    className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer ${al.btnColor}`}
                  >
                    <span>{al.accionTexto}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Métricas Principales del Negocio */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => onNavegar('/gestion/analitica')}
          className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Leads Generados</span>
            <div className="p-2 bg-emerald-50 rounded-xl group-hover:bg-emerald-100 transition-colors">
              <MessageCircle className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{kpis.totalClicsContactar}</span>
            <span className="text-[10px] text-emerald-700 font-semibold">+18% sem</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Contactos iniciados a comercios</p>
        </div>

        <div 
          onClick={() => onNavegar('/gestion/comercios/ventas-confirmadas')}
          className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Ventas Informadas</span>
            <div className="p-2 bg-indigo-50 rounded-xl group-hover:bg-indigo-100 transition-colors">
              <TrendingUp className="w-4 h-4 text-indigo-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{ventasConfirmadas.length}</span>
            <span className="text-[10px] text-indigo-700 font-semibold">Cód. Personal</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Informadas por los comercios</p>
        </div>

        <div 
          onClick={() => onNavegar('/gestion/comercios/pipeline')}
          className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Comercios en Red</span>
            <div className="p-2 bg-amber-50 rounded-xl group-hover:bg-amber-100 transition-colors">
              <Building2 className="w-4 h-4 text-amber-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{kanbanItems.length}</span>
            <span className="text-[10px] text-amber-700 font-semibold">{comerciosPendientes.length} pendientes</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">7 etapas en Pipeline CRM</p>
        </div>

        <div 
          onClick={() => onNavegar('/gestion/campanas-cobro')}
          className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-stone-500 uppercase">Saldo PPC Total</span>
            <div className="p-2 bg-sky-50 rounded-xl group-hover:bg-sky-100 transition-colors">
              <CreditCard className="w-4 h-4 text-sky-700" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-stone-900">{totalClicsSaldo}</span>
            <span className="text-[10px] text-sky-700 font-semibold">clics</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-1">Distribuido en {packs.length} packs</p>
        </div>
      </div>

      {/* 4. Directorio Modular: Accesos a las 7 Secciones */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-stone-900 tracking-tight">
            Módulos del Sistema
          </h2>
          <span className="text-xs text-stone-400">Consola CRM & ERP Modular</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {/* Analítica */}
          <div 
            onClick={() => onNavegar('/gestion/analitica')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Analítica</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Gráficos de audiencia, comportamiento de comercios y rendimiento de enlaces con atribución UTM.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-blue-700 font-semibold">
              <span>Usuarios · Comercios · Atribución</span>
            </div>
          </div>

          {/* Usuarios */}
          <div 
            onClick={() => onNavegar('/gestion/usuarios')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-teal-50 text-teal-700">
                  <Users className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Usuarios</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Base de usuarios registrados ({usuarios.length}), validación de WhatsApp, saldos de puntos y referidos virales.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-teal-700 font-semibold">
              <span>Lista de usuarios · Puntos y referidos</span>
            </div>
          </div>

          {/* Comercios CRM */}
          <div 
            onClick={() => onNavegar('/gestion/comercios')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <Building2 className="w-4 h-4" />
                </div>
                {comerciosPendientes.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                    {comerciosPendientes.length} pendientes
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-stone-900">Comercios CRM</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Pipeline de 7 etapas, aprobación con RUC SUNAT, ficha 360 y registro de ventas confirmadas.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-amber-700 font-semibold">
              <span>Pipeline · Aprobaciones · Ficha 360 · Ventas</span>
            </div>
          </div>

          {/* Ofertas */}
          <div 
            onClick={() => onNavegar('/gestion/ofertas')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <Tag className="w-4 h-4" />
                </div>
                {ofertasPendientes.length > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full">
                    {ofertasPendientes.length} por moderar
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-stone-900">Ofertas</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Catálogo general de promociones, cola de moderación (4:5) asistida por IA y rendimiento por oferta.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-rose-700 font-semibold">
              <span>Catálogo · Moderación · KPIs · Categorías</span>
            </div>
          </div>

          {/* Campañas y Cobro ERP */}
          <div 
            onClick={() => onNavegar('/gestion/campanas-cobro')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <CreditCard className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Campañas y Cobro ERP</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Planes PPC de clics (50, 100, 500), canje por aporte de productos y configuración contable unificada.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-emerald-700 font-semibold">
              <span>Planes PPC · Pagos · Facturación · Finanzas</span>
            </div>
          </div>

          {/* Comunicaciones */}
          <div 
            onClick={() => onNavegar('/gestion/comunicaciones')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                  <Send className="w-4 h-4" />
                </div>
                <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h3 className="text-sm font-bold text-stone-900">Comunicaciones</h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                Envíos de correos de verificación, resumen matutino (Digest D10) y plantillas transaccionales.
              </p>
            </div>
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center gap-2 text-[11px] text-purple-700 font-semibold">
              <span>Envíos · Digest diario · Plantillas</span>
            </div>
          </div>

          {/* Configuración */}
          <div 
            onClick={() => onNavegar('/gestion/configuracion')}
            className="p-4 bg-white rounded-2xl border border-stone-200/80 hover:border-stone-400 shadow-2xs cursor-pointer transition-all flex flex-col justify-between group md:col-span-2 lg:col-span-3"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-100 text-slate-800">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Configuración de Sistema</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Conexión WhatsApp, Correo/SMTP, SEO/Metadatos, Auditoría en vivo, Interruptores de módulos y Agente IA Gemini.
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onNavegar('/gestion/configuracion');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                Abrir Configuración
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Registro Cronológico en Vivo del Microkernel */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-bold text-stone-900">Eventos del Sistema en Tiempo Real</h3>
          </div>
          <button 
            onClick={() => onNavegar('/gestion/configuracion/auditoria')}
            className="text-xs text-emerald-700 font-bold hover:underline flex items-center gap-1"
          >
            <span>Ver auditoría completa</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="divide-y divide-stone-100 max-h-48 overflow-y-auto">
          {eventosRecientes.map(ev => (
            <div key={ev.id} className="py-2 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-bold text-emerald-800 text-[10px] bg-emerald-50 px-2 py-0.5 rounded-md">
                  {ev.tipoEvento}
                </span>
                <span className="text-stone-600 truncate">
                  {ev.actorTipo}: {ev.actorId} {ev.distrito ? `· ${ev.distrito}` : ''}
                </span>
              </div>
              <span className="text-[10px] text-stone-400 font-mono shrink-0">
                {new Date(ev.fechaHora).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
