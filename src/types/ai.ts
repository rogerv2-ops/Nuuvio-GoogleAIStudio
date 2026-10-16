export type AiProviderId = 'gemini' | 'openai' | 'anthropic' | 'openrouter' | 'custom';

export interface AiModel {
  id: string;
  label: string;
  description: string;
}

export interface AiProvider {
  id: AiProviderId;
  nombre: string;
  baseUrl: string;
  apiKey: string;
  activado: boolean;
  modelos: AiModel[];
}

export interface AssistantConfig {
  asistenteId: 'ia-usuarios' | 'ia-gestion' | 'ia-comercios';
  nombre: string;
  descripcion: string;
  proveedorPrimarioId: AiProviderId;
  modeloPrimarioId: string;
  proveedorRespaldoId: AiProviderId;
  modeloRespaldoId: string;
}

export interface AiCallLog {
  id: string;
  fecha: string;
  asistenteId: string;
  asistenteNombre: string;
  proveedorId: AiProviderId;
  proveedorNombre: string;
  modeloId: string;
  tokens: number;
  latenciaMs: number;
  exito: boolean;
  errorMsg?: string;
  esRespaldo?: boolean;
}

export interface GenerarTextoParams {
  prompt: string;
  systemInstruction?: string;
  asistenteId?: 'ia-usuarios' | 'ia-gestion' | 'ia-comercios' | 'prueba';
  forceProviderId?: AiProviderId;
  forceModelId?: string;
}

export interface GenerarTextoResult {
  ok: boolean;
  texto: string;
  proveedorId: AiProviderId;
  proveedorNombre: string;
  modeloId: string;
  tokens: number;
  latenciaMs: number;
  error?: string;
  esRespaldo?: boolean;
}
