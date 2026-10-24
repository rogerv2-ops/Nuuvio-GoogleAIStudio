/**
 * Landing del embudo de prerregistro de comercios (yuddit.com).
 *
 * HTML server-rendered detrás del flag EMBUDO_PREREGISTRO. Se sirve en
 * `/registro-comercio`; la sustitución de la raíz es un paso posterior que
 * requiere aprobación explícita del dueño (no se hace en esta rama).
 *
 * MARCA REAL: el logo no es una sustitución tipográfica. Se inyecta desde la
 * configuración viva del sitio (app_settings.landing_logo, la misma fuente
 * que usa /api/banners), así la landing del embudo usa la misma marca que el
 * resto del producto y cambia con el panel de Banners.
 *
 * COPY: los textos de campaña (titular, subtítulo, consentimiento y etiqueta
 * del botón) están PENDIENTES de la campaña de Instagram. Los provisionales
 * llevan la marca [PROVISIONAL] visible para que nadie los confunda con copy
 * aprobado. Antes de publicar la raíz hay que reemplazarlos.
 *
 * Seguridad: sin scripts externos, sin datos de terceros renderizados, el
 * logo se escapa al inyectarlo, formulario con honeypot oculto y envío por
 * fetch con fallback a POST nativo (urlencoded) si no hay JS.
 */
import { CATEGORIAS_CAPTACION } from "./categoriasCaptacion.ts";

