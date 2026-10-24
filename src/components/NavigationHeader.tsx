import React, { useEffect, useState } from 'react';
import { Store, LogOut, Lock, ArrowLeft, Shield } from 'lucide-react';
import { AuthSession } from '../core/security';
import { bannersModule, LogoLanding, colorConAlfa } from '../modules/banners';
import { withResourceVersion } from '../utils/resourceVersion';

export type ActiveSurface = 'web' | 'comercio' | 'gestion' | 'bienvenida';

interface NavigationHeaderProps {
  superficieActiva: ActiveSurface;
  alCambiarSuperficie: (s: ActiveSurface) => void;
  usuarioNombre?: string;
  sesion?: AuthSession | null;
  onCerrarSesion?: () => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  superficieActiva,
  alCambiarSuperficie,
  sesion,
  onCerrarSesion
}) => {
  const esAdmin = sesion?.rol === 'admin';
  const esGestion = superficieActiva === 'gestion';

  // Logo configurado en la seccion de Banners. Si no hay, se mantiene el logo
  // por defecto (la "Y" + el nombre): nunca queda un hueco vacio en la cabecera.
  const [logo, setLogo] = useState<LogoLanding>(() => bannersModule.obtenerLogo());
  // PRUEBA VISUAL: header blanco/neon; fondo de app_settings conservado (revertible).

  useEffect(() => {
    bannersModule.sincronizarConServidor();
    const desuscribir = bannersModule.suscribir(() => {
      setLogo(bannersModule.obtenerLogo());
    });
    return () => desuscribir();
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur-md border-b transition-colors ${
        superficieActiva === 'web' ? 'border-white' : 'bg-[#FBF9F4]/95 border-[#EAE5D9]'
      }`}
      style={superficieActiva === 'web' ? { backgroundColor: colorConAlfa('#FFFFFF', 0.95) } : undefined}
    >
      <div className={`mx-auto flex items-center justify-between gap-3 ${
        superficieActiva === 'web'
          ? 'w-full max-w-[640px] px-3 sm:px-4 py-2.5'
          : 'max-w-7xl px-4 lg:px-8 py-2.5'
      }`}>
        {/* Brand & Tagline */}
        <div className="flex items-center gap-3">
          <div 
            className="flex items-center gap-2 cursor-pointer select-none group" 
            onClick={() => alCambiarSuperficie('web')}
          >
            {logo.imagenUrl ? (
              <img
                src={withResourceVersion(logo.imagenUrl)}
                alt="Yuddit"
                style={{ height: `${logo.altoPx}px` }}
                className="block w-auto max-w-[120px] sm:max-w-[200px] object-contain shrink-0"
              />
            ) : (
              <>
                <div className="w-9 h-9 rounded-xl bg-[#1B4332] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-[#2D6A4F] transition-colors">
                  Y
                </div>
                <div>
                  <span className="font-bold text-xl tracking-tight text-[#1C1917]">Yuddit</span>
                  <p className="text-[11px] text-[#78716C] leading-none hidden sm:block">Plataforma de ofertas locales · Lima</p>
                </div>
              </>
            )}
          </div>

          {/* Si estamos en el panel exclusivo de administración, mostrar distintivo */}
          {esGestion && (
            <div className="hidden md:flex items-center gap-1.5 ml-3 pl-3 border-l border-stone-300">
              <span className="flex items-center gap-1 bg-slate-900 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-lg shadow-xs">
                <Shield className="w-3 h-3 text-emerald-400" />
                Panel de Administración
              </span>
            </div>
          )}
        </div>

        {/* Acciones principales del Header */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Si estamos en Panel de Comercio o Panel de Administración, dar opción de volver al catálogo público */}
          {superficieActiva !== 'web' ? (
            <button
              onClick={() => alCambiarSuperficie('web')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 border border-[#EAE5D9] rounded-xl transition-all shadow-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver a la Web</span>
            </button>
          ) : (
            /* Botón Único de Panel de Comercio para la web pública */
            <button
              onClick={() => alCambiarSuperficie('comercio')}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all bg-[#1B4332] hover:bg-[#2D6A4F] text-white shadow-sm"
              title="Acceso para comercios y aliados"
            >
              <Store className="w-3.5 h-3.5 text-emerald-300" />
              <span>Panel de Comercio</span>
            </button>
          )}

          {/* Cápsula de Sesión Activa */}
          {sesion ? (
            <div className="flex items-center gap-2 bg-white border border-[#EAE5D9] px-2.5 py-1 rounded-xl shadow-xs text-xs">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                esAdmin ? 'bg-slate-900 text-white' : 'bg-emerald-100 text-emerald-800'
              }`}>
                {esAdmin ? 'A' : 'C'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-[11px] font-bold text-[#1C1917] leading-tight max-w-[130px] truncate">
                  {sesion.email}
                </span>
                <span className="text-[10px] text-emerald-700 leading-tight">
                  {esAdmin ? 'Super Administrador' : 'Comercio Aliado'}
                </span>
              </div>

              {onCerrarSesion && (
                <button
                  onClick={onCerrarSesion}
                  title="Cerrar sesión"
                  className="p-1 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ) : (
            superficieActiva !== 'web' && (
              <div className="flex items-center gap-1.5 bg-stone-100 text-stone-600 px-2.5 py-1 rounded-xl text-[11px]">
                <Lock className="w-3 h-3 text-stone-400" />
                <span className="hidden sm:inline">Sin sesión</span>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
};
