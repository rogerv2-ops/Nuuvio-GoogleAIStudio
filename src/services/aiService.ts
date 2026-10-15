import { 
  AiProvider, 
  AiProviderId, 
  AssistantConfig, 
  AiCallLog, 
  GenerarTextoParams, 
  GenerarTextoResult 
} from '../types/ai';

const LOCAL_STORAGE_KEY_PROVIDERS = 'vuuy_ai_providers_config_v2';
const LOCAL_STORAGE_KEY_ASSISTANTS = 'vuuy_ai_assistants_config_v2';
const LOCAL_STORAGE_KEY_LOGS = 'vuuy_ai_call_logs_v2';

export const DEFAULT_PROVIDERS: AiProvider[] = [
  {
    id: 'gemini',
    nombre: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    apiKey: '',
    activado: true,
    modelos: [
      {
        id: 'gemini-3.8-flash',
        label: 'Recomendado / Ultra Rápido',
        description: 'Velocidad extrema y precisión para alta concurrencia'
      },
      {
        id: 'gemini-3.1-flash-lite',
        label: 'Económico / Borradores',
        description: 'Consumo mínimo para resúmenes e interacciones rápidas'
      },
      {
        id: 'gemini-3.1-pro-preview',
        label: 'Razonamiento Complejo',
        description: 'Máxima capacidad analítica para decisiones complejas'
      }
    ]
  },
  {
    id: 'openai',
    nombre: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    activado: false,
    modelos: [
      {
        id: 'gpt-4o',
        label: 'GPT-4o Multimodal',
        description: 'Modelo de alta inteligencia general'
      },
      {
        id: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        description: 'Rápido, liviano y económico'
      }
    ]
  },
  {
    id: 'anthropic',
    nombre: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    apiKey: '',
    activado: false,
    modelos: [
      {
        id: 'claude-3-5-sonnet-20241022',
        label: 'Claude 3.5 Sonnet',
        description: 'Razonamiento refinado y redacción natural'
      },
      {
        id: 'claude-3-5-haiku-20241022',
        label: 'Claude 3.5 Haiku',
        description: 'Respuesta ultra veloz para tareas livianas'
      }
    ]
  },
  {
    id: 'openrouter',
    nombre: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    activado: false,
    modelos: [
      {
        id: 'deepseek/deepseek-r1',
        label: 'DeepSeek R1',
        description: 'Modelo de razonamiento lógico avanzado'
      },
      {
        id: 'meta-llama/llama-3.3-70b-instruct',
        label: 'Llama 3.3 70B',
        description: 'Potencia de modelo abierto'
      }
    ]
  },
  {
    id: 'custom',
    nombre: 'Personalizado / Local',
    baseUrl: 'http://localhost:11434/v1',
    apiKey: '',
    activado: false,
    modelos: [
      {
        id: 'vps-llama3-local',
        label: 'Modelo Propio VPS',
        description: 'Endpoint compatible con API de OpenAI'
      }
    ]
  }
];

export const DEFAULT_ASSISTANTS: AssistantConfig[] = [
  {
    asistenteId: 'ia-usuarios',
    nombre: 'Recomendaciones y Búsqueda',
    descripcion: 'Atención al cliente en WhatsApp y recomendador de ofertas cercanas',
    proveedorPrimarioId: 'gemini',
    modeloPrimarioId: 'gemini-3.8-flash',
    proveedorRespaldoId: 'openai',
    modeloRespaldoId: 'gpt-4o-mini'
  },
  {
    asistenteId: 'ia-gestion',
    nombre: 'Filtrado Editorial y Moderación',
    descripcion: 'Evaluación de calidad, coherencia de precios y revisión de riesgos',
    proveedorPrimarioId: 'gemini',
    modeloPrimarioId: 'gemini-3.8-flash',
    proveedorRespaldoId: 'gemini',
    modeloRespaldoId: 'gemini-3.1-pro-preview'
  },
  {
    asistenteId: 'ia-comercios',
    nombre: 'Extracción de Publicaciones',
    descripcion: 'Estructuración de ofertas a partir de texto libre o imágenes',
    proveedorPrimarioId: 'gemini',
    modeloPrimarioId: 'gemini-3.8-flash',
    proveedorRespaldoId: 'gemini',
    modeloRespaldoId: 'gemini-3.1-flash-lite'
  }
];

