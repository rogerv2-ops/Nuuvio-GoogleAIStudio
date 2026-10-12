import React, { useState, useEffect } from 'react';
import { 
  Globe, Search, CheckCircle2, AlertCircle, Sparkles, Copy, Check,
  Share2, RefreshCw, Save, Tag, ExternalLink, Code2, Eye, ShieldCheck,
  Info, ArrowUpRight, Smartphone, Monitor
} from 'lucide-react';
import { seoMetadataModule, SeoMetadata, SeoScoreResult } from '../modules/seoMetadata';

interface SeoMetadataEditorProps {
  usuarioNombre?: string;
  onGuardadoExitoso?: () => void;
}

export const SeoMetadataEditor: React.FC<SeoMetadataEditorProps> = ({
  usuarioNombre = 'Super Admin',
  onGuardadoExitoso
}) => {
  const [datos, setDatos] = useState<SeoMetadata>(() => seoMetadataModule.obtenerMetadatos());
  const [nuevaPalabraClave, setNuevaPalabraClave] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [tabPrevisualizacion, setTabPrevisualizacion] = useState<'google' | 'social' | 'schema'>('google');
  const [vistaDispositivo, setVistaDispositivo] = useState<'mobile' | 'desktop'>('mobile');

  // Palabras clave sugeridas para enriquecer SEO local de Lima
  const PALABRAS_SUGERIDAS = [
    'ofertas lima',
    'descuentos miraflores',
    'promociones san isidro',
    'gastronomia peruana',
    'cafeterias barranco',
    'asistente whatsapp',
    'cupones surco',
    'comercios verificados',
    'compras lima',
    'descuentos surquillo'
  ];

  // Cálculo de análisis y puntuación en tiempo real
  const diagnostico: SeoScoreResult = seoMetadataModule.calcularPuntuacion(datos);

  // Suscribirse a cambios externos
  useEffect(() => {
    const unsub = seoMetadataModule.suscribir(() => {
      setDatos(seoMetadataModule.obtenerMetadatos());
    });
    return unsub;
  }, []);

  const handleChange = <K extends keyof SeoMetadata>(campo: K, valor: SeoMetadata[K]) => {
    setDatos(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  const handleAgregarPalabraClave = () => {
    const palabra = nuevaPalabraClave.trim().toLowerCase();
    if (!palabra) return;
    if (datos.keywords.includes(palabra)) {
      setNuevaPalabraClave('');
      return;
    }
    setDatos(prev => ({
      ...prev,
      keywords: [...prev.keywords, palabra]
    }));
    setNuevaPalabraClave('');
  };

  const handleEliminarPalabraClave = (palabra: string) => {
    setDatos(prev => ({
      ...prev,
      keywords: prev.keywords.filter(k => k !== palabra)
    }));
  };

  const handleAgregarSugerida = (sugerida: string) => {
    if (!datos.keywords.includes(sugerida)) {
      setDatos(prev => ({
        ...prev,
        keywords: [...prev.keywords, sugerida]
      }));
    }
  };

  const handleGuardar = () => {
    setGuardando(true);
    try {
      seoMetadataModule.guardarMetadatos(datos, usuarioNombre);
      setMensajeExito('¡Metadatos SEO actualizados y aplicados en el documento HTML!');
      if (onGuardadoExitoso) onGuardadoExitoso();
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (e) {
      console.error(e);
      alert('Error al guardar los metadatos.');
    } finally {
      setGuardando(false);
    }
  };

  const handleRestaurar = () => {
    if (window.confirm('¿Deseas restaurar todos los metadatos SEO a los valores predeterminados de fábrica?')) {
      const rest = seoMetadataModule.restaurarPredeterminados(usuarioNombre);
      setDatos(rest);
      setMensajeExito('Valores de fábrica restablecidos correctamente.');
      setTimeout(() => setMensajeExito(null), 3500);
    }
  };

  const handleCopiarHtml = () => {
    const snippet = seoMetadataModule.generarHtmlSnippet();
    navigator.clipboard.writeText(snippet);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  // Indicadores de longitud
  const titleLen = datos.title.length;
  const descLen = datos.description.length;

  return (
    <div className="space-y-6">
      {/* Banner Superior / Encabezado del Módulo */}
      <div className="bg-gradient-to-br from-[#1B4332] to-[#0F281E] text-white p-5 sm:p-7 rounded-2xl sm:rounded-3xl shadow-sm relative overflow-hidden">
        {/* Adorno decorativo de fondo */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-emerald-300">
              <Globe className="w-3.5 h-3.5" />
              <span>SEO Global & Motores de Búsqueda</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white">
              Gestor de Metadatos SEO y Posicionamiento
            </h2>
            <p className="text-xs sm:text-sm text-stone-200/90 leading-relaxed font-normal">
              Edita el título global, meta descripción, palabras clave (keywords) y tarjetas sociales de vuuy. 
              Los cambios se sincronizan en vivo con las etiquetas <code className="bg-black/30 px-1.5 py-0.5 rounded text-emerald-300 font-mono text-[11px]">&lt;head&gt;</code> y enriquecen la visibilidad en Google y WhatsApp.
            </p>
          </div>

          {/* Tarjeta de Calificación / Health Score SEO */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-4 rounded-2xl flex flex-col items-center sm:items-start shrink-0 min-w-[220px]">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-medium text-stone-300">Puntaje de Optimización</span>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                diagnostico.score >= 85 ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/30' :
                diagnostico.score >= 60 ? 'bg-amber-500/30 text-amber-200 border border-amber-400/30' :
                'bg-rose-500/30 text-rose-200 border border-rose-400/30'
              }`}>
                {diagnostico.grade}
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {diagnostico.score}
              </span>
              <span className="text-sm font-semibold text-stone-300">/ 100</span>
            </div>
            {/* Barra de progreso visual */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2.5">
              <div 
                className={`h-full transition-all duration-500 ${
                  diagnostico.score >= 85 ? 'bg-emerald-400' :
                  diagnostico.score >= 60 ? 'bg-amber-400' :
                  'bg-rose-400'
                }`}
                style={{ width: `${diagnostico.score}%` }}
              />
            </div>
            <span className="text-[11px] text-stone-300 mt-2 text-center sm:text-left">
              {diagnostico.items.filter(i => i.status === 'passed').length} de {diagnostico.items.length} directrices cumplidas
            </span>
          </div>
        </div>
      </div>

      {/* Notificación de éxito al guardar */}
      {mensajeExito && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="text-xs sm:text-sm font-semibold">{mensajeExito}</span>
          </div>
          <button 
            type="button"
            onClick={() => setMensajeExito(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Grid de 2 Columnas: Formulario de Edición a la izquierda, Previsualizaciones & Diagnóstico a la derecha */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ================= COLUMNA IZQUIERDA: FORMULARIO DE EDICIÓN (7 Cols) ================= */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Bloque 1: Metadatos Esenciales de Búsqueda */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1B4332] flex items-center justify-center font-bold">
                  <Search className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">Metadatos Principales (SERP)</h3>
                  <p className="text-[11px] text-stone-400">Indexación primaria para buscadores web</p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-stone-500 bg-stone-100 px-2.5 py-1 rounded-lg">
                HTML &lt;head&gt;
              </span>
            </div>

            {/* Campo: Título de la Aplicación */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="seo-title" className="font-bold text-stone-800 flex items-center gap-1.5">
                  <span>Título de la Página (&lt;title&gt;)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                    titleLen >= 30 && titleLen <= 65
                      ? 'bg-emerald-100 text-emerald-800'
                      : titleLen === 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {titleLen} / 60 caracteres
                  </span>
                </div>
              </div>
              <input
                id="seo-title"
                type="text"
                value={datos.title}
                onChange={e => handleChange('title', e.target.value)}
                placeholder="vuuy — Asistente de WhatsApp y Ofertas Cercanas"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all"
              />
              <p className="text-[11px] text-stone-500 leading-tight">
                El título debe contener el nombre de la marca e intención de búsqueda (ideal: 30 a 60 caracteres).
              </p>
            </div>

            {/* Campo: Meta Descripción */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="seo-description" className="font-bold text-stone-800 flex items-center gap-1.5">
                  <span>Meta Descripción (&lt;meta name="description"&gt;)</span>
                  <span className="text-rose-500">*</span>
                </label>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                  descLen >= 120 && descLen <= 165
                    ? 'bg-emerald-100 text-emerald-800'
                    : descLen === 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {descLen} / 160 caracteres
                </span>
              </div>
              <textarea
                id="seo-description"
                rows={3}
                value={datos.description}
                onChange={e => handleChange('description', e.target.value)}
                placeholder="Describe tu propuesta de valor en 1-2 oraciones claras..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-xs sm:text-sm font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332] transition-all resize-y"
              />
              <div className="flex items-center justify-between text-[11px] text-stone-500">
                <span>Resumen persuasivo con llamada a la acción para aumentar el CTR orgánico (ideal: 120 - 160 caracteres).</span>
              </div>
            </div>

            {/* Campo: Palabras Clave (Keywords Tag Manager) */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100">
              <div className="flex items-center justify-between text-xs">
                <label className="font-bold text-stone-800 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-stone-500" />
                  <span>Palabras Clave (&lt;meta name="keywords"&gt;)</span>
                </label>
                <span className="text-[11px] font-semibold text-stone-500">
                  {datos.keywords.length} agregadas
                </span>
              </div>

              {/* Input para añadir nueva palabra clave */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nuevaPalabraClave}
                  onChange={e => setNuevaPalabraClave(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAgregarPalabraClave();
                    }
                  }}
                  placeholder="Escribe un término (ej: 'ofertas san borja') y presiona Enter..."
                  className="flex-1 px-3.5 py-2 rounded-xl border border-stone-200 text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20 focus:border-[#1B4332]"
                />
                <button
                  type="button"
                  onClick={handleAgregarPalabraClave}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0"
                >
                  Agregar
                </button>
              </div>

              {/* Tags activos */}
              <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 bg-stone-50 rounded-xl border border-stone-200/80">
                {datos.keywords.length === 0 ? (
                  <span className="text-xs text-stone-400 italic">No hay palabras clave registradas aún.</span>
                ) : (
                  datos.keywords.map((kw, idx) => (
                    <span 
                      key={idx}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-800 shadow-2xs group"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleEliminarPalabraClave(kw)}
                        className="text-stone-400 hover:text-rose-600 transition-colors ml-0.5"
                        title={`Eliminar "${kw}"`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Nube de palabras sugeridas para autocompletar rápidamente */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-stone-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>Sugerencias rápidas para Lima:</span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {PALABRAS_SUGERIDAS.map((sug, i) => {
                    const yaEsta = datos.keywords.includes(sug);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={yaEsta}
                        onClick={() => handleAgregarSugerida(sug)}
                        className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                          yaEsta
                            ? 'bg-stone-100 text-stone-400 line-through cursor-default'
                            : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60 font-medium'
                        }`}
                      >
                        + {sug}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bloque 2: OpenGraph & Redes Sociales */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">Tarjetas Sociales (OpenGraph & Twitter)</h3>
                  <p className="text-[11px] text-stone-400">Visualización al compartir en WhatsApp, Facebook y X</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Título Social (og:title)</label>
                <input
                  type="text"
                  value={datos.ogTitle}
                  onChange={e => handleChange('ogTitle', e.target.value)}
                  placeholder="Título para compartir"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Tipo de Tarjeta Twitter</label>
                <select
                  value={datos.twitterCard}
                  onChange={e => handleChange('twitterCard', e.target.value as 'summary_large_image' | 'summary')}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                >
                  <option value="summary_large_image">summary_large_image (Tarjeta grande con foto)</option>
                  <option value="summary">summary (Tarjeta pequeña)</option>
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-stone-700">URL de Imagen Social (og:image)</label>
                <input
                  type="url"
                  value={datos.ogImageUrl}
                  onChange={e => handleChange('ogImageUrl', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
                <p className="text-[11px] text-stone-400">
                  Recomendado: 1200 x 630 px en formato JPG o PNG para máxima nitidez en WhatsApp y redes.
                </p>
              </div>
            </div>
          </div>

          {/* Bloque 3: Indexación & Configuración Técnica */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0F172A]">Directivas de Indexación & Schema</h3>
                  <p className="text-[11px] text-stone-400">Control de rastreo y marcado semántico</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">URL Canónica Principal</label>
                <input
                  type="url"
                  value={datos.canonicalUrl}
                  onChange={e => handleChange('canonicalUrl', e.target.value)}
                  placeholder="https://vuuy.pe"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Directiva Robots (&lt;meta name="robots"&gt;)</label>
                <select
                  value={datos.robots}
                  onChange={e => handleChange('robots', e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                >
                  <option value="index, follow">index, follow (Indexar y seguir enlaces - Recomendado)</option>
                  <option value="noindex, follow">noindex, follow (No indexar en buscadores, pero seguir enlaces)</option>
                  <option value="noindex, nofollow">noindex, nofollow (Privado / Oculto a motores)</option>
                  <option value="index, nofollow">index, nofollow (Indexar página, no seguir enlaces)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Tipo de Esquema Schema.org (JSON-LD)</label>
                <select
                  value={datos.schemaType}
                  onChange={e => handleChange('schemaType', e.target.value as 'WebApplication' | 'LocalBusiness' | 'Organization')}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                >
                  <option value="WebApplication">WebApplication (Aplicación Web & Directorio)</option>
                  <option value="LocalBusiness">LocalBusiness (Red de Comercios Locales)</option>
                  <option value="Organization">Organization (Organización Corporativa)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700">Región Geográfica (Lima, Perú)</label>
                <input
                  type="text"
                  value={datos.geoPlacename}
                  onChange={e => handleChange('geoPlacename', e.target.value)}
                  placeholder="Lima, Perú"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-medium text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#1B4332]/20"
                />
              </div>
            </div>
          </div>

          {/* Barra de Acciones y Guardado */}
          <div className="bg-white rounded-2xl border border-stone-200/80 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 sticky bottom-4 z-20">
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <Info className="w-4 h-4 text-stone-400 shrink-0" />
              <span>Última actualización: {new Date(datos.ultimaActualizacion).toLocaleString()}</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleRestaurar}
                className="flex-1 sm:flex-none px-3.5 py-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                title="Restaurar a valores de fábrica"
              >
                <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                <span>Restaurar</span>
              </button>

              <button
                type="button"
                onClick={handleGuardar}
                disabled={guardando}
                className="flex-1 sm:flex-none px-5 py-2.5 bg-[#1B4332] hover:bg-[#153427] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{guardando ? 'Guardando...' : 'Guardar y Aplicar en Vivo'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* ================= COLUMNA DERECHA: PREVISUALIZACIÓN EN VIVO & DIAGNÓSTICO (5 Cols) ================= */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Tarjeta de Previsualización Interactiva */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-bold text-[#0F172A]">Previsualización en Vivo</h3>
              </div>
              
              {/* Selector de pestaña de preview */}
              <div className="flex items-center bg-stone-100 p-0.5 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setTabPrevisualizacion('google')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    tabPrevisualizacion === 'google' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-500'
                  }`}
                >
                  Google
                </button>
                <button
                  type="button"
                  onClick={() => setTabPrevisualizacion('social')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    tabPrevisualizacion === 'social' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-500'
                  }`}
                >
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setTabPrevisualizacion('schema')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    tabPrevisualizacion === 'schema' ? 'bg-white text-stone-900 shadow-2xs font-bold' : 'text-stone-500'
                  }`}
                >
                  JSON-LD
                </button>
              </div>
            </div>

            {/* PREVISUALIZACIÓN 1: GOOGLE SERP */}
            {tabPrevisualizacion === 'google' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Cómo verán los usuarios a vuuy en los resultados de Google:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setVistaDispositivo('mobile')}
                      className={`p-1 rounded ${vistaDispositivo === 'mobile' ? 'bg-stone-200 text-stone-800' : 'text-stone-400'}`}
                      title="Vista Móvil"
                    >
                      <Smartphone className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaDispositivo('desktop')}
                      className={`p-1 rounded ${vistaDispositivo === 'desktop' ? 'bg-stone-200 text-stone-800' : 'text-stone-400'}`}
                      title="Vista Escritorio"
                    >
                      <Monitor className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Google Snippet Box */}
                <div className={`p-4 rounded-xl border border-stone-200/90 bg-white font-sans ${
                  vistaDispositivo === 'mobile' ? 'max-w-[340px] mx-auto shadow-xs' : ''
                }`}>
                  {/* URL / Breadcrumb */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#1B4332] text-white flex items-center justify-center text-[10px] font-bold">
                      v
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[12px] font-medium text-stone-900 leading-tight">vuuy</span>
                      <span className="text-[11px] text-stone-500 truncate leading-tight">
                        {datos.canonicalUrl || 'https://vuuy.pe'}
                      </span>
                    </div>
                  </div>

                  {/* Title Link */}
                  <h4 className="text-[15px] sm:text-[16px] text-[#1a0dab] hover:underline cursor-pointer font-normal leading-snug line-clamp-2">
                    {datos.title || 'vuuy — Asistente de Ofertas y Comercios'}
                  </h4>

                  {/* Description Snippet */}
                  <p className="text-[12px] sm:text-[13px] text-[#4d5156] mt-1 leading-relaxed line-clamp-3">
                    {datos.description || 'Sin descripción configurada.'}
                  </p>

                  {/* Keywords highlight mockup */}
                  {datos.keywords.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap gap-1">
                      <span className="text-[10px] text-stone-400">Coincidencias clave:</span>
                      {datos.keywords.slice(0, 4).map((k, i) => (
                        <span key={i} className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded">
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PREVISUALIZACIÓN 2: WHATSAPP / SOCIAL CARD */}
            {tabPrevisualizacion === 'social' && (
              <div className="space-y-3">
                <p className="text-[11px] text-stone-500">
                  Previsualización de la tarjeta de enlace que verán las personas cuando se comparta vuuy por WhatsApp o redes:
                </p>

                <div className="bg-[#EFEAE2] p-3 rounded-2xl">
                  {/* Burbuja estilo WhatsApp */}
                  <div className="bg-white rounded-xl shadow-xs overflow-hidden max-w-[320px] mx-auto border border-stone-200/60">
                    {/* Imagen OpenGraph */}
                    <div className="w-full h-36 bg-stone-100 relative overflow-hidden">
                      {datos.ogImageUrl ? (
                        <img 
                          src={datos.ogImageUrl} 
                          alt="OpenGraph Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-stone-400">
                          Sin imagen configurada
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        vuuy.pe
                      </div>
                    </div>

                    {/* Texto de la tarjeta */}
                    <div className="p-3 space-y-1 bg-[#F9F9F9]">
                      <h5 className="text-xs font-bold text-stone-900 line-clamp-2 leading-tight">
                        {datos.ogTitle || datos.title}
                      </h5>
                      <p className="text-[11px] text-stone-600 line-clamp-2 leading-snug">
                        {datos.ogDescription || datos.description}
                      </p>
                      <span className="text-[10px] text-stone-400 block pt-1">vuuy.pe</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* PREVISUALIZACIÓN 3: SCHEMA JSON-LD */}
            {tabPrevisualizacion === 'schema' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-stone-500">
                  <span>Marcado JSON-LD Schema.org inyectado en el DOM:</span>
                  <button
                    type="button"
                    onClick={handleCopiarHtml}
                    className="flex items-center gap-1 text-emerald-700 font-bold hover:underline"
                  >
                    {copiado ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiado ? '¡Copiado!' : 'Copiar todo el HTML'}</span>
                  </button>
                </div>

                <div className="bg-stone-900 text-emerald-300 font-mono text-[11px] p-3 rounded-xl overflow-x-auto max-h-64 scrollbar-thin">
                  <pre>{JSON.stringify(seoMetadataModule.generarJsonLdObjeto(), null, 2)}</pre>
                </div>
              </div>
            )}

          </div>

          {/* Tarjeta de Lista de Comprobación y Consejos de Posicionamiento */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-stone-200/80 p-4 sm:p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
              <h3 className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Auditoría & Consejos SEO</span>
              </h3>
              <span className="text-[11px] font-semibold text-stone-500">
                Puntaje {diagnostico.score}/100
              </span>
            </div>

            <div className="space-y-2.5">
              {diagnostico.items.map((item) => (
                <div 
                  key={item.id}
                  className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                    item.status === 'passed' 
                      ? 'bg-emerald-50/60 border-emerald-200/70 text-emerald-900' :
                    item.status === 'warning'
                      ? 'bg-amber-50/60 border-amber-200/70 text-amber-900' :
                      'bg-rose-50/60 border-rose-200/70 text-rose-900'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {item.status === 'passed' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                    {item.status === 'warning' && <AlertCircle className="w-4 h-4 text-amber-600" />}
                    {item.status === 'failed' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <span className="font-bold block leading-tight">{item.label}</span>
                    <p className="text-[11px] text-stone-600 leading-normal">{item.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Botón rápido para copiar el bloque HTML <head> completo */}
            <div className="pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={handleCopiarHtml}
                className="w-full py-2.5 px-3 rounded-xl bg-stone-50 hover:bg-stone-100 border border-stone-200/80 text-stone-700 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Code2 className="w-3.5 h-3.5 text-stone-500" />
                <span>{copiado ? '¡Código HTML Copiado!' : 'Copiar Snippet HTML <head>'}</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
