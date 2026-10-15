import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList
} from 'recharts';
import { TrendingUp, MessageCircle, BarChart2 } from 'lucide-react';
import { clicsAtribucionModule } from '../../modules/clics';
import { coreEvents } from '../../core/events';
import { ofertasModule } from '../../modules/ofertas';

interface TendenciasOfertasRechartsWidgetProps {
  /**
   * Si se especifica comercioId, el comercio ve SOLO los datos de sus propias ofertas.
   * Si se omite o es null/undefined, el administrador ve los datos de TODAS las ofertas del sistema.
   */
  comercioId?: string;
  titulo?: string;
  className?: string;
}

export const TendenciasOfertasRechartsWidget: React.FC<TendenciasOfertasRechartsWidgetProps> = ({
  comercioId,
  titulo,
  className = ''
}) => {
  // Ventana de tiempo estricta: últimos 7 días
  const datosTop5 = useMemo(() => {
    const ahora = Date.now();
    const sieteDiasAtras = ahora - 7 * 24 * 60 * 60 * 1000;

    // 1. Recolectar clics de seguimiento de clicsAtribucionModule
    const clicsAtribucion = clicsAtribucionModule.listarClics();
    
    // 2. Recolectar eventos de clics directos de coreEvents
    const eventosCore = coreEvents.consultar({
      limite: 500
    }).filter(e => e.tipoEvento === 'click_lo_quiero_directo' || e.tipoEvento === 'clic_contactar');

    // Conteo por ofertaId
    const conteoPorOferta = new Map<string, { count: number; comercioId?: string }>();

    // Procesar clics de atribución
    for (const c of clicsAtribucion) {
      const fecha = new Date(c.creadoEn).getTime();
      if (!isNaN(fecha) && fecha >= sieteDiasAtras) {
        if (!comercioId || c.comercioId === comercioId) {
          const actual = conteoPorOferta.get(c.ofertaId) || { count: 0, comercioId: c.comercioId };
          actual.count += 1;
          if (c.comercioId) actual.comercioId = c.comercioId;
          conteoPorOferta.set(c.ofertaId, actual);
        }
      }
    }

    // Procesar eventos core (evitando duplicar con deduplicación por ID)
    for (const e of eventosCore) {
      const fecha = new Date(e.fechaHora).getTime();
      if (!isNaN(fecha) && fecha >= sieteDiasAtras) {
        const ofId = (e.datos as any)?.ofertaId;
        const comId = (e.datos as any)?.comercioId;
        if (ofId) {
          if (!comercioId || comId === comercioId) {
            const actual = conteoPorOferta.get(ofId) || { count: 0, comercioId: comId };
            // Si no estaba en clicsAtribucion, sumar
            if (!clicsAtribucion.some(c => c.ofertaId === ofId && Math.abs(new Date(c.creadoEn).getTime() - fecha) < 2000)) {
              actual.count += 1;
              conteoPorOferta.set(ofId, actual);
            }
          }
        }
      }
    }

    // Mapear con datos reales de las ofertas
    const listaOfertas: {
      id: string;
      nombre: string;
      nombreCorto: string;
      comercioNombre: string;
      clics: number;
    }[] = [];

    conteoPorOferta.forEach((val, ofId) => {
      if (val.count > 0) {
        const of = ofertasModule.obtenerOferta(ofId);
        const fullTitle = of?.titulo || `Oferta ${ofId}`;
        const shortTitle = fullTitle.length > 20 ? `${fullTitle.substring(0, 18)}...` : fullTitle;
        
        listaOfertas.push({
          id: ofId,
          nombre: fullTitle,
          nombreCorto: shortTitle,
          comercioNombre: of?.comercioNombre || 'Comercio',
          clics: val.count
        });
      }
    });

    // Ordenar descendente por número de clics
    listaOfertas.sort((a, b) => b.clics - a.clics);

    // Retornar exactamente las 5 ofertas con más clics en los últimos 7 días
    return listaOfertas.slice(0, 5);
  }, [comercioId]);

  const tituloFinal = titulo || (comercioId ? 'Ofertas más buscadas (Últimos 7 días)' : 'Top 5 Ofertas más buscadas (Últimos 7 días)');

  // Gradiente de colores en barras para visualización clara
  const coloresBarras = ['#059669', '#10B981', '#34D399', '#6EE7B7', '#A7F3D0'];

  return (
    <div className={`bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-2xs ${className}`}>
      {/* Encabezado del widget */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 gap-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-stone-900 leading-snug">
              {tituloFinal}
            </h3>
            <p className="text-[11px] text-stone-500">
              {comercioId ? 'Tus ofertas con más clics a WhatsApp' : 'Tendencia de clics a WhatsApp por oferta'}
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md shrink-0">
          7 días
        </span>
      </div>

      {/* Si no hay datos todavía: mostrar exactamente "Aún no hay clics para mostrar" */}
      {datosTop5.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-7 px-4 text-center space-y-2 bg-stone-50/60 rounded-xl border border-dashed border-stone-200">
          <BarChart2 className="w-6 h-6 text-stone-400 stroke-[1.5]" />
          <p className="text-xs font-semibold text-stone-600">
            Aún no hay clics para mostrar
          </p>
          <p className="text-[11px] text-stone-400 max-w-xs">
            Los clics que los clientes realicen hacia WhatsApp en los últimos 7 días aparecerán automáticamente aquí.
          </p>
        </div>
      ) : (
        <div className="w-full">
          {/* Gráfico en barras horizontales usando recharts */}
          <div className="w-full" style={{ height: Math.max(160, datosTop5.length * 36) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={datosTop5}
                margin={{ top: 4, right: 32, left: 0, bottom: 4 }}
              >
                <XAxis 
                  type="number" 
                  allowDecimals={false} 
                  tick={{ fontSize: 10, fill: '#78716C' }}
                  axisLine={{ stroke: '#E7E5E4' }}
                  tickLine={false}
                />
                <YAxis 
                  type="category" 
                  dataKey="nombreCorto" 
                  width={110} 
                  tick={{ fontSize: 11, fill: '#1C1917', fontWeight: 600 }}
                  axisLine={{ stroke: '#E7E5E4' }}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(245, 245, 244, 0.6)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-stone-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-1 border border-stone-700">
                          <p className="font-bold text-white text-[12px]">{data.nombre}</p>
                          {!comercioId && (
                            <p className="text-stone-300 text-[10px]">{data.comercioNombre}</p>
                          )}
                          <div className="flex items-center gap-1.5 text-emerald-400 font-black text-xs pt-0.5">
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{data.clics} {data.clics === 1 ? 'clic a WhatsApp' : 'clics a WhatsApp'}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="clics" 
                  radius={[0, 6, 6, 0]}
                  barSize={18}
                >
                  {datosTop5.map((_, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={coloresBarras[index % coloresBarras.length]} 
                    />
                  ))}
                  <LabelList 
                    dataKey="clics" 
                    position="right" 
                    style={{ fontSize: 11, fontWeight: 700, fill: '#047857' }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leyenda y resumen inferior */}
          <div className="flex items-center justify-between text-[11px] text-stone-500 pt-3 mt-1 border-t border-stone-100">
            <span>Fuente: Eventos reales de WhatsApp</span>
            <span className="font-semibold text-emerald-700">
              Total 7d: {datosTop5.reduce((sum, d) => sum + d.clics, 0)} clics
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
