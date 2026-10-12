/**
 * MODULO 5: usuarios (esquema: usr)
 * Ciclo de vida del usuario final: registro, verificación por correo,
 * vinculación de WhatsApp, categorías, consentimientos y bajas.
 */
import { AudienceUser } from '../types';
import { SEED_USER } from '../data/seedData';
import { coreEvents } from '../core/events';

class UsuariosModule {
  private usuarios: Map<string, AudienceUser> = new Map([
    [SEED_USER.id, { 
      ...SEED_USER,
      utm: {
        source: 'instagram',
        medium: 'paid_social',
        campaign: 'promo_gastronomia_lima',
        content: 'video_reels_acai'
      }
    }],
    ['usr_demo_02', {
      id: 'usr_demo_02',
      telefono: '+51 987 111 222',
      nombre: 'Luciana',
      apellido: 'Rivas',
      email: 'luciana.rivas@gmail.com',
      emailVerificado: false,
      edad: 26,
      genero: 'Femenino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'Barranco',
      categoriasInteres: ['Gastronomía y Café', 'Moda y Calzado'],
      puntosSaldo: 0,
      codigoRef: 'VUUY-LR26',
      invitadoPor: 'VUUY-CV88',
      estado: 'pendiente',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 36).toISOString(),
      utm: {
        source: 'whatsapp',
        medium: 'chat_share',
        campaign: 'amigos_vuuy_ofertas'
      }
    }],
    ['usr_demo_03', {
      id: 'usr_demo_03',
      telefono: '+51 987 222 333',
      nombre: 'Mateo',
      apellido: 'Alva',
      email: 'mateo.alva@outlook.com',
      emailVerificado: true,
      edad: 31,
      genero: 'Masculino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
      categoriasInteres: ['Gastronomía y Café', 'Tecnología y Gadgets'],
      puntosSaldo: 30,
      codigoRef: 'VUUY-MA73',
      estado: 'activo',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 48).toISOString(),
      utm: {
        source: 'facebook',
        medium: 'social_post',
        campaign: 'ofertas_barranco_miraflores',
        content: 'carrusel_cafeterias'
      }
    }],
    ['usr_demo_04', {
      id: 'usr_demo_04',
      telefono: '+51 987 333 444',
      nombre: 'Valeria',
      apellido: 'Mendoza',
      email: 'valeria.mendoza@gmail.com',
      emailVerificado: true,
      edad: 24,
      genero: 'Femenino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'San Isidro',
      categoriasInteres: ['Moda y Calzado', 'Belleza y Bienestar'],
      puntosSaldo: 50,
      codigoRef: 'VUUY-VM91',
      estado: 'activo',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 20).toISOString(),
      utm: {
        source: 'tiktok',
        medium: 'creator_bio',
        campaign: 'foodies_lima_noche',
        content: 'link_en_bio'
      }
    }],
    ['usr_demo_05', {
      id: 'usr_demo_05',
      telefono: '+51 987 444 555',
      nombre: 'Diego',
      apellido: 'Paredes',
      email: 'diego.paredes@gmail.com',
      emailVerificado: true,
      edad: 34,
      genero: 'Masculino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'Surco',
      categoriasInteres: ['Gastronomía y Café', 'Hogar y Decoración'],
      puntosSaldo: 10,
      codigoRef: 'VUUY-DP12',
      estado: 'activo',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 12).toISOString(),
      utm: {
        source: 'google',
        medium: 'cpc',
        campaign: 'ofertas_restaurantes_lima',
        term: 'descuentos cafes lima'
      }
    }],
    ['usr_demo_06', {
      id: 'usr_demo_06',
      telefono: '+51 987 555 666',
      nombre: 'Andrea',
      apellido: 'Silva',
      email: 'andrea.silva@hotmail.com',
      emailVerificado: true,
      edad: 28,
      genero: 'Femenino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'Barranco',
      categoriasInteres: ['Gastronomía y Café', 'Belleza y Bienestar'],
      puntosSaldo: 20,
      codigoRef: 'VUUY-AS45',
      invitadoPor: 'VUUY-CV88',
      estado: 'activo',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 8).toISOString(),
      utm: {
        source: 'whatsapp',
        medium: 'chat_share',
        campaign: 'amigos_vuuy_ofertas'
      }
    }],
    ['usr_demo_07', {
      id: 'usr_demo_07',
      telefono: '+51 987 666 777',
      nombre: 'Renzo',
      apellido: 'Chávez',
      email: 'renzo.chavez@gmail.com',
      emailVerificado: false,
      edad: 27,
      genero: 'Masculino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'San Borja',
      categoriasInteres: ['Tecnología y Gadgets', 'Gastronomía y Café'],
      puntosSaldo: 0,
      codigoRef: 'VUUY-RC60',
      estado: 'pendiente',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 4).toISOString(),
      utm: {
        source: 'instagram',
        medium: 'paid_social',
        campaign: 'promo_gastronomia_lima',
        content: 'story_swipe'
      }
    }],
    ['usr_demo_08', {
      id: 'usr_demo_08',
      telefono: '+51 987 777 888',
      nombre: 'Camila',
      apellido: 'Torres',
      email: 'camila.torres@gmail.com',
      emailVerificado: true,
      edad: 25,
      genero: 'Femenino',
      ciudad: 'Lima',
      provincia: 'Lima',
      distrito: 'Miraflores',
      categoriasInteres: ['Moda y Calzado', 'Gastronomía y Café'],
      puntosSaldo: 10,
      codigoRef: 'VUUY-CT19',
      invitadoPor: 'VUUY-LR26',
      estado: 'activo',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date(Date.now() - 3600000 * 2).toISOString(),
      utm: {
        source: 'tiktok',
        medium: 'creator_bio',
        campaign: 'foodies_lima_noche'
      }
    }]
  ]);

  // Códigos temporales de 6 dígitos para vincular teléfono con correo (H1)
  private codigosVinculacion: Map<string, { usuarioId: string; expiraEn: number }> = new Map([
    ['542918', { usuarioId: 'usr_demo_02', expiraEn: Date.now() + 48 * 3600 * 1000 }]
  ]);

  private solicitudesDelDia: Map<string, { fecha: string; contador: number }> = new Map();
  private listeners: (() => void)[] = [];

  public registrarUsuario(datos: {
    nombre: string;
    apellido: string;
    telefono: string;
    email: string;
    edad: number;
    genero: string;
    distrito: string;
    provincia?: string;
    ciudad?: string;
    categoriasInteres: string[];
    invitadoPor?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
  }): { usuario: AudienceUser; codigoVinculacion: string; verificationToken: string } {
    // Normalizar teléfono
    const telLimpio = datos.telefono.replace(/\s+/g, '');
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const iniciales = (datos.nombre.charAt(0) + (datos.apellido ? datos.apellido.charAt(0) : 'U')).toUpperCase();
    const codigoRef = `VUUY-${iniciales}${Math.floor(10 + Math.random() * 90)}`;
    const verificationToken = `vtok_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    const nuevoUsuario: AudienceUser = {
      id,
      telefono: telLimpio,
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email.toLowerCase(),
      emailVerificado: false, // Requiere verificación por correo
      edad: datos.edad,
      genero: datos.genero,
      ciudad: datos.ciudad || 'Lima',
      provincia: datos.provincia || 'Lima',
      distrito: datos.distrito,
      categoriasInteres: datos.categoriasInteres,
      puntosSaldo: 0,
      codigoRef,
      invitadoPor: datos.invitadoPor,
      estado: 'pendiente',
      consentimientos: { correo: true, push: true, whatsapp: true },
      registradoEn: new Date().toISOString(),
      utm: datos.utm,
      verificationToken
    };

    this.usuarios.set(id, nuevoUsuario);

    // Guardar usuario en sesión local activa
    this.setUsuarioActivo(id);

    // Generar código de 6 dígitos para vincular
    const codigoVinculacion = Math.floor(100000 + Math.random() * 900000).toString();
    this.codigosVinculacion.set(codigoVinculacion, {
      usuarioId: id,
      expiraEn: Date.now() + 48 * 3600 * 1000
    });

    coreEvents.emitir({
      tipoEvento: 'usuario_registrado_utm',
      actorTipo: 'usuario',
      actorId: id,
      distrito: datos.distrito,
      origen: 'web',
      datos: {
        nombre: `${datos.nombre} ${datos.apellido}`,
        email: datos.email,
        telefono: telLimpio,
        invitadoPor: datos.invitadoPor,
        utm: datos.utm,
        verificationToken
      }
    });

    this.notificar();
    return { usuario: nuevoUsuario, codigoVinculacion, verificationToken };
  }

  public verificarPorToken(token: string): AudienceUser | null {
    if (!token) return null;
    for (const u of this.usuarios.values()) {
      if (u.verificationToken === token) {
        u.emailVerificado = true;
        u.estado = 'activo';
        this.setUsuarioActivo(u.id);

        coreEvents.emitir({
          tipoEvento: 'email_verificado_token',
          actorTipo: 'usuario',
          actorId: u.id,
          distrito: u.distrito,
          origen: 'correo',
          datos: { email: u.email, token }
        });

        this.notificar();
        return u;
      }
    }
    return null;
  }

  public getUsuarioActivo(): AudienceUser | null {
    if (typeof window === 'undefined') return null;
    try {
      const id = localStorage.getItem('vuuy_active_user_id');
      if (id) {
        return this.usuarios.get(id) || null;
      }
    } catch {
      // ignore
    }
    return null;
  }

  public setUsuarioActivo(id: string | null) {
    if (typeof window === 'undefined') return;
    try {
      if (id) {
        localStorage.setItem('vuuy_active_user_id', id);
      } else {
        localStorage.removeItem('vuuy_active_user_id');
      }
    } catch {
      // ignore
    }
    this.notificar();
  }

  public verificarEmail(usuarioId: string): boolean {
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) return false;
    usuario.emailVerificado = true;
    usuario.estado = 'activo';

    coreEvents.emitir({
      tipoEvento: 'email_verificado',
      actorTipo: 'usuario',
      actorId: usuarioId,
      distrito: usuario.distrito,
      origen: 'correo',
      datos: { email: usuario.email }
    });

    this.notificar();
    return true;
  }

  public vincularPorCodigo(codigo: string, telefono: string): AudienceUser | null {
    const registro = this.codigosVinculacion.get(codigo);
    if (!registro || registro.expiraEn < Date.now()) return null;

    const usuario = this.usuarios.get(registro.usuarioId);
    if (!usuario) return null;

    usuario.telefono = telefono.replace(/\s+/g, '');
    usuario.emailVerificado = true;
    usuario.estado = 'activo';
    usuario.ultimoMensajeEn = new Date().toISOString();

    coreEvents.emitir({
      tipoEvento: 'whatsapp_vinculado',
      actorTipo: 'usuario',
      actorId: usuario.id,
      distrito: usuario.distrito,
      origen: 'whatsapp',
      datos: { telefono: usuario.telefono, codigo }
    });

    this.codigosVinculacion.delete(codigo);
    this.notificar();
    return usuario;
  }

  public obtenerPorTelefono(telefono: string): AudienceUser | undefined {
    const telLimpio = telefono.replace(/[\s+-]/g, '');
    for (const user of this.usuarios.values()) {
      const uTelLimpio = user.telefono.replace(/[\s+-]/g, '');
      if (uTelLimpio === telLimpio || uTelLimpio.endsWith(telLimpio) || telLimpio.endsWith(uTelLimpio)) {
        return user;
      }
    }
    return undefined;
  }

  public obtenerPorId(id: string): AudienceUser | undefined {
    return this.usuarios.get(id);
  }

  public listarUsuarios(): AudienceUser[] {
    return Array.from(this.usuarios.values());
  }

  public registrarSolicitudOferta(usuarioId: string): { permitido: boolean; numeroDelDia: number } {
    const hoy = new Date().toISOString().split('T')[0];
    const clave = `${usuarioId}_${hoy}`;
    const registro = this.solicitudesDelDia.get(clave) || { fecha: hoy, contador: 0 };

    if (registro.contador >= 10) {
      return { permitido: false, numeroDelDia: registro.contador };
    }

    registro.contador += 1;
    this.solicitudesDelDia.set(clave, registro);

    const usuario = this.usuarios.get(usuarioId);
    if (usuario) {
      usuario.ultimoMensajeEn = new Date().toISOString();
    }

    coreEvents.emitir({
      tipoEvento: 'oferta_solicitada',
      actorTipo: 'usuario',
      actorId: usuarioId,
      distrito: usuario?.distrito,
      origen: 'whatsapp',
      datos: { numeroDelDia: registro.contador }
    });

    return { permitido: true, numeroDelDia: registro.contador };
  }

  public darDeBaja(usuarioId: string, canal?: 'correo' | 'push' | 'whatsapp' | 'todo') {
    const usuario = this.usuarios.get(usuarioId);
    if (!usuario) return;

    if (canal === 'todo' || !canal) {
      usuario.estado = 'baja';
      usuario.consentimientos = { correo: false, push: false, whatsapp: false };
    } else {
      usuario.consentimientos[canal] = false;
    }

    coreEvents.emitir({
      tipoEvento: 'usuario_baja',
      actorTipo: 'usuario',
      actorId: usuarioId,
      distrito: usuario.distrito,
      origen: 'whatsapp',
      datos: { canal: canal || 'todo' }
    });

    this.notificar();
  }

  public suscribir(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notificar() {
    this.listeners.forEach(l => l());
  }
}

export const usuariosModule = new UsuariosModule();
