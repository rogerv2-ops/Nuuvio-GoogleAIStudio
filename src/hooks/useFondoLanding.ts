import { useEffect, useState } from 'react';
import { bannersModule, FONDO_LANDING_DEFAULT } from '../modules/banners';

/**
 * Color de fondo configurado para la landing.
 *
 * El color vive en el servidor (app_settings.landing_fondo) y se configura en
 * la seccion de Banners, debajo del logo. Este hook se suscribe al modulo para
 * que el cambio se vea al instante, sin recargar.
 */
export function useFondoLanding(): string {
  const [fondo, setFondo] = useState<string>(() => bannersModule.obtenerFondo() || FONDO_LANDING_DEFAULT);

  useEffect(() => {
    const desuscribir = bannersModule.suscribir(() => {
      setFondo(bannersModule.obtenerFondo() || FONDO_LANDING_DEFAULT);
    });
    return () => desuscribir();
  }, []);

  return fondo;
}
