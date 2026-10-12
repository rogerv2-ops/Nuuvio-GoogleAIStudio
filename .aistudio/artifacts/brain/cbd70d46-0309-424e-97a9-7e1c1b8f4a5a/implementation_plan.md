# Plan de Implementación: Reorganización Modular del Panel de Comercio vuuy

## 1. Diagnóstico e Inventario Actual

### Modelo de Negocio y Reglas Clave
- **vuuy** es un asistente en WhatsApp que genera leads para comercios locales.
- **Un clic en "Contactar"** abre la conversación de WhatsApp con un código personal (`VUUY-XX99`), pero **no demuestra venta ni cliente cerrado**.
- **Las ventas confirmadas** son informadas por el propio dueño del negocio ingresando el código personal que el cliente le presenta. No son cobros de vuuy ni de pasarela.
- **Ingresos de vuuy:** Provienen de la recarga de packs de clics PPC cuando el comercio activa o mantiene campañas.
- **Aislamiento de Negocio:** Según la indicación expresa de Roger (*"NO hay filtrado de negocio, cada negocio es independiente"*), la sesión actual (`rogerv707@gmail.com`) está enlazada a su comercio autorizado (`merch_01` — La Bodega Verde). No se debe mezclar información ni permitir navegar como otros comercios sin sesión autorizada.

### Clasificación de Componentes y Vistas Actuales
1. **Visible y conectado:**
   - Tabla de ofertas activas (`ofertasModule.listarOfertasPorComercio`).
   - Modal de creación de oferta en proporción vertical 4:5 (`ofertasModule.crearOferta`).
   - Validador de ventas sin QR por código personal (`clicsAtribucionModule.confirmarVenta`).
   - Validador de canje de premios (`puntosModule.validarCodigoCanje`).
   - Saldo de clics PPC y recarga de paquetes (`facturacionModule.obtenerSaldoComercio`, `comprarPack`).
2. **Visible con diferencias numéricas identificadas (Gráfico y Tarjetas de la captura):**
   - En la captura se mostraba "1 clic" en una tarjeta y "19 clics" en el acumulado de una oferta: se debe a períodos de tiempo distintos (hoy vs. histórico de la oferta). Se corregirá unificando el selector de rango de fechas compartido (`Hoy`, `Últimos 7 días`, `Últimos 30 días`, `Personalizado`) en zona horaria `America/Lima`.
   - Se reemplazará el término ambiguo "Conversión" por **"Tasa de Clic / Contacto (CTR)"** y **"Ventas reportadas por tu negocio"**, utilizando lenguaje de dueño de local.
3. **Faltantes a estructurar:**
   - Separación modular de la navegación en 5 dominios principales + Utilidades.
   - Páginas resumen por sección accesibles al hacer clic en el título, con chevrons para desplegar subpáginas.
   - Rutas canónicas bajo `/comercio/*` con soporte de enlaces limpios y hash fallback.

---

## 2. Arquitectura de Rutas y Menú Propuesta

### Registro Central de Rutas (`/comercio`)
1. **Inicio (`/comercio`)**
   - Portada ejecutiva para el dueño: "¿Cómo va mi negocio hoy?".
   - Tarjetas clave: Clics de contacto recibidos a WhatsApp, Veces que se mostraron tus ofertas, Tasa de interés (CTR), Saldo de clics restantes en campaña.
   - Alertas inmediatas: Ofertas por vencer, ofertas con stock bajo, clics próximos a agotarse.
   - Acceso directo: Validar código de cliente en 1 clic.

2. **Mis ofertas (`/comercio/ofertas`)**
   - Resumen del catálogo del comercio.
   - **Subpáginas:**
     - `/comercio/ofertas/nueva`: Formulario de publicación con vista previa obligatoria 4:5 vertical.
     - `/comercio/ofertas/en-revision`: Ofertas enviadas pendientes de validación por administración.
     - `/comercio/ofertas/historial`: Ofertas pausadas, vencidas o agotadas.
     - `/comercio/ofertas/:ofertaId`: Detalle operativo de la oferta, edición de stock y precio.

3. **Resultados (`/comercio/resultados`)**
   - Resumen de rendimiento y visibilidad.
   - **Subpáginas:**
     - `/comercio/resultados/ofertas`: Comparativa de qué ofertas atraen más contactos a WhatsApp.
     - `/comercio/resultados/zonas-canales`: Zonas de origen de los interesados y desglose WhatsApp vs Web.
     - `/comercio/resultados/ofertas/:ofertaId`: Desglose analítico por oferta individual.

