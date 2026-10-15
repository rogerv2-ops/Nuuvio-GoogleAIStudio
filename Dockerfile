# Igual a Google AI Studio: corre el mismo server.ts (Express + Vite build + Baileys en proceso)
# No cambia lógica del repo, solo el runtime (antes Nixpacks servía solo Caddy estático)
FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . ./
RUN bun run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

# server.ts en production sirve /app/dist + todas las /api/* (whatsapp, waha, banners)
CMD ["bun", "run", "start"]
