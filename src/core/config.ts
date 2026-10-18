/**
 * MODULO 2: core-config (esquema: cfg)
 * Un solo lugar para TODA la configuración técnica y de negocio que debe cambiarse sin tocar código.
 */
import { FeatureFlags } from '../types';

export interface SystemParameter {
  clave: string;
  valor: string | number | boolean;
  descripcion: string;
  actualizadoEn: string;
  actualizadoPor: string;
}

export interface ConfigHistoryEntry {
  id: string;
  clave: string;
  valorAnterior: string | number | boolean;
  valorNuevo: string | number | boolean;
  cambiadoPor: string;
  cambiadoEn: string;
}

class CoreConfig {
  private flags: FeatureFlags = {
    usuarios: true,
    comercios: true,
    ofertas: true,
    clicsAtribucion: true,
    puntosReferidos: true,
    campanasFacturacion: false, // Regla D12: Nace apagada por decisión administrativa
    digest: true,
    analitica: true,
    iaUsuarios: true,
    iaComercios: true,
    iaGestion: true,
    webPublica: true,
    panelComercio: true,
    panelGestion: true
  };

  private parametros: Map<string, SystemParameter> = new Map([
    ['modelo_ia', {
      clave: 'modelo_ia',
      valor: 'gemini-2.5-flash',
      descripcion: 'Modelo de IA activo (Gemini primero)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['conector_whatsapp', {
      clave: 'conector_whatsapp',
      valor: 'WAHA (Pruebas / Local)',
      descripcion: 'Conector de mensajería (WAHA para pruebas, Meta Cloud API para producción)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['radio_cercania_km', {
      clave: 'radio_cercania_km',
      valor: 5,
      descripcion: 'Radio de búsqueda de ofertas cercanas por defecto en kilómetros (D6)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['max_solicitudes_dia_usuario', {
      clave: 'max_solicitudes_dia_usuario',
      valor: 10,
      descripcion: 'Límite de solicitudes de ofertas por usuario por día',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['duracion_maxima_oferta_dias', {
      clave: 'duracion_maxima_oferta_dias',
      valor: 30,
      descripcion: 'Duración máxima de una oferta activa (Canónico: 30 días)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['puntos_por_referido_registro', {
      clave: 'puntos_por_referido_registro',
      valor: 50,
      descripcion: 'Puntos otorgados cuando un referido se registra (D7)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['hora_digest_lima', {
      clave: 'hora_digest_lima',
      valor: '09:00',
      descripcion: 'Hora de envío del resumen diario por correo en hora de Lima (D10)',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['precio_pack_50', {
      clave: 'precio_pack_50',
      valor: 70,
      descripcion: 'Precio en S/. del pack de 50 clics',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['precio_pack_100', {
      clave: 'precio_pack_100',
      valor: 120,
      descripcion: 'Precio en S/. del pack de 100 clics',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }],
    ['precio_pack_500', {
      clave: 'precio_pack_500',
      valor: 500,
      descripcion: 'Precio en S/. del pack de 500 clics',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: 'Sistema'
    }]
  ]);

  private historial: ConfigHistoryEntry[] = [];
  private listeners: (() => void)[] = [];

  public obtenerParametro(clave: string): SystemParameter | undefined {
    return this.parametros.get(clave);
  }

  public obtenerValor<T = string | number | boolean>(clave: string, defecto: T): T {
    const param = this.parametros.get(clave);
    return param ? (param.valor as unknown as T) : defecto;
  }

  public listarParametros(): SystemParameter[] {
    return Array.from(this.parametros.values());
  }

  public cambiarParametro(clave: string, nuevoValor: string | number | boolean, cambiadoPor: string = 'Super Admin') {
    const actual = this.parametros.get(clave);
    const valorAnterior = actual ? actual.valor : '';

    this.parametros.set(clave, {
      clave,
      valor: nuevoValor,
      descripcion: actual ? actual.descripcion : '',
      actualizadoEn: new Date().toISOString(),
      actualizadoPor: cambiadoPor
    });

    this.historial.unshift({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clave,
      valorAnterior,
      valorNuevo: nuevoValor,
      cambiadoPor,
      cambiadoEn: new Date().toISOString()
    });

    this.notificar();
  }

  public getFlags(): FeatureFlags {
    return { ...this.flags };
  }

  public moduloActivo(nombre: keyof FeatureFlags): boolean {
    return !!this.flags[nombre];
  }

  public alternarModulo(nombre: keyof FeatureFlags, cambiadoPor: string = 'Super Admin') {
    const valorAnterior = this.flags[nombre];
    const valorNuevo = !valorAnterior;
    this.flags[nombre] = valorNuevo;

    this.historial.unshift({
      id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clave: `flag_${nombre}`,
      valorAnterior,
      valorNuevo,
      cambiadoPor,
      cambiadoEn: new Date().toISOString()
    });

    this.notificar();
  }

  public getHistorial(): ConfigHistoryEntry[] {
    return [...this.historial];
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

export const coreConfig = new CoreConfig();
