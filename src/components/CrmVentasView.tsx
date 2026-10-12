import React, { useState, useMemo, useEffect } from 'react';
import { 
  DollarSign, ShoppingCart, CheckCircle2, Search, Plus, 
  Calendar, Building2, Tag, ArrowUpRight, Check, X, Store,
  FileText, Sparkles, Filter, RefreshCw
} from 'lucide-react';
import { clicsAtribucionModule } from '../modules/clics';
import { comerciosModule } from '../modules/comercios';
import { ofertasModule } from '../modules/ofertas';
import { ConfirmedSale, Merchant, Offer } from '../types';

export const CrmVentasView: React.FC = () => {
  const [version, setVersion] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [comercioFiltro, setComercioFiltro] = useState<string>('todos');
  const [modalNuevaVenta, setModalNuevaVenta] = useState(false);
  const [notificacion, setNotificacion] = useState<string | null>(null);

  // Formulario para registrar venta manual
  const [formVenta, setFormVenta] = useState({
    codigoPersonal: '',
    comercioId: '',
    montoVenta: 45
  });
  const [errorVenta, setErrorVenta] = useState<string | null>(null);

  useEffect(() => {
    const unsubClics = clicsAtribucionModule.suscribir(() => setVersion(v => v + 1));
    return () => unsubClics();
  }, []);

  const ventas: ConfirmedSale[] = useMemo(() => {
    return clicsAtribucionModule.listarTodasLasVentas();
  }, [version]);

  const comercios: Merchant[] = useMemo(() => {
    return comerciosModule.listarComercios();
  }, []);

  const ofertas: Offer[] = useMemo(() => {
    return ofertasModule.listarOfertas();
  }, []);

  // KPIs de Ventas
  const kpis = useMemo(() => {
    const totalVentas = ventas.length;
    const montoTotal = ventas.reduce((acc, v) => acc + (v.montoVenta || 0), 0);
    const ticketPromedio = totalVentas > 0 ? (montoTotal / totalVentas).toFixed(2) : '0.00';
    const comerciosConVentas = new Set(ventas.map(v => v.comercioId)).size;

    return {
      totalVentas,
      montoTotal: montoTotal.toFixed(2),
      ticketPromedio,
      comerciosConVentas
    };
  }, [ventas]);

  // Filtrado de ventas
  const ventasFiltradas = useMemo(() => {
    return ventas.filter(v => {
      const cumpleComercio = comercioFiltro === 'todos' || v.comercioId === comercioFiltro;
      const comercio = comercios.find(c => c.id === v.comercioId);
      const oferta = ofertas.find(o => o.id === v.ofertaId);
      const query = busqueda.toLowerCase();

      const cumpleBusqueda = !busqueda || 
        v.codigoPersonal.toLowerCase().includes(query) ||
        (comercio?.nombreComercial.toLowerCase().includes(query)) ||
        (oferta?.titulo.toLowerCase().includes(query));

      return cumpleComercio && cumpleBusqueda;
    });
  }, [ventas, comercioFiltro, busqueda, comercios, ofertas]);

  const handleConfirmarVenta = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorVenta(null);

    if (!formVenta.codigoPersonal.trim()) {
      setErrorVenta('Ingresa el código personal de usuario.');
      return;
    }
    if (!formVenta.comercioId) {
      setErrorVenta('Selecciona el comercio asociado.');
      return;
    }

    const res = clicsAtribucionModule.confirmarVenta({
      codigoPersonal: formVenta.codigoPersonal.trim().toUpperCase(),
      comercioId: formVenta.comercioId,
      montoVenta: Number(formVenta.montoVenta)
    });

    if (!res.ok) {
      setErrorVenta(res.error || 'No se pudo confirmar la venta. Verifica el código.');
      return;
    }

    setModalNuevaVenta(false);
    setFormVenta({ codigoPersonal: '', comercioId: '', montoVenta: 45 });
    setNotificacion('¡Venta registrada con éxito en el sistema!');
    setTimeout(() => setNotificacion(null), 3500);
  };

  return (
    <div className="space-y-5">
      {/* Notificación temporal */}
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

      {/* Tarjetas de Métricas de Ventas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Ventas Confirmadas</span>
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShoppingCart className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            {kpis.totalVentas}
          </div>
          <div className="text-[11px] text-stone-500">Transacciones validadas en red</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Volumen Bruto (GMV)</span>
            <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
              S/
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            S/ {kpis.montoTotal}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold">+18.2% vs. mes previo</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Ticket Promedio</span>
            <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            S/ {kpis.ticketPromedio}
          </div>
          <div className="text-[11px] text-stone-500">Por venta registrada en Lima</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-semibold">Comercios Monetizando</span>
            <div className="w-6 h-6 rounded-full bg-stone-100 text-stone-600 flex items-center justify-center">
              <Store className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl font-black text-stone-900 font-mono tabular-nums leading-none mb-1">
            {kpis.comerciosConVentas}
          </div>
          <div className="text-[11px] text-stone-500">De {comercios.length} comercios activos</div>
        </div>
      </div>

      {/* Barra de Acciones y Filtros */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-3.5 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {/* Buscador */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por código de usuario, comercio u oferta..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-700"
            />
          </div>

          {/* Filtro Comercio */}
          <select
            value={comercioFiltro}
            onChange={(e) => setComercioFiltro(e.target.value)}
            className="bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-700 py-1.5 px-3 focus:outline-none focus:ring-1 focus:ring-emerald-700"
          >
            <option value="todos">Todos los comercios</option>
            {comercios.map(c => (
              <option key={c.id} value={c.id}>{c.nombreComercial}</option>
            ))}
          </select>
        </div>

        {/* Botón registrar venta manual */}
        <button
          onClick={() => {
            setErrorVenta(null);
            setModalNuevaVenta(true);
          }}
          className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Confirmar Venta Manual</span>
        </button>
      </div>

      {/* Tabla de Ventas Confirmadas */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs min-w-[680px]">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-3.5">Código Personal</th>
                <th className="py-3 px-3.5">Comercio</th>
                <th className="py-3 px-3.5">Oferta Validada</th>
                <th className="py-3 px-3.5 text-right">Monto Venta</th>
                <th className="py-3 px-3.5">Fecha y Hora</th>
                <th className="py-3 px-3.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {ventasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-stone-400 text-xs">
                    No hay ventas registradas con los filtros actuales.
                  </td>
                </tr>
              ) : (
                ventasFiltradas.map((v) => {
                  const comercio = comercios.find(c => c.id === v.comercioId);
                  const oferta = ofertas.find(o => o.id === v.ofertaId);

                  return (
                    <tr key={v.id} className="hover:bg-stone-50/60 transition-colors">
                      <td className="py-3 px-3.5 font-mono font-bold text-emerald-800">
                        {v.codigoPersonal}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-stone-900">{comercio?.nombreComercial || v.comercioId}</div>
                        <div className="text-[11px] text-stone-500">{comercio?.distrito || 'Lima'}</div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-medium text-stone-800 line-clamp-1">{oferta?.titulo || 'Oferta Promocional'}</div>
                        <div className="text-[11px] text-stone-500">Ref: S/ {oferta?.precioOferta || '-'}</div>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold text-stone-900">
                        S/ {(v.montoVenta || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-3.5 text-stone-500 font-mono text-[11px]">
                        {new Date(v.confirmadaEn).toLocaleString('es-PE', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Confirmada</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Confirmar Venta Manual */}
      {modalNuevaVenta && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h4 className="font-bold text-base text-stone-900">Confirmar Venta por Código</h4>
              </div>
              <button
                onClick={() => setModalNuevaVenta(false)}
                className="w-7 h-7 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorVenta && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {errorVenta}
              </div>
            )}

            <form onSubmit={handleConfirmarVenta} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Código Personal de Usuario (6 dígitos / CV88-91)
                </label>
                <input
                  type="text"
                  required
                  placeholder="ej. CV88-91"
                  value={formVenta.codigoPersonal}
                  onChange={(e) => setFormVenta({ ...formVenta, codigoPersonal: e.target.value.toUpperCase() })}
                  className="w-full p-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-sm uppercase focus:outline-none focus:ring-1 focus:ring-emerald-700"
                />
                <p className="text-[11px] text-stone-500 mt-1">
                  Código emitido al usuario cuando hizo clic en contactar al comercio.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Comercio que Realizó la Venta
                </label>
                <select
                  required
                  value={formVenta.comercioId}
                  onChange={(e) => setFormVenta({ ...formVenta, comercioId: e.target.value })}
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
                  Monto Cobrado al Cliente (Soles)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 font-bold">S/</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={formVenta.montoVenta}
                    onChange={(e) => setFormVenta({ ...formVenta, montoVenta: Number(e.target.value) })}
                    className="w-full pl-9 pr-3 py-2.5 bg-stone-50 border border-stone-300 rounded-xl font-mono text-sm focus:outline-none focus:ring-1 focus:ring-emerald-700"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNuevaVenta(false)}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Validar Venta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
