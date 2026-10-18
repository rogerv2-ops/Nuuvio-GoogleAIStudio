import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, Gift, Search, Filter, CheckCircle2, AlertCircle, 
  Phone, Mail, MapPin, Tag, Award, ArrowUpRight, X, Plus, 
  ExternalLink, Sparkles, RefreshCw, ShieldCheck, Trash2, Check
} from 'lucide-react';
import { usuariosModule } from '../../../modules/usuarios';
import { puntosModule } from '../../../modules/puntos';
import { AudienceUser } from '../../../types';
import { DISTRITOS_LIMA } from '../../../data/seedData';
import { RegistrationAuditLogTable } from '../components/RegistrationAuditLogTable';

interface UsuariosDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const UsuariosDomainView: React.FC<UsuariosDomainViewProps> = ({ subruta, onNavegar }) => {
  const [version, setVersion] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroDistrito, setFiltroDistrito] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'pendiente' | 'baja'>('todos');
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<AudienceUser | null>(null);

  // Modal de confirmación para purgar usuario sin dejar rastros
  const [usuarioPurgaConfirmar, setUsuarioPurgaConfirmar] = useState<AudienceUser | null>(null);
  const [purgando, setPurgando] = useState(false);

  // Modal para acreditar puntos manuales
  const [modalAcreditarPuntos, setModalAcreditarPuntos] = useState(false);
  const [formPuntos, setFormPuntos] = useState({
    usuarioId: '',
    cantidad: 20,
    motivo: 'ajuste_gestion' as const
  });
  const [notificacion, setNotificacion] = useState<string | null>(null);

  useEffect(() => {
    const unsubU = usuariosModule.suscribir(() => setVersion(v => v + 1));
    const unsubP = puntosModule.suscribir(() => setVersion(v => v + 1));
    return () => {
      unsubU();
      unsubP();
    };
  }, []);

  const usuarios = useMemo(() => usuariosModule.listarUsuarios(), [version]);
  const recompensas = useMemo(() => puntosModule.listarRecompensas(), [version]);

  const esLista = subruta === '/gestion/usuarios/lista';
  const esPuntos = subruta === '/gestion/usuarios/puntos-referidos';
  const esAuditoria = subruta === '/gestion/usuarios/auditoria';
  const esResumen = !esLista && !esPuntos && !esAuditoria;

  // Filtrado de usuarios
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const q = busqueda.toLowerCase().trim();
      const cumpleBusqueda = !q || 
        u.nombre.toLowerCase().includes(q) ||
        (u.apellido && u.apellido.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        (u.telefono && u.telefono.toLowerCase().includes(q)) ||
        (u.codigoRef && u.codigoRef.toLowerCase().includes(q));

      const cumpleDistrito = filtroDistrito === 'todos' || u.distrito === filtroDistrito;
      const cumpleEstado = filtroEstado === 'todos' || u.estado === filtroEstado;

      return cumpleBusqueda && cumpleDistrito && cumpleEstado;
    });
  }, [usuarios, busqueda, filtroDistrito, filtroEstado]);

  // Manejador de acreditación manual de puntos
  const handleAcreditarPuntosSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPuntos.usuarioId || formPuntos.cantidad <= 0) return;

    puntosModule.acreditarPuntos({
      usuarioId: formPuntos.usuarioId,
      cantidad: Number(formPuntos.cantidad),
      motivo: 'ajuste_gestion'
    });

    const user = usuarios.find(u => u.id === formPuntos.usuarioId);
    setNotificacion(`Se acreditaron ${formPuntos.cantidad} puntos a ${user?.nombre || 'usuario'}.`);
    setModalAcreditarPuntos(false);
    setFormPuntos({ usuarioId: '', cantidad: 20, motivo: 'ajuste_gestion' });

    setTimeout(() => setNotificacion(null), 4000);
  };

  const handleConfirmarPurga = async () => {
    if (!usuarioPurgaConfirmar) return;
    try {
      setPurgando(true);
      const res = await usuariosModule.eliminarYPurgarUsuario(
        usuarioPurgaConfirmar.id,
        usuarioPurgaConfirmar.email,
        usuarioPurgaConfirmar.telefono
      );
      setNotificacion(`✅ ${res.mensaje}`);
      setUsuarioSeleccionado(null);
      setUsuarioPurgaConfirmar(null);
      setVersion(v => v + 1);
      setTimeout(() => setNotificacion(null), 5000);
    } catch (err: any) {
      setNotificacion(`❌ Error al purgar usuario: ${err.message || err}`);
    } finally {
      setPurgando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subnavegación de Sección */}
      <div className="flex items-center gap-1.5 border-b border-stone-200 pb-3 overflow-x-auto">
        <button
          onClick={() => onNavegar('/gestion/usuarios')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            esResumen ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Vista General
        </button>
        <button
          onClick={() => onNavegar('/gestion/usuarios/lista')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            esLista ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Directorio de Usuarios ({usuarios.length})
        </button>
        <button
          onClick={() => onNavegar('/gestion/usuarios/puntos-referidos')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer ${
            esPuntos ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          Programa de Puntos
        </button>
        <button
          onClick={() => onNavegar('/gestion/usuarios/auditoria')}
          className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5 ${
            esAuditoria ? 'bg-[#1B4332] text-white' : 'text-stone-600 hover:bg-stone-100'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Log de Auditoría (Registros)</span>
        </button>
      </div>

      {notificacion && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2 animate-in fade-in shadow-xs">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notificacion}</span>
        </div>
      )}

      {/* 1. VISTA RESUMEN KPIs */}
      {esResumen && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Usuarios</span>
              <span className="text-2xl font-black text-stone-900 mt-1 block">{usuarios.length}</span>
              <span className="text-[10px] text-emerald-700 font-semibold mt-1 block">Registrados en la comunidad</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Correos Verificados</span>
              <span className="text-2xl font-black text-emerald-700 mt-1 block">
                {usuarios.filter(u => u.emailVerificado).length}
              </span>
              <span className="text-[10px] text-stone-400 font-medium mt-1 block">
                {usuarios.length > 0 ? Math.round((usuarios.filter(u => u.emailVerificado).length / usuarios.length) * 100) : 0}% de tasa de conversión
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Pendientes Verificación</span>
              <span className="text-2xl font-black text-amber-700 mt-1 block">
                {usuarios.filter(u => !u.emailVerificado).length}
              </span>
              <span className="text-[10px] text-amber-700/80 font-medium mt-1 block">Con enlace enviado por correo</span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Puntos Acumulados</span>
              <span className="text-2xl font-black text-purple-700 mt-1 block">
                {usuarios.reduce((acc, u) => acc + (u.puntosSaldo || 0), 0)} pts
              </span>
              <span className="text-[10px] text-purple-600/80 font-medium mt-1 block">Programa de referidos activo</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. TAB DE LOG DE AUDITORÍA */}
      {(esAuditoria || esResumen) && (
        <RegistrationAuditLogTable />
      )}

      {/* 3. LISTA DE USUARIOS (Con Ficha Individual) */}
      {(esLista || esResumen) && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Directorio de Usuarios ({usuariosFiltrados.length})
              </h3>
              <p className="text-xs text-stone-400">
                Haz clic en cualquier usuario para abrir su Ficha Individual o eliminarlo para pruebas
              </p>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email, ref..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <select
                value={filtroDistrito}
                onChange={(e) => setFiltroDistrito(e.target.value)}
                className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              >
                <option value="todos">Todos los distritos</option>
                {DISTRITOS_LIMA.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as any)}
                className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
              >
                <option value="todos">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="pendiente">Pendientes</option>
                <option value="baja">Bajas</option>
              </select>
            </div>
          </div>

          {/* Tabla de Usuarios */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">Usuario</th>
                  <th className="pb-2.5">Contacto / Teléfono</th>
                  <th className="pb-2.5">Distrito</th>
                  <th className="pb-2.5">Estado</th>
                  <th className="pb-2.5">Cód. Ref</th>
                  <th className="pb-2.5">Puntos</th>
                  <th className="pb-2.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {usuariosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400 text-xs">
                      No se encontraron usuarios con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  usuariosFiltrados.map(user => (
                    <tr 
                      key={user.id} 
                      onClick={() => setUsuarioSeleccionado(user)}
                      className="hover:bg-stone-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 font-semibold text-stone-900">
                        <div>
                          <span>{user.nombre} {user.apellido || ''}</span>
                          <span className="block text-[11px] text-stone-400 font-normal truncate max-w-[150px]">{user.email}</span>
                        </div>
                      </td>
                      <td className="py-3 text-stone-600 font-mono text-[11px]">
                        {user.telefono || '—'}
                      </td>
                      <td className="py-3 text-stone-600">
                        {user.distrito || '—'}
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          user.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : user.estado === 'pendiente'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {user.estado}
                        </span>
                      </td>
                      <td className="py-3 font-mono font-bold text-stone-700">
                        {user.codigoRef}
                      </td>
                      <td className="py-3 font-bold text-purple-700">
                        {user.puntosSaldo || 0} pts
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUsuarioSeleccionado(user);
                            }}
                            className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[11px] font-semibold cursor-pointer"
                          >
                            Ficha
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setUsuarioPurgaConfirmar(user);
                            }}
                            title="Eliminar usuario y purgar todos sus rastros (para pruebas)"
                            className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Borrar</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. PUNTOS Y REFERIDOS */}
      {esPuntos && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-purple-600" />
                  <span>Programa Viral de Puntos y Recompensas</span>
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Reglas de gamificación: 50 puntos por referido registrado.
                </p>
              </div>

              <button
                onClick={() => setModalAcreditarPuntos(true)}
                className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Acreditar Puntos Manuales</span>
              </button>
            </div>

            {/* Ranking de Referidos */}
            <div className="pt-2">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                Top Usuarios por Saldo de Puntos
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {usuarios
                  .slice()
                  .sort((a, b) => (b.puntosSaldo || 0) - (a.puntosSaldo || 0))
                  .slice(0, 3)
                  .map((top, idx) => (
                    <div key={top.id} className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                          #{idx + 1}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-stone-800 block">{top.nombre} {top.apellido}</span>
                          <span className="text-[10px] text-stone-400 font-mono">{top.codigoRef}</span>
                        </div>
                      </div>
                      <span className="text-sm font-black text-purple-700">{top.puntosSaldo || 0} pts</span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Catálogo de Recompensas */}
            <div className="pt-4 border-t border-stone-100">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2.5">
                Catálogo de Recompensas Activas
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {recompensas.map(rew => (
                  <div key={rew.id} className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 space-y-1.5">
                    <div className="flex items-start justify-between">
                      <span className="text-xs font-bold text-stone-900">{rew.titulo}</span>
                      <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                        {rew.puntosRequeridos} pts
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">{rew.descripcion}</p>
                    <div className="flex items-center justify-between text-[10px] text-stone-400 pt-1">
                      <span>Stock: {rew.stock}</span>
                      <span>{rew.distrito}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FICHA INDIVIDUAL DE USUARIO */}
      {usuarioSeleccionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                  Ficha Individual de Usuario
                </span>
                <h3 className="text-lg font-black text-stone-900 mt-1">
                  {usuarioSeleccionado.nombre} {usuarioSeleccionado.apellido}
                </h3>
                <p className="text-xs text-stone-400 font-mono">ID: {usuarioSeleccionado.id}</p>
              </div>
              <button
                onClick={() => setUsuarioSeleccionado(null)}
                className="p-1.5 hover:bg-stone-100 rounded-xl text-stone-400 hover:text-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-3.5 rounded-2xl border border-stone-200/70">
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Teléfono / WhatsApp</span>
                <span className="font-mono font-semibold text-stone-800">{usuarioSeleccionado.telefono}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Correo Electrónico</span>
                <span className="font-semibold text-stone-800 truncate block">{usuarioSeleccionado.email}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Verificación de Correo</span>
                <span className={`font-bold ${usuarioSeleccionado.emailVerificado ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {usuarioSeleccionado.emailVerificado ? 'Verificado (1 clic)' : 'Pendiente de verificación'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Ubicación</span>
                <span className="font-semibold text-stone-800">{usuarioSeleccionado.distrito}, {usuarioSeleccionado.ciudad}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Código de Referido</span>
                <span className="font-mono font-bold text-stone-800">{usuarioSeleccionado.codigoRef}</span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-bold block">Saldo de Puntos</span>
                <span className="font-bold text-purple-700">{usuarioSeleccionado.puntosSaldo || 0} pts</span>
              </div>
            </div>

            {/* Atribución UTM de Origen */}
            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200/70 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                Atribución de Registro (UTM)
              </span>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div><span className="text-stone-400">Origen (Source):</span> <strong className="text-stone-800">{usuarioSeleccionado.utm?.source || 'Orgánico / Directo'}</strong></div>
                <div><span className="text-stone-400">Medio (Medium):</span> <strong className="text-stone-800">{usuarioSeleccionado.utm?.medium || 'N/A'}</strong></div>
                <div><span className="text-stone-400">Campaña:</span> <strong className="text-stone-800">{usuarioSeleccionado.utm?.campaign || 'N/A'}</strong></div>
                <div><span className="text-stone-400">Invitado por:</span> <strong className="text-stone-800">{usuarioSeleccionado.invitadoPor || 'Sin referido'}</strong></div>
              </div>
            </div>

            {/* Categorías de Interés */}
            <div>
              <span className="text-xs font-bold text-stone-700 block mb-1.5">Categorías de Interés:</span>
              <div className="flex flex-wrap gap-1.5">
                {usuarioSeleccionado.categoriasInteres.map(cat => (
                  <span key={cat} className="px-2 py-0.5 bg-stone-100 text-stone-700 text-xs rounded-lg font-medium">
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-stone-100 gap-2">
              <button
                type="button"
                onClick={() => setUsuarioPurgaConfirmar(usuarioSeleccionado)}
                className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Trash2 className="w-4 h-4" />
                <span>Borrar Usuario y Limpiar Rastros</span>
              </button>

              <button
                onClick={() => setUsuarioSeleccionado(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONFIRMAR PURGA COMPLETA DE USUARIO */}
      {usuarioPurgaConfirmar && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-start gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-2xl shrink-0">
                <Trash2 className="w-6 h-6 text-rose-700" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">¿Borrar Usuario y Limpiar Rastros?</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Reset total de cuenta para pruebas del flujo de registro.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 text-xs space-y-1.5">
              <div><span className="text-stone-500 font-semibold">Usuario:</span> <strong className="text-stone-900">{usuarioPurgaConfirmar.nombre} {usuarioPurgaConfirmar.apellido || ''}</strong></div>
              <div><span className="text-stone-500 font-semibold">Correo:</span> <strong className="text-stone-900">{usuarioPurgaConfirmar.email}</strong></div>
              <div><span className="text-stone-500 font-semibold">WhatsApp:</span> <strong className="text-stone-900">{usuarioPurgaConfirmar.telefono || 'Sin teléfono'}</strong></div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Esta función elimina la cuenta de PostgreSQL, borra el historial de correos enviados (`email_logs`), elimina los registros en la auditoría de registro (`registration_logs`) y limpia la sesión en el navegador (`localStorage`). El correo y número quedarán <strong>completamente libres</strong> para volver a probar el flujo de registro sin errores de duplicidad.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                disabled={purgando}
                onClick={() => setUsuarioPurgaConfirmar(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={purgando}
                onClick={handleConfirmarPurga}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {purgando ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Purgando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Sí, Borrar sin Dejar Rastros</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ACREDITAR PUNTOS MANUALES */}
      {modalAcreditarPuntos && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleAcreditarPuntosSubmit}
            className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4"
          >
            <div className="flex items-start justify-between">
              <h3 className="text-base font-black text-stone-900">Acreditar Puntos</h3>
              <button
                type="button"
                onClick={() => setModalAcreditarPuntos(false)}
                className="p-1 hover:bg-stone-100 rounded-lg text-stone-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Seleccionar Usuario</label>
                <select
                  required
                  value={formPuntos.usuarioId}
                  onChange={(e) => setFormPuntos({ ...formPuntos, usuarioId: e.target.value })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                >
                  <option value="">Selecciona un usuario...</option>
                  {usuarios.map(u => (
                    <option key={u.id} value={u.id}>{u.nombre} {u.apellido || ''} ({u.codigoRef})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Cantidad de Puntos</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={formPuntos.cantidad}
                  onChange={(e) => setFormPuntos({ ...formPuntos, cantidad: Number(e.target.value) })}
                  className="w-full p-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setModalAcreditarPuntos(false)}
                className="px-3.5 py-2 bg-stone-100 text-stone-700 text-xs font-semibold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl"
              >
                Acreditar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
