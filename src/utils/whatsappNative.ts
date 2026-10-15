/**
 * Abre WhatsApp utilizando el protocolo nativo del sistema operativo (whatsapp://send).
 * 
 * Selección de Aplicación en Teléfonos Móviles (whatsapp://send):
 * El botón de WhatsApp utiliza la URI nativa whatsapp://send?phone=NUMERO&text=Ofertas.
 * Al hacer clic desde un teléfono móvil, el sistema operativo (Android / iOS) abre el selector
 * nativo ("Abrir con..."), permitiéndote elegir explícitamente entre WhatsApp Personal,
 * WhatsApp Business o cuentas clonadas/secundarias.
 * 
 * Compatibilidad con Navegadores de Escritorio (Fallback):
 * Si se accede desde una computadora donde el navegador no ejecuta protocolos nativos, el
 * sistema detecta la permanencia del foco y redirige automáticamente a la interfaz web
 * oficial (https://api.whatsapp.com/send).
 */

export function generarUrlsWhatsApp(phone: string, text: string = 'Ofertas') {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  return {
    cleanPhone,
    nativeUrl: cleanPhone ? `whatsapp://send?phone=${cleanPhone}&text=${encodedText}` : '#',
    webUrl: cleanPhone ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}` : '#'
  };
}

export function abrirWhatsAppNativo(phone: string, text: string = 'Ofertas') {
  const { cleanPhone, nativeUrl, webUrl } = generarUrlsWhatsApp(phone, text);
  if (!cleanPhone) return;

  // 1. Invoca el protocolo nativo whatsapp://send (dispara el selector en Android / iOS)
  window.location.href = nativeUrl;

  // 2. Fallback para escritorios / navegadores sin protocolo registrado
  const start = Date.now();
  setTimeout(() => {
    // Si tras 1200ms la ventana retiene el foco (no se abrió app externa), redirige a WhatsApp Web
    if (Date.now() - start < 2500 && document.hasFocus()) {
      window.location.href = webUrl;
    }
  }, 1200);
}

