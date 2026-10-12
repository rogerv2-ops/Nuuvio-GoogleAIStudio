/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useCallback } from 'react';
import { NavigationHeader, ActiveSurface } from './components/NavigationHeader';
import { PublicWeb } from './components/PublicWeb';
import { MerchantPanel } from './components/MerchantPanel';
import { AdminPanel } from './components/AdminPanel';
import { LoginView } from './components/LoginView';
import { coreConfig } from './core/config';
import { coreSecurity } from './core/security';
import { comerciosModule } from './modules/comercios';
import { ofertasModule } from './modules/ofertas';
import { seoMetadataModule } from './modules/seoMetadata';

// Detección inicial de ruta /gestion, /panel o /comercio (soporta pathname y hash)
function obtenerSuperficieDesdeUrl(): ActiveSurface {
  if (typeof window === 'undefined') return 'web';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();

  if (
    path === '/panel' ||
    path === '/gestion' ||
    path.startsWith('/gestion/') ||
    hash === '#panel' ||
    hash === '#/panel' ||
    hash === '#gestion' ||
    hash === '#/gestion' ||
    hash.startsWith('#/gestion/') ||
    hash.startsWith('#gestion/')
  ) {
    return 'gestion';
  }
  if (
    path === '/comercio' ||
    path.startsWith('/comercio/') ||
    hash === '#comercio' ||
    hash === '#/comercio' ||
    hash.startsWith('#/comercio/') ||
    hash.startsWith('#comercio/')
  ) {
    return 'comercio';
  }
  return 'web';
}

export default function App() {
  const [superficieActiva, setSuperficieActiva] = useState<ActiveSurface>(obtenerSuperficieDesdeUrl);
  const [ofertaSeleccionadaId, setOfertaSeleccionadaId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Sincronizar superficie activa con la URL del navegador
  const cambiarSuperficie = useCallback((s: ActiveSurface) => {
    setSuperficieActiva(s);
    if (s !== 'web') setOfertaSeleccionadaId(null);

    try {
      if (typeof window !== 'undefined' && window.history) {
        if (s === 'gestion') {
          window.history.pushState({ superficie: 'gestion' }, '', '/gestion');
        } else if (s === 'comercio') {
          window.history.pushState({ superficie: 'comercio' }, '', '/comercio');
        } else {
          window.history.pushState({ superficie: 'web' }, '', '/');
        }
      }
    } catch {
      // Si la URL no puede ser reescrita en el entorno de iframe, usar hash como fallback seguro
      if (s === 'gestion') window.location.hash = '#/gestion';
      else if (s === 'comercio') window.location.hash = '#comercio';
      else window.location.hash = '';
    }
  }, []);

  // Escuchar eventos de navegación del navegador (atrás/adelante y cambio de hash)
  useEffect(() => {
    const handlePopState = () => {
      setSuperficieActiva(obtenerSuperficieDesdeUrl());
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, []);

  // Escuchar cambios reactivos en los módulos del microkernel
  useEffect(() => {
    seoMetadataModule.inicializar();
    const forzarActualizacion = () => setTick(t => t + 1);
    const unConfig = coreConfig.suscribir(forzarActualizacion);
    const unSecurity = coreSecurity.suscribir(forzarActualizacion);
    const unComercios = comerciosModule.suscribir(forzarActualizacion);
    const unOfertas = ofertasModule.suscribir(forzarActualizacion);
    const unSeo = seoMetadataModule.suscribir(forzarActualizacion);

    return () => {
      unConfig();
      unSecurity();
      unComercios();
      unOfertas();
      unSeo();
    };
  }, []);

  const sesion = coreSecurity.getSesionActual();
  const tieneAccesoGestion = coreSecurity.tieneAcceso('gestion');
  const tieneAccesoComercio = coreSecurity.tieneAcceso('comercio');

  return (
    <div className="min-h-screen bg-[#FBF9F4] text-[#1C1917] font-sans antialiased selection:bg-[#D8F3DC] selection:text-[#1B4332]">
      {/* Universal Top Navigation Header */}
      <NavigationHeader
        superficieActiva={superficieActiva}
        alCambiarSuperficie={cambiarSuperficie}
        usuarioNombre={sesion?.nombre}
        sesion={sesion}
        onCerrarSesion={() => {
          coreSecurity.cerrarSesion();
          // Si estaba en gestión, volver a login o a la web pública
          if (superficieActiva === 'gestion') {
            // Se mantiene en /panel mostrando el formulario de login de gestión
          }
        }}
      />

      {/* Main Surface Viewport */}
      <main className="w-full">
        {superficieActiva === 'web' && (
          <div className="w-full max-w-[640px] mx-auto">
            <PublicWeb
              ofertaSeleccionadaId={ofertaSeleccionadaId}
              onLimpiarOfertaSeleccionada={() => setOfertaSeleccionadaId(null)}
            />
          </div>
        )}

        {superficieActiva === 'comercio' && (
          tieneAccesoComercio ? (
            <MerchantPanel />
          ) : (
            <LoginView
              superficie="comercio"
              onLoginExitoso={() => {}}
              onVolverAWeb={() => cambiarSuperficie('web')}
              onCambiarSuperficie={(s) => cambiarSuperficie(s)}
            />
          )
        )}

        {superficieActiva === 'gestion' && (
          tieneAccesoGestion ? (
            <AdminPanel />
          ) : (
            <LoginView
              superficie="gestion"
              onLoginExitoso={() => {}}
              onVolverAWeb={() => cambiarSuperficie('web')}
              onCambiarSuperficie={(s) => cambiarSuperficie(s)}
            />
          )
        )}
      </main>
    </div>
  );
}
