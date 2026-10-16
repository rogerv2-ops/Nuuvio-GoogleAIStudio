import React, { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, Gift, AlertCircle, ShoppingCart, 
  Clock, Hash, Sparkles, ArrowRight, Bell, Volume2, VolumeX,
  Radio, Zap, X, Check, ShieldCheck, Play, Download, FileSpreadsheet
} from 'lucide-react';
import { Merchant, ConfirmedSale } from '../../../types';
import { clicsAtribucionModule } from '../../../modules/clics';
import { puntosModule } from '../../../modules/puntos';
import { coreEvents } from '../../../core/events';

interface VentasComercioViewProps {
  comercio: Merchant;
  ventas: ConfirmedSale[];
  rutaActual: string;
}

export interface AlertaCanjeEnVivo {
  id: string;
  codigoPersonal: string;
  ofertaTitulo: string;
  monto: number;
  usuarioNombre: string;
  horaStr: string;
  tipo: 'venta_confirmada' | 'canje_puntos';
}

export const VentasComercioView: React.FC<VentasComercioViewProps> = ({
  comercio,
  ventas: ventasProp,
  rutaActual
}) => {
  // Estado local para ventas en tiempo real
  const [ventasLocales, setVentasLocales] = useState<ConfirmedSale[]>(ventasProp);

  // Formulario de confirmación de venta con código
  const [codigoVentaInput, setCodigoVentaInput] = useState('');
  const [montoVentaInput, setMontoVentaInput] = useState<number>(35);
  const [resultadoVenta, setResultadoVenta] = useState<{ ok: boolean; mensaje: string } | null>(null);

  // Canje de premio / puntos
  const [codigoCanjeInput, setCodigoCanjeInput] = useState('');
  const [resultadoCanje, setResultadoCanje] = useState<{ ok: boolean; mensaje: string } | null>(null);

  // Sistema de Alertas en Tiempo Real y Sonido
  const [sonidoHabilitado, setSonidoHabilitado] = useState<boolean>(true);
  const [alertaActiva, setAlertaActiva] = useState<AlertaCanjeEnVivo | null>(null);
  const [historialAlertas, setHistorialAlertas] = useState<AlertaCanjeEnVivo[]>([]);

  // Función para sintetizar un sonido de notificación breve usando Web Audio API
  const emitirSonidoNotificacion = () => {
    if (!sonidoHabilitado) return;

    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Oscilador 1: Tono agudo de inicio (E5 = 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // Ramp a A5 (880Hz)

      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.45);

      // Oscilador 2: Armónico secundario para un sonido más rico
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now + 0.08); // E6
      gain2.gain.setValueAtTime(0.15, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.08);
      osc2.stop(now + 0.5);
    } catch (e) {
      console.warn('AudioContext error or blocked by browser user gesture policy:', e);
    }
  };

  // Disparar una nueva alerta visual y sonora
  const lanzarAlertaTiempoReal = (alerta: AlertaCanjeEnVivo) => {
    setAlertaActiva(alerta);
    setHistorialAlertas(prev => [alerta, ...prev.slice(0, 9)]);
    emitirSonidoNotificacion();
  };

  // Escuchar eventos globales en tiempo real
  useEffect(() => {
    const desuscribir = coreEvents.suscribir((evento) => {
      if (evento.actorId === comercio.id || evento.datos?.comercioId === comercio.id) {
        if (evento.tipoEvento === 'venta_confirmada') {
          const nuevaAlerta: AlertaCanjeEnVivo = {
            id: `alt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            codigoPersonal: String(evento.datos?.codigoPersonal || 'CV88-91'),
            ofertaTitulo: 'Oferta canjeada en tu local',
            monto: Number(evento.datos?.monto || 35),
            usuarioNombre: 'Cliente registrado WhatsApp',
            horaStr: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            tipo: 'venta_confirmada'
          };
          lanzarAlertaTiempoReal(nuevaAlerta);
          // Actualizar lista local de ventas
          setVentasLocales(clicsAtribucionModule.listarVentasPorComercio(comercio.id));
        } else if (evento.tipoEvento === 'canje_solicitado' || evento.tipoEvento === 'canje_entregado') {
          const nuevaAlerta: AlertaCanjeEnVivo = {
            id: `alt_cj_${Date.now()}`,
            codigoPersonal: String(evento.datos?.codigoCanje || 'CJ-9982'),
            ofertaTitulo: String(evento.datos?.premio || 'Recompensa Fidelización'),
            monto: 0,
            usuarioNombre: String(evento.datos?.usuarioNombre || 'Usuario vuuy'),
            horaStr: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            tipo: 'canje_puntos'
          };
          lanzarAlertaTiempoReal(nuevaAlerta);
        }
      }
    });

    return () => desuscribir();
  }, [comercio.id]);

  // Manejador para confirmar venta manual
  const handleConfirmarVenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoVentaInput.trim()) return;

    const res = clicsAtribucionModule.confirmarVenta({
      codigoPersonal: codigoVentaInput,
      comercioId: comercio.id,
      montoVenta: Number(montoVentaInput)
    });

    if (res.ok) {
      setResultadoVenta({ 
        ok: true, 
        mensaje: `¡Venta registrada con éxito para el código ${codigoVentaInput.toUpperCase()}!` 
      });
      setCodigoVentaInput('');
      setVentasLocales(clicsAtribucionModule.listarVentasPorComercio(comercio.id));
    } else {
      setResultadoVenta({ 
        ok: false, 
        mensaje: res.error || 'Código personal no encontrado o no corresponde a este local.' 
      });
    }
  };

  // Manejador para validar canje
  const handleValidarCanje = (e: React.FormEvent) => {
    e.preventDefault();
    if (!codigoCanjeInput.trim()) return;

    const res = puntosModule.validarCodigoCanje(codigoCanjeInput, comercio.id);
    if (res.ok && res.canje) {
      setResultadoCanje({ 
        ok: true, 
        mensaje: `¡Código válido! Se entregó "${res.canje.rewardTitulo}" a ${res.canje.usuarioNombre}.` 
      });
      
      // Disparar alerta en tiempo real
      lanzarAlertaTiempoReal({
        id: `alt_manual_${Date.now()}`,
        codigoPersonal: res.canje.codigo,
        ofertaTitulo: res.canje.rewardTitulo,
        monto: 0,
        usuarioNombre: res.canje.usuarioNombre,
        horaStr: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        tipo: 'canje_puntos'
      });

      setCodigoCanjeInput('');
    } else {
      setResultadoCanje({ 
        ok: false, 
        mensaje: res.error || 'Código de canje no válido o ya utilizado.' 
      });
    }
  };

  // Exportar historial de ventas validadas a CSV
  const handleExportarCSV = () => {
    if (ventasLocales.length === 0) return;

    const headers = ['ID Venta', 'Código Personal', 'Fecha Registro', 'Monto (PEN)', 'Estado', 'Comercio ID'];
    const rows = ventasLocales.map(v => [
      v.id,
      v.codigoPersonal,
      new Date(v.confirmadaEn).toLocaleString('es-PE'),
      `S/ ${v.montoVenta || 35}.00`,
      'Confirmada en caja',
      v.comercioId
    ]);

    const csvRows = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))];
    const csvString = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ventas_confirmadas_${comercio.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Función para simular una alerta de canje en vivo (Probar Alerta)
  const handleSimularAlertaPrueba = () => {
    const codigosPrueba = ['CV88-91', 'LR26-44', 'MA73-09', 'BV55-12', 'SF99-80'];
    const ofertasPrueba = ['Ceviche Mixto Tradicional', '2x1 Pisco Sour de Arándanos', 'Combo Burguer Artesanal', 'Postre Gratis por Visita'];
    const nombresPrueba = ['Carlos M. (Miraflores)', 'Ana P. (Barranco)', 'Jorge R. (Surco)', 'Lucía V. (San Isidro)'];

    const randomCod = codigosPrueba[Math.floor(Math.random() * codigosPrueba.length)] || 'CV88-91';
    const randomOfr = ofertasPrueba[Math.floor(Math.random() * ofertasPrueba.length)] || 'Ceviche Mixto Tradicional';
    const randomNom = nombresPrueba[Math.floor(Math.random() * nombresPrueba.length)] || 'Cliente registrado WhatsApp';
    const randomMonto = Math.floor(Math.random() * 40) + 25;

    // Emitir evento en coreEvents
    coreEvents.emitir({
      tipoEvento: 'venta_confirmada',
      actorTipo: 'comercio',
      actorId: comercio.id,
      origen: 'panel',
      datos: {
        codigoPersonal: randomCod,
        comercioId: comercio.id,
        ofertaTitulo: randomOfr,
        monto: randomMonto,
        usuarioNombre: randomNom
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Barra de Estado del Escuchador de Alertas en Tiempo Real */}
      <div className="bg-gradient-to-r from-stone-900 via-[#0F172A] to-emerald-950 text-white rounded-2xl p-4 sm:p-5 shadow-md border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Canal de Alertas en Tiempo Real Activo
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            <span>Notificaciones de Canjes y Ventas Confirmadas</span>
          </h3>
          <p className="text-xs text-stone-300 max-w-xl">
            Cada vez que un cliente redima un código o confirme una compra en tu local, sonarás una alerta sonora y visual al instante.
          </p>
        </div>

        {/* Controles de Sonido y Prueba */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setSonidoHabilitado(!sonidoHabilitado)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
              sonidoHabilitado 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30' 
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:bg-stone-700'
            }`}
            title={sonidoHabilitado ? 'Sonido activado' : 'Sonido silenciado'}
          >
            {sonidoHabilitado ? (
              <>
                <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Sonido Activado</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-stone-400" />
                <span>Sonido Silenciado</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSimularAlertaPrueba}
            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-stone-950" />
            <span>Probar Alerta en Vivo</span>
          </button>
        </div>
      </div>

      {/* BANNER DE ALERTA POPUP EN TIEMPO REAL (Animado al llegar nuevo canje) */}
      {alertaActiva && (
        <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-900 text-white rounded-2xl p-4 sm:p-5 shadow-xl border-2 border-emerald-300 animate-bounce transition-all">
          <button
            onClick={() => setAlertaActiva(null)}
            className="absolute top-3 right-3 text-emerald-200 hover:text-white p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 sm:gap-4 pr-8">
            <div className="w-10 h-10 rounded-2xl bg-white text-emerald-800 flex items-center justify-center shrink-0 shadow-md">
              <Sparkles className="w-5 h-5 text-emerald-600 animate-spin" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-md border border-white/30">
                  🔔 ¡NUEVO CANJE EN TIEMPO REAL!
                </span>
                <span className="text-[11px] font-mono text-emerald-200">
                  {alertaActiva.horaStr}
                </span>
              </div>

              <h4 className="text-base sm:text-lg font-black tracking-tight text-white">
                Código Personal: <span className="bg-black/30 font-mono px-2 py-0.5 rounded-lg border border-white/20">{alertaActiva.codigoPersonal}</span>
              </h4>

              <p className="text-xs text-emerald-100">
                {alertaActiva.tipo === 'venta_confirmada' 
                  ? `Se confirmó una venta por S/ ${alertaActiva.monto}.00 para ${alertaActiva.usuarioNombre}.`
                  : `Se entregó el premio "${alertaActiva.ofertaTitulo}" a ${alertaActiva.usuarioNombre}.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Historial Reciente de Alertas Recibidas */}
      {historialAlertas.length > 0 && (
        <div className="bg-stone-900 text-stone-200 rounded-2xl p-4 border border-stone-800 space-y-3">
          <div className="flex items-center justify-between border-b border-stone-800 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>Últimas Alertas Recibidas en esta Sesión ({historialAlertas.length})</span>
            </h4>
            <button 
              onClick={() => setHistorialAlertas([])} 
              className="text-[10px] text-stone-500 hover:text-stone-300 font-bold"
            >
              Limpiar
            </button>
          </div>

          <div className="space-y-2">
            {historialAlertas.map((alt) => (
              <div key={alt.id} className="p-2.5 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-mono font-bold text-white bg-stone-800 px-1.5 py-0.5 rounded text-[11px] mr-2">
                      {alt.codigoPersonal}
                    </span>
                    <span className="text-stone-300 font-medium">{alt.ofertaTitulo}</span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono text-[11px]">
                  <span className="text-emerald-400 font-bold">{alt.monto > 0 ? `S/ ${alt.monto}` : 'Canje'}</span>
                  <span className="text-stone-500 ml-2">{alt.horaStr}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formularios de Confirmación */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Validador de Venta Sin QR */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <span>✅</span> Registrar Venta con Código del Cliente
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Ingresa el código personal de 5 caracteres que el cliente tiene en su WhatsApp
            </p>
          </div>

          <form onSubmit={handleConfirmarVenta} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                Código Personal del Cliente
              </label>
              <input
                type="text"
                value={codigoVentaInput}
                onChange={e => setCodigoVentaInput(e.target.value.toUpperCase())}
                placeholder="Ej. CV88-91"
                maxLength={8}
                className="w-full p-2.5 text-sm font-mono font-bold tracking-widest border border-stone-200 rounded-xl uppercase outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                Monto aproximado consumido (S/)
              </label>
              <input
                type="number"
                value={montoVentaInput}
                onChange={e => setMontoVentaInput(Number(e.target.value))}
                placeholder="Monto en soles"
                className="w-full p-2 text-xs border border-stone-200 rounded-xl outline-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Confirmar Venta
            </button>

            {resultadoVenta && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                resultadoVenta.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {resultadoVenta.mensaje}
              </div>
            )}
          </form>
        </div>

        {/* Validador de Canje de Premios / Fidelización */}
        <div className="bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs space-y-4">
          <div>
            <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
              <span>🎁</span> Validar Canje de Puntos
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Canjes de recompensas solicitadas por usuarios con puntos vuuy
            </p>
          </div>

          <form onSubmit={handleValidarCanje} className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold text-stone-600 block mb-1">
                Código del Bono o Premio
              </label>
              <input
                type="text"
                value={codigoCanjeInput}
                onChange={e => setCodigoCanjeInput(e.target.value.toUpperCase())}
                placeholder="Ej. CJ-9982"
                className="w-full p-2.5 text-sm font-mono font-bold tracking-wider border border-stone-200 rounded-xl uppercase outline-none focus:ring-1 focus:ring-emerald-700"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Entregar Premio al Cliente
            </button>

            {resultadoCanje && (
              <div className={`p-3 rounded-xl text-xs font-semibold ${
                resultadoCanje.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}>
                {resultadoCanje.mensaje}
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Historial de Ventas Reportadas */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Historial de Ventas Informadas por tu Negocio</span>
            </h4>
            <p className="text-xs text-stone-400 mt-0.5">
              Transacciones validadas en caja mediante código personal de cliente.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs text-stone-400 font-mono">
              {ventasLocales.length} ventas
            </span>
            <button
              type="button"
              onClick={handleExportarCSV}
              disabled={ventasLocales.length === 0}
              className="px-3.5 py-1.5 bg-[#166534] hover:bg-[#14532D] text-white disabled:bg-stone-200 disabled:text-stone-400 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
              title="Descargar reporte en formato CSV (Excel)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar a CSV</span>
            </button>
          </div>
        </div>

        {ventasLocales.length === 0 ? (
          <p className="text-xs text-stone-400 py-6 text-center">
            Aún no has registrado ventas informadas con código personal.
          </p>
        ) : (
          <div className="divide-y divide-stone-100 text-xs">
            {ventasLocales.map((v) => (
              <div key={v.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                    {v.codigoPersonal}
                  </span>
                  <span className="text-[11px] text-stone-400 ml-2 font-mono">
                    {new Date(v.confirmadaEn).toLocaleDateString('es-PE')}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-[#0F172A] font-mono">
                    S/ {v.montoVenta || 35}.00
                  </span>
                  <span className="text-[10px] text-emerald-700 block font-semibold">
                    Confirmada en caja
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