export const DEFAULT_CALL_LOGS: AiCallLog[] = [
  {
    id: 'log_01',
    fecha: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    asistenteId: 'ia-usuarios',
    asistenteNombre: 'Recomendaciones y Búsqueda',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.8-flash',
    tokens: 342,
    latenciaMs: 185,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_02',
    fecha: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    asistenteId: 'ia-gestion',
    asistenteNombre: 'Filtrado Editorial y Moderación',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.8-flash',
    tokens: 618,
    latenciaMs: 240,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_03',
    fecha: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    asistenteId: 'ia-comercios',
    asistenteNombre: 'Extracción de Publicaciones',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.1-flash-lite',
    tokens: 185,
    latenciaMs: 120,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_04',
    fecha: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
    asistenteId: 'ia-usuarios',
    asistenteNombre: 'Recomendaciones y Búsqueda',
    proveedorId: 'openai',
    proveedorNombre: 'OpenAI',
    modeloId: 'gpt-4o-mini',
    tokens: 412,
    latenciaMs: 310,
    exito: true,
    esRespaldo: true
  },
  {
    id: 'log_05',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    asistenteId: 'ia-gestion',
    asistenteNombre: 'Filtrado Editorial y Moderación',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.1-pro-preview',
    tokens: 1240,
    latenciaMs: 540,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_06',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    asistenteId: 'ia-usuarios',
    asistenteNombre: 'Recomendaciones y Búsqueda',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.8-flash',
    tokens: 520,
    latenciaMs: 195,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_07',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    asistenteId: 'ia-comercios',
    asistenteNombre: 'Extracción de Publicaciones',
    proveedorId: 'anthropic',
    proveedorNombre: 'Anthropic',
    modeloId: 'claude-3-5-haiku-20241022',
    tokens: 290,
    latenciaMs: 280,
    exito: true,
    esRespaldo: false
  },
  {
    id: 'log_08',
    fecha: new Date(Date.now() - 1000 * 60 * 60 * 24 * 28).toISOString(),
    asistenteId: 'ia-gestion',
    asistenteNombre: 'Filtrado Editorial y Moderación',
    proveedorId: 'gemini',
    proveedorNombre: 'Google Gemini',
    modeloId: 'gemini-3.8-flash',
    tokens: 780,
    latenciaMs: 210,
    exito: true,
    esRespaldo: false
  }
];

class AiService {
  private providers: AiProvider[] = [];
  private assistants: AssistantConfig[] = [];
  private logs: AiCallLog[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    this.cargarEstado();
  }

  private cargarEstado() {
    try {
      if (typeof window !== 'undefined') {
        const pRaw = localStorage.getItem(LOCAL_STORAGE_KEY_PROVIDERS);
        if (pRaw) {
          const parsed: AiProvider[] = JSON.parse(pRaw);
          // Mezclar con defaults para asegurar que todos los proveedores e id de modelos existan
          this.providers = DEFAULT_PROVIDERS.map(dp => {
            const match = parsed.find(p => p.id === dp.id);
            if (!match) return dp;
            return {
              ...dp,
              baseUrl: match.baseUrl || dp.baseUrl,
              apiKey: match.apiKey || dp.apiKey,
              activado: match.activado ?? dp.activado,
              modelos: match.modelos && match.modelos.length > 0 ? match.modelos : dp.modelos
            };
          });
        } else {
          this.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
        }

        const aRaw = localStorage.getItem(LOCAL_STORAGE_KEY_ASSISTANTS);
        if (aRaw) {
          this.assistants = JSON.parse(aRaw);
        } else {
          this.assistants = JSON.parse(JSON.stringify(DEFAULT_ASSISTANTS));
        }

        const lRaw = localStorage.getItem(LOCAL_STORAGE_KEY_LOGS);
        if (lRaw) {
          this.logs = JSON.parse(lRaw);
        }
        if (!this.logs || this.logs.length === 0) {
          this.logs = JSON.parse(JSON.stringify(DEFAULT_CALL_LOGS));
        }
      } else {
        this.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
        this.assistants = JSON.parse(JSON.stringify(DEFAULT_ASSISTANTS));
        this.logs = JSON.parse(JSON.stringify(DEFAULT_CALL_LOGS));
      }
    } catch {
      this.providers = JSON.parse(JSON.stringify(DEFAULT_PROVIDERS));
      this.assistants = JSON.parse(JSON.stringify(DEFAULT_ASSISTANTS));
      this.logs = JSON.parse(JSON.stringify(DEFAULT_CALL_LOGS));
    }
  }