export interface OpcionesLandingEmbudo {
  logoUrl: string;
  logoAltoPx: number;
}

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlLandingEmbudo(opts: OpcionesLandingEmbudo): string {
  const alto = Math.min(160, Math.max(24, Math.round(opts.logoAltoPx || 40)));
  const logoHtml = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="yuddit" style="height:${alto}px;display:block">`
    : `<div style="font-size:30px;font-weight:800;letter-spacing:-1px">yuddit</div>`;

  const opciones = CATEGORIAS_CAPTACION.map(
    (c) => `<option value="${esc(c)}">${esc(c)}</option>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="referrer" content="no-referrer">
<title>yuddit - Aviso de lanzamiento para comercios</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; color:#111; font-family:-apple-system,'Segoe UI',Roboto,sans-serif; min-height:100vh; display:flex; justify-content:center; }
  .wrap { width:100%; max-width:430px; padding:32px 22px 48px; }
  h1 { font-size:26px; line-height:1.25; margin:34px 0 10px; font-weight:700; }
  h1 .hl { background:#C8FF3D; padding:0 4px; border-radius:4px; }
  .sub { font-size:15px; color:#555; line-height:1.5; margin-bottom:26px; }
  label { display:block; font-size:13px; font-weight:600; margin:16px 0 6px; }
  input[type=text], input[type=email], input[type=tel], select {
    width:100%; padding:13px 14px; border:1.5px solid #111; border-radius:10px; font-size:15px; background:#fff;
  }
  input:focus, select:focus { outline:2px solid #C8FF3D; border-color:#111; }
  .opt { font-weight:400; color:#999; font-size:12px; }
  .hint { font-size:12px; color:#888; margin-top:4px; }
  .consent { display:flex; gap:10px; align-items:flex-start; margin-top:22px; font-size:12.5px; color:#444; line-height:1.45; }
  .consent input { margin-top:2px; }
  .hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
  button { width:100%; margin-top:26px; padding:15px; background:#111; color:#C8FF3D; border:none; border-radius:12px; font-size:16px; font-weight:700; cursor:pointer; }
  .note { text-align:center; font-size:12px; color:#999; margin-top:14px; }
  .err { display:none; background:#fff0f0; color:#a00; border:1px solid #f0c0c0; border-radius:8px; padding:10px 12px; font-size:13px; margin-top:14px; }
  #ok-view { display:none; text-align:center; padding:60px 0; }
  #ok-view .check { width:64px; height:64px; border-radius:50%; background:#C8FF3D; display:inline-flex; align-items:center; justify-content:center; font-size:30px; margin-bottom:18px; }
  #ok-view .baja { display:inline-block; margin-top:16px; font-size:12px; color:#999; }
  footer { margin-top:40px; text-align:center; font-size:12px; color:#bbb; }
</style>
</head>
<body>
<div class="wrap">
  ${logoHtml}
  <div id="form-view">
    <!-- [PROVISIONAL] Titular y subtítulo: copy de campaña pendiente (Roger). -->
    <h1>[PROVISIONAL] Tu comercio, a un toque de <span class="hl">nuevos clientes</span></h1>
    <p class="sub">[PROVISIONAL] Estamos preparando el lanzamiento en Miraflores, Lima. Deja tus datos y te avisamos cuando abramos.</p>
    <form id="f" method="post" action="/api/preregistros">
      <label for="nombreComercial">Nombre comercial</label>
      <input type="text" id="nombreComercial" name="nombreComercial" required maxlength="120" autocomplete="organization">
      <label for="responsable">Nombre del responsable</label>
      <input type="text" id="responsable" name="responsable" required maxlength="120" autocomplete="name">
      <label for="correo">Correo</label>
      <input type="email" id="correo" name="correo" required maxlength="160" autocomplete="email">
      <label for="distrito">Distrito o zona</label>
      <input type="text" id="distrito" name="distrito" required maxlength="120" placeholder="Ej: Miraflores">
      <p class="hint">Lanzamos primero en Miraflores. Si tu comercio está en otra zona, queda registrado para la expansión.</p>
      <label for="categoria">Categoría</label>
      <select id="categoria" name="categoria" required>
        <option value="" disabled selected>Selecciona una categoría</option>
        ${opciones}
      </select>
      <label for="whatsapp">WhatsApp <span class="opt">(opcional)</span></label>
      <input type="tel" id="whatsapp" name="whatsapp" maxlength="20" placeholder="+51 999 999 999" autocomplete="tel">
      <label for="instagram">Instagram <span class="opt">(opcional)</span></label>
      <input type="text" id="instagram" name="instagram" maxlength="80" placeholder="@tucomercio">
      <label for="tiktok">TikTok <span class="opt">(opcional)</span></label>
      <input type="text" id="tiktok" name="tiktok" maxlength="80" placeholder="@tucomercio">
      <div class="hp" aria-hidden="true"><label>Web de la empresa<input type="text" name="empresa" tabindex="-1" autocomplete="off"></label></div>
      <!-- [PROVISIONAL] Texto de consentimiento: finalidad exacta pendiente de copy. -->
      <label class="consent"><input type="checkbox" id="consentimiento" name="consentimiento" value="si" required>
        <span>[PROVISIONAL] Acepto recibir por correo el aviso de lanzamiento de yuddit. Puedo darme de baja cuando quiera, sin necesidad de cuenta.</span></label>
      <!-- [PROVISIONAL] Etiqueta del botón: pendiente de copy; no debe prometer alta de comercio si solo capta interés. -->
      <button type="submit">[PROVISIONAL] Avísenme cuando abran</button>
      <p class="note">Sin spam. Solo el aviso de lanzamiento.</p>
      <div class="err" id="err"></div>
    </form>
  </div>
  <div id="ok-view">
    <div class="check">&#10003;</div>
    <!-- [PROVISIONAL] Texto de confirmación pendiente de copy. -->
    <h1>[PROVISIONAL] Listo, te avisaremos</h1>
    <p class="sub">Gracias. Avisaremos a tu correo cuando abramos.</p>
    <a class="baja" id="baja-link" href="#">¿Te arrepentiste? Date de baja aquí</a>
  </div>
  <footer>yuddit &copy; 2026</footer>
</div>
<script>
(function(){
  var f=document.getElementById('f');
  if(!f||!window.fetch)return; // sin fetch: POST nativo (urlencoded) como fallback
  f.addEventListener('submit',function(ev){
    ev.preventDefault();
    var err=document.getElementById('err');
    err.style.display='none';
    var datos={
      nombreComercial:f.nombreComercial.value.trim(),
      responsable:f.responsable.value.trim(),
      correo:f.correo.value.trim(),
      distrito:f.distrito.value.trim(),
      categoria:f.categoria.value,
      whatsapp:f.whatsapp.value.trim(),
      instagram:f.instagram.value.trim(),
      tiktok:f.tiktok.value.trim(),
      empresa:f.empresa.value,
      consentimiento:f.consentimiento.checked?'si':''
    };
    fetch('/api/preregistros',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(datos)})
      .then(function(r){return r.json().then(function(j){return {status:r.status,j:j};});})
      .then(function(res){
        if(res.status===200&&res.j&&res.j.ok){
          document.getElementById('form-view').style.display='none';
          var ok=document.getElementById('ok-view');
          ok.style.display='block';
          if(res.j.bajaUrl)document.getElementById('baja-link').href=res.j.bajaUrl;
          window.scrollTo(0,0);
        }else{
          err.textContent=(res.j&&res.j.error)?res.j.error:'No pudimos registrar tus datos. Inténtalo de nuevo.';
          err.style.display='block';
        }
      })
      .catch(function(){
        err.textContent='Sin conexión. Inténtalo de nuevo.';
        err.style.display='block';
      });
  });
})();
</script>
</body>
</html>`;
}
