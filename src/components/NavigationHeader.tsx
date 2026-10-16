import React from 'react';
import { Store, LogOut, Lock, ArrowLeft, Shield } from 'lucide-react';
import { AuthSession } from '../core/security';

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

  return (
    <header className="sticky top-0 z-50 bg-[#FBF9F4]/95 backdrop-blur-md border-b border-[#EAE5D9] transition-colors">
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
            <div className="w-9 h-9 rounded-xl bg-[#1B4332] text-white flex items-center justify-center font-bold text-lg shadow-sm group-hover:bg-[#2D6A4F] transition-colors">
              v
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl tracking-tight text-[#1C1917]">vuuy</span>
                <span className="text-xs text-[#2D6A4F] font-semibold bg-[#D8F3DC] px-2 py-0.5 rounded-full">Lima</span>
              </div>
              <p className="text-[11px] text-[#78716C] leading-none hidden sm:block">Plataforma de ofertas locales · Lima</p>
            </div>
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
