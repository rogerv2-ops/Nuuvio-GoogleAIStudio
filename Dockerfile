FROM oven/bun:1 AS base
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .

# FUENTES: sin esto, las imagenes que el bot manda por WhatsApp salen SIN
# TEXTO (sin titulo, sin precio, sin comercio, sin distrito).
#
# `oven/bun:1` viene slim, sin ninguna fuente. @napi-rs/canvas dibuja con
# canvas, y sin una fuente cargada `fillText` no dibuja NADA y sin error:
# la imagen sale con los recuadros pero vacia. Medido en produccion el
# 2026-10-21: el contenedor tenia 0 fuentes y las tarjetas llegaban sin un
# solo texto.
#
# fontconfig es lo que resuelve 'sans-serif' a una fuente concreta.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      fonts-dejavu-core \
      fontconfig \
 && fc-cache -f \
 && rm -rf /var/lib/apt/lists/*

RUN bun run build && test -f dist/index.html
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["/app/docker-entrypoint.sh"]
