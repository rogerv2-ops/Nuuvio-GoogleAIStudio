/**
 * MODULO 4: core-security (esquema: sec)
 * Sistema de sesiones de usuario, roles y permisos para Panel de Administración y Panel Comercio.
 * Los usuarios finales de la web pública no requieren login.
 */
import { AuditLogItem } from '../types';

export type UserRole = 'admin' | 'operador' | 'comercio';

export interface AuthSession {
  token: string;
  usuarioId: string;
  nombre: string;
  email: string;
  rol: UserRole;
  merchantId?: string; // Scope aislado para comercios
  expiraEn: string;
}

export interface CredencialUsuario {
  email: string;
  contrasena: string;
  nombre: string;
  rol: UserRole;
  usuarioId: string;
  merchantId?: string;
  descripcion: string;
}

// Credenciales autorizadas del sistema (valores por defecto)
export const CREDENCIALES_SISTEMA: CredencialUsuario[] = [
  {
    email: 'rogerv2@gmail.com',
    contrasena: 'Pasion2271**//',
    nombre: 'Super Administrador',
    rol: 'admin',
    usuarioId: 'admin_master_01',
    descripcion: 'Acceso total al Panel de Administración, auditoría y moderación'
  },
  {
    email: 'rogerv707@gmail.com',
    contrasena: 'Pasion2271**//',
    nombre: 'Comercio Aliado',
    rol: 'comercio',
    usuarioId: 'comercio_user_01',
    merchantId: 'merch_01',
    descripcion: 'Acceso al Panel de Comercio, catálogo y recargas PPC'
  }
];

const STORAGE_KEY = 'vuuy_auth_session_v3';
const SECURITY_RATE_LIMIT_KEY = 'vuuy_sec_ratelimit_v1';
const SECURITY_CREDENTIALS_STORAGE_KEY = 'vuuy_sec_credentials_v1';

// Parámetros de seguridad estándar contra ataques de fuerza bruta
const MAX_INTENTOS_FALLIDOS = 5;
const TIEMPO_BLOQUEO_MS = 5 * 60 * 1000; // 5 minutos de bloqueo

interface RateLimitData {
  intentosFallidos: number;
  bloqueadoHasta: number | null;
  ultimoIntento: number;
}

