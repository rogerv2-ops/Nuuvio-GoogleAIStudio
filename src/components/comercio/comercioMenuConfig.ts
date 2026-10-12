import { 
  Home, Tag, BarChart2, Zap, CheckCircle2, Store
} from 'lucide-react';
import { ComercioMenuItem } from './types';
import { ofertasModule } from '../../modules/ofertas';
import { facturacionModule } from '../../modules/facturacion';

export const OBTENER_COMERCIO_MENU = (comercioId: string): ComercioMenuItem[] => [
  {
    id: 'inicio',
    ruta: '/comercio',
    titulo: 'Inicio',
    descripcion: 'Cómo va tu negocio hoy, contactos recibidos y alertas del local',
    icono: Home,
    subitems: []
  },
  {
    id: 'ofertas',
    ruta: '/comercio/ofertas',
    titulo: 'Mis ofertas',
    descripcion: 'Catálogo de promociones activas, en revisión y archivo',
    icono: Tag,
    badge: () => {
      const ofrs = ofertasModule.listarOfertasPorComercio(comercioId);
      return ofrs.length > 0 ? { count: ofrs.length, color: 'bg-stone-100 text-stone-700' } : null;
    },
    subitems: [
      {
        id: 'ofertas-nueva',
        ruta: '/comercio/ofertas/nueva',
        titulo: 'Nueva oferta',
        descripcion: 'Publicar descuento o promoción con foto vertical 4:5'
      },
      {
        id: 'ofertas-en-revision',
        ruta: '/comercio/ofertas/en-revision',
        titulo: 'En revisión',
        descripcion: 'Ofertas enviadas en proceso de validación',
        badge: () => {
          const rev = ofertasModule.listarOfertasPorComercio(comercioId).filter(o => o.estado === 'en_validacion');
          return rev.length > 0 ? { count: rev.length, color: 'bg-amber-100 text-amber-800' } : null;
        }
      },
      {
        id: 'ofertas-historial',
        ruta: '/comercio/ofertas/historial',
        titulo: 'Historial de ofertas',
        descripcion: 'Promociones pausadas, agotadas y vencidas'
      }
    ]
  },
  {
    id: 'resultados',
    ruta: '/comercio/resultados',
    titulo: 'Resultados',
    descripcion: 'Cuántas personas ven tus ofertas y cuántas te escriben al WhatsApp',
    icono: BarChart2,
    subitems: [
      {
        id: 'resultados-ofertas',
        ruta: '/comercio/resultados/ofertas',
        titulo: 'Por oferta',
        descripcion: 'Comparativa de qué promociones atraen más interesados'
      },
      {
        id: 'resultados-zonas-canales',
        ruta: '/comercio/resultados/zonas-canales',
        titulo: 'Por zona y canal',
        descripcion: 'Distritos de los usuarios y contacto por WhatsApp vs Web'
      }
    ]
  },
  {
    id: 'campanas',
    ruta: '/comercio/campanas',
    titulo: 'Campañas de clics',
    descripcion: 'Saldo de clics disponibles, recarga de paquetes y comprobantes',
    icono: Zap,
    badge: () => {
      const saldo = facturacionModule.obtenerSaldoComercio(comercioId);
      return { count: saldo, color: saldo < 15 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800' };
    },
    subitems: [
      {
        id: 'campanas-lista',
        ruta: '/comercio/campanas/lista',
        titulo: 'Mis campañas',
        descripcion: 'Estado actual de consumo y campañas activas'
      },
      {
        id: 'campanas-packs',
        ruta: '/comercio/campanas/packs',
        titulo: 'Packs de clics',
        descripcion: 'Recargar saldo de contactos por Yape o Plin'
      },
      {
        id: 'campanas-pagos',
        ruta: '/comercio/campanas/pagos',
        titulo: 'Pagos y comprobantes',
        descripcion: 'Historial de recargas y recibos de pago'
      }
    ]
  },
  {
    id: 'ventas',
    ruta: '/comercio/ventas',
    titulo: 'Ventas confirmadas',
    descripcion: 'Ingresa el código que trajo el cliente para validar compras reales',
    icono: CheckCircle2,
    subitems: [
      {
        id: 'ventas-confirmar',
        ruta: '/comercio/ventas/confirmar',
        titulo: 'Confirmar con código',
        descripcion: 'Registrar código personal de WhatsApp mostrado por el cliente'
      },
      {
        id: 'ventas-historial',
        ruta: '/comercio/ventas/historial',
        titulo: 'Historial de ventas',
        descripcion: 'Registro de ventas informadas por tu negocio'
      },
      {
        id: 'ventas-canjes',
        ruta: '/comercio/ventas/canjes',
        titulo: 'Canjes de premios',
        descripcion: 'Entrega de recompensas del programa de fidelización'
      }
    ]
  },
  {
    id: 'negocio',
    ruta: '/comercio/negocio',
    titulo: 'Mi negocio',
    descripcion: 'Información de tu local, RUC, WhatsApp y preferencias',
    icono: Store,
    subitems: [
      {
        id: 'negocio-datos',
        ruta: '/comercio/negocio/datos',
        titulo: 'Datos del comercio',
        descripcion: 'RUC, Razón Social y teléfono verificado'
      },
      {
        id: 'negocio-locales',
        ruta: '/comercio/negocio/locales',
        titulo: 'Sede y dirección',
        descripcion: 'Ubicación física del local y horarios'
      },
      {
        id: 'negocio-cuenta',
        ruta: '/comercio/negocio/cuenta',
        titulo: 'Cuenta y acceso',
        descripcion: 'Correo y preferencias de alertas'
      }
    ]
  }
];

export function normalizarRutaComercio(pathnameOrHash: string): string {
  let ruta = pathnameOrHash.trim();
  if (ruta.startsWith('#')) ruta = ruta.substring(1);
  if (ruta.startsWith('/')) ruta = ruta.substring(1);
  if (ruta === '' || ruta === 'comercio') return '/comercio';

  // Redirecciones compatibles de pestañas anteriores
  if (ruta === 'comercio/ofertas' || ruta === 'ofertas') return '/comercio/ofertas';
  if (ruta === 'comercio/estadisticas' || ruta === 'estadisticas') return '/comercio/resultados';
  if (ruta === 'comercio/historial' || ruta === 'historial') return '/comercio/ventas';
  if (ruta === 'comercio/pagos' || ruta === 'pagos') return '/comercio/campanas';

  return `/${ruta}`;
}