4. **Campañas de clics (`/comercio/campanas`)**
   - Resumen de saldo y consumo de tráfico PPC.
   - **Subpáginas:**
     - `/comercio/campanas/lista`: Estado actual de campañas activas vs agotadas.
     - `/comercio/campanas/:campaniaId`: Detalle de clics consumidos día por día.
     - `/comercio/campanas/packs`: Compra de paquetes de clics (50, 100, 500) con Yape/Plin o canje de productos.
     - `/comercio/campanas/pagos`: Historial de comprobantes y recibos de pago.

5. **Ventas confirmadas (`/comercio/ventas`)**
   - Resumen de clientes que llegaron al local y compraron.
   - **Subpáginas:**
     - `/comercio/ventas/confirmar`: Herramienta rápida para ingresar el código personal del cliente.
     - `/comercio/ventas/historial`: Listado de ventas informadas por fecha y monto.
     - `/comercio/ventas/canjes`: Validación de premios por puntos del programa de fidelización (condicional).

6. **Mi negocio (`/comercio/negocio`)**
   - Datos del comercio (`/comercio/negocio/datos`): RUC, Razón Social, Nombre Comercial, Instagram, WhatsApp.
   - Locales (`/comercio/negocio/locales`): Dirección, distrito (`Barranco`) y horarios de atención del local.
   - Cuenta y preferencias (`/comercio/negocio/cuenta`): Usuario de acceso, notificaciones por correo.

7. **Utilidades (en cabecera / pie sin sobrecargar el menú principal):**
   - Notificaciones (`/comercio/notificaciones` o campana interactiva con bandeja).
   - Centro de Ayuda (`/comercio/ayuda`): Guías cortas para dueños de negocio (cómo tomar fotos 4:5, cómo pedir el código al cliente).
   - Volver a la web (`/`) y Cerrar sesión.

---

## 3. Plan de Archivos y Componentes

1. **`src/components/comercio/types.ts`**: Tipos de rutas, menú, subítems y filtros del comercio.
2. **`src/components/comercio/comercioMenuConfig.ts`**: Configuración central del menú, rutas `/comercio/*` y resolvedor de rutas heredadas.
3. **`src/components/comercio/ComercioLayout.tsx`**: Layout profesional para dueños de negocio (sidebar responsive colapsable, encabezado con negocio activo fijado a la sesión, breadcrumbs limpios, selector de período America/Lima, campana de alertas y drawer móvil).
4. **Vistas de Dominio (`src/components/comercio/views/`)**:
   - `InicioComercioView.tsx`: Portada ejecutiva y pulso de hoy.
   - `MisOfertasComercioView.tsx`: Catálogo, creación 4:5, ofertas en revisión e historial.
   - `ResultadosComercioView.tsx`: Gráficos de tendencias, comparación entre ofertas y zonas.
   - `CampanasComercioView.tsx`: Control de clics prepagos, recarga Yape/Plin y facturación.
   - `VentasComercioView.tsx`: Validación de código personal del cliente y registro de ventas.
   - `MiNegocioComercioView.tsx`: Ficha del local, RUC y teléfono verificado.
   - `AyudaComercioModal.tsx` & `NotificacionesComercioDrawer.tsx`: Utilidades operativas.
5. **Actualización de `MerchantPanel.tsx`**: Delegar en `ComercioLayout` manteniendo retrocompatibilidad total con las sesiones y callbacks existentes.
6. **Sincronización en `App.tsx`**: Reconocer subrutas `/comercio/*` y hash `#/comercio/*` para navegación fluida con el botón atrás/adelante del navegador.

---

## 4. Criterios de Aceptación y Verificación

- [ ] La sesión del comercio solo visualiza y gestiona su propio negocio (`merch_01`), sin filtrados cruzados ni acceso a datos de otros comercios.
- [ ] El lenguaje utilizado es directo, claro y orientado a comerciantes (sin jerga técnica interna de ERP).
- [ ] Se distingue nítidamente entre: "Personas que vieron la oferta" (Vistas), "Contactos por WhatsApp" (Clics/Leads) y "Ventas confirmadas por tu negocio".
- [ ] El formulario de creación de ofertas mantiene y respeta la proporción 4:5 con previsualizador en vivo.
- [ ] La validación de ventas con código de cliente opera de forma inmediata y emite el evento auditado `venta_confirmada`.
- [ ] La aplicación compila limpiamente (`compile_applet`) y pasa validación de tipos (`lint_applet`).
