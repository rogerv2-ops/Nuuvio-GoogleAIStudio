import { 
  LayoutDashboard, BarChart3, Users, Building2, Tag, 
  CreditCard, Send, Settings, MapPin
} from 'lucide-react';
import { GestionMenuItem } from './types';
import { comerciosModule } from '../../modules/comercios';
import { ofertasModule } from '../../modules/ofertas';

export const GESTION_MENU: GestionMenuItem[] = [
  {
    id: 'general',
    ruta: '/gestion',
    titulo: 'Panel General',
    descripcion: 'Consola ejecutiva, alertas prioritarias y pulso del negocio',
    icono: LayoutDashboard,
    subitems: []
  },
  {
    id: 'analitica',
    ruta: '/gestion/analitica',
    titulo: 'Analítica',
    descripcion: 'Métricas de audiencia, tracción de comercios y atribución de campañas',
    icono: BarChart3,
    subitems: [
      {
        id: 'analitica-usuarios',
        ruta: '/gestion/analitica/usuarios',
        titulo: 'Usuarios',
        descripcion: 'Crecimiento de audiencia, distritos y embudo de conversión'
      },
      {
        id: 'analitica-comercios',
        ruta: '/gestion/analitica/comercios',
        titulo: 'Comercios',
        descripcion: 'Interacciones de leads generados y respuesta de comercios'
      },
      {
        id: 'analitica-atribucion',
        ruta: '/gestion/analitica/atribucion',
        titulo: 'Rendimiento y Atribución',
        descripcion: 'Rastreo UTM por canal, campaña y origen de registros'
      },
      {
        id: 'analitica-ofertas-whatsapp',
        ruta: '/gestion/analitica/ofertas-whatsapp',
        titulo: 'Ofertas & Alcance WhatsApp',
        descripcion: 'Evolución semanal de ofertas y alcance estimado en WhatsApp'
      }
    ]
  },
  {
    id: 'usuarios',
    ruta: '/gestion/usuarios',
    titulo: 'Usuarios',
    descripcion: 'Base de audiencia verificada, gamificación y red de referidos',
    icono: Users,
    subitems: [
      {
        id: 'usuarios-lista',
        ruta: '/gestion/usuarios/lista',
        titulo: 'Lista de usuarios',
        descripcion: 'Directorio de audiencia con estado de verificación y WhatsApp'
      },
      {
        id: 'usuarios-puntos',
        ruta: '/gestion/usuarios/puntos-referidos',
        titulo: 'Puntos y referidos',
        descripcion: 'Saldos acumulados, canjes solicitados y ranking viral'
      },
      {
        id: 'usuarios-auditoria',
        ruta: '/gestion/usuarios/auditoria',
        titulo: 'Log de Auditoría',
        descripcion: 'Histórico de intentos de registro, unicidad de WhatsApp/email y resultado'
      }
    ]
  },
  {
    id: 'comercios',
    ruta: '/gestion/comercios',
    titulo: 'Comercios CRM',
    descripcion: 'Pipeline comercial, validación RUC SUNAT y ventas confirmadas',
    icono: Building2,
    badge: () => {
      const p = comerciosModule.listarPendientes().length;
      return p > 0 ? { count: p, color: 'bg-amber-100 text-amber-800 border-amber-200' } : null;
    },
    subitems: [
      {
        id: 'comercios-pipeline',
        ruta: '/gestion/comercios/pipeline',
        titulo: 'Pipeline Comercios',
        descripcion: 'Tablero Kanban de 7 etapas para captación y prospección'
      },
      {
        id: 'comercios-aprobaciones',
        ruta: '/gestion/comercios/aprobaciones',
        titulo: 'Aprobación de comercios con RUC',
        descripcion: 'Checklist manual de verificación formal con SUNAT y ubicación',
        badge: () => {
          const p = comerciosModule.listarPendientes().length;
          return p > 0 ? { count: p, color: 'bg-rose-100 text-rose-800 border-rose-200' } : null;
        }
      },
      {
        id: 'comercios-activos',
        ruta: '/gestion/comercios/activos',
        titulo: 'Comercios Activos',
        descripcion: 'Directorio de negocios habilitados para publicar ofertas'
      },
      {
        id: 'comercios-actividades',
        ruta: '/gestion/comercios/actividades',
        titulo: 'Actividades y seguimiento',
        descripcion: 'Bitácora de contactos, llamadas y compromisos comerciales'
      },
      {
        id: 'comercios-ventas-confirmadas',
        ruta: '/gestion/comercios/ventas-confirmadas',
        titulo: 'Ventas Confirmadas',
        descripcion: 'Resultados informados por los comercios con código personal'
      }
    ]
  },
  {
    id: 'ofertas',
    ruta: '/gestion/ofertas',
    titulo: 'Ofertas',
    descripcion: 'Catálogo de promociones, moderación de imágenes y analítica',
    icono: Tag,
    badge: () => {
      const p = ofertasModule.listarPendientesModeracion().length;
      return p > 0 ? { count: p, color: 'bg-rose-100 text-rose-800 border-rose-200' } : null;
    },
    subitems: [
      {
        id: 'ofertas-catalogo',
        ruta: '/gestion/ofertas/catalogo',
        titulo: 'Catálogo de Ofertas',
        descripcion: 'Inventario general de ofertas filtradas por distrito y categoría'
      },
      {
        id: 'ofertas-moderacion',
        ruta: '/gestion/ofertas/moderacion',
        titulo: 'Moderación de Ofertas',
        descripcion: 'Cola de aprobación de fotos formato 4:5 y revisión con IA',
        badge: () => {
          const p = ofertasModule.listarPendientesModeracion().length;
          return p > 0 ? { count: p, color: 'bg-rose-100 text-rose-800 border-rose-200' } : null;
        }
      },
      {
        id: 'ofertas-kpis',
        ruta: '/gestion/ofertas/kpis',
        titulo: 'Ofertas con KPIs',
        descripcion: 'Rendimiento individual: impresiones, clics de contacto y conversión'
      },
      {
        id: 'ofertas-categorias-banners',
        ruta: '/gestion/ofertas/categorias-banners',
        titulo: 'Categorías del Catálogo',
        descripcion: 'Taxonomía de rubros comerciales para clasificación del catálogo'
      }
    ]
  },
  {
    id: 'campanas-cobro',
    ruta: '/gestion/campanas-cobro',
    titulo: 'Campañas y Cobro ERP',
    descripcion: 'Monetización PPC por packs de clics, facturación y finanzas',
    icono: CreditCard,
    subitems: [
      {
        id: 'campanas-planes',
        ruta: '/gestion/campanas-cobro/planes',
        titulo: 'Planes y Packs PPC',
        descripcion: 'Catálogo comercial de packs (50, 100, 500) y canje por producto'
      },
      {
        id: 'campanas-activas',
        ruta: '/gestion/campanas-cobro/campanas',
        titulo: 'Campañas activas',
        descripcion: 'Saldo de clics disponibles y consumo por negocio'
      },
      {
        id: 'campanas-pagos',
        ruta: '/gestion/campanas-cobro/pagos',
        titulo: 'Pagos y cobros',
        descripcion: 'Verificación de abonos por Yape, Plin y transferencias'
      },
      {
        id: 'campanas-facturacion',
        ruta: '/gestion/campanas-cobro/facturacion',
        titulo: 'Facturación',
        descripcion: 'Emisión y control tributario de comprobantes electrónicos'
      },
      {
        id: 'campanas-finanzas',
        ruta: '/gestion/campanas-cobro/finanzas',
        titulo: 'Finanzas y reportes',
        descripcion: 'Ingresos propios realizados vs proyectados'
      },
      {
        id: 'campanas-config-contable',
        ruta: '/gestion/campanas-cobro/configuracion-contable',
        titulo: 'Configuración contable',
        descripcion: 'Precios base y reglas comerciales centralizadas en CoreConfig'
      }
    ]
  },
  {
    id: 'comunicaciones',
    ruta: '/gestion/comunicaciones',
    titulo: 'Comunicaciones',
    descripcion: 'Despacho de resúmenes diarios, notificaciones y plantillas',
    icono: Send,
    subitems: [
      {
        id: 'comunicaciones-envios',
        ruta: '/gestion/comunicaciones/envios',
        titulo: 'Envíos',
        descripcion: 'Historial de correos transaccionales y notificaciones push'
      },
      {
        id: 'comunicaciones-digest',
        ruta: '/gestion/comunicaciones/digest',
        titulo: 'Digest',
        descripcion: 'Simulacion del resumen diario (D10). NO envia correos: el bot solo responde consultas'
      },
      {
        id: 'comunicaciones-plantillas',
        ruta: '/gestion/comunicaciones/plantillas',
        titulo: 'Plantillas',
        descripcion: 'Modelos de mensajes para verificación, alertas y promociones'
      }
    ]
  },
  {
    id: 'zonas',
    ruta: '/gestion/zonas',
    titulo: 'Zonas',
    descripcion: 'Provincias donde opera Yuddit y sus distritos',
    icono: MapPin,
    subitems: [
      {
        id: 'zonas-operacion',
        ruta: '/gestion/zonas',
        titulo: 'Zonas de operacion',
        descripcion: 'Enciende o apaga las provincias segun el negocio se expande'
      }
    ]
  },
  {
    id: 'configuracion',
    ruta: '/gestion/configuracion',
    titulo: 'Configuración',
    descripcion: 'Parámetros técnicos, conectores de mensajería, seguridad y SEO',
    icono: Settings,
    subitems: [
      {
        id: 'config-whatsapp',
        ruta: '/gestion/configuracion/whatsapp',
        titulo: 'Conexión WhatsApp',
        descripcion: 'Conector WAHA / Meta Cloud API y monitoreo de sesiones QR'
      },
      {
        id: 'config-correo',
        ruta: '/gestion/configuracion/correo',
        titulo: 'Correo/SMTP',
        descripcion: 'Credenciales SMTP y claves API de Resend para verificación'
      },
      {
        id: 'config-seo',
        ruta: '/gestion/configuracion/seo',
        titulo: 'SEO/Metadatos',
        descripcion: 'OpenGraph, etiquetas canónicas y Schema.org estructurado'
      },
      {
        id: 'config-auditoria',
        ruta: '/gestion/configuracion/auditoria',
        titulo: 'Auditoría y Logs',
        descripcion: 'Registro cronológico de eventos del microkernel e inicios de sesión'
      },
      {
        id: 'config-general',
        ruta: '/gestion/configuracion/general',
        titulo: 'General e interruptores',
        descripcion: 'Feature flags del sistema para activar o pausar módulos'
      },
      {
        id: 'config-seguridad',
        ruta: '/gestion/configuracion/seguridad',
        titulo: 'Seguridad',
        descripcion: 'Control de sesiones de administración y roles de acceso'
      },
      {
        id: 'config-agentes',
        ruta: '/gestion/configuracion/agentes',
        titulo: 'Proveedores de IA',
        descripcion: 'Orquestación multi-proveedor (Gemini, OpenAI, Anthropic, OpenRouter, Local), modelos y API keys'
      },
      {
        id: 'config-banners',
        ruta: '/gestion/configuracion/banners',
        titulo: 'Banners del Feed',
        descripcion: 'Gestión y orden de imágenes rotativas del header del feed'
      }
    ]
  }
];

