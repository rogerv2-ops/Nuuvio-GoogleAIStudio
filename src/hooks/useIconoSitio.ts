import { useEffect } from 'react';
import { bannersModule } from '../modules/banners';

const LINK_ID = 'yuddit-site-icon';

/**
 * Ícono del sitio (favicon) configurado en la sección de Banners.
 *
 * Escribe (o actualiza) el `<link rel="icon">` del documento para que la
 * pestaña del navegador muestre el ícono elegido por el admin. Si no hay
 * ícono configurado, se quita el link propio y el navegador usa su defecto.
 *
 * El ícono vive en el servidor (`app_settings.landing_logo.iconUrl`) junto al
 * logo de la landing; este hook se suscribe al módulo para que el cambio se
 * vea al instante, sin recargar la página.
 */
export function useIconoSitio(): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const aplicar = () => {
      const iconUrl = bannersModule.obtenerLogo().iconUrl || '';
      let link = document.getElementById(LINK_ID) as HTMLLinkElement | null;

      if (!iconUrl) {
        if (link) link.remove();
        return;
      }

      if (!link) {
        link = document.createElement('link');
        link.id = LINK_ID;
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = iconUrl;
    };

    aplicar();
    const desuscribir = bannersModule.suscribir(aplicar);
    return () => desuscribir();
  }, []);
}
