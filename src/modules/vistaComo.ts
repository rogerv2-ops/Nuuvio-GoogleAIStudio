/**
 * Estado de "Entrar como comercio" para el administrador.
 *
 * Cuando hay un merchantId activo, el panel de comercio muestra ese local
 * aunque la sesion sea de admin. Es estado de vista (cliente): no cambia la
 * sesion ni los permisos del servidor, solo que panel se renderiza.
 */
class VistaComoModule {
  private merchantId: string | null = null;
  private listeners: Array<() => void> = [];

  /** El admin entra a ver el panel de un comercio especifico. */
  public entrar(id: string): void {
    this.merchantId = id;
    this.notificar();
  }

  /** Vuelve al panel de administracion. */
  public salir(): void {
    this.merchantId = null;
    this.notificar();
  }

  public obtener(): string | null {
    return this.merchantId;
  }

  public suscribir(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notificar(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const vistaComoModule = new VistaComoModule();
