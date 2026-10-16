/**
 * Sube una imagen (dataURL) al servidor, que la compacta a WebP en disco.
 * Retorna la URL pública (/uploads/...).
 * CONSTITUCIÓN II: si la subida falla, LANZA error. Prohibido fallback a dataURL.
 */
export async function subirImagenAlServidor(
  dataUrl: string,
  folder: string = "general"
): Promise<string> {
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, folder }),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data?.ok && data.url) return data.url as string;
  throw new Error(data?.error || "No se pudo subir la imagen al servidor");
}
