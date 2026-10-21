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
import { BienvenidaView } from './components/BienvenidaView';
import { UserRegistrationFunnelModal } from './components/UserRegistrationFunnelModal';
import { coreConfig } from './core/config';
import { coreSecurity } from './core/security';
import { useFondoLanding } from './hooks/useFondoLanding';
import { comerciosModule } from './modules/comercios';
import { vistaComoModule } from './modules/vistaComo';
import { ofertasModule } from './modules/ofertas';
import { seoMetadataModule } from './modules/seoMetadata';
import { sincronizarVersionConServidor } from './utils/resourceVersion';

// Detección inicial de ruta /gestion, /panel, /comercio o /bienvenida (soporta pathname, hash y query)
function obtenerSuperficieDesdeUrl(): ActiveSurface {
  if (typeof window === 'undefined') return 'web';
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  const search = window.location.search.toLowerCase();

  if (
    path === '/bienvenida' ||
    path.startsWith('/bienvenida/') ||
    hash === '#bienvenida' ||
    hash === '#/bienvenida' ||
    hash.startsWith('#/bienvenida') ||
    hash.startsWith('#bienvenida') ||
    search.includes('verify_token=') ||
    search.includes('token=') ||
    search.includes('vista=bienvenida')
  ) {
    return 'bienvenida';
  }

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

/**
 * URL canonica de cada superficie: la que debe quedar en la barra de
 * direcciones cuando NO hay sesion.
 *
 * Sin esto, al cerrar sesion en el panel de gestion la URL se quedaba
 * clavada en la sub-ruta interna (por ejemplo `/gestion/usuarios/lista`),
 * de modo que cualquier persona que mirara la barra de direcciones veía
 * una ruta de administracion. Ahora, al perder la sesion, la URL vuelve a
 * la superficie publica.
 */
function urlPublicaDeSuperficie(s: ActiveSurface): string {
  if (s === 'comercio') return '/comercio';
  if (s === 'bienvenida') return '/bienvenida';
  return '/';
}

export default function App() {
  const [superficieActiva, setSuperficieActiva] = useState<ActiveSurface>(obtenerSuperficieDesdeUrl);
  const fondoLanding = useFondoLanding();
  const [ofertaSeleccionadaId, setOfertaSeleccionadaId] = useState<string | null>(null);
  const [modalRegistroAbierto, setModalRegistroAbierto] = useState(false);
  const [, setTick] = useState(0);
  const [vistaComoId, setVistaComoId] = useState<string | null>(vistaComoModule.obtener());

  // "Entrar como comercio" (admin): la senal llega desde la vista de comercios del panel de gestion.
  useEffect(() => vistaComoModule.suscribir(() => {
    const id = vistaComoModule.obtener();
    setVistaComoId(id);
    setSuperficieActiva(id ? 'comercio' : 'gestion');
  }), []);

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
        } else if (s === 'bienvenida') {
          window.history.pushState({ superficie: 'bienvenida' }, '', '/bienvenida');
        } else {
          window.history.pushState({ superficie: 'web' }, '', '/');
        }
      }
    } catch {
      // Si la URL no puede ser reescrita en el entorno de iframe, usar hash como fallback seguro
      if (s === 'gestion') window.location.hash = '#/gestion';
      else if (s === 'comercio') window.location.hash = '#comercio';
      else if (s === 'bienvenida') window.location.hash = '#bienvenida';
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
    sincronizarVersionConServidor();
    seoMetadataModule.inicializar();
    void coreSecurity.validarSesionConServidor();
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

  // Si la sesion se pierde sola (expira, 401, cierre en otra pestana), la
  // URL no debe seguir en una sub-ruta interna de gestion. Se sube a la
  // entrada canonica de la superficie, que es la que muestra el login.
  useEffect(() => {
    if (superficieActiva !== 'gestion') return;
    if (tieneAccesoGestion) return;
    try {
      if (typeof window === 'undefined' || !window.history) return;
      const actual = window.location.pathname.toLowerCase();
      if (actual === '/gestion' || actual === '/panel' || actual === '/') return;
      window.history.replaceState({ superficie: 'gestion' }, '', '/gestion');
    } catch {
      /* noop */
    }
  }, [superficieActiva, tieneAccesoGestion]);

  return (
    <div
      className={`min-h-screen text-[#1C1917] font-sans antialiased selection:bg-[#D8F3DC] selection:text-[#1B4332] ${
        superficieActiva === 'web' ? '' : 'bg-[#FBF9F4]'
      }`}
      style={superficieActiva === 'web' ? { backgroundColor: fondoLanding } : undefined}
    >
      {/* Universal Top Navigation Header */}
      <NavigationHeader
        superficieActiva={superficieActiva}
        alCambiarSuperficie={cambiarSuperficie}
        usuarioNombre={sesion?.nombre}
        sesion={sesion}
        onCerrarSesion={() => {
          coreSecurity.cerrarSesion();
          // Al cerrar sesion la URL NO debe seguir mostrando una ruta
          // interna de gestion (`/gestion/usuarios/lista`): se devuelve a
          // la superficie publica. Sin esto, la ruta interna queda a la
          // vista de cualquiera que mire la barra de direcciones.
          const destino = urlPublicaDeSuperficie(superficieActiva);
          try {
            if (typeof window !== 'undefined' && window.history) {
              window.history.replaceState({ superficie: destino }, '', destino);
            } else if (typeof window !== 'undefined') {
              window.location.hash = '';
            }
          } catch {
            /* noop */
          }
          if (superficieActiva === 'comercio') {
            // el panel de comercio muestra su propio login en /comercio
          } else if (superficieActiva !== 'web') {
            cambiarSuperficie('web');
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

        {superficieActiva === 'bienvenida' && (
          <BienvenidaView
            onVolverAWeb={() => cambiarSuperficie('web')}
            onAbrirRegistro={() => setModalRegistroAbierto(true)}
          />
        )}

        {superficieActiva === 'comercio' && (
          (tieneAccesoComercio || vistaComoId) ? (
            <MerchantPanel entrarComoId={vistaComoId} />
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

      {/* Modal universal de registro (para aperturas desde Bienvenida restringida o accesos directos) */}
      <UserRegistrationFunnelModal
        isOpen={modalRegistroAbierto}
        onClose={() => setModalRegistroAbierto(false)}
        onSuccess={() => {
          setModalRegistroAbierto(false);
          cambiarSuperficie('web');
        }}
      />
    </div>
  );
}
