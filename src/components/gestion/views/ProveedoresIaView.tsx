import React, { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, Server, Key, Eye, EyeOff, CheckCircle2, XCircle, 
  Play, Plus, Trash2, Shield, RefreshCw, Layers, Cpu, Activity,
  Clock, Check, AlertTriangle, ChevronDown, ChevronUp, Lock,
  Zap, Search, DollarSign, BarChart2
} from 'lucide-react';
import { aiService } from '../../../services/aiService';
import { AiProvider, AiProviderId, AssistantConfig, AiCallLog } from '../../../types/ai';
import { confirmar } from '../../common/ConfirmModal';

interface ProveedoresIaViewProps {
  onNavegar?: (ruta: string) => void;
}

export const ProveedoresIaView: React.FC<ProveedoresIaViewProps> = () => {
  const [version, setVersion] = useState(0);
  const [proveedores, setProveedores] = useState<AiProvider[]>(() => aiService.obtenerProveedores());
  const [asistentes, setAsistentes] = useState<AssistantConfig[]>(() => aiService.obtenerAsistentes());
  const [logs, setLogs] = useState<AiCallLog[]>(() => aiService.obtenerLogs());

  // Estados de UI de edición y seguridad
  const [verApiKey, setVerApiKey] = useState<Record<string, boolean>>({});
  const [apiKeysInput, setApiKeysInput] = useState<Record<string, string>>({});
  const [guardadoExitosa, setGuardadoExitosa] = useState(false);
  const [probandoModeloKey, setProbandoModeloKey] = useState<string | null>(null);
  const [resultadoPrueba, setResultadoPrueba] = useState<Record<string, {
    ok: boolean;
    latenciaMs: number;
    tokens: number;
    mensaje: string;
  }>>({});

  // Estado para modal/formulario de agregar modelo
  const [modalAgregarModeloProvId, setModalAgregarModeloProvId] = useState<AiProviderId | null>(null);
  const [nuevoModeloForm, setNuevoModeloForm] = useState({ id: '', label: '', description: '' });

  // Estados para Filtros y Análisis del Registro de IA
  const [filtroProveedorId, setFiltroProveedorId] = useState<string>('todos');
  const [filtroBusqueda, setFiltroBusqueda] = useState<string>('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');

  // Cálculos de KPIs y métricas del Log de llamadas a IA
  const kpisLogs = useMemo(() => {
    const total = logs.length;
    const exitosas = logs.filter(l => l.exito).length;
    const tasaExito = total > 0 ? ((exitosas / total) * 100).toFixed(1) : '100';

    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const logsEsteMes = logs.filter(l => {
      const d = new Date(l.fecha);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });

    const tokensEsteMes = logsEsteMes.reduce((acc, l) => acc + (l.tokens || 0), 0);
    const totalTokensHistoricos = logs.reduce((acc, l) => acc + (l.tokens || 0), 0);

    const latencias = logs.filter(l => l.exito && l.latenciaMs > 0).map(l => l.latenciaMs);
    const latenciaPromedio = latencias.length > 0 
      ? Math.round(latencias.reduce((a, b) => a + b, 0) / latencias.length) 
      : 0;

    // Estimación de costo: ~$0.00015 por 1,000 tokens promedio
    const costoEstUsd = tokensEsteMes * 0.0000002;
    const costoEstPen = costoEstUsd * 3.75;

    return {
      total,
      exitosas,
      tasaExito,
      tokensEsteMes,
      totalTokensHistoricos,
      latenciaPromedio,
      costoEstUsd: costoEstUsd < 0.01 && costoEstUsd > 0 ? '< $0.01' : `$${costoEstUsd.toFixed(4)}`,
      costoEstPen: costoEstPen < 0.01 && costoEstPen > 0 ? '< S/ 0.01' : `S/ ${costoEstPen.toFixed(3)}`
    };
  }, [logs]);

  // Agrupación de consumo acumulativo de tokens por mes (Monitoreo de Costos)
  const consumoPorMes = useMemo(() => {
    const mapa: Record<string, { clave: string; etiqueta: string; llamadas: number; tokens: number; proveedores: Record<string, number> }> = {};

    logs.forEach(l => {
      const d = new Date(l.fecha);
      const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const etiqueta = d.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
      const etiquetaCaps = etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);

      if (!mapa[clave]) {
        mapa[clave] = { clave, etiqueta: etiquetaCaps, llamadas: 0, tokens: 0, proveedores: {} };
      }

      mapa[clave].llamadas += 1;
      mapa[clave].tokens += (l.tokens || 0);
      const pNombre = l.proveedorNombre || l.proveedorId;
      mapa[clave].proveedores[pNombre] = (mapa[clave].proveedores[pNombre] || 0) + (l.tokens || 0);
    });

    return Object.values(mapa).sort((a, b) => b.clave.localeCompare(a.clave));
  }, [logs]);

  // Logs filtrados
  const logsFiltrados = useMemo(() => {
    return logs.filter(l => {
      if (filtroProveedorId !== 'todos' && l.proveedorId !== filtroProveedorId) {
        return false;
      }
      if (filtroEstado === 'exito' && !l.exito) return false;
      if (filtroEstado === 'fallo' && l.exito) return false;
      if (filtroEstado === 'respaldo' && (!l.exito || !l.esRespaldo)) return false;

      if (filtroBusqueda.trim()) {
        const q = filtroBusqueda.toLowerCase();
        const coincideAsistente = (l.asistenteNombre || '').toLowerCase().includes(q) || l.asistenteId.toLowerCase().includes(q);
        const coincideModelo = l.modeloId.toLowerCase().includes(q);
        const coincideProv = (l.proveedorNombre || '').toLowerCase().includes(q);
        return coincideAsistente || coincideModelo || coincideProv;
      }

      return true;
    });
  }, [logs, filtroProveedorId, filtroEstado, filtroBusqueda]);

  // Suscripción a cambios del servicio de IA
  useEffect(() => {
    const unsub = aiService.suscribir(() => {
      setProveedores(aiService.obtenerProveedores());
      setAsistentes(aiService.obtenerAsistentes());
      setLogs(aiService.obtenerLogs());
      setVersion(v => v + 1);
    });
    return () => unsub();
  }, []);

  // Manejador para guardar cambios de proveedores
  const handleGuardarProveedores = (e: React.FormEvent) => {
    e.preventDefault();
    const proveedoresActualizados = proveedores.map(p => {
      const nuevaClave = apiKeysInput[p.id];
      return {
        ...p,
        apiKey: nuevaClave !== undefined ? nuevaClave : p.apiKey
      };
    });

    aiService.guardarProveedores(proveedoresActualizados);
    aiService.guardarAsistentes(asistentes);
    setGuardadoExitosa(true);
    setTimeout(() => setGuardadoExitosa(false), 3000);
  };

  // Cambio de valor de campo de proveedor
  const handleCambioProveedor = (id: AiProviderId, campo: keyof AiProvider, valor: any) => {
    setProveedores(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, [campo]: valor };
      }
      return p;
    }));
  };

  // Cambio de asignación de asistente
  const handleCambioAsistente = (
    asistenteId: string, 
    campo: 'proveedorPrimarioId' | 'modeloPrimarioId' | 'proveedorRespaldoId' | 'modeloRespaldoId',
    valor: string
  ) => {
    setAsistentes(prev => prev.map(a => {
      if (a.asistenteId === asistenteId) {
        const actualizado = { ...a, [campo]: valor };
        // Si cambió el proveedor, asignar el primer modelo disponible de ese proveedor
        if (campo === 'proveedorPrimarioId') {
          const prov = proveedores.find(p => p.id === valor);
          if (prov && prov.modelos.length > 0) {
            actualizado.modeloPrimarioId = prov.modelos[0].id;
          }
        }
        if (campo === 'proveedorRespaldoId') {
          const prov = proveedores.find(p => p.id === valor);
          if (prov && prov.modelos.length > 0) {
            actualizado.modeloRespaldoId = prov.modelos[0].id;
          }
        }
        return actualizado;
      }
      return a;
    }));
  };

  // Probar modelo de un proveedor
  const handleProbarModelo = async (prov: AiProvider, modeloId: string) => {
    const testKey = `${prov.id}::${modeloId}`;
    setProbandoModeloKey(testKey);

    const keyFinal = apiKeysInput[prov.id] !== undefined ? apiKeysInput[prov.id] : prov.apiKey;

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: prov.id,
          modelId: modeloId,
          baseUrl: prov.baseUrl,
          apiKey: keyFinal
        })
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setResultadoPrueba(prev => ({
          ...prev,
          [testKey]: {
            ok: true,
            latenciaMs: data.latenciaMs || 150,
            tokens: data.tokens || 12,
            mensaje: `OK (${data.latenciaMs}ms, ${data.tokens || 12} fichas)`
          }
        }));
      } else {
        setResultadoPrueba(prev => ({
          ...prev,
          [testKey]: {
            ok: false,
            latenciaMs: data.latenciaMs || 0,
            tokens: 0,
            mensaje: data.error || 'Fallo de conexión'
          }
        }));
      }
    } catch (err: any) {
      setResultadoPrueba(prev => ({
        ...prev,
        [testKey]: {
          ok: false,
          latenciaMs: 0,
          tokens: 0,
          mensaje: err.message || 'Error de red'
        }
      }));
    } finally {
      setProbandoModeloKey(null);
    }
  };

  // Agregar nuevo modelo
  const handleAgregarNuevoModelo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAgregarModeloProvId || !nuevoModeloForm.id || !nuevoModeloForm.label) return;

    aiService.agregarModelo(
      modalAgregarModeloProvId,
      nuevoModeloForm.id.trim(),
      nuevoModeloForm.label.trim(),
      nuevoModeloForm.description.trim() || 'Modelo personalizado'
    );

    setModalAgregarModeloProvId(null);
    setNuevoModeloForm({ id: '', label: '', description: '' });
  };

  // Eliminar modelo
  const handleEliminarModelo = async (provId: AiProviderId, modeloId: string) => {
    const confirmado = await confirmar({
      titulo: 'Eliminar modelo',
      mensaje: `¿Deseas eliminar el modelo ${modeloId}?`,
      textoConfirmar: 'Eliminar'
    });
    if (!confirmado) return;
    aiService.eliminarModelo(provId, modeloId);
  };

  // Métricas de logs
  const totalTokensConsumidos = useMemo(() => logs.reduce((acc, l) => acc + (l.tokens || 0), 0), [logs]);
  const llamadasExitosas = useMemo(() => logs.filter(l => l.exito).length, [logs]);
  const tasaExito = useMemo(() => logs.length > 0 ? Math.round((llamadasExitosas / logs.length) * 100) : 100, [logs, llamadasExitosas]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#1F2937] p-6 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-8 -translate-y-8 pointer-events-none">
          <Cpu className="w-64 h-64 text-white" />
        </div>
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold text-emerald-200 border border-white/10">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Capa Única de Orquestación de IA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Proveedores y Modelos de Inteligencia Artificial
          </h2>
          <p className="text-xs text-stone-200 leading-relaxed">
            Centraliza todas las llamadas del sistema. Define el proveedor principal y de respaldo para cada asistente, administra claves API de forma protegida y prueba la latencia y consumo de fichas.
          </p>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Proveedores Activos</span>
          <div className="text-xl font-black text-stone-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-emerald-600" />
            <span>{proveedores.filter(p => p.activado).length} / {proveedores.length}</span>
          </div>
          <span className="text-[10px] text-stone-400 block">Google Gemini predeterminado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Modelo Activo Principal</span>
          <div className="text-sm font-black text-emerald-700 truncate flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="truncate">gemini-3.8-flash</span>
          </div>
          <span className="text-[10px] text-emerald-600 font-semibold block">Ultra Rápido</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Fichas / Tokens Usados</span>
          <div className="text-xl font-black text-stone-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-500" />
            <span>{totalTokensConsumidos.toLocaleString()}</span>
          </div>
          <span className="text-[10px] text-stone-400 block">Total histórico acumulado</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
          <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Tasa de Disponibilidad</span>
          <div className="text-xl font-black text-stone-900 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{tasaExito}%</span>
          </div>
          <span className="text-[10px] text-stone-400 block">Con respaldo automático active</span>
        </div>
      </div>

      {guardadoExitosa && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold rounded-2xl flex items-center gap-2 shadow-2xs animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Configuración de proveedores y modelos de IA guardada con éxito en el servidor.</span>
        </div>
      )}

      {/* SECCIÓN 1: SELECCIÓN ACTIVA DE ASISTENTES Y RESPALDO */}
      <form onSubmit={handleGuardarProveedores} className="space-y-6">
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <span>Asignación de Modelos por Asistente</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Selecciona el proveedor y modelo principal para cada función del sistema, así como un modelo de respaldo si el primero falla.
              </p>
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Configuración</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {asistentes.map(asist => {
              const provPrim = proveedores.find(p => p.id === asist.proveedorPrimarioId) || proveedores[0];
              const provResp = proveedores.find(p => p.id === asist.proveedorRespaldoId) || proveedores[0];

              return (
                <div key={asist.asistenteId} className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md inline-block">
                      {asist.asistenteId}
                    </span>
                    <h4 className="text-sm font-black text-stone-900">{asist.nombre}</h4>
                    <p className="text-[11px] text-stone-500 leading-tight">{asist.descripcion}</p>
                  </div>

                  {/* Configuración Primaria */}
                  <div className="p-3 bg-white rounded-xl border border-stone-200 space-y-2">
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-600" />
                      Proveedor Principal
                    </span>
                    <div className="space-y-1.5">
                      <select
                        value={asist.proveedorPrimarioId}
                        onChange={(e) => handleCambioAsistente(asist.asistenteId, 'proveedorPrimarioId', e.target.value)}
                        className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs font-bold text-stone-800"
                      >
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {!p.activado ? '(Inactivo)' : ''}
                          </option>
                        ))}
                      </select>

                      <select
                        value={asist.modeloPrimarioId}
                        onChange={(e) => handleCambioAsistente(asist.asistenteId, 'modeloPrimarioId', e.target.value)}
                        className="w-full p-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800"
                      >
                        {provPrim.modelos.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.id} - {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Configuración Respaldo */}
                  <div className="p-3 bg-stone-100/80 rounded-xl border border-stone-200 space-y-2">
                    <span className="text-[10px] font-bold text-stone-600 uppercase tracking-wider block flex items-center gap-1">
                      <Shield className="w-3 h-3 text-amber-600" />
                      Proveedor de Respaldo (Failover)
                    </span>
                    <div className="space-y-1.5">
                      <select
                        value={asist.proveedorRespaldoId}
                        onChange={(e) => handleCambioAsistente(asist.asistenteId, 'proveedorRespaldoId', e.target.value)}
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs font-bold text-stone-800"
                      >
                        {proveedores.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {!p.activado ? '(Inactivo)' : ''}
                          </option>
                        ))}
                      </select>

                      <select
                        value={asist.modeloRespaldoId}
                        onChange={(e) => handleCambioAsistente(asist.asistenteId, 'modeloRespaldoId', e.target.value)}
                        className="w-full p-2 bg-white border border-stone-200 rounded-lg text-xs text-stone-800"
                      >
                        {provResp.modelos.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.id} - {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SECCIÓN 2: REGISTRO DE PROVEEDORES Y SUS MODELOS */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-base font-black text-stone-900 flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-600" />
                <span>Registro de Proveedores de IA</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Configura URL base, claves API seguras y modelos compatibles. Las claves se guardan solo en servidor y muestran máscara de seguridad.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {proveedores.map((prov) => {
              const esVerClave = verApiKey[prov.id] || false;
              const tieneClaveConfigurada = prov.apiKey || apiKeysInput[prov.id];

              return (
                <div 
                  key={prov.id}
                  className={`p-5 rounded-2xl border transition-all space-y-4 ${
                    prov.activado 
                      ? 'bg-white border-stone-200 shadow-2xs' 
                      : 'bg-stone-50/80 border-stone-200/60 opacity-85'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                        prov.activado ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                      }`}>
                        {prov.id === 'gemini' ? 'G' : prov.id === 'openai' ? 'OA' : prov.id === 'anthropic' ? 'AN' : prov.id === 'openrouter' ? 'OR' : 'LOC'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-stone-900">{prov.nombre}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            prov.activado ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                          }`}>
                            {prov.activado ? 'Activado' : 'Desactivado'}
                          </span>
                        </div>
                        <span className="text-[11px] text-stone-400 block font-mono">{prov.baseUrl}</span>
                      </div>
                    </div>

                    {/* Toggle de activado */}
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <label className="text-xs font-bold text-stone-600 cursor-pointer flex items-center gap-2">
                        <span>{prov.activado ? 'Habilitado' : 'Deshabilitado'}</span>
                        <input
                          type="checkbox"
                          checked={prov.activado}
                          onChange={(e) => handleCambioProveedor(prov.id, 'activado', e.target.checked)}
                          className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Campos de configuración */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1">
                        URL Base de la API
                      </label>
                      <input
                        type="text"
                        value={prov.baseUrl}
                        onChange={(e) => handleCambioProveedor(prov.id, 'baseUrl', e.target.value)}
                        className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800"
                        placeholder="https://..."
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-stone-700 block mb-1 flex items-center justify-between">
                        <span>API Key (Protegida)</span>
                        <span className="text-[10px] font-normal text-stone-400">
                          {tieneClaveConfigurada ? '•••• Configurada' : 'No configurada'}
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={esVerClave ? 'text' : 'password'}
                          value={apiKeysInput[prov.id] !== undefined ? apiKeysInput[prov.id] : (prov.apiKey ? '••••••••••••••••' : '')}
                          onChange={(e) => setApiKeysInput({ ...apiKeysInput, [prov.id]: e.target.value })}
                          placeholder={prov.apiKey ? '••••••••••••••••' : 'Ingresa la API Key de ' + prov.nombre}
                          className="w-full p-2.5 pr-10 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800"
                        />
                        <button
                          type="button"
                          onClick={() => setVerApiKey({ ...verApiKey, [prov.id]: !esVerClave })}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                        >
                          {esVerClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Lista de Modelos del Proveedor */}
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-stone-700 uppercase tracking-wider block">
                        Modelos de {prov.nombre} ({prov.modelos.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => setModalAgregarModeloProvId(prov.id)}
                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar Modelo</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {prov.modelos.map((m) => {
                        const testKey = `${prov.id}::${m.id}`;
                        const probando = probandoModeloKey === testKey;
                        const resPrueba = resultadoPrueba[testKey];

                        return (
                          <div 
                            key={m.id}
                            className="p-3 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2 relative group hover:border-emerald-300 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono text-[11px] font-bold text-stone-900 block truncate" title={m.id}>
                                  {m.id}
                                </span>
                                <span className="text-[11px] font-bold text-emerald-700 block">
                                  {m.label}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleEliminarModelo(prov.id, m.id)}
                                className="text-stone-300 hover:text-rose-600 p-1 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Eliminar modelo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <p className="text-[10px] text-stone-500 leading-tight">
                              {m.description}
                            </p>

                            <div className="pt-2 flex items-center justify-between border-t border-stone-200/60">
                              <button
                                type="button"
                                onClick={() => handleProbarModelo(prov, m.id)}
                                disabled={probando}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                  probando
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                                }`}
                              >
                                {probando ? (
                                  <>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Probando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3 h-3 fill-current" />
                                    <span>Probar</span>
                                  </>
                                )}
                              </button>

                              {resPrueba && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                                  resPrueba.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {resPrueba.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  <span>{resPrueba.mensaje}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3">
            <button
              type="submit"
              className="px-6 py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Todos los Cambios de IA</span>
            </button>
          </div>
        </div>
      </form>

      {/* SECCIÓN 3: KPIS, MONITOREO DE COSTOS Y REGISTRO HISTÓRICO DE LLAMADAS */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-600" />
              <span>Consumo de Tokens, Costos y Registro Histórico</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Monitoreo en tiempo real de consultas ejecutadas, acumulación mensual de fichas y estimación de costos por proveedor.
            </p>
          </div>
          <button
            type="button"
            onClick={() => aiService.limpiarLogs()}
            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer self-start sm:self-auto"
          >
            Limpiar Registro
          </button>
        </div>

        {/* 4 TARJETAS DE KPIS PRINCIPALES SOBRE LAS LLAMADAS A LA IA */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Card 1: Total Llamadas */}
          <div className="bg-gradient-to-br from-[#F8FAF8] to-[#EAF5EE] border border-emerald-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Total Llamadas IA</span>
              <div className="w-7 h-7 rounded-lg bg-[#1B4332] text-white flex items-center justify-center">
                <Activity className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-stone-900 tracking-tight">{kpisLogs.total}</div>
              <p className="text-[11px] text-emerald-700 font-bold mt-0.5">{kpisLogs.tasaExito}% tasa de éxito (200 OK)</p>
            </div>
          </div>

          {/* Card 2: Tokens Este Mes */}
          <div className="bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7]/40 border border-amber-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Tokens (Este Mes)</span>
              <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center">
                <Zap className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-amber-900 tracking-tight">{kpisLogs.tokensEsteMes.toLocaleString()}</div>
              <p className="text-[11px] text-amber-700 font-medium mt-0.5">{kpisLogs.totalTokensHistoricos.toLocaleString()} tokens históricos</p>
            </div>
          </div>

          {/* Card 3: Latencia Promedio */}
          <div className="bg-gradient-to-br from-[#F8FAFC] to-[#EEF2FF] border border-indigo-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Latencia Promedio</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-indigo-900 tracking-tight">{kpisLogs.latenciaPromedio} ms</div>
              <p className="text-[11px] text-indigo-700 font-medium mt-0.5">Tiempo promedio de respuesta</p>
            </div>
          </div>

          {/* Card 4: Costo Estimado */}
          <div className="bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE]/60 border border-purple-200/80 rounded-2xl p-4 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-600">Costo Estimado Mes</span>
              <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-purple-900 tracking-tight">{kpisLogs.costoEstUsd}</div>
              <p className="text-[11px] text-purple-700 font-bold mt-0.5">Equivalente aprox: {kpisLogs.costoEstPen}</p>
            </div>
          </div>
        </div>

        {/* TABLA DE CÁLCULO ACUMULATIVO DE TOKENS POR MES */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-emerald-700" />
              <span>Consumo Acumulado de Tokens por Mes (Monitoreo de Costos)</span>
            </h4>
            <span className="text-[10px] font-semibold text-stone-400">Calculado sobre la capa única de IA</span>
          </div>

          {consumoPorMes.length === 0 ? (
            <div className="text-xs text-stone-400 py-3 text-center">Sin actividad registrada.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
              {consumoPorMes.map(m => {
                const costoUsd = m.tokens * 0.0000002;
                const costoPen = costoUsd * 3.75;

                return (
                  <div key={m.clave} className="p-3.5 bg-stone-50 border border-stone-200/80 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-900">{m.etiqueta}</span>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        {m.tokens.toLocaleString()} tokens
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-stone-200/60">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Llamadas</span>
                        <strong className="text-stone-800 font-mono">{m.llamadas}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-400 block">Costo Est.</span>
                        <strong className="text-emerald-800 font-mono">
                          {costoUsd < 0.01 ? '< $0.01' : `$${costoUsd.toFixed(4)}`}
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* REGISTRO HISTÓRICO CON FILTRO RÁPIDO POR PROVEEDOR */}
        <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-stone-100">
            <div>
              <h3 className="text-sm sm:text-base font-black text-stone-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>Registro Histórico de Llamadas a la IA</span>
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {logsFiltrados.length} de {logs.length} consultas registradas
              </p>
            </div>

            {/* FILTROS RÁPIDOS POR PROVEEDOR Y BÚSQUEDA */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl overflow-x-auto max-w-full">
                <button
                  type="button"
                  onClick={() => setFiltroProveedorId('todos')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    filtroProveedorId === 'todos' ? 'bg-white text-stone-900 shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  Todos
                </button>
                {proveedores.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setFiltroProveedorId(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      filtroProveedorId === p.id ? 'bg-[#1B4332] text-white shadow-2xs' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {p.nombre}
                  </button>
                ))}
              </div>

              {/* Búsqueda por texto */}
              <div className="relative shrink-0">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar modelo o asistente..."
                  value={filtroBusqueda}
                  onChange={(e) => setFiltroBusqueda(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-[#1B4332] w-36 sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* TABLA DE LOGS */}
          {logsFiltrados.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs font-semibold">
              No hay registros que coincidan con el filtro seleccionado.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-[11px] font-extrabold uppercase text-stone-500">
                    <th className="py-2.5 px-3">Fecha y Hora</th>
                    <th className="py-2.5 px-3">Asistente</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Modelo</th>
                    <th className="py-2.5 px-3">Tokens</th>
                    <th className="py-2.5 px-3">Latencia</th>
                    <th className="py-2.5 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {logsFiltrados.map((l) => (
                    <tr key={l.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-2.5 px-3 text-[11px] font-mono text-stone-500 whitespace-nowrap">
                        {new Date(l.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })},{' '}
                        {new Date(l.fecha).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-stone-900">{l.asistenteNombre || l.asistenteId}</td>
                      <td className="py-2.5 px-3 font-semibold text-stone-700">
                        <span className="px-2 py-0.5 bg-stone-100 border border-stone-200 rounded-md font-mono text-[11px]">
                          {l.proveedorNombre || l.proveedorId}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-stone-600">{l.modeloId}</td>
                      <td className="py-2.5 px-3 font-black text-amber-700">
                        {(l.tokens || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-stone-500">{l.latenciaMs} ms</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold inline-flex items-center gap-1 ${
                          l.exito
                            ? (l.esRespaldo ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200')
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {l.exito ? (l.esRespaldo ? 'Respaldo' : '200 OK') : 'Error'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL PARA AGREGAR MODELO PERSONALIZADO */}
      {modalAgregarModeloProvId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="text-base font-black text-stone-900">
                Agregar Modelo a {proveedores.find(p => p.id === modalAgregarModeloProvId)?.nombre}
              </h3>
              <button
                type="button"
                onClick={() => setModalAgregarModeloProvId(null)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAgregarNuevoModelo} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Identificador Exacto del Modelo (ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. gpt-4o-2024-08-06 o llama-3-70b"
                  value={nuevoModeloForm.id}
                  onChange={(e) => setNuevoModeloForm({ ...nuevoModeloForm, id: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Etiqueta Visible
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. Recomendado / Ultra Rápido"
                  value={nuevoModeloForm.label}
                  onChange={(e) => setNuevoModeloForm({ ...nuevoModeloForm, label: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Descripción Corta
                </label>
                <input
                  type="text"
                  placeholder="ej. Modelo optimizado para alta frecuencia"
                  value={nuevoModeloForm.description}
                  onChange={(e) => setNuevoModeloForm({ ...nuevoModeloForm, description: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAgregarModeloProvId(null)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Guardar Modelo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
