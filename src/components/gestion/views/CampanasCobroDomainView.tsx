import React, { useState, useMemo, useEffect } from 'react';
import { 
  CreditCard, Layers, DollarSign, Receipt, TrendingUp, 
  Settings, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, 
  Store, Plus, ArrowRight, Save, HelpCircle, X
} from 'lucide-react';
import { CrmPlanesView } from '../../CrmPlanesView';
import { facturacionModule } from '../../../modules/facturacion';
import { comerciosModule } from '../../../modules/comercios';
import { coreConfig } from '../../../core/config';
import { ClickPack } from '../../../types';
import { DateRangeSelector, DateRangeValue, helperObtenerRangoPorPreset } from '../../common/DateRangeSelector';

interface CampanasCobroDomainViewProps {
  subruta?: string;
  onNavegar: (ruta: string) => void;
}

export const CampanasCobroDomainView: React.FC<CampanasCobroDomainViewProps> = ({ subruta, onNavegar }) => {
  const [version, setVersion] = useState(0);
  const [rangoFechaPagos, setRangoFechaPagos] = useState<DateRangeValue>(() => helperObtenerRangoPorPreset('30d'));

  // Estados de Configuración Contable compartidos directamente con coreConfig
  const [precio50, setPrecio50] = useState<number>(() => Number(coreConfig.obtenerValor('precio_pack_50', 70)));
  const [precio100, setPrecio100] = useState<number>(() => Number(coreConfig.obtenerValor('precio_pack_100', 120)));
  const [precio500, setPrecio500] = useState<number>(() => Number(coreConfig.obtenerValor('precio_pack_500', 500)));
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  useEffect(() => {
    const unsubF = facturacionModule.suscribir(() => setVersion(v => v + 1));
    const unsubC = coreConfig.suscribir(() => {
      setPrecio50(Number(coreConfig.obtenerValor('precio_pack_50', 70)));
      setPrecio100(Number(coreConfig.obtenerValor('precio_pack_100', 120)));
      setPrecio500(Number(coreConfig.obtenerValor('precio_pack_500', 500)));
      setVersion(v => v + 1);
    });
    return () => {
      unsubF();
      unsubC();
    };
  }, []);

  const packs = useMemo(() => facturacionModule.listarTodosLosPacks(), [version]);
  const comercios = useMemo(() => comerciosModule.listarComercios(), [version]);
  const facturacionActiva = coreConfig.moduloActivo('campanasFacturacion');

  // Subrutas
  const esPlanes = subruta === '/gestion/campanas-cobro/planes';
  const esCampanas = subruta === '/gestion/campanas-cobro/campanas';
  const esPagos = subruta === '/gestion/campanas-cobro/pagos';
  const esFacturacion = subruta === '/gestion/campanas-cobro/facturacion';
  const esFinanzas = subruta === '/gestion/campanas-cobro/finanzas';
  const esContable = subruta === '/gestion/campanas-cobro/configuracion-contable';
  const esResumen = !esPlanes && !esCampanas && !esPagos && !esFacturacion && !esFinanzas && !esContable;

  const handleGuardarConfigContable = (e: React.FormEvent) => {
    e.preventDefault();
    coreConfig.cambiarParametro('precio_pack_50', Number(precio50), 'Super Admin');
    coreConfig.cambiarParametro('precio_pack_100', Number(precio100), 'Super Admin');
    coreConfig.cambiarParametro('precio_pack_500', Number(precio500), 'Super Admin');
    setGuardadoExitoso(true);
    setTimeout(() => setGuardadoExitoso(false), 3000);
  };

  const clicsTotalesComprados = packs.reduce((acc, p) => acc + p.totalClics, 0);
  const saldoTotalDisponible = packs.reduce((acc, p) => acc + p.saldoClics, 0);
  const ingresosTotales = packs.reduce((acc, p) => acc + p.montoTotal, 0);

  return (
    <div className="space-y-6">
      {/* Subnavegación de Sección */}
      <div className="bg-white p-2 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <button
          onClick={() => onNavegar('/gestion/campanas-cobro')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esResumen
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Resumen ERP</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/planes')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esPlanes
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Planes y Packs PPC</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/campanas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esCampanas
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Store className="w-3.5 h-3.5" />
          <span>Campañas activas</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/pagos')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esPagos
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>Pagos y cobros</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/facturacion')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esFacturacion
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          <span>Facturación</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/finanzas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esFinanzas
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Finanzas y reportes</span>
        </button>

        <button
          onClick={() => onNavegar('/gestion/campanas-cobro/configuracion-contable')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
            esContable
              ? 'bg-[#1B4332] text-white shadow-xs'
              : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configuración contable</span>
        </button>
      </div>

      {/* 1. RESUMEN ERP */}
      {esResumen && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-stone-900">
                  Consola Campañas y Cobro ERP (PPC)
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Modelo de monetización por paquetes de clics y canje promocional de productos.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavegar('/gestion/campanas-cobro/planes')}
                  className="px-3.5 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Ver Catálogo de Packs
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200/70">
                <span className="text-[10px] font-bold text-stone-400 uppercase">Packs Comprados</span>
                <div className="text-2xl font-black text-stone-900 mt-1">{packs.length}</div>
                <span className="text-[10px] text-stone-500">{clicsTotalesComprados} clics acumulados</span>
              </div>
              <div className="p-3.5 bg-sky-50/50 rounded-xl border border-sky-100">
                <span className="text-[10px] font-bold text-sky-800 uppercase">Saldo Disponible</span>
                <div className="text-2xl font-black text-sky-900 mt-1">{saldoTotalDisponible}</div>
                <span className="text-[10px] text-sky-700">Clics activos por consumir</span>
              </div>
              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <span className="text-[10px] font-bold text-emerald-800 uppercase">Ingresos Propios</span>
                <div className="text-2xl font-black text-emerald-900 mt-1">S/. {ingresosTotales.toFixed(2)}</div>
                <span className="text-[10px] text-emerald-700">Recaudado por PPC</span>
              </div>
              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-100">
                <span className="text-[10px] font-bold text-amber-800 uppercase">Estado Interruptor</span>
                <div className={`text-base font-bold mt-2 ${facturacionActiva ? 'text-emerald-800' : 'text-amber-800'}`}>
                  {facturacionActiva ? 'Activo (Producción)' : 'Pruebas Libres (D12)'}
                </div>
                <span className="text-[10px] text-stone-500">CoreConfig central</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PLANES Y PACKS PPC */}
      {esPlanes && (
        <CrmPlanesView />
      )}

      {/* 3. CAMPAÑAS ACTIVAS */}
      {esCampanas && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Campañas y Saldos de Clics por Comercio ({comercios.length})
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Monitoreo del saldo activo de clics contratados por cada comercio de la red.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                  <th className="pb-2.5">Comercio</th>
                  <th className="pb-2.5">Distrito</th>
                  <th className="pb-2.5">Saldo Clics</th>
                  <th className="pb-2.5">Estado Pack</th>
                  <th className="pb-2.5 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {comercios.map(c => {
                  const saldo = facturacionModule.obtenerSaldoComercio(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-stone-50">
                      <td className="py-3 font-semibold text-stone-900">{c.nombreComercial}</td>
                      <td className="py-3 text-stone-600">{c.distrito}</td>
                      <td className="py-3 font-black text-sky-800">{saldo} clics</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          saldo > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                        }`}>
                          {saldo > 0 ? 'Activo' : 'Sin saldo'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => onNavegar('/gestion/campanas-cobro/planes')}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-[11px] font-bold"
                        >
                          Recargar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PAGOS Y COBROS */}
      {esPagos && (
        <div className="space-y-6">
          <DateRangeSelector
            value={rangoFechaPagos}
            onChange={setRangoFechaPagos}
            titulo="Periodo de Auditoría de Pagos y Packs"
          />

          <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Historial de Pagos y Compras de Packs ({packs.filter(p => {
                  const fIso = (p.compradoEn || '').split('T')[0];
                  return !fIso || (fIso >= rangoFechaPagos.fechaInicio && fIso <= rangoFechaPagos.fechaFin);
                }).length})
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Transacciones registradas en {rangoFechaPagos.etiqueta} ({rangoFechaPagos.fechaInicio} al {rangoFechaPagos.fechaFin}) por canales Yape, Plin, Transferencia o Canje por Productos.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500 font-semibold">
                    <th className="pb-2.5">ID Pack</th>
                    <th className="pb-2.5">Comercio</th>
                    <th className="pb-2.5">Clics</th>
                    <th className="pb-2.5">Monto Pagado</th>
                    <th className="pb-2.5">Fecha</th>
                    <th className="pb-2.5 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {packs.filter(p => {
                    const fIso = (p.compradoEn || '').split('T')[0];
                    return !fIso || (fIso >= rangoFechaPagos.fechaInicio && fIso <= rangoFechaPagos.fechaFin);
                  }).map(p => {
                    const com = comercios.find(c => c.id === p.comercioId);
                    return (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="py-3 font-mono font-bold text-stone-700">{p.id}</td>
                        <td className="py-3 font-semibold text-stone-900">{com?.nombreComercial || p.comercioId}</td>
                        <td className="py-3 font-bold text-sky-800">{p.totalClics} clics</td>
                        <td className="py-3 font-black text-emerald-800">S/. {p.montoTotal.toFixed(2)}</td>
                        <td className="py-3 text-stone-500">{new Date(p.compradoEn).toLocaleDateString()}</td>
                        <td className="py-3 text-right">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {p.estado}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. FACTURACIÓN */}
      {esFacturacion && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Emisión de Facturación Electrónica (SUNAT)
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Control de comprobantes fiscales emitidos para cobro de campañas publicitarias PPC.
            </p>
          </div>

          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/70 text-xs space-y-2">
            <span className="font-bold text-stone-800 block">Datos Fiscales del Emisor:</span>
            <div className="grid grid-cols-2 gap-2 text-stone-600">
              <div><strong>Razón Social:</strong> VUUY PERU S.A.C.</div>
              <div><strong>RUC:</strong> 20608976543</div>
              <div><strong>Régimen:</strong> MYPE Tributario</div>
              <div><strong>Tasa IGV:</strong> 18.00%</div>
            </div>
          </div>
        </div>
      )}

      {/* 6. FINANZAS Y REPORTES */}
      {esFinanzas && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-5 space-y-4">
          <div>
            <h3 className="text-base font-bold text-stone-900">
              Reporte Financiero y Monetización de vuuy
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Desglose de ingresos directos vs valorización de aportes en canje de productos.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-800 uppercase">Ingresos Recaudados</span>
              <div className="text-2xl font-black text-emerald-950 mt-1">S/. {ingresosTotales.toFixed(2)}</div>
              <p className="text-[10px] text-emerald-700 mt-1">Total acumulado en venta de packs PPC</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <span className="text-[11px] font-bold text-purple-800 uppercase">Valorización Canje Productos</span>
              <div className="text-2xl font-black text-purple-950 mt-1">S/. 140.00</div>
              <p className="text-[10px] text-purple-700 mt-1">Productos aportados para el marketplace de puntos</p>
            </div>
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
              <span className="text-[11px] font-bold text-stone-600 uppercase">Ticket Promedio por Pack</span>
              <div className="text-2xl font-black text-stone-900 mt-1">
                S/. {packs.length > 0 ? (ingresosTotales / packs.length).toFixed(2) : '0.00'}
              </div>
              <p className="text-[10px] text-stone-500 mt-1">Promedio por orden de recarga</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. CONFIGURACIÓN CONTABLE (UNIFICADA CON CORECONFIG) */}
      {esContable && (
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-2xs p-5 sm:p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-stone-900 flex items-center gap-2">
                <Settings className="w-5 h-5 text-emerald-700" />
                <span>Configuración Contable y Precios Comerciales</span>
              </h3>
              <p className="text-xs text-stone-500 mt-1 max-w-xl">
                Los parámetros definidos aquí provienen del <strong>servicio central de configuración (CoreConfig)</strong>. 
                Cualquier cambio se sincroniza de forma inmediata sin una segunda fuente de verdad.
              </p>
            </div>
          </div>

          {guardadoExitoso && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Precios comerciales y parámetros contables actualizados en CoreConfig.</span>
            </div>
          )}

          <form onSubmit={handleGuardarConfigContable} className="space-y-4 max-w-xl">
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Precio Pack 50 Clics (S/.)
                </label>
                <input
                  type="number"
                  min="1"
                  value={precio50}
                  onChange={(e) => setPrecio50(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold"
                />
                <span className="text-[10px] text-stone-400">Parámetro central: precio_pack_50</span>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Precio Pack 100 Clics (S/.)
                </label>
                <input
                  type="number"
                  min="1"
                  value={precio100}
                  onChange={(e) => setPrecio100(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold"
                />
                <span className="text-[10px] text-stone-400">Parámetro central: precio_pack_100</span>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Precio Pack 500 Clics (S/.)
                </label>
                <input
                  type="number"
                  min="1"
                  value={precio500}
                  onChange={(e) => setPrecio500(Number(e.target.value))}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 font-bold"
                />
                <span className="text-[10px] text-stone-400">Parámetro central: precio_pack_500</span>
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Parámetros en CoreConfig</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
