import { SEED_AUDIENCE_USERS } from "../data/seedData.ts";

export interface AudienceUser {
  id: string;
  email: string;
  nombre: string;
  apellido?: string | null;
  telefono?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  ciudad?: string | null;
  emailVerificado?: boolean | null;
  verificationToken?: string | null;
  codigoRef?: string | null;
  puntosSaldo?: number | null;
  estado?: string | null;
  categoriasInteres?: any;
  consentimientos?: any;
  utm?: any;
  registradoEn?: string | null;
  createdAt?: Date | null;
}

class UsuariosModule {
  private usuarios: Map<string, AudienceUser> = new Map();
  private listeners: (() => void)[] = [];

  constructor() {
    // Inicializar con semillas iniciales
    SEED_AUDIENCE_USERS.forEach((u) => {
      this.usuarios.set(u.id, { ...(u as unknown as AudienceUser) });
    });

    if (typeof window !== "undefined") {
      this.cargarDeAPI();
    }
  }

  /**
   * Carga la audiencia de usuarios directamente desde PostgreSQL mediante repo.ts
   */
  async cargarDeDB(): Promise<AudienceUser[]> {
    if (typeof window === "undefined") {
      try {
        const { getAllAudienceUsers } = await import("../db/repo.ts");
        const dbUsers = await getAllAudienceUsers();
        if (dbUsers && dbUsers.length > 0) {
          this.usuarios.clear();
          dbUsers.forEach((u: any) => this.usuarios.set(u.id, u as AudienceUser));
          this.notificar();
          return dbUsers as AudienceUser[];
        }
      } catch (err) {
        console.warn("[UsuariosModule] Error cargando usuarios de PostgreSQL:", err);
      }
    } else {
      await this.cargarDeAPI();
    }
    return this.listarUsuarios();
  }

  /**
   * Carga usuarios desde el endpoint de la API en el frontend
   */
  async cargarDeAPI(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        const res = await fetch("/api/audience/users");
        if (res.ok) {
          const data = await res.json();
          const lista = data.users || data;
          if (Array.isArray(lista) && lista.length > 0) {
            this.cargarDeLista(lista);
          }
        }
      } catch (e) {
        console.warn("[UsuariosModule Client] Error al consultar /api/audience/users:", e);
      }
    }
  }

  /**
   * Carga una lista directa de usuarios
   */
  cargarDeLista(lista: AudienceUser[]): void {
    if (Array.isArray(lista) && lista.length > 0) {
      this.usuarios.clear();
      lista.forEach((u) => this.usuarios.set(u.id, u));
      this.notificar();
    }
  }

  /**
   * Guarda o actualiza un usuario directamente en PostgreSQL
   */
  async guardarUsuario(user: Partial<AudienceUser> & { id: string; email: string; nombre: string }): Promise<void> {
    const existing = this.usuarios.get(user.id) || ({} as AudienceUser);
    const updated: AudienceUser = {
      ...existing,
      ...user,
      registradoEn: user.registradoEn || existing.registradoEn || new Date().toISOString(),
    };
    this.usuarios.set(user.id, updated);
    this.notificar();

    if (typeof window === "undefined") {
      try {
        const { upsertAudienceUser } = await import("../db/repo.ts");
        await upsertAudienceUser(updated);
      } catch (err) {
        console.warn("[UsuariosModule Server] Error persistiendo usuario en PostgreSQL:", err);
      }
    } else {
      try {
        await fetch("/api/audience/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updated),
        });
      } catch (e) {
        console.warn("[UsuariosModule Client] Error al guardar usuario:", e);
      }
    }
  }

  /**
   * Elimina y purga un usuario directamente en PostgreSQL
   */
  async eliminarUsuario(id: string): Promise<boolean> {
    this.usuarios.delete(id);
    this.notificar();

    if (typeof window === "undefined") {
      try {
        const { deleteAndPurgeUser } = await import("../db/repo.ts");
        return await deleteAndPurgeUser(id);
      } catch (err) {
        console.warn("[UsuariosModule Server] Error eliminando usuario de PostgreSQL:", err);
        return false;
      }
    } else {
      try {
        const res = await fetch(`/api/audience/${id}`, { method: "DELETE" });
        return res.ok;
      } catch (e) {
        console.warn("[UsuariosModule Client] Error al eliminar usuario:", e);
        return false;
      }
    }
  }

  obtenerUsuario(id: string): AudienceUser | undefined {
    return this.usuarios.get(id);
  }

  async obtenerPorTelefono(telefono: string): Promise<AudienceUser | undefined> {
    const clean = telefono.replace(/\D/g, "");
    for (const u of this.usuarios.values()) {
      if (u.telefono && u.telefono.replace(/\D/g, "").endsWith(clean.slice(-9))) {
        return u;
      }
    }

    if (typeof window === "undefined") {
      try {
        const { findAudienceUserByPhone } = await import("../db/repo.ts");
        const found = await findAudienceUserByPhone(telefono);
        if (found) {
          this.usuarios.set(found.id, found as AudienceUser);
          return found as AudienceUser;
        }
      } catch (err) {
        console.warn("[UsuariosModule] Error buscando usuario por teléfono en DB:", err);
      }
    }
    return undefined;
  }

  obtenerPorEmail(email: string): AudienceUser | undefined {
    const cleanEmail = email.trim().toLowerCase();
    for (const u of this.usuarios.values()) {
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        return u;
      }
    }
    return undefined;
  }

  listarUsuarios(): AudienceUser[] {
    return Array.from(this.usuarios.values());
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
}

export const usuariosModule = new UsuariosModule();