class CoreSecurity {
  private auditLogs: AuditLogItem[] = [
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

  private listeners: (() => void)[] = [];
  private sesionActual: AuthSession | null = null;
  private credenciales: CredencialUsuario[] = [...CREDENCIALES_SISTEMA];
  private rateLimit: RateLimitData = {
    intentosFallidos: 0,
    bloqueadoHasta: null,
    ultimoIntento: 0
  };

  constructor() {
    this.cargarCredenciales();
    this.cargarSesionAlmacenada();
    this.cargarRateLimit();
  }

  private cargarCredenciales() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(SECURITY_CREDENTIALS_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.credenciales = parsed;
          }
        }
      }
    } catch {
      // Ignorar fallback
    }
  }

  private guardarCredenciales() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SECURITY_CREDENTIALS_STORAGE_KEY, JSON.stringify(this.credenciales));
      }
    } catch {
      // Ignorar fallback
    }
  }

  public listarCredenciales(): CredencialUsuario[] {
    return [...this.credenciales];
  }

  public actualizarContrasena(email: string, nuevaContrasena: string): { ok: boolean; mensaje: string } {
    const idx = this.credenciales.findIndex(c => c.email.toLowerCase() === email.toLowerCase());
    if (idx === -1) {
      return { ok: false, mensaje: 'Usuario no encontrado' };
    }
    if (!nuevaContrasena || nuevaContrasena.trim().length < 6) {
      return { ok: false, mensaje: 'La nueva contraseña debe tener al menos 6 caracteres' };
    }
    this.credenciales[idx] = {
      ...this.credenciales[idx],
      contrasena: nuevaContrasena.trim()
    };
    this.guardarCredenciales();
    this.registrarAuditoria({
      operadorId: this.sesionActual?.usuarioId || 'admin',
      operadorNombre: this.sesionActual?.nombre || 'Super Admin',
      accion: 'Cambio de contraseña',
      entidad: 'usuario_seguridad',
      entidadId: email,
      detalles: `Actualización de contraseña para el usuario ${email}`
    });
    this.notificar();
    return { ok: true, mensaje: 'Contraseña actualizada correctamente' };
  }

  public agregarCredencial(nueva: CredencialUsuario): { ok: boolean; mensaje: string } {
    const existe = this.credenciales.some(c => c.email.toLowerCase() === nueva.email.toLowerCase());
    if (existe) {
      return { ok: false, mensaje: 'Ya existe un usuario con este correo' };
    }
    this.credenciales.push(nueva);
    this.guardarCredenciales();
    this.registrarAuditoria({
      operadorId: this.sesionActual?.usuarioId || 'admin',
      operadorNombre: this.sesionActual?.nombre || 'Super Admin',
      accion: 'Alta de credencial de acceso',
      entidad: 'usuario_seguridad',
      entidadId: nueva.email,
      detalles: `Nuevo usuario creado: ${nueva.nombre} (${nueva.rol})`
    });
    this.notificar();
    return { ok: true, mensaje: 'Usuario registrado exitosamente' };
  }

  private cargarRateLimit() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = localStorage.getItem(SECURITY_RATE_LIMIT_KEY);
        if (data) {
          this.rateLimit = JSON.parse(data);
        }
      }
    } catch {
      // Ignorar fallback
    }
  }

  private guardarRateLimit() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SECURITY_RATE_LIMIT_KEY, JSON.stringify(this.rateLimit));
      }
    } catch {
      // Ignorar fallback
    }
  }

  public obtenerEstadoBloqueo(): { bloqueado: boolean; segundosRestantes: number; intentosRestantes: number } {
    const ahora = Date.now();
    if (this.rateLimit.bloqueadoHasta && this.rateLimit.bloqueadoHasta > ahora) {
      const segundosRestantes = Math.ceil((this.rateLimit.bloqueadoHasta - ahora) / 1000);
      return {
        bloqueado: true,
        segundosRestantes,
        intentosRestantes: 0
      };
    }

    // Si ya expiró el bloqueo, resetear
    if (this.rateLimit.bloqueadoHasta && this.rateLimit.bloqueadoHasta <= ahora) {
      this.rateLimit = {
        intentosFallidos: 0,
        bloqueadoHasta: null,
        ultimoIntento: ahora
      };
      this.guardarRateLimit();
    }

    const intentosRestantes = Math.max(0, MAX_INTENTOS_FALLIDOS - this.rateLimit.intentosFallidos);
    return {
      bloqueado: false,
      segundosRestantes: 0,
      intentosRestantes
    };
  }

  private registrarIntentoFallido(email: string) {
    const ahora = Date.now();
    this.rateLimit.intentosFallidos += 1;
    this.rateLimit.ultimoIntento = ahora;

    if (this.rateLimit.intentosFallidos >= MAX_INTENTOS_FALLIDOS) {
      this.rateLimit.bloqueadoHasta = ahora + TIEMPO_BLOQUEO_MS;
    }

    this.guardarRateLimit();

    this.registrarAuditoria({
      operadorId: 'sistema_seguridad',
      operadorNombre: 'Filtro Seguridad',
      accion: 'Intento de acceso fallido',
      entidad: 'autenticacion',
      entidadId: email.substring(0, 3) + '***',
      detalles: `Fallo de autenticación. Intentos acumulados: ${this.rateLimit.intentosFallidos}/${MAX_INTENTOS_FALLIDOS}`
    });
  }

  private resetearIntentosFallidos() {
    this.rateLimit = {
      intentosFallidos: 0,
      bloqueadoHasta: null,
      ultimoIntento: Date.now()
    };
    this.guardarRateLimit();
  }

  private cargarSesionAlmacenada() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const guardada = localStorage.getItem(STORAGE_KEY);
        if (guardada) {
          const parsed = JSON.parse(guardada) as AuthSession;
          // Verificar si no ha expirado
          if (new Date(parsed.expiraEn).getTime() > Date.now()) {
            this.sesionActual = parsed;
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    } catch {
      // Ignorar error al acceder a localStorage
    }
  }

  public iniciarSesion(email: string, contrasena: string): { ok: boolean; error?: string; sesion?: AuthSession; bloqueado?: boolean; segundosRestantes?: number } {
    // 1. Verificar bloqueo por fuerza bruta
    const estadoBloqueo = this.obtenerEstadoBloqueo();
    if (estadoBloqueo.bloqueado) {
      return {
        ok: false,
        error: `Acceso temporalmente restringido por motivos de seguridad tras múltiples intentos erróneos. Reintente en ${estadoBloqueo.segundosRestantes} segundos.`,
        bloqueado: true,
        segundosRestantes: estadoBloqueo.segundosRestantes
      };
    }

    const emailNormalizado = email.trim().toLowerCase();
    const contrasenaLimpia = contrasena.trim();

    if (!emailNormalizado || !contrasenaLimpia) {
      return {
        ok: false,
        error: 'Debe ingresar correo y contraseña.'
      };
    }

    const usuarioValido = this.credenciales.find(
      u => u.email.toLowerCase() === emailNormalizado && u.contrasena === contrasenaLimpia
    );

    if (!usuarioValido) {
      this.registrarIntentoFallido(emailNormalizado);
      const nuevoEstado = this.obtenerEstadoBloqueo();
      
      if (nuevoEstado.bloqueado) {
        return {
          ok: false,
          error: `Acceso restringido por seguridad. Ha alcanzado el límite de intentos permitidos (${MAX_INTENTOS_FALLIDOS}). Espere 5 minutos.`,
          bloqueado: true,
          segundosRestantes: nuevoEstado.segundosRestantes
        };
      }

      return {
        ok: false,
        error: `Credenciales de acceso incorrectas. Le restan ${nuevoEstado.intentosRestantes} intentos antes del bloqueo de seguridad.`
      };
    }

    // Login exitoso: restablecer contador de fallos
    this.resetearIntentosFallidos();

    const nuevaSesion: AuthSession = {
      token: `tok_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`,
      usuarioId: usuarioValido.usuarioId,
      nombre: usuarioValido.nombre,
      email: usuarioValido.email,
      rol: usuarioValido.rol,
      merchantId: usuarioValido.merchantId,
      expiraEn: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    this.sesionActual = nuevaSesion;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nuevaSesion));
      }
    } catch {
      // Ignorar fallback
    }

    this.registrarAuditoria({
      operadorId: usuarioValido.usuarioId,
      operadorNombre: usuarioValido.nombre,
      accion: 'Inicio de sesión',
      entidad: 'sesion',
      entidadId: usuarioValido.usuarioId,
      detalles: `Inicio de sesión exitoso con rol ${usuarioValido.rol} (${usuarioValido.email})`
    });

    this.notificar();
    return { ok: true, sesion: nuevaSesion };
  }

  public cerrarSesion(): void {
    if (this.sesionActual) {
      this.registrarAuditoria({
        operadorId: this.sesionActual.usuarioId,
        operadorNombre: this.sesionActual.nombre,
        accion: 'Cierre de sesión',
        entidad: 'sesion',
        entidadId: this.sesionActual.usuarioId,
        detalles: `Cierre de sesión seguro de ${this.sesionActual.email}`
      });
    }

    this.sesionActual = null;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignorar fallback
    }

    this.notificar();
  }

  public getSesionActual(): AuthSession | null {
    return this.sesionActual ? { ...this.sesionActual } : null;
  }

  public estaAutenticado(): boolean {
    return this.sesionActual !== null;
  }

  public tieneAcceso(superficie: 'gestion' | 'comercio' | 'web'): boolean {
    if (superficie === 'web') return true;
    if (!this.sesionActual) return false;
    if (superficie === 'gestion') {
      return this.sesionActual.rol === 'admin';
    }
    if (superficie === 'comercio') {
      return this.sesionActual.rol === 'comercio' || this.sesionActual.rol === 'admin';
    }
    return false;
  }

  public cambiarSesion(sesion: Partial<AuthSession> | null) {
    if (!sesion) {
      this.cerrarSesion();
      return;
    }
    if (this.sesionActual) {
      this.sesionActual = {
        ...this.sesionActual,
        ...sesion
      };
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(this.sesionActual));
        }
      } catch {
        // Ignorar
      }
      this.notificar();
    }
  }

  public registrarAuditoria(log: Omit<AuditLogItem, 'id' | 'fecha'>) {
    const item: AuditLogItem = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...log,
      fecha: new Date().toISOString()
    };
    this.auditLogs.unshift(item);
    this.notificar();
  }

  public getAuditLogs(): AuditLogItem[] {
    return [...this.auditLogs];
  }

  public tienePermiso(accion: 'aprobar_comercio' | 'moderar_oferta' | 'cambiar_flags' | 'editar_precios'): boolean {
    if (!this.sesionActual) return false;
    if (this.sesionActual.rol === 'admin') return true;
    if (this.sesionActual.rol === 'operador') {
      return accion === 'aprobar_comercio' || accion === 'moderar_oferta';
    }
    return false;
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

export const coreSecurity = new CoreSecurity();
