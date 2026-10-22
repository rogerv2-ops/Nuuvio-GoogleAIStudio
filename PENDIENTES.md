# Pendientes de Yuddit

**Para qué sirve este archivo:** es la lista viva de lo que falta, escrita en palabras de negocio
(qué se rompe y qué le cuesta al comercio o al dueño). Está en la raíz del repo para que la vea
cualquiera: el dueño, otro agente en otra sesión, o quien clones el proyecto.

**Cómo se usa:**
- Cuando se termina algo, se tilda la casilla y se pone la fecha y el commit.
- Cada pendiente que se vaya a trabajar se puede abrir como issue (`gh issue create`) con las
  etiquetas de `docs/agents/triage-labels.md` (`ready-for-agent` si está listo para un agente,
  `needs-info` si falta una decisión del dueño).
- Los pendientes grandes tienen su propio documento de fase en `odd/tasks/`.
- Última revisión: **2026-10-21**.

**Las tres columnas de estado:** `Decisión del dueño` (alguien tiene que decidir, el código no
puede) · `Listo para agente` (está claro qué hay que hacer) · `Verificar en dispositivo` (no hay forma
de probarlo sin un celular o una persona).

---

## 1. Dinero y saldos de los comercios

| # | Pendiente | Por qué importa (consecuencia) | Dónde | Quién |
|---|---|---|---|---|
| P-01 | ✅ **[HECHO 2026-10-22]** Un saldo acreditado nunca debe reportarse como error.
| P-23 | **Migrar comercios de blob JSON a tabla indexada.** Hoy los comercios se guardan como JSON en `app_settings` (clave `merchants_list`/`merchants_kanban`), sin columnas ni índices. Crear tabla `comercios` con PK, índice por RUC y por estado, migrar los datos existentes, actualizar `savePersistedMerchants`/`getPersistedMerchants` y los endpoints. Lo mismo aplica a ofertas (ya tienen tabla pero se usan en memoria) y a usuarios (tabla `audience_users` ya existe y está bien). Hoy, si falla algo después de guardar el pack (por ejemplo la recarga de la cache), la pantalla dice "no se pudo acreditar" aunque los clics **ya quedaron guardados**. Si el admin reintenta, el comercio recibe los clics dos veces. | Es plata duplicada sin que nadie lo note hasta ver la factura. | `src/routes/facturacion.ts` (la escritura del pack y la recarga de la cache están en el mismo `try`) | Listo para agente |
| P-02 | **La auditoría de la acreditación se escribe sin `await`.** Si esa escritura falla, el registro de "quién acreditó qué" se pierde, y la promesa rechazada queda flotando. | Sin registro no hay forma de saber a quién cargarle un saldo de más. | `src/routes/facturacion.ts` | Listo para agente |
| P-03 | **La ruta no valida que el comercio exista.** Un `comercioId` mal escrito deja un pack huérfano con saldo, visible en "Pagos y cobros". | Un saldo que no le corresponde a nadie. Además no hay forma de anularlo desde la app. | `src/routes/facturacion.ts` | Decisión del dueño (validar contra la lista de comercios, o dejar acreditación libre) |
| P-04 | **El panel no distingue "saldo 0" de "no se pudo leer el saldo".** Si la lectura falla, el `catch` devuelve 0 y todas las ofertas activas aparecen como "no visibles". | Falsa alarma: el admin acredita clics que el comercio ya había pagado. | `src/components/gestion/views/OfertasDomainView.tsx` | Listo para agente |
| P-05 | **Con más de una instancia del servidor, acreditar saldo solo refresca la instance que atendió el pedido.** Las demás siguen con la cache vieja y la oferta no se ve hasta que reinician. | Si mañana se escala a dos instancias, el botón deja de funcionar sin avisar. | `src/modules/facturacion.ts` (`recargarCache`) | Listo para agente |
| P-06 | **No hay forma de anular ni de corregir un pack acreditado** desde la app. | Un error de carga se corrige solo editando la base a mano. | `src/routes/facturacion.ts` | Decisión del dueño (¿botón de anular? ¿pack negativo?) |
| P-07 | **Los precios de los packs no coinciden:** el módulo usa 70 / 120 / 500 y la pantalla 30 / 55 / 250. | El comercio ve un precio y se le cobra otro: la Discussion de dinero. | `src/modules/facturacion.ts` y la pantalla de planes | Decisión del dueño (cuál es el precio real) |
| P-08 | **La compra de packs con pasarela de pago (Yape / Plazo / tarjeta) no existe.** Hoy el botón "Acreditar saldo" es el parche manual. | El comercio tiene que pedirte los clics por WhatsApp; no hay autopago. | `src/routes/facturacion.ts` (hoy solo lectura + acreditación manual) | Decisión del dueño (es un proyecto aparte) |
| P-09 | **El canje con código QR no está implementado.** El código de canje vive en un `Map` en memoria del navegador: se pierde al recargar la página y dos comercios pueden canjear el mismo código. | Los premios se pueden dar dos veces (o perderse). | `odd/tasks/fase-canje-y-referidos.md` | Decisión del dueño (postergado) |

## 2. Pruebas y calidad