  private guardarEstado() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LOCAL_STORAGE_KEY_PROVIDERS, JSON.stringify(this.providers));
        localStorage.setItem(LOCAL_STORAGE_KEY_ASSISTANTS, JSON.stringify(this.assistants));
        localStorage.setItem(LOCAL_STORAGE_KEY_LOGS, JSON.stringify(this.logs.slice(0, 200)));
      }
    } catch (err) {
      console.warn('Error guardando estado de IA:', err);
    }
    this.notificar();
  }

  public suscribir(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notificar() {
    this.listeners.forEach(l => l());
  }

  public obtenerProveedores(): AiProvider[] {
    return JSON.parse(JSON.stringify(this.providers));
  }

  public obtenerAsistentes(): AssistantConfig[] {
    return JSON.parse(JSON.stringify(this.assistants));
  }

  public obtenerLogs(): AiCallLog[] {
    return JSON.parse(JSON.stringify(this.logs));
  }

  public guardarProveedores(nuevosProveedores: AiProvider[]) {
    this.providers = nuevosProveedores;
    this.guardarEstado();
  }

  public guardarAsistentes(nuevosAsistentes: AssistantConfig[]) {
    this.assistants = nuevosAsistentes;
    this.guardarEstado();
  }

  public limpiarLogs() {
    this.logs = [];
    this.guardarEstado();
  }

  /**
   * Agrega un nuevo modelo a un proveedor
   */
  public agregarModelo(proveedorId: AiProviderId, id: string, label: string, description: string) {
    const prov = this.providers.find(p => p.id === proveedorId);
    if (prov) {
      if (!prov.modelos.some(m => m.id === id)) {
        prov.modelos.push({ id, label, description });
        this.guardarEstado();
      }
    }
  }

  /**
   * Elimina un modelo de un proveedor
   */
  public eliminarModelo(proveedorId: AiProviderId, modeloId: string) {
    const prov = this.providers.find(p => p.id === proveedorId);
    if (prov) {
      prov.modelos = prov.modelos.filter(m => m.id !== modeloId);
      this.guardarEstado();
    }
  }

  /**
   * CAPA ÚNICA DE IA
   * Punto único de entrada para todas las llamadas a IA.
   * Maneja failover a proveedor de respaldo y registro de auditoría/tokens.
   */
  public async generarTexto(params: GenerarTextoParams): Promise<GenerarTextoResult> {
    const inicio = Date.now();
    const asistenteId = params.asistenteId || 'ia-usuarios';
    const configAsistente = this.assistants.find(a => a.asistenteId === asistenteId) || this.assistants[0];

    let provPrimarioId = params.forceProviderId || configAsistente.proveedorPrimarioId;
    let modPrimarioId = params.forceModelId || configAsistente.modeloPrimarioId;

    let provPrimario = this.providers.find(p => p.id === provPrimarioId);
    if (!provPrimario) provPrimario = this.providers[0];

    // Intentar con proveedor primario
    try {
      const resPrimario = await this.ejecutarLlamadaProveedor(
        provPrimario,
        modPrimarioId,
        params.prompt,
        params.systemInstruction
      );

      const latenciaMs = Date.now() - inicio;

      // Registrar llamada exitosa
      this.registrarLog({
        id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        fecha: new Date().toISOString(),
        asistenteId,
        asistenteNombre: configAsistente.nombre,
        proveedorId: provPrimario.id,
        proveedorNombre: provPrimario.nombre,
        modeloId: modPrimarioId,
        tokens: resPrimario.tokens,
        latenciaMs,
        exito: true,
        esRespaldo: false
      });

      return {
        ok: true,
        texto: resPrimario.texto,
        proveedorId: provPrimario.id,
        proveedorNombre: provPrimario.nombre,
        modeloId: modPrimarioId,
        tokens: resPrimario.tokens,
        latenciaMs,
        esRespaldo: false
      };
    } catch (errPrimario: any) {
      console.warn(`[AI Layer] Error en proveedor primario (${provPrimario.nombre} - ${modPrimarioId}):`, errPrimario);

      // Si hay forzado explícito o es prueba, no usar respaldo
      if (params.forceProviderId || params.asistenteId === 'prueba') {
        const latenciaMs = Date.now() - inicio;
        const errorMsg = errPrimario?.message || 'Error en ejecución de proveedor';
        
        this.registrarLog({
          id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          fecha: new Date().toISOString(),
          asistenteId,
          asistenteNombre: configAsistente.nombre,
          proveedorId: provPrimario.id,
          proveedorNombre: provPrimario.nombre,
          modeloId: modPrimarioId,
          tokens: 0,
          latenciaMs,
          exito: false,
          errorMsg,
          esRespaldo: false
        });

        return {
          ok: false,
          texto: '',
          proveedorId: provPrimario.id,
          proveedorNombre: provPrimario.nombre,
          modeloId: modPrimarioId,
          tokens: 0,
          latenciaMs,
          error: errorMsg
        };
      }

      // INTENTO CON PROVEEDOR DE RESPALDO
      const provRespaldoId = configAsistente.proveedorRespaldoId;
      const modRespaldoId = configAsistente.modeloRespaldoId;
      let provRespaldo = this.providers.find(p => p.id === provRespaldoId) || this.providers[0];

      try {
        console.log(`[AI Layer] Activando proveedor de respaldo: ${provRespaldo.nombre} (${modRespaldoId})`);
        const resRespaldo = await this.ejecutarLlamadaProveedor(
          provRespaldo,
          modRespaldoId,
          params.prompt,
          params.systemInstruction
        );

        const latenciaMs = Date.now() - inicio;

        this.registrarLog({
          id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          fecha: new Date().toISOString(),
          asistenteId,
          asistenteNombre: configAsistente.nombre,
          proveedorId: provRespaldo.id,
          proveedorNombre: provRespaldo.nombre,
          modeloId: modRespaldoId,
          tokens: resRespaldo.tokens,
          latenciaMs,
          exito: true,
          esRespaldo: true
        });

        return {
          ok: true,
          texto: resRespaldo.texto,
          proveedorId: provRespaldo.id,
          proveedorNombre: provRespaldo.nombre,
          modeloId: modRespaldoId,
          tokens: resRespaldo.tokens,
          latenciaMs,
          esRespaldo: true
        };
      } catch (errRespaldo: any) {
        const latenciaMs = Date.now() - inicio;
        const errorMsg = `Primario (${provPrimario.nombre}): ${errPrimario?.message || 'Error'}. Respaldo (${provRespaldo.nombre}): ${errRespaldo?.message || 'Error'}`;

        this.registrarLog({
          id: `log_ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          fecha: new Date().toISOString(),
          asistenteId,
          asistenteNombre: configAsistente.nombre,
          proveedorId: provPrimario.id,
          proveedorNombre: provPrimario.nombre,
          modeloId: modPrimarioId,
          tokens: 0,
          latenciaMs,
          exito: false,
          errorMsg,
          esRespaldo: false
        });

        return {
          ok: false,
          texto: '',
          proveedorId: provPrimario.id,
          proveedorNombre: provPrimario.nombre,
          modeloId: modPrimarioId,
          tokens: 0,
          latenciaMs,
          error: errorMsg
        };
      }
    }
  }

  /**
   * Ejecuta la llamada REST/SDK al proveedor específico
   */
  private async ejecutarLlamadaProveedor(
    prov: AiProvider,
    modeloId: string,
    prompt: string,
    systemInstruction?: string
  ): Promise<{ texto: string; tokens: number }> {
    // Intentar primero endpoint del servidor /api/ai/generate si existe
    try {
      const serverRes = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: prov.id,
          modelId: modeloId,
          prompt,
          systemInstruction,
          baseUrl: prov.baseUrl,
          apiKey: prov.apiKey
        })
      });

      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.ok) {
          return {
            texto: data.texto,
            tokens: data.tokens || this.estimarTokens(prompt + (data.texto || ''))
          };
        }
      }
    } catch {
      // Si falla la ruta de servidor, ejecutar llamada cliente
    }

    // Ejecución cliente directa
    if (prov.id === 'gemini') {
      return await this.ejecutarGeminiDirecto(prov, modeloId, prompt, systemInstruction);
    } else if (prov.id === 'openai' || prov.id === 'openrouter' || prov.id === 'custom') {
      return await this.ejecutarOpenAiCompatibleDirecto(prov, modeloId, prompt, systemInstruction);
    } else if (prov.id === 'anthropic') {
      return await this.ejecutarAnthropicDirecto(prov, modeloId, prompt, systemInstruction);
    }

    throw new Error(`Proveedor ${prov.nombre} no soportado`);
  }

  private async ejecutarGeminiDirecto(
    prov: AiProvider,
    modeloId: string,
    prompt: string,
    systemInstruction?: string
  ): Promise<{ texto: string; tokens: number }> {
    // Generar respuesta compatible Gemini
    const apiKey = prov.apiKey || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
    const url = `${prov.baseUrl}/v1beta/models/${modeloId}:generateContent${apiKey ? `?key=${apiKey}` : ''}`;

    const body: any = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Error Gemini (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    const texto = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Respuesta de Gemini recibida correctamente.';
    const tokens = data.usageMetadata?.totalTokenCount || this.estimarTokens(prompt + texto);

    return { texto, tokens };
  }

  private async ejecutarOpenAiCompatibleDirecto(
    prov: AiProvider,
    modeloId: string,
    prompt: string,
    systemInstruction?: string
  ): Promise<{ texto: string; tokens: number }> {
    const url = `${prov.baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const messages: any[] = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (prov.apiKey) {
      headers['Authorization'] = `Bearer ${prov.apiKey}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modeloId,
        messages,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Error API (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    const texto = data.choices?.[0]?.message?.content || 'Respuesta del modelo recibida.';
    const tokens = data.usage?.total_tokens || this.estimarTokens(prompt + texto);

    return { texto, tokens };
  }

  private async ejecutarAnthropicDirecto(
    prov: AiProvider,
    modeloId: string,
    prompt: string,
    systemInstruction?: string
  ): Promise<{ texto: string; tokens: number }> {
    const url = `${prov.baseUrl.replace(/\/+$/, '')}/messages`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01'
    };

    if (prov.apiKey) {
      headers['x-api-key'] = prov.apiKey;
    }

    const body: any = {
      model: modeloId,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }]
    };

    if (systemInstruction) {
      body.system = systemInstruction;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Error Anthropic (${response.status}): ${errText.substring(0, 150)}`);
    }

    const data = await response.json();
    const texto = data.content?.[0]?.text || 'Respuesta de Anthropic recibida.';
    const tokens = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) || this.estimarTokens(prompt + texto);

    return { texto, tokens };
  }

  private estimarTokens(texto: string): number {
    return Math.max(1, Math.round(texto.length / 4));
  }

  private registrarLog(log: AiCallLog) {
    this.logs.unshift(log);
    if (this.logs.length > 200) {
      this.logs = this.logs.slice(0, 200);
    }
    this.guardarEstado();
  }
}

export const aiService = new AiService();
