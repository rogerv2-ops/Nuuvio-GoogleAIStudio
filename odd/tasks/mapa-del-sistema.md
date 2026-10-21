# Mapa del sistema — inventario verificado del estado real

Estado: **mapa completo (primera mitad de la fase)**. Decisión del dueño (2026-10-20): *"mapa completo primero, después implementar"*.
Base: `main` a 2026-10-20, commit `dc92a65`. Verificado contra **producción real** (contenedor `pnpsnjshl9otauk7y7m5dqtf-20261020T223237`), no contra el código solamente.

> Por qué esta fase: el dueño notó que cada corrección destapa otra, y que **no hay un mapa**. *"Así como has encontrado muchos endpoints sueltos hay muchas funciones más que aún no están bien, no hay un mapeo completo aún de eventos que sea de nivel"*. Este documento es ese mapa: qué existe, qué funciona, qué está a medias y qué no existe.

---

## 1. Superficie HTTP — 69 endpoints, verificados en caliente

Extraídos del código (`server.ts` 40 + `src/routes/audience.ts` 11 + `src/routes/auth.ts` 18) y **verificados uno por uno contra producción**.

| Respuesta sin sesión | Cantidad | Qué son |
|---|---|---|
| **401** | 44 | Requieren sesión (gate global de `/api`) |
| **400** | 9 | Reaching the handler pero falta el cuerpo válido |
| **200** | 7 | Públicos de lectura |
| **403** | 3 | Webhooks con secreto inválido (fail-closed ✓) |
| **404** | 3 | Ruta con parámetro inexistente |
| **302** | 1 | `/c/:ofertaId` (redirección al comercio) |

**Superficie pública (22 endpoints)** — lo que cualquiera puede tocar sin sesión:

| Endpoint | Qué hace | Nota |
|---|---|---|
| `GET /api/whatsapp/contacto` | Resuelve el número del bot y arma el enlace | Devuelve el número del bot: **es lo que permite el botón de WhatsApp** (regla de `docs/reglas-whatsapp.md`) |
| `GET /api/whatsapp/public` | Estado del bot (conectado o no) | No expone el número |
| `POST /api/whatsapp/webhook`, `POST /api/waha/webhook` | Entrada de mensajes | Con secreto: 403 sin él ✓ |
| `GET /api/ofertas`, `/api/ofertas/publicas`, `/api/banners` | Catálogo público | Sin teléfonos de comercio ✓ |
| `POST /api/ofertas/:id/like` | Like anónimo | No factura, no escribe en click_logs |
| `GET /c/:ofertaId` | El clic con firma | **Único camino que factura** |
| `POST /api/audience/sync-user`, `check-uniqueness`, `log-registration` | El embudo de registro web | **Sin auth** — hallazgo abierto (ver §5) |
| `GET /api/verify-email`, `GET /api/audience/verify-token` | Verificación por token | `verify-token` devuelve la ficha completa del usuario — hallazgo abierto |
| `POST /api/auth/login`, `/login/mfa`, `/logout`, `/forgot-password`, `/reset-password` | Autenticación | Rate limit: 10 logins / 5 min |
| `GET /api/auth/me` | Sesión actual | Devuelve 401 sin cookie/token |

**Discrepancias entre código y servidor: 1, y es correcta.** `/api/auth/me` está en `esRutaPublica` (para que el `401` lo maneje el propio handler) pero igual exige token. Los `404` son IDs de prueba inexistentes.

**Conclusión de esta sección: la superficie HTTP está sana.** Lo que falló en las correcciones anteriores no fue el gate, sino el *contenido* de la respuesta (el email inventado) y la *frescura* de los datos.

---

## 2. Datos — 15 tablas, con filas reales en producción

