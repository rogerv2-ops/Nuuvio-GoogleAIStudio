# Fase SEO — Que Google (y las vistas previas) vean Yuddit

Estado: **anotada para una fase propia** (decisión del dueño, 2026-10-20: *"el seo es importantísimo, así que hay que anotarlo para otra fase"*).
Rama: por crear cuando se arranque. Base: `main`.

## Contexto

La pregunta que lo disparó: *"la app, la interface aún se forma solo con javascript? no veo casi código html en la landing, eso es bueno o malo?"*.

**Respuesta medida (no opinada):** el HTML que descarga un visitante pesa **1 KB** y es literalmente:

```html
<body>
  <div id="root"></div>
</body>
```

Todo lo visible (ofertas, categorías, botones de WhatsApp) lo dibuja JavaScript: **1.5 MB** en el bundle principal (`dist/assets/index-*.js`, 1.466 MB) + `repo-*.js` (196 KB, chunk diferido de la base de datos). La landing **no tiene texto en el HTML** y sus contenidos vienen de la base (`GET /api/ofertas/publicas`), no del repo.

Es una SPA (Single Page Application) clásica: el servidor devuelve `index.html` para **cualquier** ruta.

## Lo que YA está hecho (no rehacer)

- `index.html` tiene `<title>`, `description`, `og:title`, `og:description`, `og:type`, `twitter:card` **estáticos** (esto es lo que leen Google y las vistas previas de WhatsApp/Facebook).
- Existe `src/modules/seoMetadata.ts` (aplica meta tags al DOM: description, keywords, author, robots, geo.region, geo.placename, og:*, canonical) y un editor en el panel: `src/components/SeoMetadataEditor.tsx`, montado en `ConfiguracionDomainView.tsx:413`.
- Existe `src/modules/seoMetadata.ts` con `ogImageUrl` y `canonicalUrl` configurables.

## Hallazgos verificados (2026-10-20, contra producción)

Estos NO son suposiciones; se comprobaron con `curl` y con lectura de código.

| # | Hallazgo | Evidencia | Impacto de negocio |
|---|---|---|---|
| **H1** | **El editor SEO del panel no sirve para nada público.** Guarda en `localStorage` del navegador del admin (`STORAGE_KEY = 'vuuy_global_seo_metadata_v1'`, `seoMetadata.ts:82,116`). **No hay endpoint en el servidor** que lea o guarde metadatos SEO (`grep` de `seo` en `server.ts`, `src/routes/`, `src/db/repo.ts` → vacío). | `seoMetadata.ts:40,82,116` | Lo que el admin escribe (título, keywords, imagen social, canonical) **nunca llega a un visitante ni a Google**. El editor da la sensación de configurar el sitio y no configura nada. |
| **H2** | **No hay `og:image` / `twitter:image` en el HTML servido.** | `curl https://yuddit.com/ \| grep -c "og:image"` → **0** | Las vistas previas de WhatsApp/Facebook/LinkedIn salen **sin imagen**. Es la primera señal visual del enlace: sin imagen, el clic se ve como un enlace pelado. |
| **H3** | **`/robots.txt` y `/sitemap.xml` devuelven el `index.html` de la SPA** (200), no un robots.txt ni un sitemap reales. | `curl https://yuddit.com/robots.txt \| head -3` → `<!doctype html>` | Google no encuentra nisitemap ni directiva de indexación. Sin sitemap, el descubrimiento de URLs nuevas es lento. |
| **H4** | **No hay render en servidor ni pre-render.** Todo el texto de la landing se genera en el navegador. | `index.html` = 1 KB con `div#root` vacío | Google tiene que **ejecutar JavaScript** para ver el contenido. Los robots de Google sí lo hacen, pero es más lento y menos fiable; **WhatsApp, Facebook, Slack, Twitter y iMessage NO ejecutan JS**: leen el HTML crudo. Hoy el HTML crudo tiene el título y la descripción correctos, pero **ninguna oferta, ningún precio, ningún comercio**. |
| **H5** | **El peso de la primera carga es de 1.5 MB de JS** (más 196 KB diferidos). | `ls -la dist/assets/*.js` | En 4G, la primera pantalla tarda. Para quien llega **clicando un botón de WhatsApp con expectativa de ver una oferta**, cada segundo en blanco es una salida. |
| **H6** | **El riesgo de pantalla en blanco sin que nadie lo note.** Ya está documentado en `AGENTS.md`: *"HTTP 200 no prueba que la SPA funcione"*. Un `ReferenceError` a nivel de módulo mata el script entero; `curl` sigue respondiendo 200 y el smoke da 10 ok. | `AGENTS.md` (sección "Verification gotchas") | Un fallo de JS puede dejar la landing en blanco **sin que ninguna alerta lo detecte**. Es el riesgo que más duele: silencioso. |

