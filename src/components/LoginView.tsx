import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Store, Lock, Mail, Eye, EyeOff, 
  ArrowLeft, AlertCircle, ShieldAlert, Clock, KeyRound, CheckCircle2
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

  // Flujo de recuperación de contraseña por correo
  const [resetPaso, setResetPaso] = useState<0 | 1 | 2>(0);
  const [resetEmail, setResetEmail] = useState('');
  const [resetCodigo, setResetCodigo] = useState('');
  const [resetNueva, setResetNueva] = useState('');
  const [resetMostrarPass, setResetMostrarPass] = useState(false);
  const [resetCargando, setResetCargando] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const [mfaPaso, setMfaPaso] = useState(false);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCodigo, setMfaCodigo] = useState('');

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (segundosBloqueo > 0) return;

    setError(null);
    setCargando(true);

    const resultado = await coreSecurity.iniciarSesion(email, password);
    setCargando(false);

    if (resultado.mfaRequerido && resultado.mfaToken) {
      setMfaToken(resultado.mfaToken);
      setMfaCodigo('');
      setMfaPaso(true);
      setError(null);
      return;
    }

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

    // El panel de comercio es solo para usuarios de comercio: el admin entra por el panel de gestion.
    if (!esGestion && resultado.sesion?.rol === 'admin') {
      coreSecurity.cerrarSesion();
      setError('Credenciales de acceso incorrectas.');
      return;
    }

    if (resultado.sesion) {
      onLoginExitoso(resultado.sesion);
    }
  };

  const cancelarMfa = () => {
    setMfaPaso(false);
    setMfaToken(null);
    setMfaCodigo('');
    setError(null);
  };

  const handleSubmitMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setCargando(true);
    const resultado = await coreSecurity.verificarMfa(mfaToken, mfaCodigo);
    setCargando(false);
    if (!resultado.ok) {
      setError(resultado.error || 'Código de verificación incorrecto.');
      return;
    }
    if (esGestion && resultado.sesion?.rol !== 'admin') {
      setError('Esta cuenta no cuenta con permisos de Administrador para acceder a esta consola.');
      coreSecurity.cerrarSesion();
      return;
    }
    // El panel de comercio es solo para usuarios de comercio: el admin entra por el panel de gestion.
    if (!esGestion && resultado.sesion?.rol === 'admin') {
      coreSecurity.cerrarSesion();
      setError('Credenciales de acceso incorrectas.');
      return;
    }
    if (resultado.sesion) {
      onLoginExitoso(resultado.sesion);
    }
  };

  const abrirRecuperacion = () => {
    setResetEmail(email);
    setResetCodigo('');
    setResetNueva('');
    setResetError(null);
    setResetInfo(null);
    setResetPaso(1);
  };

  const cancelarRecuperacion = () => {
    setResetPaso(0);
    setResetError(null);
    setResetInfo(null);
  };

  const handleSolicitarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Ingresa el correo de tu cuenta.');
      return;
    }
    setResetError(null);
    setResetInfo(null);
    setResetCargando(true);
    const r = await coreSecurity.solicitarResetContrasena(resetEmail);
    setResetCargando(false);
    if (!r.ok) {
      setResetError(r.mensaje);
      return;
    }
    setResetInfo(r.mensaje);
    setResetPaso(2);
  };

  const handleConfirmarReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetInfo(null);
    setResetCargando(true);
    const r = await coreSecurity.confirmarResetContrasena(resetEmail, resetCodigo, resetNueva);
    setResetCargando(false);
    if (!r.ok) {
      setResetError(r.mensaje);
      return;
    }
    setResetInfo(r.mensaje);
    setEmail(resetEmail.trim().toLowerCase());
    setPassword('');
    setResetPaso(0);
  };

  const reenviarCodigo = async () => {
    setResetError(null);
    setResetInfo(null);
    setResetCargando(true);
    const r = await coreSecurity.solicitarResetContrasena(resetEmail);
    setResetCargando(false);
    if (!r.ok) {
      setResetError(r.mensaje);
      return;
    }
    setResetInfo('Código reenviado. Revisa tu correo.');
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

          {resetPaso > 0 ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={cancelarRecuperacion}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al inicio de sesión</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-800">Recuperar contraseña</h2>
                  <p className="text-[11px] text-stone-500">
                    {resetPaso === 1
                      ? 'Te enviaremos un código de verificación a tu correo.'
                      : 'Ingresa el código recibido y tu nueva contraseña.'}
                  </p>
                </div>
              </div>

              {resetError ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3.5 text-rose-700 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="flex-1 font-medium">{resetError}</div>
                </div>
              ) : resetInfo ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 text-emerald-700 text-xs flex items-start gap-2.5 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <div className="flex-1 font-medium">{resetInfo}</div>
                </div>
              ) : null}

              <form onSubmit={resetPaso === 1 ? handleSolicitarReset : handleConfirmarReset} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">Correo Electrónico</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      disabled={resetPaso === 2}
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="tu-correo@empresa.pe"
                      className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-medium placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all disabled:opacity-60"
                    />
                  </div>
                </div>

                {resetPaso === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Código de verificación</label>
                      <input
                        type="text"
                        required
                        inputMode="text"
                        autoComplete="one-time-code"
                        value={resetCodigo}
                        onChange={(e) => setResetCodigo(e.target.value.toUpperCase())}
                        placeholder="A1B2C3D4"
                        className="w-full px-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm tracking-[0.3em] text-center font-bold text-stone-900 placeholder:text-stone-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">Nueva Contraseña</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                          <Lock className="w-4 h-4" />
                        </div>
                        <input
                          type={resetMostrarPass ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={resetNueva}
                          onChange={(e) => setResetNueva(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full pl-10 pr-10 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-medium placeholder:text-stone-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setResetMostrarPass(!resetMostrarPass)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-stone-400 hover:text-stone-600 focus:outline-none"
                          tabIndex={-1}
                        >
                          {resetMostrarPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={resetCargando}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                    esGestion
                      ? 'bg-[#0F172A] hover:bg-[#1E293B] shadow-slate-900/10'
                      : 'bg-[#1B4332] hover:bg-[#2D6A4F] shadow-emerald-900/10'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {resetCargando ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{resetPaso === 1 ? 'Enviar código' : 'Restablecer contraseña'}</span>
                    </>
                  )}
                </button>
              </form>

              {resetPaso === 2 && (
                <button
                  type="button"
                  onClick={reenviarCodigo}
                  disabled={resetCargando}
                  className="w-full text-[11px] text-stone-500 hover:text-stone-800 transition-colors disabled:opacity-50"
                >
                  ¿No recibiste el código? Reenviar
                </button>
              )}
            </div>
          ) : mfaPaso ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={cancelarMfa}
                className="flex items-center gap-1.5 text-xs font-semibold text-stone-500 hover:text-stone-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver al inicio de sesión</span>
              </button>

              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-800">Verificación en dos pasos</h2>
                  <p className="text-[11px] text-stone-500">
                    Ingresa el código de 6 dígitos de tu app autenticadora o un código de respaldo.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmitMfa} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">Código de verificación</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    inputMode="text"
                    autoComplete="one-time-code"
                    value={mfaCodigo}
                    onChange={(e) => setMfaCodigo(e.target.value.toUpperCase())}
                    placeholder="123456"
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-lg tracking-[0.4em] text-center font-bold text-stone-900 placeholder:text-stone-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={cargando}
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
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Verificar</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (
          <>
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

            <div className="flex justify-end">
              <button
                type="button"
                onClick={abrirRecuperacion}
                disabled={segundosBloqueo > 0}
                className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-600 transition-colors disabled:opacity-50"
              >
                ¿Olvidaste tu contraseña?
              </button>
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
          </>
          )}
        </div>
      </div>
    </div>
  );
};
