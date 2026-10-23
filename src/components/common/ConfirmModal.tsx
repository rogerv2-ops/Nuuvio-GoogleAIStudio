/**
 * Confirmacion modal compartida para las acciones destructivas del panel.
 *
 * Regla: ninguna accion que borre, vacie o restablezca datos usa la ventana
 * del navegador. `window.confirm` bloquea el hilo, se ve distinta en cada
 * navegador, no se puede estilar y en movil corta el texto largo. Todas las
 * confirmaciones pasan por aca, con el mismo estilo, para que el admin tenga
 * una sola forma de confirmar.
 *
 * Uso (siempre con `await`, ver el test que lo vigila):
 *
 *   const ok = await confirmar({
 *     titulo: 'Eliminar comercio',
 *     mensaje: `¿Eliminar definitivamente "${nombre}"?`
 *   });
 *   if (!ok) return;
 *
 * Si te olvidas del `await`, `confirmar(...)` devuelve una promesa (siempre
 * truthy) y la accion se ejecutaria SIN confirmacion. El test
 * `tests/security/confirmaciones-modales.test.ts` lo detecta.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

export interface OpcionesConfirmacion {
  /** Titulo corto: que se va a destruir. */
  titulo: string;
  /** La pregunta completa, con el dato concreto (nombre, correo, etc.). */
  mensaje: string;
  /** Texto del boton que ejecuta. Por defecto "Confirmar". */
  textoConfirmar?: string;
  /** Texto del boton que aborta. Por defecto "Cancelar". */
  textoCancelar?: string;
  /**
   * 'peligro' (rojo, por defecto): lo irreversible, se pierden datos.
   * 'aviso' (ambar): algo que se puede deshacer (por ejemplo reconectar).
   */
  tono?: 'peligro' | 'aviso';
}

interface ConfirmacionPendiente extends OpcionesConfirmacion {
  resolver: (valor: boolean) => void;
}

let pendiente: ConfirmacionPendiente | null = null;
let hostsMontados = 0;
const oyentes = new Set<(p: ConfirmacionPendiente | null) => void>();

function avisarOyentes(): void {
  for (const oyente of oyentes) oyente(pendiente);
}

/**
 * Abre la confirmacion y resuelve `true` solo si la persona confirma.
 *
 * Cierra en falso: si nadie monto el host, NUNCA resuelve `true`. Una accion
 * destructiva no puede ejecutarse sin confirmacion, asi que ante la duda se
 * cancela. El error se registra para que el fallo sea visible y no un boton
 * que parece no hacer nada.
 */
export function confirmar(opciones: OpcionesConfirmacion): Promise<boolean> {
  if (hostsMontados === 0) {
    console.error(
      '[ConfirmModal] No hay <ConfirmModalHost /> montado: la accion destructiva NO se ejecuto.'
    );
    return Promise.resolve(false);
  }

  // Una sola confirmacion a la vez: si habia otra abierta, se cancela.
  pendiente?.resolver(false);

  return new Promise<boolean>((resolver) => {
    pendiente = { ...opciones, resolver };
    avisarOyentes();
  });
}

/**
 * Monta el modal. Va UNA sola vez, en la raiz de la aplicacion (`App.tsx`).
 * Confirmar sin host montado no borra nada (ver `confirmar`).
 */
export function ConfirmModalHost() {
  const [estado, setEstado] = useState<ConfirmacionPendiente | null>(pendiente);
  const refCancelar = useRef<HTMLButtonElement | null>(null);

  const cerrar = useCallback((valor: boolean) => {
    const actual = pendiente;
    pendiente = null;
    avisarOyentes();
    actual?.resolver(valor);
  }, []);

  useEffect(() => {
    hostsMontados += 1;
    const oyente = (p: ConfirmacionPendiente | null) => setEstado(p);
    oyentes.add(oyente);
    setEstado(pendiente);

    return () => {
      hostsMontados -= 1;
      oyentes.delete(oyente);
      // Si el host se desmonta con una confirmacion abierta, se cancela:
      // nunca se resuelve en `true` por accidente.
      cerrar(false);
    };
  }, [cerrar]);

  // Escape cancela. Nunca confirma.
  useEffect(() => {
    if (!estado) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(false);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [estado, cerrar]);

  // El foco arranca en Cancelar: Enter no debe borrar por accidente.
  useEffect(() => {
    if (estado) refCancelar.current?.focus();
  }, [estado]);

  if (!estado) return null;

  const esPeligro = (estado.tono ?? 'peligro') === 'peligro';

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
      onClick={() => cerrar(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
        aria-describedby="confirmacion-mensaje"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95"
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-2xl shrink-0 ${
              esPeligro ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h3 id="confirmacion-titulo" className="text-base font-black text-stone-900">
              {estado.titulo}
            </h3>
            <p
              id="confirmacion-mensaje"
              className="text-xs text-stone-600 leading-relaxed break-words"
            >
              {estado.mensaje}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            ref={refCancelar}
            type="button"
            onClick={() => cerrar(false)}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            {estado.textoCancelar ?? 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => cerrar(true)}
            className={`px-4 py-2 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              esPeligro ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {estado.textoConfirmar ?? 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}
