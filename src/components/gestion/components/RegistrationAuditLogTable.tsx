import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, RefreshCw, Search, CheckCircle2, AlertCircle, 
  AlertTriangle, Mail, Phone, Clock, User, FileText, Trash2, Check
} from 'lucide-react';
import { confirmar, alerta } from '../../common/ConfirmModal';

export interface RegistrationLogItem {
  id: string;
  email: string;
  telefono?: string;
  nombre?: string;
  status: 'success' | 'error';
  resultDetails?: string;
  timestamp: string;
  createdAt?: string;
}

interface RegistrationAuditLogTableProps {
  onRefreshParent?: () => void;
}

export const RegistrationAuditLogTable: React.FC<RegistrationAuditLogTableProps> = () => {
  const [logs, setLogs] = useState<RegistrationLogItem[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificacion, setNotificacion] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'success' | 'error'>('todos');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  const cargarLogs = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await fetch('/api/audience/registration-logs?limit=150');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.logs)) {
          setLogs(data.logs);
        }
      } else {
        setError('No se pudieron obtener los logs de auditoría.');
      }
    } catch (err: any) {
      console.error('[Audit Log] Error al cargar logs:', err);
      setError(err.message || 'Error de conexión con la base de datos.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      cargarLogs();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const borrarLogYRastros = async (log: RegistrationLogItem) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar usuario y sus rastros',
      mensaje: `¿Eliminar al usuario (${log.email}) y borrar todos sus rastros de prueba?`,
      textoConfirmar: 'Eliminar rastros'
    });
    if (!confirmado) return;
    try {
      setEliminandoId(log.id);
      const res = await fetch('/api/audience/purge-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: log.email, telefono: log.telefono })
      });
      const data = await res.json();
      if (data.ok) {
        setNotificacion(`✅ Rastros del correo ${log.email} purgados correctamente.`);
        setTimeout(() => setNotificacion(null), 4000);
        cargarLogs();
      } else {
        alerta({ titulo: 'Error al eliminar rastros', mensaje: data.error || 'Error al eliminar rastros', tono: 'error' });
      }
    } catch (err: any) {
      alerta({ titulo: 'Error de red', mensaje: 'Error de red al intentar eliminar rastros: ' + err.message, tono: 'error' });
    } finally {
      setEliminandoId(null);
    }
  };

  const limpiarTodosLosLogs = async () => {
    const confirmado = await confirmar({
      titulo: 'Vaciar auditoría',
      mensaje: '¿Estás seguro de vaciar todos los logs de auditoría de prueba?',
      textoConfirmar: 'Vaciar'
    });
    if (!confirmado) return;
    try {
      setCargando(true);
      const res = await fetch('/api/audience/clear-all-registration-logs', { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setNotificacion('✅ Historial de auditoría de registros limpiado por completo.');
        setTimeout(() => setNotificacion(null), 4000);
        cargarLogs();
      }
    } catch (err: any) {
      alerta({ titulo: 'Error al limpiar logs', mensaje: 'Error al limpiar logs: ' + err.message, tono: 'error' });
    } finally {
      setCargando(false);
    }
  };

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      const cumpleEstado = filtroEstado === 'todos' || log.status === filtroEstado;
      const q = busqueda.toLowerCase().trim();
      const cumpleBusqueda =
        !q ||
        log.email.toLowerCase().includes(q) ||
        (log.telefono && log.telefono.toLowerCase().includes(q)) ||
        (log.nombre && log.nombre.toLowerCase().includes(q)) ||
        (log.resultDetails && log.resultDetails.toLowerCase().includes(q));

      return cumpleEstado && cumpleBusqueda;
    });
  }, [logs, filtroEstado, busqueda]);

  // KPIs
  const totalIntentos = logs.length;
  const exitosos = logs.filter((l) => l.status === 'success').length;
  const errores = logs.filter((l) => l.status === 'error').length;
  const tasaExito = totalIntentos > 0 ? ((exitosos / totalIntentos) * 100).toFixed(1) : '100.0';

  const formatearFecha = (isoString: string) => {
    try {
      const d = new Date(isoString);
      if (isNaN(d.getTime())) return isoString;
      return new Intl.DateTimeFormat('es-PE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-5">
      {/* Cabecera y Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#1B4332]/10 text-[#1B4332] rounded-xl">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
              Log de Auditoría de Intentos de Registro
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                Cloud SQL / PostgreSQL
              </span>
            </h3>
            <p className="text-xs text-stone-500">
              Registro histórico de intentos de creación de cuenta, validaciones de unicidad de email/WhatsApp y estado.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {logs.length > 0 && (
            <button
              onClick={limpiarTodosLosLogs}
              title="Limpiar todo el historial de auditoría de prueba"
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vaciar Auditoría</span>
            </button>
          )}

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse text-emerald-600' : ''}`} />
            <span>{autoRefresh ? 'Auto-refresh (10s)' : 'Auto-refresh'}</span>
          </button>

          <button
            onClick={cargarLogs}
            disabled={cargando}
            className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {notificacion && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificacion}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-stone-50 border border-stone-200/70 rounded-xl">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Intentos Registrados</span>
          <span className="text-xl font-black text-stone-900 mt-0.5 block">{totalIntentos}</span>
        </div>

        <div className="p-3 bg-emerald-50/50 border border-emerald-200/60 rounded-xl">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">Registros Exitosos</span>
          <span className="text-xl font-black text-emerald-800 mt-0.5 block">{exitosos}</span>
        </div>

        <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl">
          <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Bloqueados / Duplicados</span>
          <span className="text-xl font-black text-amber-900 mt-0.5 block">{errores}</span>
        </div>

        <div className="p-3 bg-stone-50 border border-stone-200/70 rounded-xl">
          <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Tasa de Éxito</span>
          <span className="text-xl font-black text-stone-800 mt-0.5 block">{tasaExito}%</span>
        </div>
      </div>

      {/* Filtros de Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por correo, WhatsApp, nombre o detalle..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:bg-white focus:outline-hidden focus:border-[#1B4332]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setFiltroEstado('todos')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filtroEstado === 'todos'
                ? 'bg-stone-900 text-white shadow-2xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            Todos ({logs.length})
          </button>
          <button
            onClick={() => setFiltroEstado('success')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filtroEstado === 'success'
                ? 'bg-emerald-700 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            Éxito ({exitosos})
          </button>
          <button
            onClick={() => setFiltroEstado('error')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              filtroEstado === 'error'
                ? 'bg-amber-700 text-white shadow-2xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            Errores / Duplicados ({errores})
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla de Logs */}
      <div className="border border-stone-200/80 rounded-xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-100/80 border-b border-stone-200 text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                <th className="py-2.5 px-3">Fecha y Hora</th>
                <th className="py-2.5 px-3">Correo Electrónico</th>
                <th className="py-2.5 px-3">WhatsApp / Teléfono</th>
                <th className="py-2.5 px-3">Nombre</th>
                <th className="py-2.5 px-3">Resultado</th>
                <th className="py-2.5 px-3">Detalle del Resultado</th>
                <th className="py-2.5 px-3 text-right">Acciones de Prueba</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {cargando && logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-stone-400" />
                    <span>Cargando logs de auditoría...</span>
                  </td>
                </tr>
              ) : logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-400">
                    <FileText className="w-6 h-6 mx-auto mb-2 text-stone-300" />
                    <span>No se encontraron intentos de registro en la auditoría.</span>
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const esExito = log.status === 'success';
                  const esEliminando = eliminandoId === log.id;
                  return (
                    <tr key={log.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] text-stone-600 whitespace-nowrap">
                        {formatearFecha(log.timestamp)}
                      </td>
                      <td className="py-3 px-3 font-medium text-stone-900">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span className="font-mono text-xs">{log.email}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-stone-700">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <Phone className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                          <span>{log.telefono || '—'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-stone-800 font-medium whitespace-nowrap">
                        {log.nombre ? (
                          <div className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-stone-400" />
                            <span>{log.nombre}</span>
                          </div>
                        ) : (
                          <span className="text-stone-400 italic">Sin nombre</span>
                        )}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {esExito ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-lg border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Éxito</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-lg border border-amber-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            <span>Error / Duplicado</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-stone-600 max-w-xs sm:max-w-md">
                        <p className="text-xs leading-relaxed line-clamp-2" title={log.resultDetails}>
                          {log.resultDetails || (esExito ? 'Registro completado' : 'Falló verificación')}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => borrarLogYRastros(log)}
                          disabled={esEliminando}
                          title="Eliminar usuario y limpiar rastros de email y auditoría para este correo/WhatsApp"
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-lg text-[11px] font-semibold transition-colors flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{esEliminando ? 'Purgando...' : 'Borrar Rastros'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
