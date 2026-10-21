/**
 * Yuddit - Definición central de tipos de dominio
 * Según documento maestro consolidado y arquitectura microkernel
 */

export type ActorType = 'usuario' | 'comercio' | 'gestion' | 'sistema';

export interface AudienceUser {
  id: string;
  telefono: string;
  nombre: string;
  apellido: string;
  email: string;
  emailVerificado: boolean;
  edad: number;
  genero: string;
  ciudad: string;
  provincia: string;
  distrito: string;
  /** Codigo ubigeo del distrito (6 digitos). El nombre solo no identifica
   *  un lugar: en el Peru hay 99 nombres de distrito repetidos. */
  distritoCodigo?: string | null;
  /** Codigo ubigeo de la provincia (6 digitos). */
  provinciaCodigo?: string | null;
  categoriasInteres: string[];
  puntosSaldo: number;
  codigoRef: string;
  invitadoPor?: string;
  estado: 'pendiente' | 'activo' | 'baja';
  consentimientos: {
    correo: boolean;
    push: boolean;
    whatsapp: boolean;
  };
  registradoEn: string;
  ultimoMensajeEn?: string;
  utm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    term?: string;
    content?: string;
  };
  verificationToken?: string;
}

export interface Merchant {
  id: string;
  ruc: string; // 11 dígitos
  nombreComercial: string;
  razonSocial: string;
  contactoNombre: string;
  telefono: string;
  email: string;
  direccion: string;
  distrito: string;
  provincia: string;
  lat: number;
  lng: number;
  instagram: string;
  categoria: string;
  estado: 'pendiente' | 'activo' | 'rechazado' | 'en_riesgo';
  registradoEn: string;
  validadoEn?: string;
  validadoPor?: string;
  motivoRechazo?: string;
}

export type OfferType = 'oferta' | 'descuento' | 'promocion' | 'liquidacion';
export type OfferState = 'borrador' | 'en_validacion' | 'activa' | 'pausada' | 'agotada' | 'vencida' | 'rechazada';

export interface Offer {
  id: string;
  codigoUrl: string; // único para /o/[codigoUrl]
  comercioId: string;
  comercioNombre: string;
  comercioWhatsapp: string;
  titulo: string;
  descripcion: string; // max 150 caracteres
  tipo: OfferType;
  precioNormal: number;
  precioOferta: number;
  stock?: number;
  categoria: string;
  distrito: string;
  provincia: string;
  lat: number;
  lng: number;
  imagenes: string[]; // 1 a 3 fotos, primera es portada
  venceEn: string; // hasta 30 días
  estado: OfferState;
  creadaEn: string;
  validadaEn?: string;
  validadaPor?: string;
  motivoRechazo?: string;
  // Métricas agregadas
  vistas: number;
  clics: number;
  leadsCalificados: number;
  likes?: number; // "Me Gusta" (informativo, no facturable)
  campaniaId?: string;
  // Video generado con IA (Veo 9:16 o 16:9)
  videoUrl?: string;
  videoAspectRatio?: '9:16' | '16:9';
  videoEstado?: 'pendiente' | 'generando' | 'completado' | 'error';
  videoPrompt?: string;
  planComercio?: string;
  distanciaTexto?: string;
}

export interface ClickRecord {
  id: string;
  ofertaId: string;
  comercioId: string;
  usuarioId: string;
  tipo: 'contactar';
  codigoPersonal: string; // Código de 6 caracteres único para verificación sin QR
  referidoPor?: string;
  canal: 'whatsapp' | 'web';
  valido: boolean;
  facturable: boolean;
  motivoNoFacturable?: string;
  creadoEn: string;
}

export interface ConfirmedSale {
  id: string;
  codigoPersonal: string;
  comercioId: string;
  ofertaId: string;
  montoVenta?: number;
  confirmadaEn: string;
}

export interface PointsMovement {
  id: string;
  usuarioId: string;
  cantidad: number; // positivo o negativo
  motivo: 'referido_registrado' | 'canje' | 'ajuste_gestion';
  referenciaId?: string;
  fecha: string;
}

export interface Reward {
  id: string;
  comercioId: string;
  comercioNombre: string;
  titulo: string;
  descripcion: string;
  tipo: 'producto' | 'descuento';
  puntosRequeridos: number;
  stock: number;
  distrito: string;
  estado: 'activa' | 'agotada' | 'pausada';
  creadaEn: string;
}

export interface Redemption {
  id: string;
  codigo: string; // alfanumérico 8 caracteres
  rewardId: string;
  rewardTitulo: string;
  usuarioId: string;
  usuarioNombre: string;
  comercioId: string;
  puntosUsados: number;
  estado: 'emitido' | 'usado' | 'vencido';
  emitidoEn: string;
  usadoEn?: string;
}

export interface ClickPack {
  id: string;
  comercioId: string;
  totalClics: number;
  saldoClics: number;
  precioUnitario: number;
  montoTotal: number;
  estado: 'activo' | 'agotado';
  compradoEn: string;
}

export interface EventLog {
  id: string;
  tipoEvento: string;
  fechaHora: string;
  actorTipo: ActorType;
  actorId: string;
  distrito?: string;
  provincia?: string;
  origen: 'whatsapp' | 'web' | 'correo' | 'panel' | 'sistema';
  datos: Record<string, unknown>;
}

export interface AuditLogItem {
  id: string;
  operadorId: string;
  operadorNombre: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles: string;
  fecha: string;
}

export interface FeatureFlags {
  usuarios: boolean;
  comercios: boolean;
  ofertas: boolean;
  clicsAtribucion: boolean;
  puntosReferidos: boolean;
  campanasFacturacion: boolean; // Inicia en false (apagado por defecto)
  digest: boolean;
  analitica: boolean;
  iaUsuarios: boolean;
  iaComercios: boolean;
  iaGestion: boolean;
  webPublica: boolean;
  panelComercio: boolean;
  panelGestion: boolean;
}

export interface ChatMessage {
  id: string;
  remitente: 'usuario' | 'bot' | 'comercio';
  texto: string;
  tipo: 'texto' | 'tarjetas_oferta' | 'botones' | 'imagen';
  timestamp: string;
  ofertasData?: Offer[];
  botones?: {
    texto: string;
    accion: string;
    datos?: Record<string, unknown>;
  }[];
}

export type KanbanStage = 'prospecto' | 'contactado' | 'registrado' | 'en_validacion' | 'activo' | 'en_riesgo' | 'perdido';

export interface MerchantKanbanItem {
  merchantId: string;
  etapa: KanbanStage;
  notas: string;
  actualizadoEn: string;
}