## Specs de la fase (propuestas, a confirmar con el dueño)

- **S1** — **Los metadatos SEO se guardan en el servidor** (tabla propia o `app_settings`), no en el `localStorage` del admin. Un endpoint admin para leer/grabar y uno público (o el render del HTML) para que los visiten.Esto cierra H1.
- **S2** — **`og:image` y `twitter:image` reales** en el HTML servido, con una imagen 1200×630 de marca. Cierra H2. (Revisar si hay que subirlos al repo `public/` o generarlos.)
- **S3** — **`robots.txt` y `sitemap.xml` reales** servidos por el servidor (antes del fallback SPA), con las URLs públicas que deban indexarse. Cierra H3.
- **S4** — **Pre-render o render en servidor de la landing**: el HTML que llega al visitante debe contener las ofertas (título, comercio, distrito, precio) y los enlaces de WhatsApp, no un `div#root` vacío. Cierra H4. Decisión a tomar: SSR en el servidor (Vite SSR / pre-render en build) vs. **pre-render estático regenerado cuando cambian las ofertas** (más simple, y el contenido cambia poco).
- **S5** — **Partir el bundle** (code splitting): que quien entra a la landing no descargue el código del panel de administración ni de la base de datos. Cierra H5 parcialmente y es de bajo riesgo.
- **S6** — **Vigilar la pantalla en blanco**: un chequeo que ejecute el bundle (headless o `jsdom`) y falle si el root queda vacío. Convierte H6 de silencioso a visible.
- **S7** — **Canónico por oferta**: cada oferta con su URL propia (`/oferta/<id>` o similar) con su título, descripción, imagen y canonical. Hoy el único enlace con datos es `/c/:id`, que es el clic con firma HMAC (no debe indexarse: `noindex`).
- **S8** — Respetar la regla WhatsApp: el número **no** puede aparecer en el HTML pre-renderizado. El enlace se sigue resolviendo en el servidor al momento del clic (`/api/whatsapp/contacto`, regla de `docs/reglas-whatsapp.md`). **Ojo**: esto condiciona S4 y S7 (el pre-render no puede "resolver" el enlace con el número dentro).

## Orden sugerido (de menor a mayor riesgo)

1. **S2 + S3** (imagen social, robots, sitemap) — bajo riesgo, mejora inmediata de las vistas previas.
2. **S1** (metadatos en el servidor) — cierra el agujero de H1, sin tocar la arquitectura de render.
3. **S5** (code splitting) — bajo riesgo, mejora la primera carga.
4. **S6** (vigilancia de pantalla en blanco) — bajo riesgo, evita repetir el modo silencioso.
5. **S4 + S7** (pre-render / render por oferta) — **el grande**. Es el que de verdad habilita el SEO, y el que más toca.

## Fuera de alcance (anotado, no decidido)

- Node de negocio: el tráfico actual de Yuddit viene de WhatsApp, no de Google. El SEO se justifica como **nuevo canal**, no comoEMS al actual. Definir con el dueño qué se busca: ¿tráfico a la landing, o posicionamiento para que el usuario de WhatsApp vea mejor el enlace?
- Métricas del nuevo canal: hoy el embudo se mide por el bot. Si entra tráfico de búsqueda, hay que poder distinguirlo (UTM de la landing, evento de origen).
- `og:image` por oferta: cada oferta con su foto (ya existen `imágenes` en `offers`).

## Verificación de la fase

- Google Search Console: verificar indexación real de la landing y de las URLs de oferta.
- Compartir un enlace de oferta en **WhatsApp** (que NO ejecuta JS) y comprobar que la vista previa trae imagen, título y descripción correctos: es el test que delata H2/H4.
- El chequeo de pantalla en blanco (S6) debe correr en CI: si el root queda vacío, la suite falla.
- Suite `tests/security` sin debilitar; `npm run lint` (gate de tipos) y `npm run build` en verde.