| # | Pendiente | Por qué importa | Dónde | Quién |
|---|---|---|---|---|
| P-10 | **El test del "un comercio no puede acreditar saldo" pasa en vacío** si el entorno no tiene credenciales de comercio: se salta la aserción y la suite queda verde sin haber probado el permiso. | El control de dinero más importante del sistema puede quedar sin probar y nadie se entera. | `tests/security/acreditar-saldo.test.ts`, `tests/security/acreditar-saldo-bordes.test.ts` | Listo para agente |
| P-11 | **El piso de `scripts/ci/assert-tests-ran.mjs` no sube.** Si los 9 tests nuevos se saltan porque el servidor no arrancó, el CI igual da verde. | Verde y vacío: el fallo reaparece en producción sin avisar. | `scripts/ci/assert-tests-ran.mjs` | Listo para agente |
| P-12 | **Los comportamientos del panel no tienen prueba automática** (el botón "Acreditar saldo" y el distintivo "No visible: sin saldo"): el repo no tiene navegador, así que se prueban a mano. | Un botón que no abre se descubre cuando el dueño lo usa. | `CampanasCobroDomainView.tsx`, `OfertasDomainView.tsx` | Verificar en dispositivo |
| P-13 | **La suite se rompe si se corre dos veces seguidas en menos de 5 minutos**: el límite de login (10 cada 5 min) vive en la memoria del servidor. Hay que reiniciar el server local y limpiar `login_failures` antes de cada corrida. | Se pierde tiempo creyendo que se rompió el código. Ya está documentado en `AGENTS.md`; queda hacerlo más visible. | `tests/security/_helpers.ts`, `AGENTS.md` | Listo para agente |

## 3. Decisiones de negocio (del dueño)

| # | Pendiente | Por qué importa | Dónde | Quién |
|---|---|---|---|---|
| P-14 | **El bot no filtra por la provincia activa**: manda por distrito, así que un usuario de otra provincia puede recibir ofertas que no le sirven. | Ofertas que no van a comprar: clics gastados en gente equivocada. | `server.ts` (búsqueda y mosaico) | Decisión del dueño (qué provincia manda) |
| P-15 | **La landing no tiene la jerarquía provincia → distrito.** | El usuario no encuentra su zona y no encuentra ofertas. | `src/components/PublicWeb.tsx` | Decisión del dueño (orden de filtros) |
| P-16 | **El widget ejecutivo muestra números inventados** como piso: `Math.max(usuarios.length, 1280)`, `|| 2140`, `|| 82`, `|| 380`, `|| 45`, un gráfico de 6 meses y `actual * 0.86`. | El panel executive muestra grownumbers que no son los reales: se decide con datos falsos. | `src/components/AdminRechartsDashboard.tsx` (y widget del KPI) | Decisión del dueño (o se borran los pisos y se muestra lo real) |
| P-17 | **El registro de comercios por WhatsApp inventa datos**: razón social, email, Instagram y categoría se completan solos si el comercio no los dio. | El panel muestra datos falsos de un comercio real (y un correo inventado puede mandar cosas). | `src/modules/comercios.ts` (`registrarProspecto`) | Listo para agente (dejar en blanco lo que no se sabe) |
| P-18 | **La activación del comercio es manual**: el que se registra por WhatsApp queda en "registrado" y hay que activarlo en el kanban antes de que pueda publicar. | El comercio espera a que alguien lo apruebe antes de poder offers. | `src/modules/comercios.ts`, panel de comercios | Decisión del dueño (dejarlo manual o automatizar con reglas) |

## 4. Verificación en dispositivos

| # | Pendiente | Por qué importa | Dónde | Quién |
|---|---|---|---|---|
| P-19 | **El enlace de oferta no se ha probado en iPhone** (el dueño no tiene iPhone: "se probará después"). Android ✅ y web ✅. | La mitad de los usuarios de WhatsApp está en iPhone. | `docs/reglas-whatsapp.md` | Verificar en dispositivo |
| P-20 | **Los botones de la landing (que sí dejan elegir app) no se probaron después del último cambio de la hoja.** | Si la hoja no abre, la landing deja de generar leads. | `src/components/WhatsAppChooser.tsx` | Verificar en dispositivo |

## 5. Fases ya planificadas (documento propio)

| # | Pendiente | Dónde | Quién |
|---|---|---|---|
| P-21 | **Fase SEO / indexación.** El dueño la priorizó como crítica: hoy la landing sirve 1 KB de HTML y el contenido de las ofertas viene de la base. Ojo: ningún pre-render puede incluir el número de WhatsApp (misma regla de los enlaces). | `odd/tasks/fase-seo-indexacion.md` | Decisión del dueño (arrancar) |
| P-22 | **Fase de canje y referidos.** Hay **tres** códigos distintos y ninguno cierra su circuito: `REF#####` (referido: no acredita puntos ni tiene link de registro), `NV-XXXXXX` (atribución del clic: el bot ya lo usa, pero el comercio no tiene dónde consultarlo) y el código de canje de premios. | `odd/tasks/fase-canje-y-referidos.md` | Decisión del dueño (postergado) |
