/**
 * Utilidad de control de versiones y cache-busting de recursos estáticos y banners.
 * Garantiza que los usuarios vean siempre la última versión actualizada de assets en cualquier navegador.
 */

let versionActual: string = typeof window !== 'undefined'
  ? (localStorage.getItem('vuuy_resource_version') || `${Date.now()}`)
  : `${Date.now()}`;

let listeners: ((version: string) => void)[] = [];

export function obtenerVersionRecursos(): string {
  return versionActual;
}

export function suscribirCambioVersion(listener: (version: string) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}

function notificar(nuevaVersion: string) {
  versionActual = nuevaVersion;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('vuuy_resource_version', nuevaVersion);
    } catch {}
  }
  listeners.forEach(l => l(nuevaVersion));
}

/**
 * Añade o actualiza el parámetro de versión (?v=...) para forzar la recarga del recurso
 */
export function withResourceVersion(url: string | undefined | null, customVersion?: string): string {
  if (!url) return '';
  // Data URLs y blob URLs no llevan cache-busting
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const v = customVersion || versionActual;
  try {
    // Si ya tiene un parámetro ?v= o &v=, reemplazarlo
    if (/[?&]v=[^&#]*/.test(url)) {
      return url.replace(/([?&]v=)[^&#]*/, `$1${v}`);
    }
    const separador = url.includes('?') ? '&' : '?';
    return `${url}${separador}v=${v}`;
  } catch {
    return url;
  }
}

/**
 * Consulta la versión actual del servidor al iniciar la app
 */
export async function sincronizarVersionConServidor(): Promise<string> {
  if (typeof window === 'undefined') return versionActual;
  try {
    const res = await fetch(`/api/version?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version && data.version !== versionActual) {
        notificar(data.version);
        return data.version;
      }
    }
  } catch (err) {
    console.warn('[ResourceVersion] No se pudo verificar versión del servidor:', err);
  }
  return versionActual;
}

/**
 * Limpia todas las cachés locales y en el servidor:
 * 1. Pide al servidor generar una nueva versión de despliegue (invalida assets)
 * 2. Borra las CacheStorage del navegador (caches API)
 * 3. Actualiza el token de versión y notifica a los componentes
 */
export async function purgarTodasLasCaches(): Promise<{ ok: boolean; version: string; mensaje: string }> {
  let nuevaVersion = `${Date.now()}`;

  // 1. Invalidar en el servidor
  try {
    const res = await fetch('/api/cache/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.version) {
        nuevaVersion = data.version;
      }
    }
  } catch (err) {
    console.warn('[ResourceVersion] Error llamando a /api/cache/purge:', err);
  }

  // 2. Limpiar CacheStorage del navegador si existe
  if (typeof window !== 'undefined' && 'caches' in window) {
    try {
      const keys = await window.caches.keys();
      await Promise.all(keys.map(key => window.caches.delete(key)));
    } catch (e) {
      console.warn('[ResourceVersion] Error borrando window.caches:', e);
    }
  }

  // 3. Limpiar sessionStorage
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
    } catch {}
  }

  // 4. Actualizar versión local
  notificar(nuevaVersion);

  // 5. Emitir evento global
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vuuy:cache-purged', { detail: { version: nuevaVersion } }));
  }

  return {
    ok: true,
    version: nuevaVersion,
    mensaje: 'Caché purgada exitosamente en servidor y navegador'
  };
}
