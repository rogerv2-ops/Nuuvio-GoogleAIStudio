export function generarLinksWhatsApp(telefono: string, texto = "Ofertas") {
  const cleanPhone = telefono.replace(/\D/g, "");
  const encText = encodeURIComponent(texto);
  return {
    cleanPhone,
    nativeUrl: cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${encText}` : "#",
    webUrl: cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encText}` : "#",
  };
}

export function abrirWhatsAppNativo(telefono: string, texto = "Ofertas") {
  const { cleanPhone, nativeUrl, webUrl } = generarLinksWhatsApp(telefono, texto);
  if (!cleanPhone) return;

  // Intenta abrir el esquema nativo de WhatsApp para activar el selector de aplicaciones en móvil
  window.location.href = nativeUrl;

  // Fallback a web / api.whatsapp.com si la app nativa no responde en escritorio o no está instalada
  const startTime = Date.now();
  setTimeout(() => {
    if (Date.now() - startTime < 2500 && document.hasFocus()) {
      window.location.href = webUrl;
    }
  }, 1200);
}
