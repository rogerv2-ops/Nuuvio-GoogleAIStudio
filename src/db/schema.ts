import { boolean, integer, jsonb, numeric, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// Usuarios de autenticación Firebase (requerido por Cloud SQL setup)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Configuraciones persistentes del sistema (WhatsApp, Resend, SMTP, etc.)
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON stringificado
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Ofertas persistentes en Cloud SQL / PostgreSQL
export const offers = pgTable('offers', {
  id: text('id').primaryKey(),
  codigoUrl: text('codigo_url').notNull(),
  comercioId: text('comercio_id').notNull(),
  comercioNombre: text('comercio_nombre').notNull(),
  comercioWhatsapp: text('comercio_whatsapp').notNull(),
  titulo: text('titulo').notNull(),
  descripcion: text('descripcion').notNull(),
  tipo: text('tipo').notNull(),
  precioNormal: numeric('precio_normal').notNull(),
  precioOferta: numeric('precio_oferta').notNull(),
  stock: integer('stock'),
  categoria: text('categoria').notNull(),
  distrito: text('distrito').notNull(),
  provincia: text('provincia').notNull(),
  lat: numeric('lat').notNull(),
  lng: numeric('lng').notNull(),
  imagenes: jsonb('imagenes').notNull(),
  venceEn: text('vence_en').notNull(),
  estado: text('estado').notNull(),
  vistas: integer('vistas').default(0),
  clics: integer('clics').default(0),
  leadsCalificados: integer('leads_calificados').default(0),
  videoUrl: text('video_url'),
  creadaEn: text('creada_en').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Banners promocionales persistentes
export const banners = pgTable('banners', {
  id: text('id').primaryKey(),
  titulo: text('titulo').notNull(),
  subtitulo: text('subtitulo').notNull(),
  imagenUrl: text('imagen_url').notNull(),
  enlaceUrl: text('enlace_url'),
  activado: boolean('activado').default(true),
  orden: integer('orden').default(1),
  createdAt: timestamp('created_at').defaultNow(),
});

// Usuarios de la comunidad registrados y verificados
export const audienceUsers = pgTable('audience_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  nombre: text('nombre').notNull(),
  apellido: text('apellido'),
  telefono: text('telefono'),
  distrito: text('distrito'),
  provincia: text('provincia'),
  ciudad: text('ciudad'),
  emailVerificado: boolean('email_verificado').default(false),
  verificationToken: text('verification_token'),
  codigoRef: text('codigo_ref'),
  puntosSaldo: integer('puntos_saldo').default(0),
  estado: text('estado').default('pendiente'),
  categoriasInteres: jsonb('categorias_interes'),
  consentimientos: jsonb('consentimientos'),
  utm: jsonb('utm'),
  registradoEn: text('registrado_en'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Historial y auditoría de correos enviados (Resend / SMTP)
export const emailLogs = pgTable('email_logs', {
  id: text('id').primaryKey(),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  provider: text('provider').notNull(),
  status: text('status').notNull(),
  timestamp: text('timestamp').notNull(),
  verificationToken: text('verification_token'),
  verificationLink: text('verification_link'),
  whatsappLink: text('whatsapp_link'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit Log de intentos de registro de usuarios
export const registrationLogs = pgTable('registration_logs', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  telefono: text('telefono'),
  nombre: text('nombre'),
  status: text('status').notNull(), // 'success' | 'error'
  resultDetails: text('result_details'),
  timestamp: text('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

