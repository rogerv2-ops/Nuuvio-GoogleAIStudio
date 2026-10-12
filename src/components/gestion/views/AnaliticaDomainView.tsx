import React from 'react';
import { 
  BarChart3, Users, Building2, Share2, TrendingUp, 
  MapPin, CheckCircle2, ArrowRight, ExternalLink
} from 'lucide-react';
import { AdminRechartsDashboard } from '../../AdminRechartsDashboard';
import { UtmAttributionDashboardWidget } from '../../UtmAttributionDashboardWidget';
import { analiticaModule } from '../../../modules/analitica';
import { usuariosModule } from '../../../modules/usuarios';
import { comerciosModule } from '../../../modules/comercios';
import { clicsAtribucionModule } from '../../../modules/clics';
import { DISTRITOS_LIMA } from '../../../data/seedData';

interface AnaliticaDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const AnaliticaDomainView: React.FC<AnaliticaDomainViewProps> = ({ subruta, onNavegar }) => {
  const kpis = analiticaModule.calcularKPIsGlobales();
  const embudo = analiticaModule.obtenerEmbudoConversion();
  const usuarios = usuariosModule.listarUsuarios();
  const comercios = comerciosModule.listarComercios();
  const ventas = clicsAtribucionModule.listarTodasLasVentas();

  // Subrutas permitidas:
  // - '' o '/gestion/analitica': Resumen general
  // - '/gestion/analitica/usuarios': Analítica de usuarios
  // - '/gestion/analitica/comercios': Analítica de comercios
  // - '/gestion/analitica/atribucion': Rendimiento y atribución UTM

  const esUsuarios = subruta === '/gestion/analitica/usuarios';
  const esComercios = subruta === '/gestion/analitica/comercios';
  const esAtribucion = subruta === '/gestion/analitica/atribucion';
  const esResumen = !esUsuarios && !esComercios && !esAtribucion;

  return (
    <div className="space-y-6">
      {/* Selector de Subpáginas */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/analitica')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Resumen General</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/analitica/usuarios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esUsuarios
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Analítica Usuarios</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/analitica/comercios')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esComercios
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Analítica Comercios</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/analitica/atribucion')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esAtribucion
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Rendimiento & Atribución UTM</span>
        </button>
      </div>

      {/* VISTA 1: RESUMEN GENERAL (Gráficos interactivos de Recharts) */}
      {esResumen && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-stone-200/80 shadow-2xs">
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                Resumen Ejecutivo de Analítica
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Métricas globales de tráfico, embudo de conversión e interacciones de leads por WhatsApp.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavegar('/gestion/analitica/atribucion')}
                className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Ver Atribución UTM</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <AdminRechartsDashboard />
        </div>
      )}

      {/* VISTA 2: USUARIOS */}
      {esUsuarios && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                Analítica de Audiencia y Registros
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Comportamiento de usuarios, canales de captación y progreso de verificación en Lima.
              </p>
            </div>

            {/* Embudo de registro a WhatsApp */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[11px] font-bold text-stone-500 uppercase">Usuarios Totales</span>
                <div className="text-2xl font-black text-stone-900 mt-1">{usuarios.length}</div>
                <span className="text-[10px] text-stone-500">Registrados en la plataforma</span>
              </div>
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[11px] font-bold text-stone-500 uppercase">Correo Verificado</span>
                <div className="text-2xl font-black text-emerald-800 mt-1">
                  {usuarios.filter(u => u.emailVerificado).length}
                </div>
                <span className="text-[10px] text-stone-500">
                  {((usuarios.filter(u => u.emailVerificado).length / Math.max(1, usuarios.length)) * 100).toFixed(0)}% de tasa de verificación
                </span>
              </div>
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[11px] font-bold text-stone-500 uppercase">WhatsApp Vinculado</span>
                <div className="text-2xl font-black text-emerald-800 mt-1">
                  {usuarios.filter(u => u.estado === 'activo').length}
                </div>
                <span className="text-[10px] text-stone-500">Con sesión activa de chat</span>
              </div>
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[11px] font-bold text-stone-500 uppercase">Canje de Puntos</span>
                <div className="text-2xl font-black text-purple-800 mt-1">
                  {usuarios.reduce((acc, u) => acc + (u.puntosSaldo || 0), 0)}
                </div>
                <span className="text-[10px] text-stone-500">Puntos acumulados en circulación</span>
              </div>
            </div>

            {/* Distribución por Distritos de Lima */}
            <div className="pt-4 border-t border-stone-100">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
                Distribución Geográfica de la Audiencia (Lima)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {DISTRITOS_LIMA.slice(0, 6).map(distrito => {
                  const count = usuarios.filter(u => u.distrito.toLowerCase() === distrito.toLowerCase()).length;
                  return (
                    <div key={distrito} className="p-2.5 bg-stone-50 rounded-xl border border-stone-200/60 text-center">
                      <span className="text-xs font-bold text-stone-800 block truncate">{distrito}</span>
                      <span className="text-sm font-black text-emerald-800">{count}</span>
                      <span className="text-[10px] text-stone-400 block">usuarios</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 3: COMERCIOS */}
      {esComercios && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-stone-900">
                Analítica de Comercios y Generación de Leads
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Efectividad de la red comercial: comercios activos, contactos de WhatsApp recibidos y ventas informadas.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200/80">
                <span className="text-[11px] font-bold text-emerald-900 uppercase">Comercios Totales</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">{comercios.length}</div>
                <p className="text-[11px] text-emerald-700 mt-1">Negocios en la red de Lima</p>
              </div>

              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-200/80">
                <span className="text-[11px] font-bold text-blue-900 uppercase">Contactos a Comercios</span>
                <div className="text-2xl font-black text-blue-900 mt-1">{kpis.totalClicsContactar}</div>
                <p className="text-[11px] text-blue-700 mt-1">Clics generados hacia WhatsApp de comercios</p>
              </div>

              <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-200/80">
                <span className="text-[11px] font-bold text-indigo-900 uppercase">Ventas Informadas</span>
                <div className="text-2xl font-black text-indigo-900 mt-1">{ventas.length}</div>
                <p className="text-[11px] text-indigo-700 mt-1">Resultados reportados con código personal</p>
              </div>
            </div>

            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-500">¿Deseas ver el detalle del pipeline comercial?</span>
              <button
                onClick={() => onNavegar('/gestion/comercios/pipeline')}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Abrir Pipeline Comercios CRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 4: RENDIMIENTO Y ATRIBUCIÓN UTM */}
      {esAtribucion && (
        <div className="space-y-6">
          <UtmAttributionDashboardWidget />
        </div>
      )}
    </div>
  );
};