| Tabla | Filas | Qué guarda | Estado |
|---|---|---|---|
| `security_logs` | 1078 | Accesos denegados, sesiones, eventos de seguridad | ✅ **Es el log real del sistema** |
| `chat_logs` | 352 | Mensajes del bot (entrada/salida) | ✅ Persiste |
| `sessions` | 74 | Sesiones activas | ✅ |
| `email_logs` | 10 | Correos enviados | ✅ |
| `click_logs` | 8 | Clics con `codigo_canje` y `facturable` | ✅ Persiste |
| `app_settings` | 16 | Ajustes (comercios, banners, config) | ✅ |
| `offers` | 6 | Catálogo | ✅ |
| `click_packs` | 3 | Paquetes de clics por comercio | ✅ |
| `audience_users` | 2 | Usuarios de audiencia (identidad = teléfono) | ✅ (PR #20) |
| `auth_users` | 2 | Admin + comercio | ✅ |
| `banners` | 1 | Banners del feed | ✅ |
| `login_failures` | 1 | Bloqueo por intentos fallidos | ✅ |
| `registration_logs` | **0** | Auditoría del registro web | ⚠️ **Vacía: el registro por WhatsApp no pasa por acá** |
| `users` | 0 | Tabla legacy (uid/email), no usada | 🗑️ Muerta |
| `geo_territorios` | 2.095 | Catálogo geográfico del Perú (UBIGEO del INEI): 25 departamentos, 196 provincias, 1.874 distritos. `activo` = dónde opera el negocio | ✅ (PR #29) |

---

## 3. Eventos — el hueco de fondo (aquí está el problema)

### 3.1 Lo que hay

- **28 tipos de evento** emitidos en toda la app (`coreEvents.emitir`), repartidos en 8 módulos del cliente.
- `tipoEvento: string` en el tipo: **no hay catálogo**. El compilador no puede detectar un evento mal escrito ni uno que ya no exista.
- `coreEvents` es una **instancia en memoria**: `this.eventos.unshift(...)` en un array del objeto. En el cliente vive en la pestaña; en el servidor, en el proceso.

### 3.2 Lo que NO hay — y es lo importante

| Lo que falta | Consecuencia medida |
|---|---|
| **Los eventos no se persisten.** No hay tabla de eventos (las 14 tablas no incluyen ninguna). | Al recargar la página **se borra todo el historial de eventos**. |
| **El servidor no emite eventos de negocio.** `server.ts` tiene 0 emisiones de `coreEvents` (solo 9 `insertChatLog`, que sí persisten). | Los eventos que nacen en el bot (el más importante: qué le pasa a cada persona) **nunca llegan al sistema de eventos**. |
| **Los tableros se alimentan de la memoria.** `analitica.ts:32` hace `coreEvents.consultar()`; `UtmAttributionDashboardWidget.tsx:99` hace `coreEvents.consultar({limite:250})`. | **El panel de analítica y el widget UTM muestran los eventos de la pestaña abierta**, no la historia del negocio. Al recargar, quedan los 26 eventos semilla + lo que se haya emitido en esa sesión. |
| **El embudo que el dueño quiere medir vive solo en el cliente.** `embudo_registro_completado` se emite en `UserRegistrationFunnelModal.tsx:199` (navegador) y no se persiste. | El embudo de registro **no se puede auditar** ni comparar entre sesiones. |

### 3.3 La incoherencia de fondo

El sistema tiene **dos sistemas de registro que no se hablan**:

| Sistema | Dónde vive | Qué registra |
|---|---|---|
| **Persistente** (tablas) | PostgreSQL | chats, clics, usuarios, sesiones, emails, packs, seguridad |
| **Efímero** (`coreEvents`) | Memoria del navegador/proceso | el embudo, la atribución UTM, el ciclo de vida de ofertas y comercios |

**Los tableros que el dueño usa para decidir están del lado efímero.** Por eso la analítica "se ve bien" mientras el negocio se mueve en la base: son dos verdades distintas.

### 3.4 Catálogo de los 28 eventos (estado real)

| Evento | Se emite en | Llega a la base | Lo lee alguien |
|---|---|---|---|
| `usuario_registrado_utm` | `usuarios.ts` | ❌ | `UtmAttributionDashboardWidget` |
| `visita_landing_utm` | `attribution.ts` | ❌ | `UtmAttributionDashboardWidget` |
| `embudo_registro_completado` | `UserRegistrationFunnelModal.tsx` | ❌ | `analitica.ts` |
| `clic_contactar` | `clics.ts` | ❌ | `analitica.ts` |
| `click_lo_quiero_directo` | `PublicWeb.tsx` | ❌ | `analitica.ts` |
| `oferta_mostrada` / `oferta_enviada` / `oferta_solicitada` | `ofertas.ts` | ❌ | `analitica.ts` |
| `oferta_activada` / `oferta_rechazada` / `oferta_reportada` | `ofertas.ts` | ❌ (parcial: `offers.estado`) | `analitica.ts` |
| `comercio_registrado` / `comercio_validado` / `comercio_calificado` / `comercio_rechazado` / `etapa_kanban_cambiada` | `comercios.ts` | ❌ (parcial: `merchants_list`) | `analitica.ts` |
| `pack_comprado` / `pack_agotado` | `facturacion.ts` | ⚠️ parcial (`click_packs`) | `analitica.ts` |
| `puntos_ganados` / `recompensa_canjeada` / `codigo_validado` | `puntos.ts` | ❌ (los puntos viven en `localStorage` del cliente) | `analitica.ts` |
| `email_verificado` / `email_verificado_token` | `usuarios.ts` | ⚠️ parcial (`audience_users.email_verificado`) | `analitica.ts` |
| `usuario_baja` | `usuarios.ts` | ⚠️ parcial (`audience_users.estado`) | `analitica.ts` |
| `whatsapp_vinculado` | `usuarios.ts` | ❌ | `analitica.ts` |
| `mensaje_recibido` | `clics.ts` | ❌ (los chats sí van a `chat_logs`) | `analitica.ts` |
| `venta_confirmada` | `VentasComercioView.tsx` | ❌ | `analitica.ts` |
| `digest_enviado` | `digest.ts` | ⚠️ parcial (`email_logs`) | `analitica.ts` |

**Los 28 se emiten en el cliente. Ninguno llega a la base. Los 4 que tienen reflejo en la base lo tienen por OTRO camino** (el estado de la fila), no porque el evento se persista.

---

## 4. Módulos del cliente — qué persiste y qué no

| Módulo | `fetch` a la API | Emite eventos | Guarda en `localStorage` | Estado |
|---|---|---|---|---|
| `usuarios.ts` | 3 | 6 | 2 | ⚠️ La copia local se sanearon (PR #21) y el servidor manda |
| `comercios.ts` | 1 | 5 | 0 | ✅ persiste en `app_settings.merchants_list` |
| `ofertas.ts` | 1 | 4 | 1 | ✅ persiste en `offers` |
| `banners.ts` | 2 | 0 | 2 | ✅ persiste en `banners` |
| `emailService.ts` | 5 | 0 | 0 | ✅ persiste en `email_logs` |
| `facturacion.ts` | 0 | 3 | 0 | ⚠️ **0 fetch**: el saldo de clics vive **solo en el navegador** del comercio |
| `puntos.ts` | 0 | 3 | 0 | ⚠️ **0 fetch**: los puntos y canjes viven **solo en el navegador** |
| `clics.ts` | 0 | 4 | 0 | ⚠️ **0 fetch**: los clics del cliente viven solo en memoria |
| `analitica.ts` | 0 | 0 | 0 | ⚠️ **0 fetch**: lee `coreEvents` (memoria) |
| `digest.ts` | 0 | 1 | 0 | ⚠️ **0 fetch** |
| `seoMetadata.ts` | 0 | 2 | 1 | 🔴 **0 fetch**: el editor SEO del panel **nunca llega al servidor** (fase SEO) |
| `vistaComo.ts` | 0 | 0 | 0 | ✅ estado de sesión, en memoria |

**5 de 12 módulos de dominio no talking con la base en absoluto** (facturacion, puntos, clics, analitica, digest). Para el dueño esto significa: **el saldo de clics y los puntos de un comercio se ven bien en su pantalla, pero no están en la base** → no hay respaldo, no se ven desde otro dispositivo y no se pueden auditar.

---

## 5. Hallazgos con consecuencia de negocio (priorizados)

| # | Hallazgo | Consecuencia | Severidad |
|---|---|---|---|
| **H1** | Los tableros de analítica y UTM leen eventos **en memoria** | Muestran la pestaña actual, no el negocio. **Decidir con esos números es decidir sobre datos que no existen** | 🔴 Crítica |
| **H2** | Los eventos no se persisten (no hay tabla) | Nada es auditable: ni el embudo, ni la atribución UTM, ni el ciclo de vida de ofertas/comercios | 🔴 Crítica |
| **H3** | El servidor no emite eventos de negocio | Lo que pasa en el bot (el canal principal) no aparece en ningún sistema de eventos | 🔴 Crítica |
| **H4** | `facturacion.ts` y `puntos.ts` no tienen `fetch`: saldo de clics y puntos viven solo en el navegador | El comercio ve su saldo en su pantalla, pero **no está en la base**: sin respaldo, invisible desde otro dispositivo, no auditable | 🔴 Crítica |
| **H5** | `analitica.ts` no tiene `fetch` | Es el módulo que alimenta el panel de analítica: no puede leer de la base | 🟠 Alta |
| **H6** | `registration_logs` vacía (0 filas) | La auditoría de registro no registra al que entra por WhatsApp (el canal principal) | 🟠 Alta |
| **H7** | `tipoEvento: string` sin catálogo | Un evento mal escrito no lo detecta el compilador; no hay forma de saber qué eventos existen | 🟠 Alta |
| **H8** | `embudo_registro_completado` se emite solo en el navegador | El embudo de registro no se puede medir de forma fiable | 🟠 Alta |
| **H9** | `INVENTARIO.md` es del 16-oct: dice 50 endpoints (hoy 69) y lista 2 que ya no existen | Quien lo lea para decidir toma decisiones sobre un mapa desactualizado | 🟡 Media |
| **H10** | Tabla `users` (0 filas) sin uso | Ruido en el esquema | 🟡 Media |
| **H11** | `audience/sync-user` y `log-registration` sin auth | Un tercero puede escribir filas de audiencia. **Hallo abierto del PR #18** (R1-audience-sync-user-open-write) | 🟠 Alta |
| **H12** | `verify-token` devuelve la ficha completa del usuario | Fuga de datos por token. **Hallo abierto del PR #18** (R1-audience-verify-token-pii) | 🟠 Alta |
| **H13** | `points`/`clics`/`facturacion` en memoria del navegador | (mismo que H4) | 🔴 Crítica |
| **H14** | `users` + `INVENTARIO` viejo | (H9/H10) | 🟡 Media |

---

## 6. Lo que YA está bien (no hay que rehacerlo)

- El **gate de autenticación** de `/api` funciona: 44 endpoints devuelven 401 sin sesión, y los webhooks fallan cerrados con 403.
- La **superficie pública** está acotada y pensada: 22 endpoints, de los cuales 8 son de autenticación, 3 son webhooks con secreto, 2 son de lectura de catálogo y 1 es el clic con firma.
- La **atribución del clic** ya funciona de punta a punta (PR #23/#24): el clic sale de la web, el bot lo reconoce, la oferta se entrega con enlace firmado y el clic queda con el teléfono real.
- La **identidad de audiencia** ya es el número (PR #20): sin correos inventados, con purga por teléfono.
- El **cobro** tiene sus invariantes intactos: solo `/c/:id` con firma factura, con ventana de 24 h y débito atómico.

---

## 7. Decisiones que hay que tomar (para la segunda mitad de la fase)

1. **¿Dónde viven los eventos?** Opción A: tabla `eventos` en la base, con el servidor emitiendo y el cliente también (vía endpoint). Opción B: cada dominio sigue su tabla propia (`click_logs`, `chat_logs`, `audience_users`...) y se abandona `coreEvents` como fuente de verdad. La B es más trabajo por dominio pero elimina la doble verdad.
2. **¿El servidor emite eventos o se registran directamente en la tabla del dominio?** Hoy hay 3 caminos posibles para un clic: `click_logs` (tabla), `coreEvents.emitir` (memoria) y el contador `oferta.clics` (columna). Con la corrección del PR #24 quedaron 2 caminos con un criterio claro: la tabla y el contador.
3. **¿Se migran los 5 módulos sin `fetch` a la base?** `facturacion` y `puntos` son los más urgentes (el dinero del comercio vive en el navegador).
4. **¿Se arregla H11/H12 (hallazgos abiertos del PR #18)?** Son de seguridad y no dependen de esta fase.
5. **Catálogo de eventos**: ¿un `enum`/unión de tipos en `src/types` con validación en compilación, o una tabla de catálogo?

---

## 8. Cómo se verificó

- **Endpoints**: extracción del código (regex sobre `app.get/post/...` en `server.ts` + `src/routes/*.ts`) y verificación **uno por uno contra producción** (con y sin sesión), 67 de 69 verificados (2 omitidos por needing archivo).
- **Tablas**: `information_schema` + `count(*)` sobre la base de producción.
- **Eventos**: extracción de los 28 `tipoEvento` emitidos, y cruce con quién los emite y quién los lee.
- **Módulos**: conteo de `fetch`, `coreEvents.emitir` y `localStorage.setItem` por módulo.
- **Discrepancias**: el código afirma una cosa y el servidor otra se detectaron comparando ambos.

## 9. Lo que este mapa NO cubre (pendiente para la segunda mitad)

- El **interior** de cada endpoint: qué valida, qué errores devuelve, qué invariantes respeta (hoy verificado endpoint por endpoint solo en los que tocamos).
- Los **scripts** de `scripts/` y su estado (CI, migraciones, backups).
- La **configuración de despliegue** (Coolify, variables de entorno, secretos).
- El **frontend**: qué pantallas existen, cuáles están conectadas a la API y cuáles leen de memoria (parcialmente cubierto en §4).
- La **documentación**: `FLUJOS.md` (F1–F12) está desactualizado respecto de los endpoints movidos a `src/routes/`.
