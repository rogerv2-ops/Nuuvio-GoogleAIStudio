# Phase 1 Data Model: Mosaico de Ofertas, Formato 1:1, Clics CPC y Redirección

Todas las entidades de dominio se persisten en Postgres (Principio I). El render
de imágenes es un artefacto efímero (no se guarda como dataURL).

## 1. ClickLog (`click_logs`)

Representa cada apertura de un enlace de oferta. Es la fuente de verdad para el
débito facturable y la analítica de clics.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | serial / PK | Autogenerado |
| `ofertaId` | text | FK lógica a `offers.id`; requerido |
| `comercioId` | text | Requerido; determina el pack a debitar |
| `usuarioTelefono` | text | Requerido; identifica al usuario para la ventana de 24 h |
| `codigoCanje` | text | Requerido; formato `NV-####`; único por clic |
| `facturable` | boolean | `true` solo si **no** existía un clic **`facturable = true`** previo de la misma pareja `(ofertaId, usuarioTelefono)` en las últimas 24 h; `false` en caso contrario o si el comercio no tiene saldo. Solo el primer clic de cada ventana de 24 h es facturable; los no facturables no reinician la ventana |
| `creadoEn` | timestamp | Autogenerado |

**Regla de facturabilidad (R3)**: `facturable = !existeClicFacturableEn24h(ofertaId, usuarioTelefono)`,
donde la ventana se ancla al **último clic facturable** (los no facturables no la reinician).
**Invariante**: un clic `facturable = true` con saldo disponible debita exactamente
1 clic del pack del comercio, y como máximo una vez por ventana de 24 h.
Nunca `saldoClics < 0`. Los "Me Gusta" no participan de esta regla (son informativos).

## 2. Offer (`offers`) — campos relevantes

| Campo | Tipo | Reglas |
|-------|------|--------|
| `id` | text / PK | — |
| `comercioId` | text | Enlaza con el pack de clics |
| `comercioNombre` | text | Mostrado en tarjeta |
| `comercioWhatsapp` | text | Destino de la redirección; debe ser válido para despachar |
| `titulo` | text | Se usa en tarjeta, pie del mosaico y mensaje "Lo quiero" |
| `descripcion` | text | Solo en detalle; **no** se repite bajo la foto en la landing |
| `precioNormal` / `precioOferta` | numeric (string) | Convertidos a `Number` en `getAllOffers` |
| `imagenes` | text[] | Primera imagen usada en tarjeta/mosaico |
| `venceEn` | text (ISO) | Oferta vencida ⇒ no elegible |
| `estado` | text | Debe ser `"activa"` para ser elegible |
| `likes` | integer | Conteo de "Me Gusta"; default 0; **incremento atómico** |
| `vistas` | integer | Contador |
| `clics` | integer | Contador de clics registrados |
| `leadsCalificados` | integer | Se incrementa por clic facturable |
| `videoUrl` | text \| null | Si existe, la landing muestra `<video>` en la tarjeta 1:1 |

**Transiciones**:
- `likes: n → n+1` en cada "Me Gusta" (anónimo, sin límite por usuario — clarificación Q1).
- `clics: n → n+1` en cada apertura de `/c/:ofertaId`.
- `leadsCalificados: n → n+1` solo si el clic es facturable **y** hay saldo.

## 3. ClickPack (en `app_settings.click_packs_list`)

No es una tabla; es una lista JSON dentro de `app_settings`.

| Campo | Tipo | Reglas |
|-------|------|--------|
| `comercioId` | text | Clave del comercio |
| `saldoClics` | integer | Cliente de clics disponibles; nunca < 0 |
| (otros) | — | Metadatos del pack (fechas, plan, etc.) |

**Operación de débito** (`facturacionModule.debitarClic`): toma el pack activo del
comercio con `saldoClics > 0`, decrementa 1 (`Math.max(0, saldo - 1)`) y persiste.

## 4. OfferCardData (DTO de render, no persistido)

Entrada de `renderOfferCardImage` / `renderMosaicImage`. Definida en
`src/utils/cardRenderer.ts`; deriva de `Offer`.

| Campo | Tipo |
|-------|------|
| `titulo` | string |
| `precioNormal` | number |
| `precioOferta` | number |
| `comercioNombre` | string |
| `distrito` | string |
| `imagen` | string (URL) |
| (opcional) `descuentoPct`, `etiqueta` | number / string |

## 5. Entidades efímeras (fuera de Postgres, permitido por constitución v1.1.0)

- **Contador de rate limit** por bucket (IP/teléfono) para `/c/` y `/api/ofertas/:id/like`.
- **Archivos `public/cards/*.jpg`**: caché de render regenerable, no data de dominio.

## 6. Reglas de validación y bordes

- Oferta elegible para el mosaico ⇔ `estado === "activa"` ∧ `no vencida` ∧
  `comercioWhatsapp` válido ∧ **`saldoClics(comercioId) > 0`**.
- El mosaico contiene entre 1 y 3 ofertas; si el filtro de saldo deja < 1 oferta,
  el bot no despacha mosaico.
- Like de oferta inexistente ⇒ `404`. Clic de oferta inexistente ⇒ `404`.
- Reapertura del enlace dentro de 24 h ⇒ `facturable = false`, sin débito, pero
  **sí** redirige (FR-021).
- Enlace obsoleto (comercio sin saldo) ⇒ `facturable = false`, sin débito, redirige.