/**
 * Tabla de redirecciones de rutas y claves anteriores a las canónicas
 */
export const REDIRECCIONES_RUTAS: Record<string, string> = {
  // Rutas y alias anteriores
  '/panel': '/gestion',
  '/panel/': '/gestion',
  '/gestion/dashboard': '/gestion',
  'dashboard': '/gestion',
  
  // Analítica
  'analitica_general': '/gestion/analitica',
  'analitica_utm': '/gestion/analitica/atribucion',
  'atribucion_utm': '/gestion/analitica/atribucion',
  '/gestion/analitica/general': '/gestion/analitica',
  
  // Comercios
  'crm_pipeline': '/gestion/comercios/pipeline',
  'kanban': '/gestion/comercios/pipeline',
  'comercios_validacion': '/gestion/comercios/aprobaciones',
  '/gestion/comercios/validacion': '/gestion/comercios/aprobaciones',
  'crm_ventas': '/gestion/comercios/ventas-confirmadas',
  'ventas': '/gestion/comercios/ventas-confirmadas',
  
  // Ofertas
  'ofertas_moderacion': '/gestion/ofertas/moderacion',
  'sistema_ofertas_moderacion': '/gestion/ofertas/moderacion',
  'sistema_ofertas_kpis': '/gestion/ofertas/kpis',
  
  // Campañas y cobro
  'crm_planes': '/gestion/campanas-cobro/planes',
  'planes': '/gestion/campanas-cobro/planes',
  
  // Configuración de sistema
  'sistema_whatsapp': '/gestion/configuracion/whatsapp',
  'sistema_correo': '/gestion/configuracion/correo',
  'sistema_seo': '/gestion/configuracion/seo',
  'sistema_auditoria': '/gestion/configuracion/auditoria',
  'auditoria': '/gestion/configuracion/auditoria'
};

export function resolverRutaCanonica(rutaOrKey: string): string {
  if (!rutaOrKey) return '/gestion';
  const limpia = rutaOrKey.trim();
  if (REDIRECCIONES_RUTAS[limpia]) {
    return REDIRECCIONES_RUTAS[limpia];
  }
  // Si la ruta contiene un id de comercio específico ej: /gestion/comercios/com_01
  if (limpia.startsWith('/gestion/comercios/') && !GESTION_MENU.find(m => m.subitems.some(s => s.ruta === limpia))) {
    return limpia; // Ruta dinámica
  }
  return limpia;
}
