/**
 * MODULO 5: usuarios (esquema: usr)
 * Ciclo de vida del usuario final: registro, verificación por correo,
 * vinculación de WhatsApp, categorías, consentimientos y bajas.
 */
import { AudienceUser } from '../types';
import { SEED_USER, SEED_AUDIENCE_USERS } from '../data/seedData';
import { coreEvents } from '../core/events';

class UsuariosModule {
  private usuarios: Map<string, AudienceUser> = new Map(SEED_AUDIENCE_USERS.map(u => [u.id, u]));

  // Códigos temporales de 6 dígitos para vincular teléfono con correo (H1)
  private codigosVinculacion: Map<string, { usuarioId: string; expiraEn: number }> = new Map([
    ['542918', { usuarioId: 'usr_demo_02', expiraEn: Date.now() + 48 * 3600 * 1000 }]
  ]);

  private solicitudesDelDia: Map<string, { fecha: string; contador: number }> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    this.cargarDesdeStorage();
    this.cargarDesdeServidor();
  }

  private async cargarDesdeServidor() {
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch('/api/audience/users');
      if (res.ok) {
        const data = await res.json();
        if (data.ok && Array.isArray(data.users)) {
          data.users.forEach((u: any) => {
            if (u && u.id) {
              const existente = this.usuarios.get(u.id);
              this.usuarios.set(u.id, {
                ...(existente || {}),
                id: u.id,
                email: u.email,
                nombre: u.nombre,
                apellido: u.apellido || '',
                telefono: u.telefono || '',
                distrito: u.distrito || '',
                provincia: u.provincia || 'Lima',
                ciudad: u.ciudad || 'Lima',
                emailVerificado: !!u.emailVerificado,
                verificationToken: u.verificationToken || undefined,
                codigoRef: u.codigoRef || `REF${Math.floor(10000 + Math.random() * 90000)}`,
                puntosSaldo: u.puntosSaldo || 0,
                estado: u.estado || 'pendiente',
                categoriasInteres: Array.isArray(u.categoriasInteres) ? u.categoriasInteres : [],
                consentimientos: u.consentimientos || { correo: true, push: true, whatsapp: true },
                registradoEn: u.registradoEn || new Date().toISOString(),
                edad: existente?.edad || 25,
                genero: existente?.genero || 'No especificado'
              });
            }
          });
          this.guardarEnStorage();
          this.notificar();
        }
      }
    } catch (e) {
      // Ignorar fallos de red silenciosamente
    }
  }

  public async syncConServidor(user: AudienceUser): Promise<{ ok: boolean; error?: string }> {
    if (typeof window === 'undefined') return { ok: true };
    try {
      const res = await fetch('/api/audience/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error || `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (err: any) {
      console.warn('Error sincronizando usuario con servidor:', err);
      return { ok: false, error: err.message };
    }
  }

  private cargarDesdeStorage() {
    if (typeof window === 'undefined') return;
    try {
      const guardados = localStorage.getItem('vuuy_registered_users_list');
      if (guardados) {
        const parsed: AudienceUser[] = JSON.parse(guardados);
        if (Array.isArray(parsed)) {
          parsed.forEach((u) => {
            if (u && u.id) {
              this.usuarios.set(u.id, u);
            }
          });
        }
      }
    } catch (e) {
      console.warn('Error al cargar usuarios de localStorage:', e);
    }
  }

  private guardarEnStorage() {
    if (typeof window === 'undefined') return;
    try {
      const lista = Array.from(this.usuarios.values());
      localStorage.setItem('vuuy_registered_users_list', JSON.stringify(lista));
    } catch (e) {
      console.warn('Error al guardar usuarios en localStorage:', e);
    }
  }

  public obtenerPorToken(token: string): AudienceUser | undefined {
    if (!token) return undefined;
    for (const u of this.usuarios.values()) {
      if (u.verificationToken === token) {
        return u;
      }
    }
    return undefined;
  }

  public verificarDuplicadoLocal(email: string, telefono: string): { existe: boolean; mensaje?: string } {
    const emailNorm = email.trim().toLowerCase();
    const telLimpio = telefono.replace(/\D/g, '');

    for (const u of this.usuarios.values()) {
      if (u.email && u.email.trim().toLowerCase() === emailNorm) {
        return {
          existe: true,
          mensaje: 'El correo electrónico ingresado ya se encuentra registrado en el sistema.'
        };
      }
      const uTel = (u.telefono || '').replace(/\D/g, '');
      if (telLimpio && uTel && (uTel === telLimpio || (telLimpio.length >= 9 && uTel.endsWith(telLimpio.slice(-9))))) {
        return {
          existe: true,
          mensaje: 'El número de WhatsApp ingresado ya se encuentra registrado en el sistema.'
        };
      }
    }
    return { existe: false };
  }

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
    const duplicado = this.verificarDuplicadoLocal(datos.email, datos.telefono);
    if (duplicado.existe && duplicado.mensaje) {
      throw new Error(duplicado.mensaje);
    }

    // Normalizar teléfono
    const telLimpio = datos.telefono.replace(/\s+/g, '');
    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const codigoRef = `REF${Math.floor(10000 + Math.random() * 90000)}`;
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

    this.guardarEnStorage();
    this.syncConServidor(nuevoUsuario);
    this.notificar();
    return { usuario: nuevoUsuario, codigoVinculacion, verificationToken };
  }

  public async registrarUsuarioAsync(datos: {
    nombre: string;
    apellido: string;
    telefono: string;
    email: string;
    edad?: number;
    genero?: string;
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
  }): Promise<{ usuario: AudienceUser; codigoVinculacion: string; verificationToken: string }> {
    const res = this.registrarUsuario({
      ...datos,
      edad: datos.edad || 28,
      genero: datos.genero || 'No especificado'
    });
    await this.syncConServidor(res.usuario);
    return res;
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

        this.guardarEnStorage();
        this.syncConServidor(u);
        this.notificar();
        return u;
      }
    }
    return null;
  }

  public agregarOActualizarUsuario(user: AudienceUser): void {
    if (!user || !user.id) return;
    this.usuarios.set(user.id, user);
    if (user.emailVerificado || user.estado === 'activo') {
      this.setUsuarioActivo(user.id);
    }
    this.guardarEnStorage();
    this.notificar();
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

  public async eliminarYPurgarUsuario(usuarioId: string, email?: string, telefono?: string): Promise<{ ok: boolean; mensaje: string }> {
    const u = this.usuarios.get(usuarioId);
    const emailToPurge = email || u?.email;
    const phoneToPurge = telefono || u?.telefono;

    if (usuarioId) {
      this.usuarios.delete(usuarioId);
    }
    
    if (emailToPurge) {
      for (const [id, user] of Array.from(this.usuarios.entries())) {
        if (user.email.toLowerCase() === emailToPurge.toLowerCase()) {
          this.usuarios.delete(id);
        }
      }
    }

    if (typeof window !== 'undefined') {
      const activeId = localStorage.getItem('vuuy_active_user_id');
      if (activeId === usuarioId) {
        localStorage.removeItem('vuuy_active_user_id');
      }
      this.guardarEnStorage();
    }

    this.notificar();

    try {
      const res = await fetch('/api/audience/purge-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: usuarioId,
          email: emailToPurge,
          telefono: phoneToPurge
        })
      });
      const data = await res.json();
      if (data.ok) {
        return { ok: true, mensaje: 'Usuario y todos sus rastros fueron purgados de la base de datos' };
      }
      return { ok: false, mensaje: data.error || 'No se pudo completar la purga en el servidor' };
    } catch (err: any) {
      console.warn('Error llamando a API de purga:', err);
      return { ok: true, mensaje: 'Usuario eliminado localmente' };
    }
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
