/**
 * MODULO: seguridad / autenticacion.
 * La verificacion de credenciales vive 100% en el servidor (/api/auth/*).
 * El navegador solo conserva la sesion firmada (token HMAC) y adjunta el
 * encabezado Authorization a cada llamada /api/*.
 */
export type RolSesion = 'admin' | 'operador' | 'comercio';

export interface SesionUsuario {
  token: string;
  usuarioId: string;
  nombre: string;
  email: string;
  rol: RolSesion;
  merchantId?: string | null;
  expiraEn: string;
}

export interface Credencial {
  email: string;
  nombre: string;
  rol: RolSesion;
  usuarioId?: string;
  merchantId?: string | null;
  descripcion?: string;
}

export interface RegistroAuditoria {
  id: string;
  operadorId: string;
  operadorNombre: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles: string;
  fecha: string;
}

interface ResultadoLogin {
  ok: boolean;
  sesion?: SesionUsuario;
  error?: string;
  bloqueado?: boolean;
  segundosRestantes?: number;
}

const STORAGE_KEY = 'vuuy_auth_session_v3';
const API_LOGIN = '/api/auth/login';
const API_LOGOUT = '/api/auth/logout';
const API_USERS = '/api/auth/users';
const API_PASSWORD = '/api/auth/password';

class CoreSecurity {
  public sesionActual: SesionUsuario | null = null;
  private listeners: (() => void)[] = [];
  private credenciales: Credencial[] = [];
  private auditLogs: RegistroAuditoria[] = [];
  private fetchPatched = false;

  constructor() {
    this.auditLogs = [
      {
        id: 'aud_01',
        operadorId: 'admin_master_01',
        operadorNombre: 'Super Admin',
        accion: 'Aprobar comercio',
        entidad: 'comercio',
        entidadId: 'merch_01',
        detalles: 'Checklist completado: RUC 20518923412 válido, Instagram verificado, WhatsApp verificado',
        fecha: '2026-09-15T14:30:00Z'
      },
      {
        id: 'aud_02',
        operadorId: 'admin_master_01',
        operadorNombre: 'Super Admin',
        accion: 'Validar oferta',
        entidad: 'oferta',
        entidadId: 'ofr_01',
        detalles: 'Aprobación de Bowl Acai Orgánico tras revisión de imágenes y precios',
        fecha: '2026-10-06T12:00:00Z'
      }
    ];
    this.instalarInterceptorFetch();
    this.cargarSesionAlmacenada();
  }

