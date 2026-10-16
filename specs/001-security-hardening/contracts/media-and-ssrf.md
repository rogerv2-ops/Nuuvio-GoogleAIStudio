# Contrato: Medios, rutas y SSRF

> Estado: pendiente (US2). Hoy hay path traversal en `GET /api/media/video/:id`
> (SEC-08), SSRF en IA/video (SEC-05) y `Range` sin validar (LOG-03).

## 1. `GET /api/media/video/:id` — público

**Confinamiento de ruta**
- `nombre = id.endsWith(".mp4") ? id : id + ".mp4"`.
- `resolved = path.resolve(VIDEOS_DIR, nombre)`.
- Válido solo si `resolved === VIDEOS_DIR || resolved.startsWith(VIDEOS_DIR + path.sep)`.
- Inválido ⇒ `400` (o `404`). No revelar la ruta resuelta.

**Validación de `Range`** (`bytes=<start>-<end>`)
- `start >= 0`, `end >= start` (si `end` ausente ⇒ `fileSize-1`), `end < fileSize`.
- Válido ⇒ `206` con `Content-Range: bytes <start>-<end>/<size>`,
  `Accept-Ranges: bytes`, `Content-Length: end-start+1`.
- Inválido ⇒ `416` con `Content-Range: bytes */<size>`.
- Sin `Range` ⇒ `200` completo.

**Casos de prueba (SC-001/SE-08/LOG-03)**
| Request | Esperado |
|---------|----------|
| `/api/media/video/..%2f..%2fetc%2fpasswd` | `400` |
| `/api/media/video/<nombre-normal>` | `200`/`206` |
| `Range: bytes=-1-` | `416` |
| `Range: bytes=10-5` | `416` |
| `Range: bytes=0-999999999` | `416` |

## 2. Guard SSRF (`validarUrlExternaPermitida(url)`)

**Aplica a**: `imageUrl` en `POST /api/gemini/generate-video`; cualquier `fetch`
disparado por datos del cliente.

**Reglas**
1. Parsear con `new URL(url)`; esquema ∈ {`http`,`https`} (si no ⇒ rechazar).
2. Resolver el host por DNS (`dns.promises.lookup`, `all: true`). Rechazar si
   **alguna** IP resuelta es privada/reservada:
   - IPv4: `0.0.0.0/8`, `10/8`, `100.64/10`, `127/8`, `169.254/16`, `172.16/12`,
     `192.0.0/24`, `192.168/16`, `198.18/15`, `224/4`, `240/4`.
   - IPv6: `::1`, `::`, `fc00::/7`, `fe80::/10`, IPv4-mapped (`::ffff:a.b.c.d`).
3. Seguir redirecciones revalidando cada `Location` (o `redirect: 'manual'`).
4. Timeout de conexión corto (≈5 s) y límite de tamaño de descarga.
5. Errores ⇒ `400` con mensaje genérico (sin filtrar detalle de red).

**Allowlist de proveedores IA** (para `baseUrl` en `/api/ai/test` y
`/api/ai/generate`):
| providerId | host permitido |
|------------|----------------|
| gemini | `generativelanguage.googleapis.com` |
| openai | `api.openai.com` |
| anthropic | `api.anthropic.com` |
| openrouter | `openrouter.ai` |

`baseUrl` cuyo host no pertenezca a la allowlist ⇒ `400`.

**Casos de prueba (SC-003)**
| Entrada | Esperado |
|---------|----------|
| `http://169.254.169.254/latest/meta-data/` | bloqueado |
| `http://127.0.0.1:3000/api/whatsapp/config` | bloqueado |
| `http://10.0.0.5/` | bloqueado |
| `http://[::1]/` | bloqueado |
| `file:///etc/passwd` | bloqueado |
| `https://images.example.com/a.webp` | permitido* |

\* sujeto a resolución DNS pública; el test usa un host público controlado.

## 3. Invariantes
- Nunca se conecta a rangos internos/metadatos desde datos del cliente.
- Las restricciones son defensivas y no alteran la subida legítima de medios
  (WebP a disco) ni la generación de video con imágenes públicas.
