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

export interface EventoSeguridad {
  id: string;
  operadorId: string;
  operadorNombre: string;
  accion: string;
  entidad: string;
  entidadId: string;
  detalles: string;
  createdAt: string;
}

export interface CambiosCredencial {
  nombre?: string;
  rol?: RolSesion;
  merchantId?: string | null;
  descripcion?: string;
}

interface ResultadoLogin {
  ok: boolean;
  sesion?: SesionUsuario;
  error?: string;
  bloqueado?: boolean;
  segundosRestantes?: number;
  mfaRequerido?: boolean;
  mfaToken?: string;
}

const STORAGE_KEY = 'vuuy_auth_session_v3';
const API_LOGIN = '/api/auth/login';
const API_LOGOUT = '/api/auth/logout';
const API_USERS = '/api/auth/users';
const API_PASSWORD = '/api/auth/password';
const API_SECURITY_LOGS = '/api/security/logs';
const API_FORGOT = '/api/auth/forgot-password';
const API_RESET = '/api/auth/reset-password';
const API_REFRESH = '/api/auth/refresh';
const API_LOGIN_MFA = '/api/auth/login/mfa';
const API_MFA_STATUS = '/api/auth/mfa/status';
const API_MFA_SETUP = '/api/auth/mfa/setup';
const API_MFA_ACTIVATE = '/api/auth/mfa/activate';
const API_MFA_DISABLE = '/api/auth/mfa/disable';

const ACTIVITY_KEY = 'vuuy_auth_activity_v1';
const IDLE_MS = 5 * 60 * 1000;
const REFRESH_LEAD_MS = 2 * 60 * 1000;
const VIGILANCIA_INTERVALO_MS = 15000;
const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'scroll',
  'touchstart',
  'touchmove',
  'click',
  'pointerdown'
] as const;

