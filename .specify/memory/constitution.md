# vuuy Constitution

## Core Principles

### I. Persistencia total en Postgres (NON-NEGOTIABLE)
Toda data de los 3 actores (usuarios, comercios, nuuvio) vive en Postgres.
Nada persistsolo en memoria sobrevive un deploy: al arrancar, todo se carga
desde DB y solo se siembra si la tabla está vacía. Prohibido guardar estado
operativo únicamente en variables en memoria, archivos efímeros o contenedor.

### II. Imágenes a disco, jamás dataURLs (NON-NEGOTIABLE)
Toda imagen (ofertas, banners, logos, configs) se sube vía
`POST /api/media/upload`, que la compacta a WebP (máx 1600px, q80) y la guarda
en disco persistente (`/app/data/uploads`). En DB solo se guarda la URL
(`/uploads/...`). Prohibido persistir `data:` URLs en Postgres.
Si la subida falla, la operación se bloquea con error visible: jamás se
conserva ni se guarda el dataURL como fallback ("nada de esquema viejo").

### III. Deploys no borran data
`docker-entrypoint.sh` aplica schema (`drizzle-kit push`, solo aditivo) antes
de arrancar. Ningún deploy borra ofertas, usuarios, comercios, banners,
configs, estadísticas ni sesión de WhatsApp. Volúmenes persistentes:
`/app/auth_info_baileys`, `/app/data`, `/app/public/videos`.

### IV. Backend y frontend desde este repo
La fuente de verdad es este repo (`main`), no builds congelados. `index.html`
apunta a `/src/main.tsx`; `vite build` debe compilar la app real. Prohibido
commitear bundles o depender de `dist/` pre-construidos.

### V. WhatsApp Baileys compatible
Motor Baileys 7.x. Al desvincular (logout o desde el teléfono) se limpia
sesión en disco Y respaldo en DB (`whatsapp_auth_files`), evitando loops
`loggedOut` sin QR.

## Development Workflow

- Trabajar en `/home/ubuntu/nuuvio-googleaistudio`, push con `gh` a `main`,
  deploy en Coolify (`panel.sustrae.com` → app nuuvio → Redeploy).
- Verificar tras cada deploy: `/api/whatsapp/config` → JSON, QR genera,
  `/api/banners` → datos de DB.
- `bun run build` debe pasar en local antes de pushear.

## Governance

Esta constitución prevalece sobre atajos. Toda excepción requiere justificación
y plan de migración. Cambios a este archivo con commit explícito.

**Version**: 1.0.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-16
