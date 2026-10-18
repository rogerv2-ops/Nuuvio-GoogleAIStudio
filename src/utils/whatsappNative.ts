export function generarLinksWhatsApp(telefono: string, texto = "Ofertas") {
  const cleanPhone = telefono.replace(/\D/g, "");
  const encText = encodeURIComponent(texto);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const webUrl = cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encText}` : "#";

  // Android: intent implicito -> el sistema muestra el selector (WhatsApp / WhatsApp Business).
  // iOS: wa.me -> iOS ofrece elegir entre WhatsApp y WhatsApp Business.
  // Escritorio: esquema nativo (abre la app de escritorio si esta instalada).
  const nativeUrl = !cleanPhone
    ? "#"
    : isAndroid
      ? `intent://send?phone=${cleanPhone}&text=${encText}#Intent;scheme=whatsapp;end`
      : isIOS
        ? `https://wa.me/${cleanPhone}?text=${encText}`
        : `whatsapp://send?phone=${cleanPhone}&text=${encText}`;

  return { cleanPhone, nativeUrl, webUrl };
}

export function abrirWhatsAppNativo(telefono: string, texto = "Ofertas") {
  const { cleanPhone, nativeUrl, webUrl } = generarLinksWhatsApp(telefono, texto);
  if (!cleanPhone) return;

  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  window.location.href = nativeUrl;

  // Fallback a web (api.whatsapp.com) si la app no responde. iOS usa wa.me y no lo necesita.
  if (!isIOS) {
    const startTime = Date.now();
    setTimeout(() => {
      if (Date.now() - startTime < 3000 && document.hasFocus()) {
        window.location.href = webUrl;
      }
    }, 1500);
  }
}