  /** Adjunta el token de sesión a toda llamada interna a /api/*. */
  private instalarInterceptorFetch(): void {
    if (typeof window === 'undefined' || this.fetchPatched || typeof window.fetch !== 'function') return;
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const token = this.sesionActual?.token;
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url;
        if (token && url && url.indexOf('/api/') !== -1) {
          const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
          if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
          init = { ...(init || {}), headers };
        }
      } catch {
        /* noop */
      }
      return fetchOriginal(input as any, init);
    };
    this.fetchPatched = true;
  }

  private cargarSesionAlmacenada(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const guardada = localStorage.getItem(STORAGE_KEY);
        if (guardada) {
          const parsed = JSON.parse(guardada) as SesionUsuario;
          if (parsed && parsed.token && new Date(parsed.expiraEn).getTime() > Date.now()) {
            this.sesionActual = parsed;
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      /* noop */
    }
  }

  async iniciarSesion(email: string, contrasena: string): Promise<ResultadoLogin> {
    const emailNormalizado = String(email || '').trim().toLowerCase();
    const contrasenaLimpia = String(contrasena || '').trim();
    if (!emailNormalizado || !contrasenaLimpia) {
      return { ok: false, error: 'Debe ingresar correo y contraseña.' };
    }
    try {
      const resp = await fetch(API_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailNormalizado, password: contrasenaLimpia })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok || !data?.sesion || !data?.token) {
        const error = data?.error || 'Credenciales de acceso incorrectas.';
        this.registrarAuditoria({
          operadorId: 'sistema_seguridad',
          operadorNombre: 'Filtro Seguridad',
          accion: 'Intento de acceso fallido',
          entidad: 'autenticacion',
          entidadId: emailNormalizado.substring(0, 3) + '***',
          detalles: `Fallo de autenticación para ${emailNormalizado}`
        });
        return { ok: false, error };
      }
      const sesion: SesionUsuario = { ...data.sesion, token: data.token };
      this.sesionActual = sesion;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
      } catch {
        /* noop */
      }
      this.registrarAuditoria({
        operadorId: sesion.usuarioId,
        operadorNombre: sesion.nombre,
        accion: 'Inicio de sesión',
        entidad: 'sesion',
        entidadId: sesion.usuarioId,
        detalles: `Inicio de sesión exitoso con rol ${sesion.rol} (${sesion.email})`
      });
      this.notificar();
      return { ok: true, sesion };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor de autenticación.' };
    }
  }

  cerrarSesion(): void {
    if (this.sesionActual) {
      this.registrarAuditoria({
        operadorId: this.sesionActual.usuarioId,
        operadorNombre: this.sesionActual.nombre,
        accion: 'Cierre de sesión',
        entidad: 'sesion',
        entidadId: this.sesionActual.usuarioId,
        detalles: `Cierre de sesión seguro de ${this.sesionActual.email}`
      });
      try {
        fetch(API_LOGOUT, { method: 'POST' }).catch(() => undefined);
      } catch {
        /* noop */
      }
    }
    this.sesionActual = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    this.notificar();
  }

  getSesionActual(): SesionUsuario | null {
    return this.sesionActual ? { ...this.sesionActual } : null;
  }

  getToken(): string | null {
    return this.sesionActual?.token || null;
  }

  estaAutenticado(): boolean {
    return !!this.sesionActual && new Date(this.sesionActual.expiraEn).getTime() > Date.now();
  }

  tieneAcceso(superficie: string): boolean {
    if (superficie === 'web') return true;
    if (!this.sesionActual) return false;
    if (superficie === 'gestion') return this.sesionActual.rol === 'admin';
    if (superficie === 'comercio') return this.sesionActual.rol === 'comercio' || this.sesionActual.rol === 'admin';
    return false;
  }

  cambiarSesion(sesion: Partial<SesionUsuario> | null): void {
    if (!sesion) {
      this.cerrarSesion();
      return;
    }
    if (this.sesionActual) {
      this.sesionActual = { ...this.sesionActual, ...sesion };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sesionActual));
      } catch {
        /* noop */
      }
      this.notificar();
    }
  }

  registrarAuditoria(log: Omit<RegistroAuditoria, 'id' | 'fecha'>): void {
    const item: RegistroAuditoria = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...log,
      fecha: new Date().toISOString()
    };
    this.auditLogs.unshift(item);
    this.notificar();
  }

  getAuditLogs(): RegistroAuditoria[] {
    return [...this.auditLogs];
  }

  tienePermiso(accion: string): boolean {
    if (!this.sesionActual) return false;
    if (this.sesionActual.rol === 'admin') return true;
    if (this.sesionActual.rol === 'operador') {
      return accion === 'aprobar_comercio' || accion === 'moderar_oferta';
    }
    return false;
  }

  suscribir(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  notificar(): void {
    this.listeners.forEach((l) => l());
  }

  // --- Gestion de credenciales (delegada al servidor) ---
  listarCredenciales(): Credencial[] {
    return [...this.credenciales];
  }

  async cargarCredenciales(): Promise<Credencial[]> {
    try {
      const resp = await fetch(API_USERS);
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok && Array.isArray(data.users)) {
        this.credenciales = data.users as Credencial[];
        this.notificar();
      }
    } catch {
      /* noop */
    }
    return this.listarCredenciales();
  }

  async actualizarContrasena(email: string, nuevaContrasena: string): Promise<{ ok: boolean; mensaje: string }> {
    const limpia = String(nuevaContrasena || '').trim();
    if (limpia.length < 6) {
      return { ok: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' };
    }
    try {
      const resp = await fetch(API_PASSWORD, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: limpia })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok) {
        this.registrarAuditoria({
          operadorId: this.sesionActual?.usuarioId || 'admin',
          operadorNombre: this.sesionActual?.nombre || 'Super Admin',
          accion: 'Cambio de contraseña',
          entidad: 'usuario_seguridad',
          entidadId: email,
          detalles: `Actualización de contraseña para el usuario ${email}`
        });
        return { ok: true, mensaje: data.mensaje || 'Contraseña actualizada correctamente' };
      }
      return { ok: false, mensaje: data?.error || 'No se pudo actualizar la contraseña' };
    } catch {
      return { ok: false, mensaje: 'Error de conexión con el servidor' };
    }
  }

  async agregarCredencial(nueva: {
    email: string;
    contrasena: string;
    nombre: string;
    rol: RolSesion;
    usuarioId?: string;
    merchantId?: string;
    descripcion?: string;
  }): Promise<{ ok: boolean; mensaje: string }> {
    try {
      const resp = await fetch(API_USERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: nueva.email,
          password: nueva.contrasena,
          nombre: nueva.nombre,
          rol: nueva.rol,
          usuarioId: nueva.usuarioId,
          merchantId: nueva.merchantId,
          descripcion: nueva.descripcion
        })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok) {
        await this.cargarCredenciales();
        this.registrarAuditoria({
          operadorId: this.sesionActual?.usuarioId || 'admin',
          operadorNombre: this.sesionActual?.nombre || 'Super Admin',
          accion: 'Alta de credencial de acceso',
          entidad: 'usuario_seguridad',
          entidadId: nueva.email,
          detalles: `Nuevo usuario creado: ${nueva.nombre} (${nueva.rol})`
        });
        return { ok: true, mensaje: data.mensaje || 'Usuario registrado exitosamente' };
      }
      return { ok: false, mensaje: data?.error || 'No se pudo crear la credencial' };
    } catch {
      return { ok: false, mensaje: 'Error de conexión con el servidor' };
    }
  }

  obtenerEstadoBloqueo(): { bloqueado: boolean; segundosRestantes: number; intentosRestantes: number } {
    return { bloqueado: false, segundosRestantes: 0, intentosRestantes: 5 };
  }
}

export const coreSecurity = new CoreSecurity();

/** @deprecated Las credenciales ahora viven y se validan en el servidor. */
export const CREDENCIALES_SISTEMA: Credencial[] = [];
