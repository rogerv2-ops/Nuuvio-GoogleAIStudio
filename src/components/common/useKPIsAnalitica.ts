/**
 * Hook de los KPIs del panel.
 *
 * Los KPIs se miden en el servidor (`GET /api/analitica/kpis`) porque es el
 * unico que puede ver la base. Antes se calculaban en el navegador con
 * `coreEvents` (eventos EN MEMORIA) y con minimos inventados: el panel
 * mostraba 240 usuarios y 625 vistas con la base vacia.
 *
 * El hook hace las dos cosas que hay que hacer juntas:
 *  1. pedir los KPIs al montar (con la sesion ya activa), y
 *  2. re-renderizar cuando el modulo avisa que cambio.
 *
 * Los valores que no se pueden medir vienen como `null`: la pantalla
 * muestra "sin medir". Un numero inventado es peor que un hueco.
 */
import { useEffect, useState } from 'react';
import { analiticaModule, GlobalKPIs, MerchantKPIs } from '../../modules/analitica';

export function useKPIsAnalitica(comercioId?: string): {
  globales: GlobalKPIs | null;
  comercio: MerchantKPIs | null;
  version: number;
} {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsub = analiticaModule.suscribir(() => setVersion(v => v + 1));
    void analiticaModule.recargar(comercioId);
    return () => unsub();
  }, [comercioId]);

  return {
    globales: analiticaModule.obtenerKPIsGlobales(),
    comercio: comercioId ? analiticaModule.obtenerKPIsComercio(comercioId) : null,
    version,
  };
}

/** Un numero medido, o "—" cuando no se puede medir. */
export function numeroMedido(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return '—';
  return valor.toLocaleString('es-PE');
}
