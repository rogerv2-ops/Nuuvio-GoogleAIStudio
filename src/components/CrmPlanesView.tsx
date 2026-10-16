import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Layers, Plus, CheckCircle2, AlertCircle, 
  ToggleLeft, ToggleRight, DollarSign, Store, ShoppingBag, 
  HelpCircle, Sparkles, Check, X, ShieldAlert, ArrowRight
} from 'lucide-react';
import { facturacionModule } from '../modules/facturacion';
import { comerciosModule } from '../modules/comercios';
import { coreConfig } from '../core/config';
import { ClickPack, Merchant } from '../types';

export const CrmPlanesView: React.FC = () => {
  const [version, setVersion] = useState(0);
  const [modalComprarPack, setModalComprarPack] = useState(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Formulario para recargar pack
  const [formPack, setFormPack] = useState({
    comercioId: '',
    cantidadClics: 100 as 50 | 100 | 500,
    metodoPago: 'yape_plin' as 'yape_plin' | 'transferencia' | 'aporte_productos',
    productoNombre: '',
    valorEstimado: 20,
    unidadesAportadas: 2
  });

  useEffect(() => {
    const unsubF = facturacionModule.suscribir(() => setVersion(v => v + 1));
    return () => unsubF();
  }, []);

  const packs: ClickPack[] = useMemo(() => {
    return facturacionModule.listarTodosLosPacks();
  }, [version]);

  const comercios: Merchant[] = useMemo(() => {
    return comerciosModule.listarComercios();
  }, []);

  const facturacionActiva = coreConfig.moduloActivo('campanasFacturacion');

  const handleToggleFacturacion = () => {
    coreConfig.alternarModulo('campanasFacturacion');
    setVersion(v => v + 1);
    setNotificacion(
      !facturacionActiva
        ? 'Facturación PPC Activada: El sistema ahora debitará saldo de clics en modo producción.'
        : 'Modo de Prueba Libre Activado (D12): Los comercios pueden recibir clics y prospectos sin bloqueos.'
    );
    setTimeout(() => setNotificacion(null), 4000);
  };

  const handleComprarPackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formPack.comercioId) return;

    facturacionModule.comprarPack({
      comercioId: formPack.comercioId,
      cantidadClics: formPack.cantidadClics,
      metodoPago: formPack.metodoPago,
      aporteProductos: formPack.metodoPago === 'aporte_productos' ? {
        productoNombre: formPack.productoNombre || 'Vale o Producto Comercial',
        valorEstimado: Number(formPack.valorEstimado),
        unidadesAportadas: Number(formPack.unidadesAportadas)
      } : undefined
    });

    setModalComprarPack(false);
    setNotificacion('¡Pack de clics activado y acreditado al comercio!');
    setTimeout(() => setNotificacion(null), 3500);
  };

  // KPIs de facturación
  const kpis = useMemo(() => {
    const clicsTotalesComprados = packs.reduce((acc, p) => acc + p.totalClics, 0);
    const saldoTotalDisponible = packs.reduce((acc, p) => acc + p.saldoClics, 0);
    const clicsConsumidos = clicsTotalesComprados - saldoTotalDisponible;
    const ingresosTotales = packs.reduce((acc, p) => acc + p.montoTotal, 0);

    return {
      clicsTotalesComprados,
      saldoTotalDisponible,
      clicsConsumidos,
      ingresosTotales: ingresosTotales.toFixed(2)
    };
  }, [packs]);

  return (
    <div className="space-y-6">
      {/* Banner de Notificación */}
      {notificacion && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notificacion}</span>
          </div>
          <button onClick={() => setNotificacion(null)} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Switch Maestro de Facturación PPC (Regla D12) */}
      <div className={`p-5 rounded-2xl border transition-all ${
        facturacionActiva 
          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900' 
          : 'bg-[#FBF9F4] border-[#EAE5D9] text-stone-900'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">Modelo de Facturación PPC (Packs de Clics)</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                facturacionActiva ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {facturacionActiva ? 'EN PRODUCCIÓN (Cobro Activo)' : 'MODO DE PRUEBA LIBRE (Regla D12)'}
              </span>
            </div>
            <p className="text-xs text-stone-600 max-w-2xl">
              {facturacionActiva
                ? 'El microkernel debita atómicamente cada clic facturable del saldo de cada comercio. Si el saldo llega a cero, el comercio queda pausado.'
                : 'Interruptor apagado por decisión administrativa: el sistema permite contactar a comercios libremente sin bloquearlos, registrando métricas estadísticas.'}
            </p>
          </div>

          <button
            type="button"
            onClick={handleToggleFacturacion}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer ${
              facturacionActiva 
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white' 
                : 'bg-stone-800 hover:bg-stone-900 text-white'
            }`}
          >
            {facturacionActiva ? (
              <>
                <ToggleRight className="w-4 h-4 text-emerald-300" />
                <span>Pausar Cobros (Modo Libre)</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4 text-stone-400" />
                <span>Activar Facturación PPC</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Packs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Clics Vendidos</span>
            <Layers className="w-4 h-4 text-stone-400" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            {kpis.clicsTotalesComprados}
          </div>
          <div className="text-[11px] text-stone-500">Volumen contratado en la red</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Saldo Disponible</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 font-mono tabular-nums leading-none mb-1">
            {kpis.saldoTotalDisponible}
          </div>
          <div className="text-[11px] text-stone-500">Clics listos para entrega</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Clics Consumidos</span>
            <CreditCard className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            {kpis.clicsConsumidos}
          </div>
          <div className="text-[11px] text-stone-500">Leads entregados por WhatsApp</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Ingresos por Packs</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            S/ {kpis.ingresosTotales}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">Recaudación acumulada</div>
        </div>
      </div>

      {/* Planes de Clics Disponibles (Pricing Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Pack 50 */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-stone-900">Pack Inicial</h4>
              <span className="text-xs font-bold bg-stone-100 text-stone-700 px-2.5 py-0.5 rounded-full">50 Clics</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-stone-900 font-mono">S/ 70</span>
              <span className="text-xs text-stone-500 ml-1">/ S/ 1.40 por lead</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Ideal para negocios que comienzan y desean probar el flujo de clientes calificados.
            </p>
          </div>
          <button
            onClick={() => {
              setFormPack({ ...formPack, cantidadClics: 50 });
              setModalComprarPack(true);
            }}
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors text-center"
          >
            Asignar Pack 50
          </button>
        </div>

        {/* Pack 100 (Recomendado) */}
        <div className="bg-white rounded-2xl p-5 border-2 border-[#166534] shadow-xs relative flex flex-col justify-between space-y-4">
          <span className="absolute -top-3 right-4 bg-[#166534] text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Más Popular
          </span>
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-[#166534]">Pack Crecimiento</h4>
              <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">100 Clics</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-stone-900 font-mono">S/ 120</span>
              <span className="text-xs text-stone-500 ml-1">/ S/ 1.20 por lead</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Tarifa estándar con mejor retorno de inversión y presencia continua en el feed de Lima.
            </p>
          </div>
          <button
            onClick={() => {
              setFormPack({ ...formPack, cantidadClics: 100 });
              setModalComprarPack(true);
            }}
            className="w-full py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl transition-colors text-center"
          >
            Asignar Pack 100
          </button>
        </div>

        {/* Pack 500 */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-stone-900">Pack Escala Pro</h4>
              <span className="text-xs font-bold bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full">500 Clics</span>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black text-stone-900 font-mono">S/ 500</span>
              <span className="text-xs text-stone-500 ml-1">/ S/ 1.00 por lead</span>
            </div>
            <p className="text-xs text-stone-500 mt-2">
              Tarifa mayorista para marcas con alto volumen y múltiples locales comerciales.
            </p>
          </div>
          <button
            onClick={() => {
              setFormPack({ ...formPack, cantidadClics: 500 });
              setModalComprarPack(true);
            }}
            className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors text-center"
          >
            Asignar Pack 500
          </button>
        </div>
      </div>

      {/* Tabla de Packs de Clics de la Red */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-sm text-stone-900">Historial de Packs Contratados</h4>
            <p className="text-xs text-stone-500">Saldos y control de paquetes asignados a cada comercio</p>
          </div>
          <button
            onClick={() => setModalComprarPack(true)}
            className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Asignar Nuevo Pack</span>
          </button>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-3.5">ID Pack</th>
                <th className="py-3 px-3.5">Comercio</th>
                <th className="py-3 px-3.5 text-center">Total Clics</th>
                <th className="py-3 px-3.5 text-center">Saldo Restante</th>
                <th className="py-3 px-3.5 text-right">Precio Unit.</th>
                <th className="py-3 px-3.5 text-right">Monto Total</th>
                <th className="py-3 px-3.5 text-center">Estado</th>
                <th className="py-3 px-3.5">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {packs.map((p) => {
                const comercio = comercios.find(c => c.id === p.comercioId);
                const porcentajeRestante = Math.round((p.saldoClics / p.totalClics) * 100);

                return (
                  <tr key={p.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3 px-3.5 font-mono text-stone-500 font-semibold">{p.id}</td>
                    <td className="py-3 px-3.5">
                      <div className="font-bold text-stone-900">{comercio?.nombreComercial || p.comercioId}</div>
                      <div className="text-[11px] text-stone-500">{comercio?.distrito || 'Lima'}</div>
                    </td>
                    <td className="py-3 px-3.5 text-center font-mono font-semibold">{p.totalClics}</td>
                    <td className="py-3 px-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 font-mono font-bold text-emerald-800">
                        <span>{p.saldoClics}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({porcentajeRestante}%)</span>
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-right font-mono text-stone-600">S/ {p.precioUnitario.toFixed(2)}</td>
                    <td className="py-3 px-3.5 text-right font-mono font-bold text-stone-900">S/ {p.montoTotal.toFixed(2)}</td>
                    <td className="py-3 px-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        p.estado === 'activo' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                      }`}>
                        {p.estado === 'activo' ? 'Activo' : 'Agotado'}
                      </span>
                    </td>
                    <td className="py-3 px-3.5 text-stone-500 font-mono text-[11px]">
                      {new Date(p.compradoEn).toLocaleDateString('es-PE')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Asignar / Recargar Pack */}
      {modalComprarPack && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-base text-stone-900">Asignar Pack de Clics PPC</h4>
              </div>
              <button
                onClick={() => setModalComprarPack(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleComprarPackSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Comercio Beneficiario
                </label>
                <select
                  required
                  value={formPack.comercioId}
                  onChange={(e) => setFormPack({ ...formPack, comercioId: e.target.value })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="">Selecciona un comercio...</option>
                  {comercios.map(c => (
                    <option key={c.id} value={c.id}>{c.nombreComercial} ({c.distrito})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Plan de Clics
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[50, 100, 500].map(cant => (
                    <button
                      key={cant}
                      type="button"
                      onClick={() => setFormPack({ ...formPack, cantidadClics: cant as 50 | 100 | 500 })}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        formPack.cantidadClics === cant 
                          ? 'border-[#166534] bg-emerald-50/60 text-[#166534] font-bold' 
                          : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-sm font-black font-mono">{cant}</div>
                      <div className="text-[10px] text-stone-500">clics</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Método de Pago
                </label>
                <select
                  value={formPack.metodoPago}
                  onChange={(e) => setFormPack({ ...formPack, metodoPago: e.target.value as any })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-700"
                >
                  <option value="yape_plin">Yape / Plin (Inmediato)</option>
                  <option value="transferencia">Transferencia Bancaria BCP/BBVA</option>
                  <option value="aporte_productos">Aporte de Productos (30% Descuento D12)</option>
                </select>
              </div>

              {formPack.metodoPago === 'aporte_productos' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="font-semibold text-amber-900 text-[11px] flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    <span>Canje por Aporte de Productos (Regla D12)</span>
                  </div>
                  <input
                    type="text"
                    placeholder="Descripción del producto (ej. 2 bowls acai)"
                    value={formPack.productoNombre}
                    onChange={(e) => setFormPack({ ...formPack, productoNombre: e.target.value })}
                    className="w-full p-2 text-xs bg-white border border-amber-300 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-amber-800">Valor Unit. (S/):</span>
                      <input
                        type="number"
                        value={formPack.valorEstimado}
                        onChange={(e) => setFormPack({ ...formPack, valorEstimado: Number(e.target.value) })}
                        className="w-full p-1.5 text-xs bg-white border border-amber-300 rounded-lg"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-800">Unidades:</span>
                      <input
                        type="number"
                        value={formPack.unidadesAportadas}
                        onChange={(e) => setFormPack({ ...formPack, unidadesAportadas: Number(e.target.value) })}
                        className="w-full p-1.5 text-xs bg-white border border-amber-300 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalComprarPack(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Acreditar Clics</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
