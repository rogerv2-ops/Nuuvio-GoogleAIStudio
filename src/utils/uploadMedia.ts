/**
 * Sube una imagen (dataURL) al servidor, que la compacta a WebP en disco.
 * Retorna la URL pública (/uploads/...) o el dataURL original como fallback.
 */
export async function subirImagenAlServidor(
  dataUrl: string,
  folder: string = "general"
): Promise<string> {
  try {
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, folder }),
    });
    const data = await res.json();
    if (res.ok && data?.ok && data.url) return data.url as string;
  } catch {
    // fallback silencioso al dataURL
  }
  return dataUrl;
}