class CoreSecurity {
  public sesionActual: SesionUsuario | null = null;
  private listeners: (() => void)[] = [];
  private credenciales: Credencial[] = [];
  private auditLogs: RegistroAuditoria[] = [];
  private fetchPatched = false;
  private bloqueoHasta = 0;
  private cerrandoPorNoAutorizado = false;
  private ultimaActividad = Date.now();
  private ultimaEscrituraActividad = 0;
  private vigilanciaInstalada = false;
  private renovando = false;

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
    this.instalarSincronizacionEntrePestanas();
    this.cargarSesionAlmacenada();
    this.instalarVigilanciaInactividad();
  }

  /**
   * Adjunta el token de sesión a toda llamada interna a /api/* y detecta
   * respuestas 401 para invalidar la sesión local (evita que la consola se
   * renderice "logueada" mientras el servidor rechaza cada llamada).
   */
  private instalarInterceptorFetch(): void {
    if (typeof window === 'undefined' || this.fetchPatched || typeof window.fetch !== 'function') return;
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      let url = '';
      try {
        const token = this.sesionActual?.token;
        url =
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
      return fetchOriginal(input as any, init).then((res) => {
        try {
          if (
            res &&
            res.status === 401 &&
            url.indexOf('/api/') !== -1 &&
            !/\/api\/auth\/(login|forgot-password|reset-password|me)/.test(url)
          ) {
            this.invalidarSesionLocal();
          }
        } catch {
          /* noop */
        }
        return res;
      });
    };
    this.fetchPatched = true;
  }

  /** Refleja en esta pestaña los cambios de sesión hechos en otra pestaña. */
  private instalarSincronizacionEntrePestanas(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('storage', (event) => {
      if (!event) return;
      if (event.key === ACTIVITY_KEY) {
        const ts = Number(event.newValue);
        if (Number.isFinite(ts) && ts > 0) this.ultimaActividad = Math.max(this.ultimaActividad, ts);
        return;
      }
      if (event.key !== STORAGE_KEY) return;
      if (event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue) as SesionUsuario;
          if (parsed && parsed.usuarioId) this.sesionActual = parsed;
        } catch {
          /* noop */
        }
      } else {
        this.sesionActual = null;
      }
      this.notificar();
    });
  }

  /** Limpia la sesión local cuando el servidor respondió 401 (token inválido/expirado). */
  invalidarSesionLocal(): void {
    if (this.cerrandoPorNoAutorizado) return;
    if (!this.sesionActual) return;
    this.cerrandoPorNoAutorizado = true;
    this.sesionActual = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* noop */
    }
    this.notificar();
    this.cerrandoPorNoAutorizado = false;
  }

  /** ¿La sesión actual debe expirar por inactividad? (admin y comercio). */
  private sesionSujetaAInactividad(): boolean {
    const rol = this.sesionActual?.rol;
    return rol === 'admin' || rol === 'comercio';
  }

  /** Registra actividad del usuario y la comparte entre pestañas (para el timeout conjunto). */
  private marcarActividad(): void {
    const ahora = Date.now();
    this.ultimaActividad = ahora;
    if (ahora - this.ultimaEscrituraActividad > 1000) {
      this.ultimaEscrituraActividad = ahora;
      try {
        localStorage.setItem(ACTIVITY_KEY, String(ahora));
      } catch {
        /* noop */
      }
    }
  }

  /** Vigila la actividad real y cierra/renueva la sesión de admin y comercio. */
  private instalarVigilanciaInactividad(): void {
    if (typeof window === 'undefined' || this.vigilanciaInstalada) return;
    const marcar = () => this.marcarActividad();
    for (const evento of ACTIVITY_EVENTS) {
      window.addEventListener(evento, marcar, { passive: true });
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', marcar, { passive: true });
    }
    window.setInterval(() => {
      void this.revisarSesion();
    }, VIGILANCIA_INTERVALO_MS);
    this.vigilanciaInstalada = true;
  }

  private async revisarSesion(): Promise<void> {
    if (!this.sesionActual) return;
    if (this.sesionSujetaAInactividad() && Date.now() - this.ultimaActividad > IDLE_MS) {
      this.cerrarPorInactividad();
      return;
    }
    await this.renovarSesionSiNecesario();
  }

  private cerrarPorInactividad(): void {
    if (!this.sesionActual) return;
    this.registrarAuditoria({
      operadorId: this.sesionActual.usuarioId,
      operadorNombre: this.sesionActual.nombre,
      accion: 'Cierre por inactividad',
      entidad: 'sesion',
      entidadId: this.sesionActual.usuarioId,
      detalles: 'Sesión cerrada automáticamente tras 5 minutos sin actividad'
    });
    this.cerrarSesion();
  }

  /** Renueva el token mientras el usuario sigue activo (sesiones admin/comercio). */
  private async renovarSesionSiNecesario(): Promise<void> {
    const s = this.sesionActual;
    if (!s || this.renovando || !this.sesionSujetaAInactividad()) return;
    const restante = new Date(s.expiraEn).getTime() - Date.now();
    if (restante > REFRESH_LEAD_MS) return;
    if (restante <= 0) {
      this.invalidarSesionLocal();
      return;
    }
    this.renovando = true;
    try {
      const resp = await fetch(API_REFRESH, { method: 'POST' });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok && data?.sesion) {
        this.sesionActual = { ...data.sesion, token: '' };
        this.ultimaActividad = Date.now();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sesionActual));
        } catch {
          /* noop */
        }
        this.notificar();
      } else if (resp.status === 401) {
        this.invalidarSesionLocal();
      }
    } catch {
      /* noop */
    } finally {
      this.renovando = false;
    }
  }

  /** Valida contra el servidor la sesión almacenada (por si el token ya no sirve). */
  async validarSesionConServidor(): Promise<boolean> {
    if (!this.sesionActual) return false;
    try {
      const resp = await fetch('/api/auth/me');
      if (resp.status === 401) {
        this.invalidarSesionLocal();
        return false;
      }
      return resp.ok;
    } catch {
      return true;
    }
  }

  private cargarSesionAlmacenada(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const guardada = localStorage.getItem(STORAGE_KEY);
        const actividadGuardada = Number(localStorage.getItem(ACTIVITY_KEY));
        if (Number.isFinite(actividadGuardada) && actividadGuardada > 0) {
          this.ultimaActividad = Math.min(Date.now(), actividadGuardada);
        }
        if (guardada) {
          const parsed = JSON.parse(guardada) as SesionUsuario;
          if (parsed && parsed.usuarioId && new Date(parsed.expiraEn).getTime() > Date.now()) {
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
      if (data?.mfaRequerido && data?.mfaToken) {
        return { ok: false, mfaRequerido: true, mfaToken: String(data.mfaToken) };
      }
      if (!resp.ok || !data?.ok || !data?.sesion) {
        const error = data?.error || 'Credenciales de acceso incorrectas.';
        const bloqueado = resp.status === 423 || data?.bloqueado === true;
        const segundosRestantes = Number(data?.segundosRestantes) || 0;
        if (bloqueado && segundosRestantes > 0) {
          this.bloqueoHasta = Date.now() + segundosRestantes * 1000;
        }
        this.registrarAuditoria({
          operadorId: 'sistema_seguridad',
          operadorNombre: 'Filtro Seguridad',
          accion: bloqueado ? 'Cuenta bloqueada temporalmente' : 'Intento de acceso fallido',
          entidad: 'autenticacion',
          entidadId: emailNormalizado.substring(0, 3) + '***',
          detalles: `Fallo de autenticación para ${emailNormalizado}`
        });
        return { ok: false, error, bloqueado, segundosRestantes };
      }
      const sesion: SesionUsuario = { ...data.sesion, token: '' };
      this.sesionActual = sesion;
      this.ultimaActividad = Date.now();
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

  async verificarMfa(mfaToken: string, codigo: string): Promise<ResultadoLogin> {
    const codigoLimpio = String(codigo || '').trim();
    if (!mfaToken || !codigoLimpio) {
      return { ok: false, error: 'Ingrese el código de verificación.' };
    }
    try {
      const resp = await fetch(API_LOGIN_MFA, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken, codigo: codigoLimpio })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok || !data?.sesion) {
        return { ok: false, error: data?.error || 'Código de verificación incorrecto.' };
      }
      const sesion: SesionUsuario = { ...data.sesion, token: '' };
      this.sesionActual = sesion;
      this.ultimaActividad = Date.now();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
      } catch {
        /* noop */
      }
      this.registrarAuditoria({
        operadorId: sesion.usuarioId,
        operadorNombre: sesion.nombre,
        accion: 'Inicio de sesión (MFA)',
        entidad: 'sesion',
        entidadId: sesion.usuarioId,
        detalles: `Segundo factor verificado con rol ${sesion.rol} (${sesion.email})`
      });
      this.notificar();
      return { ok: true, sesion };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor de autenticación.' };
    }
  }

  async obtenerEstadoMfa(): Promise<{ ok: boolean; habilitado?: boolean; disponible?: boolean; error?: string }> {
    try {
      const resp = await fetch(API_MFA_STATUS);
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) return { ok: false, error: data?.error || 'No se pudo consultar el estado de MFA.' };
      return { ok: true, habilitado: !!data.habilitado, disponible: data.disponible !== false };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
  }

  async configurarMfa(): Promise<{ ok: boolean; secret?: string; otpauthUrl?: string; qrDataUrl?: string; error?: string }> {
    try {
      const resp = await fetch(API_MFA_SETUP, { method: 'POST' });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) return { ok: false, error: data?.error || 'No se pudo iniciar la configuración de MFA.' };
      return { ok: true, secret: data.secret, otpauthUrl: data.otpauthUrl, qrDataUrl: data.qrDataUrl };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
  }

  async activarMfa(codigo: string): Promise<{ ok: boolean; codigosRespaldo?: string[]; error?: string }> {
    try {
      const resp = await fetch(API_MFA_ACTIVATE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: String(codigo || '').trim() })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) return { ok: false, error: data?.error || 'No se pudo activar MFA.' };
      return { ok: true, codigosRespaldo: Array.isArray(data.codigosRespaldo) ? data.codigosRespaldo : [] };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
    }
  }

  async desactivarMfa(codigo: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const resp = await fetch(API_MFA_DISABLE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo: String(codigo || '').trim() })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.ok) return { ok: false, error: data?.error || 'No se pudo desactivar MFA.' };
      return { ok: true };
    } catch {
      return { ok: false, error: 'No se pudo conectar con el servidor.' };
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
    if (!this.estaAutenticado()) return false;
    if (superficie === 'gestion') return this.sesionActual!.rol === 'admin';
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

  async actualizarCredencial(
    identificador: string,
    cambios: CambiosCredencial
  ): Promise<{ ok: boolean; mensaje: string }> {
    try {
      const resp = await fetch(`${API_USERS}/${encodeURIComponent(identificador)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios)
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok) {
        await this.cargarCredenciales();
        this.registrarAuditoria({
          operadorId: this.sesionActual?.usuarioId || 'admin',
          operadorNombre: this.sesionActual?.nombre || 'Super Admin',
          accion: 'Actualización de credencial',
          entidad: 'usuario_seguridad',
          entidadId: identificador,
          detalles: `Credencial actualizada: ${JSON.stringify(cambios)}`
        });
        return { ok: true, mensaje: data.mensaje || 'Credencial actualizada correctamente' };
      }
      return { ok: false, mensaje: data?.error || 'No se pudo actualizar la credencial' };
    } catch {
      return { ok: false, mensaje: 'Error de conexión con el servidor' };
    }
  }

  async eliminarCredencial(identificador: string): Promise<{ ok: boolean; mensaje: string }> {
    try {
      const resp = await fetch(`${API_USERS}/${encodeURIComponent(identificador)}`, {
        method: 'DELETE'
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok) {
        await this.cargarCredenciales();
        this.registrarAuditoria({
          operadorId: this.sesionActual?.usuarioId || 'admin',
          operadorNombre: this.sesionActual?.nombre || 'Super Admin',
          accion: 'Eliminación de credencial',
          entidad: 'usuario_seguridad',
          entidadId: identificador,
          detalles: `Credencial eliminada: ${identificador}`
        });
        return { ok: true, mensaje: data.mensaje || 'Credencial eliminada correctamente' };
      }
      return { ok: false, mensaje: data?.error || 'No se pudo eliminar la credencial' };
    } catch {
      return { ok: false, mensaje: 'Error de conexión con el servidor' };
    }
  }

  async cargarLogsSeguridad(limite = 100): Promise<EventoSeguridad[]> {
    try {
      const resp = await fetch(`${API_SECURITY_LOGS}?limit=${limite}`);
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok && Array.isArray(data.logs)) {
        return data.logs as EventoSeguridad[];
      }
    } catch {
      /* noop */
    }
    return [];
  }

  /** Solicita el envío de un código de recuperación al correo indicado. */
  async solicitarResetContrasena(email: string): Promise<{ ok: boolean; mensaje: string }> {
    const correo = String(email || '').trim().toLowerCase();
    if (!correo) return { ok: false, mensaje: 'Debe ingresar un correo electrónico.' };
    try {
      const resp = await fetch(API_FORGOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo })
      });
      const data: any = await resp.json().catch(() => ({}));
      return {
        ok: resp.ok && data?.ok !== false,
        mensaje:
          data?.mensaje ||
          data?.error ||
          'Si el correo está registrado, recibirás un código de recuperación.'
      };
    } catch {
      return { ok: false, mensaje: 'No se pudo conectar con el servidor de autenticación.' };
    }
  }

  /** Confirma el restablecimiento con el código recibido y la nueva contraseña. */
  async confirmarResetContrasena(
    email: string,
    codigo: string,
    nuevaContrasena: string
  ): Promise<{ ok: boolean; mensaje: string }> {
    const correo = String(email || '').trim().toLowerCase();
    const code = String(codigo || '').trim();
    const pass = String(nuevaContrasena || '').trim();
    if (!correo || !code || !pass) {
      return { ok: false, mensaje: 'Correo, código y nueva contraseña son requeridos.' };
    }
    if (pass.length < 6) {
      return { ok: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres.' };
    }
    try {
      const resp = await fetch(API_RESET, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: correo, codigo: code, password: pass })
      });
      const data: any = await resp.json().catch(() => ({}));
      if (resp.ok && data?.ok) {
        this.bloqueoHasta = 0;
        return { ok: true, mensaje: data.mensaje || 'Contraseña restablecida correctamente.' };
      }
      return { ok: false, mensaje: data?.error || 'No se pudo restablecer la contraseña.' };
    } catch {
      return { ok: false, mensaje: 'No se pudo conectar con el servidor de autenticación.' };
    }
  }

  obtenerEstadoBloqueo(): { bloqueado: boolean; segundosRestantes: number; intentosRestantes: number } {
    const restantes = Math.max(0, Math.ceil((this.bloqueoHasta - Date.now()) / 1000));
    return { bloqueado: restantes > 0, segundosRestantes: restantes, intentosRestantes: 5 };
  }
}

export const coreSecurity = new CoreSecurity();

/** @deprecated Las credenciales ahora viven y se validan en el servidor. */
export const CREDENCIALES_SISTEMA: Credencial[] = [];
