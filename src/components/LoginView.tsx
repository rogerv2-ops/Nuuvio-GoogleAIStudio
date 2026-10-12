import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Store, Lock, Mail, Eye, EyeOff, 
  ArrowLeft, AlertCircle, ShieldAlert, Clock
} from 'lucide-react';
import { coreSecurity, AuthSession } from '../core/security';

interface LoginViewProps {
  superficie: 'gestion' | 'comercio';
  onLoginExitoso: (sesion: AuthSession) => void;
  onVolverAWeb: () => void;
  onCambiarSuperficie?: (superficie: 'gestion' | 'comercio') => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  superficie,
  onLoginExitoso,
  onVolverAWeb
}) => {
  const esGestion = superficie === 'gestion';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [segundosBloqueo, setSegundosBloqueo] = useState<number>(0);

  // Monitor de bloqueo de seguridad por fuerza bruta
  useEffect(() => {
    const checkBloqueo = () => {
      const estado = coreSecurity.obtenerEstadoBloqueo();
      if (estado.bloqueado) {
        setSegundosBloqueo(estado.segundosRestantes);
      } else {
        setSegundosBloqueo(0);
      }
    };

    checkBloqueo();
    const intervalo = setInterval(checkBloqueo, 1000);
    return () => clearInterval(intervalo);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (segundosBloqueo > 0) return;

    setError(null);
    setCargando(true);

    setTimeout(() => {
      const resultado = coreSecurity.iniciarSesion(email, password);
      setCargando(false);

      if (!resultado.ok) {
        setError(resultado.error || 'Credenciales de acceso incorrectas.');
        if (resultado.bloqueado && resultado.segundosRestantes) {
          setSegundosBloqueo(resultado.segundosRestantes);
        }
        return;
      }

      // Validar si la cuenta posee los permisos necesarios
      if (esGestion && resultado.sesion?.rol !== 'admin') {
        setError('Esta cuenta no cuenta con permisos de Administrador para acceder a esta consola.');
        coreSecurity.cerrarSesion();
        return;
      }

      if (resultado.sesion) {
        onLoginExitoso(resultado.sesion);
      }
    }, 350);
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#FBF9F4]">
      <div className="w-full max-w-md bg-white rounded-3xl border border-[#EAE5D9] shadow-xl shadow-stone-200/60 overflow-hidden">
        {/* Banner Superior */}
        <div className={`p-6 text-white ${esGestion ? 'bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0F172A]' : 'bg-gradient-to-br from-[#1B4332] via-[#2D6A4F] to-[#1B4332]'}`}>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={onVolverAWeb}
              className="flex items-center gap-1.5 text-xs text-white/80 hover:text-white transition-colors bg-white/10 px-3 py-1.5 rounded-xl hover:bg-white/20"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Web</span>
            </button>
            <span className="text-[11px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-white/15 text-white/90">
              {esGestion ? 'Acceso Restringido' : 'Acceso Comercios'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner">
              {esGestion ? (
                <ShieldCheck className="w-6 h-6 text-emerald-300" />
              ) : (
                <Store className="w-6 h-6 text-emerald-200" />
              )}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">
                {esGestion ? 'Panel de Administración' : 'Panel de Comercio'}
              </h1>
              <p className="text-xs text-stone-200">
                {esGestion 
                  ? 'Consola central de gestión y control de la plataforma' 
                  : 'Portal de ofertas, analítica y canjes'}
              </p>
            </div>
          </div>
        </div>

        {/* Cuerpo del Formulario */}
        <div className="p-6 sm:p-7 space-y-5">
          {/* Alerta de Bloqueo por Fuerza Bruta si aplica */}
          {segundosBloqueo > 0 ? (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-amber-800 text-xs flex items-start gap-3 animate-fadeIn">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Acceso bloqueado por seguridad</p>
                <p className="text-amber-700 leading-relaxed">
                  Se ha detectado múltiples intentos no válidos. Por protocolo de seguridad, este terminal está temporalmente bloqueado.
                </p>
                <div className="flex items-center gap-1.5 font-mono font-bold text-amber-900 pt-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Tiempo restante: {segundosBloqueo} segundos</span>
                </div>
              </div>
            </div>
          ) : error ? (
            /* Alerta de Error genérica estándar */
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          ) : null}

          {/* Formulario de Login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  disabled={segundosBloqueo > 0}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={esGestion ? 'admin@plataforma.pe' : 'comercio@tuempresa.pe'}
                  className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-medium placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={mostrarPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={segundosBloqueo > 0}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-medium placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {mostrarPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando || segundosBloqueo > 0}
              className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                esGestion 
                  ? 'bg-[#0F172A] hover:bg-[#1E293B] shadow-slate-900/10' 
                  : 'bg-[#1B4332] hover:bg-[#2D6A4F] shadow-emerald-900/10'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {cargando ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Ingresar al Sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Medidas de Seguridad Estándar Informativas */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Autenticación segura
            </span>
            <span>Protección contra fuerza bruta activa</span>
          </div>
        </div>
      </div>
    </div>
  );
};
