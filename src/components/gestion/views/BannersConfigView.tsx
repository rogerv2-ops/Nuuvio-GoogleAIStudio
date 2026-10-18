import React, { useState, useEffect, useRef } from 'react';
import { 
  Images, Plus, Upload, Link as LinkIcon, Eye, Trash2, 
  ArrowUp, ArrowDown, Check, RefreshCw, Sparkles, Layers,
  ExternalLink, CheckCircle2, AlertCircle, ToggleLeft, ToggleRight, Edit2, X, AlertTriangle
} from 'lucide-react';
import { bannersModule, FeedBanner } from '../../../modules/banners';
import { withResourceVersion } from '../../../utils/resourceVersion';

export const BannersConfigView: React.FC = () => {
  const [banners, setBanners] = useState<FeedBanner[]>(() => bannersModule.listarBanners());
  const [bannerEditando, setBannerEditando] = useState<FeedBanner | null>(null);
  const [bannerEliminando, setBannerEliminando] = useState<FeedBanner | null>(null);

  // Ref para hacer scroll automático al formulario al editar
  const formRef = useRef<HTMLDivElement>(null);

  // Formulario
  const [formTitulo, setFormTitulo] = useState('');
  const [formSubtitulo, setFormSubtitulo] = useState('');
  const [formImagenUrl, setFormImagenUrl] = useState('');
  const [formEnlaceUrl, setFormEnlaceUrl] = useState('');
  const [formActivado, setFormActivado] = useState(true);
  const [modoOrigen, setModoOrigen] = useState<'url' | 'upload'>('url');

  const [notificacion, setNotificacion] = useState<string | null>(null);

  const refrescarLista = () => {
    setBanners(bannersModule.listarBanners());
  };

  useEffect(() => {
    bannersModule.sincronizarConServidor();
    refrescarLista();
    const unsub = bannersModule.suscribir(() => {
      refrescarLista();
    });
    return () => unsub();
  }, []);

  const handleSubirArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen no debe superar los 10 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result) {
        const local = event.target.result as string;
        const anterior = formImagenUrl;
        setFormImagenUrl(local);
        try {
          const { subirImagenAlServidor } = await import('../../../utils/uploadMedia');
          const url = await subirImagenAlServidor(local, 'banners');
          setFormImagenUrl(url);
        } catch (err) {
          setFormImagenUrl(anterior);
          alert('No se pudo subir la imagen al servidor: ' + (err instanceof Error ? err.message : err));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGuardarBanner = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formImagenUrl.trim()) {
      alert('Por favor ingresa la URL de la imagen o sube un archivo.');
      return;
    }
    if (formImagenUrl.startsWith('data:')) {
      alert('La imagen aún se está subiendo al servidor. Espera a que termine.');
      return;
    }

    if (bannerEditando) {
      bannersModule.actualizarBanner(bannerEditando.id, {
        titulo: formTitulo.trim() || 'Banner Yuudit',
        subtitulo: formSubtitulo.trim(),
        imagenUrl: formImagenUrl.trim(),
        enlaceUrl: formEnlaceUrl.trim(),
        activado: formActivado
      });
      setNotificacion(`Banner "${formTitulo.trim() || 'Yuudit'}" actualizado correctamente.`);
    } else {
      bannersModule.crearBanner({
        titulo: formTitulo.trim() || 'Banner Yuudit',
        subtitulo: formSubtitulo.trim(),
        imagenUrl: formImagenUrl.trim(),
        enlaceUrl: formEnlaceUrl.trim(),
        activado: formActivado,
        orden: banners.length + 1
      });
      setNotificacion('Nuevo banner agregado al sistema de rotación.');
    }

    refrescarLista();

    // Resetear formulario
    setFormTitulo('');
    setFormSubtitulo('');
    setFormImagenUrl('');
    setFormEnlaceUrl('');
    setFormActivado(true);
    setBannerEditando(null);

    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleEditar = (b: FeedBanner) => {
    setBannerEditando(b);
    setFormTitulo(b.titulo || '');
    setFormSubtitulo(b.subtitulo || '');
    setFormImagenUrl(b.imagenUrl || '');
    setFormEnlaceUrl(b.enlaceUrl || '');
    setFormActivado(b.activado);
    setModoOrigen(b.imagenUrl.startsWith('data:') ? 'upload' : 'url');

    // Desplazar la pantalla suavemente hacia el formulario
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCancelarEdicion = () => {
    setBannerEditando(null);
    setFormTitulo('');
    setFormSubtitulo('');
    setFormImagenUrl('');
    setFormEnlaceUrl('');
    setFormActivado(true);
  };

  const handleToggleEstado = (id: string, activadoActual: boolean) => {
    bannersModule.actualizarBanner(id, { activado: !activadoActual });
    refrescarLista();
  };

  const handleConfirmarEliminar = () => {
    if (!bannerEliminando) return;

    bannersModule.eliminarBanner(bannerEliminando.id);
    if (bannerEditando?.id === bannerEliminando.id) {
      handleCancelarEdicion();
    }
    
    refrescarLista();
    setNotificacion(`Banner "${bannerEliminando.titulo}" eliminado.`);
    setBannerEliminando(null);

    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleMover = (index: number, direccion: 'arriba' | 'abajo') => {
    const nuevaLista = [...banners];
    const targetIndex = direccion === 'arriba' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= nuevaLista.length) return;

    const temp = nuevaLista[index];
    nuevaLista[index] = nuevaLista[targetIndex];
    nuevaLista[targetIndex] = temp;

    bannersModule.reordenar(nuevaLista);
    refrescarLista();
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Notificación flotante */}
      {notificacion && (
        <div className="p-3 bg.emerald-50 bg-[#EAF5EE] border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <span>{notificacion}</span>
          </div>
          <button onClick={() => setNotificacion(null)} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-stone-900 flex items-center gap-2">
              <Images className="w-5 h-5 text-emerald-700" />
              <span>Configuración de Banners del Feed</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Administra las imágenes que se muestran en carrusel rotativo en la parte superior del feed principal de ofertas.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              bannersModule.restaurarPredeterminados();
              refrescarLista();
              setNotificacion('Banners predeterminados restaurados.');
              setTimeout(() => setNotificacion(null), 3000);
            }}
            className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restaurar Predeterminados</span>
          </button>
        </div>
      </div>

      {/* FORMULARIO DE CREACIÓN / EDICIÓN DE BANNER */}
      <div ref={formRef} className={`bg-white rounded-3xl border transition-all p-5 sm:p-6 shadow-2xs space-y-4 ${
        bannerEditando ? 'border-amber-300 ring-2 ring-amber-400/20' : 'border-stone-200/80'
      }`}>
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              {bannerEditando ? <Edit2 className="w-4 h-4 text-amber-600" /> : <Plus className="w-4 h-4 text-emerald-700" />}
              <span>{bannerEditando ? `Editar Banner: ${bannerEditando.titulo}` : 'Agregar Nuevo Banner'}</span>
            </h3>
            {bannerEditando && (
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">
                Modifica los datos y presiona "Guardar Cambios" para actualizar.
              </p>
            )}
          </div>

          {bannerEditando && (
            <button
              type="button"
              onClick={handleCancelarEdicion}
              className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar Edición
            </button>
          )}
        </div>

        <form onSubmit={handleGuardarBanner} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Título */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Título del Banner
              </label>
              <input
                type="text"
                placeholder="ej. Gran Venta de Primavera"
                value={formTitulo}
                onChange={(e) => setFormTitulo(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>

            {/* Subtítulo */}
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Subtítulo o Descripción (Opcional)
              </label>
              <input
                type="text"
                placeholder="ej. Hasta 50% de descuento en locales seleccionados"
                value={formSubtitulo}
                onChange={(e) => setFormSubtitulo(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>
          </div>

          {/* Selección de Origen de Imagen (URL o Subida) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-700 block">
              Origen de la Imagen del Banner
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModoOrigen('url')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoOrigen === 'url'
                    ? 'bg-[#1B4332] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Ingresar URL de Imagen</span>
              </button>
              <button
                type="button"
                onClick={() => setModoOrigen('upload')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  modoOrigen === 'upload'
                    ? 'bg-[#1B4332] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Imagen desde Archivo</span>
              </button>
            </div>

            {modoOrigen === 'url' ? (
              <input
                type="text"
                required
                placeholder="/banner-ficha-oferta-mujer.webp o https://ejemplo.com/banner.webp"
                value={formImagenUrl}
                onChange={(e) => setFormImagenUrl(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            ) : (
              <div className="p-4 bg-stone-50 border-2 border-dashed border-stone-200 rounded-2xl text-center space-y-2">
                <Upload className="w-6 h-6 text-stone-400 mx-auto" />
                <p className="text-xs text-stone-600 font-bold">Selecciona una imagen de tu equipo</p>
                <p className="text-[10px] text-stone-400">Formatos soportados: WEBP, PNG, JPG (Recomendado 1200x400 px, max 3 MB)</p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSubirArchivo}
                  className="block w-full text-xs text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-stone-200 file:text-stone-700 hover:file:bg-stone-300 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Previsualización en vivo */}
          {formImagenUrl && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Previsualización del Banner</span>
              <div className="w-full h-32 sm:h-40 rounded-2xl overflow-hidden border border-stone-200 relative bg-stone-100 shadow-2xs">
                <img
                  src={withResourceVersion(formImagenUrl)}
                  alt="Vista previa"
                  className="w-full h-full object-cover"
                />
                {(formTitulo || formSubtitulo) && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3.5 flex flex-col justify-end text-white">
                    <span className="font-black text-sm">{formTitulo}</span>
                    {formSubtitulo && <span className="text-xs text-stone-200">{formSubtitulo}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Enlace de destino & Interruptor Activo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-stone-700 block mb-1">
                Enlace de Destino (Opcional)
              </label>
              <input
                type="text"
                placeholder="ej. /o/oferta-especial o https://mipagina.com"
                value={formEnlaceUrl}
                onChange={(e) => setFormEnlaceUrl(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formActivado}
                  onChange={(e) => setFormActivado(e.target.checked)}
                  className="sr-only"
                />
                <div className={`w-10 h-6 rounded-full transition-colors relative ${formActivado ? 'bg-[#1B4332]' : 'bg-stone-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${formActivado ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-xs font-bold text-stone-700">
                  {formActivado ? 'Banner Activo en Rotación' : 'Banner Inactivo'}
                </span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            {bannerEditando && (
              <button
                type="button"
                onClick={handleCancelarEdicion}
                className="px-4 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar Edición
              </button>
            )}
            <button
              type="submit"
              className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{bannerEditando ? 'Guardar Cambios del Banner' : 'Agregar Banner a la Rotación'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* LISTA Y ORDENAMIENTO DE BANNERS CONFIGURADOS */}
      <div className="bg-white rounded-3xl border border-stone-200/80 p-5 sm:p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div>
            <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-700" />
              <span>Banners Configurados ({banners.length})</span>
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Los banners activos rotan automáticamente cada 5 segundos en el header del feed.
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
            {banners.filter(b => b.activado).length} Activos
          </span>
        </div>

        {banners.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-xs font-semibold">
            No hay banners registrados. Agrega uno nuevo desde el formulario superior o haz clic en "Restaurar Predeterminados".
          </div>
        ) : (
          <div className="space-y-3">
            {banners.map((b, idx) => {
              const estaEditandoEste = bannerEditando?.id === b.id;

              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                    estaEditandoEste
                      ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-300'
                      : b.activado 
                        ? 'bg-stone-50/70 border-stone-200/90' 
                        : 'bg-stone-100/60 border-stone-200/60 opacity-60'
                  }`}
                >
                  {/* Imagen miniatura e info */}
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    <div className="w-28 h-16 rounded-xl overflow-hidden border border-stone-200 shrink-0 bg-stone-200 relative">
                      <img src={withResourceVersion(b.imagenUrl)} alt={b.titulo} className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 bg-stone-900/80 text-white font-mono text-[9px] px-1.5 py-0.5 rounded">
                        #{b.orden}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-xs text-stone-900 truncate">{b.titulo}</h4>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                          b.activado ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
                        }`}>
                          {b.activado ? 'Activo' : 'Inactivo'}
                        </span>
                        {estaEditandoEste && (
                          <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-[10px] font-black">
                            Editando
                          </span>
                        )}
                      </div>
                      {b.subtitulo && <p className="text-[11px] text-stone-500 truncate">{b.subtitulo}</p>}
                      <p className="text-[10px] font-mono text-stone-400 truncate">{b.imagenUrl}</p>
                    </div>
                  </div>

                  {/* Botones de control y orden */}
                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1">
                      <button
                        type="button"
                        onClick={() => handleMover(idx, 'arriba')}
                        disabled={idx === 0}
                        className="p-1.5 hover:bg-stone-100 text-stone-600 disabled:opacity-30 rounded-lg cursor-pointer"
                        title="Mover arriba"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMover(idx, 'abajo')}
                        disabled={idx === banners.length - 1}
                        className="p-1.5 hover:bg-stone-100 text-stone-600 disabled:opacity-30 rounded-lg cursor-pointer"
                        title="Mover abajo"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleEstado(b.id, b.activado)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        b.activado
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {b.activado ? 'Pausar' : 'Activar'}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleEditar(b)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title="Editar banner"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-amber-600" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBannerEliminando(b)}
                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
                      title="Borrar banner"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Borrar</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {bannerEliminando && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-stone-200 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">¿Borrar este banner?</h3>
                <p className="text-xs text-stone-500">Esta acción removerá el banner de la rotación del feed.</p>
              </div>
            </div>

            <div className="p-3 bg-stone-50 rounded-2xl border border-stone-200 text-xs space-y-1">
              <span className="font-bold text-stone-900 block">{bannerEliminando.titulo}</span>
              <p className="text-stone-500 truncate font-mono text-[10px]">{bannerEliminando.imagenUrl}</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setBannerEliminando(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarEliminar}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Borrar Banner</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
