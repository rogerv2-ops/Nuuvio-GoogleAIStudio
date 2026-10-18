# YUDDIT - CONSTITUCIÓN DEL CÓDIGO

Este documento contiene las reglas inquebrantables de arquitectura, producto y seguridad. Como agente de IA, DEBES leer y respetar estas reglas antes de proponer o ejecutar cualquier cambio en el código.

## 1. REGLAS DE ARQUITECTURA Y PERSISTENCIA (BACKEND FIRST)
- **Base de Datos Única:** Toda la persistencia de datos (usuarios, comercios, ofertas, clics, saldos) debe hacerse ESTRICTAMENTE en PostgreSQL utilizando Drizzle ORM (`src/db/repo.ts`). 
- **Cero JSON Locales:** Está estrictamente prohibido usar archivos `.json` locales o `localStorage` para guardar el estado del negocio. El contenedor en la nube es efímero y se borra al reiniciar.
- **Lógica en el Servidor, Vistas Tontas:** Los componentes de React (`.tsx`) solo renderizan datos. Cualquier cálculo, filtrado, ordenamiento o validación debe ocurrir en el backend (`server.ts` o `src/modules/`).

## 2. REGLAS DE MENSAJERÍA Y COSTOS (MODELO DUAL Y MOSAICOS)
- **Modelo Dual (PULL B2C / PUSH B2B):** Para los usuarios finales (consumidores), Yuddit opera 100% PULL (nunca inicia una conversación, solo responde). Para los Comercios Aliados, el sistema puede operar PUSH (envío proactivo de alertas de saldo bajo, confirmaciones de aprobación o reportes de métricas).
- **Regla de 1 Mensaje (Mosaicos):** Para ahorrar costos en la API de Meta al responder a usuarios, el bot debe responder con máximo 1 mensaje que contenga una sola imagen fusionada (Mosaico de 3 ofertas renderizado con `@napi-rs/canvas`) y 1 texto interactivo con botones nativos.
- **Formato Visual:** Todas las tarjetas individuales generadas deben tener un formato cuadrado estricto 1:1 (800x800 px).

## 3. SEGURIDAD Y PRIVACIDAD (MURO DE FUEGO)
- **Ofuscación Absoluta:** El número de WhatsApp del bot y los números de los comercios JAMÁS deben estar expuestos (`hardcoded`) en el frontend. Toda redirección debe pasar por rutas puente en el servidor (ej. `/api/go/pedir` o `/c/:ofertaId`).
- **Enlaces WhatsApp Nativos (`whatsapp://send`):** Todo enlace o redirección hacia WhatsApp DEBE usar el esquema nativo `whatsapp://send?phone=<num>&text=<texto>` (para que el sistema operativo ofrezca elegir entre WhatsApp y WhatsApp Business), con fallback a `https://api.whatsapp.com/send?...`. Está prohibido `https://wa.me/...` y redirigir (302) sin el esquema nativo. Las rutas puente del servidor (`/go/*`, `/api/go/*`) deben responder una página intersticial que intente el esquema nativo y haga fallback automático a la web.
- **Antifraude de Leads:** Todo lead o clic facturable debe validarse en Postgres para evitar cobros dobles al comercio por el mismo usuario interactuando con la misma oferta en un lapso de 24 horas.
- **Separación de Roles:** Un número de teléfono no puede ser Usuario Consumidor y Comercio a la vez. El backend debe verificar la tabla `merchants` antes que `audience_users`.

## 4. MODERACIÓN B2B (3 CAPAS)
Toda oferta nueva publicada por un comercio debe pasar por:
1. **Blacklist:** Rechazo automático si incluye palabras prohibidas (iPhone, Apple, réplica, préstamo, etc.).
2. **Guillotina de Descuento:** Si el descuento supera el 60%, pasa a revisión humana obligatoria (`en_validacion`).
3. **Visión IA:** Gemini debe validar la calidad de la foto (rechazar capturas de pantalla, baja calidad o contenido indebido).

## 5. REGLAS DEL AGENTE (TUS LÍMITES)
- **Cero instalaciones sin permiso:** Tienes prohibido ejecutar `npm install` o añadir dependencias pesadas (ej. Puppeteer, PostGIS) sin confirmación explícita del usuario.
- **Resiliencia (Try/Catch):** Todas las llamadas a APIs externas (Gemini, Meta, Baileys) deben estar envueltas en `try/catch`. Si fallan, el servidor Node.js NUNCA debe crashear.
- **Nomenclatura Bilingüe:** Usa inglés para la sintaxis (map, filter, width, height) y español para el dominio del negocio (ofertas, comercios, clics).

## Development Workflow

- Trabajar en `/home/ubuntu/nuuvio-googleaistudio`, push con `gh` a `main`,
  deploy en Coolify (`panel.sustrae.com` → app nuuvio → Redeploy).
- Verificar tras cada deploy: `/api/whatsapp/config` → JSON, QR genera,
  `/api/banners` → datos de DB.
- `bun run build` debe pasar en local antes de pushear.

## Governance

Esta constitución prevalece sobre atajos. Toda excepción requiere justificación
y plan de migración. Cambios a este archivo con commit explícito.

**Version**: 1.3.0 | **Ratified**: 2026-10-16 | **Last Amended**: 2026-10-18

**Changelog**:
- 1.3.0 (2026-10-18): nueva regla en Seguridad (§3) — todo enlace/redirección a WhatsApp
  debe usar el esquema nativo `whatsapp://send` con fallback web; prohibido `wa.me` y
  redirecciones 302 sin esquema nativo.
- 1.2.0 (2026-10-18): reescritura integral a las reglas maestras (Backend First,
  Modelo Dual PULL/PUSH, Regla de 1 Mensaje, Muro de Fuego, Moderación B2B 3 capas y
  límites del agente). Sustituye los principios I–V previos.
- 1.1.0 (2026-10-16): aclara el alcance del Principio I — el estado efímero de
  seguridad/rendimiento (p. ej. contadores de rate limiting) no es data de
  actores y queda fuera del mandato de persistencia. Resuelve el conflicto
  detectado en el análisis del feature `001-security-hardening` (C1).
- 1.0.0 (2026-10-16): ratificación inicial.
