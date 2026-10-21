/**
 * Hook del saldo de clics.
 *
 * El saldo vive en la tabla `click_packs` y se lee por la API
 * (`GET /api/facturacion/packs`). Antes, el panel mostraba la semilla del
 * modulo: ni el comercio ni el admin veian su saldo real.
 *
 * El hook se encarga de las dos cosas que hay que hacer SIEMPRE juntas:
 *  1. pedir el saldo al montar (con la sesion ya activa), y
 *  2. re-renderizar cuando el modulo avisa que cambio.
 *
 * Sin el punto 2, la pantalla se queda con el valor que leyo al montar
 * aunque el saldo haya cambiado (por ejemplo, despues de un clic
 * facturable).
 */
import { useEffect, useState } from 'react';
import { facturacionModule } from '../../modules/facturacion';

/**
 * @returns el numero de version: se incrementa en cada recarga. Sirve como
 *          dependencia de `useMemo` para recalcular lo que dependa del saldo.
 */
export function useSaldoFacturacion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsub = facturacionModule.suscribir(() => setVersion(v => v + 1));
    void facturacionModule.recargarCache();
    return () => unsub();
  }, []);

  return version;
}
