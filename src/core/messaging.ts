/**
 * MODULO 1: core-messaging (esquema: msg)
 * Puerta única entre Yuddit y WhatsApp.
 * Recibe webhooks, normaliza, identifica actor, respeta ventana de 24h y despacha comandos.
 */
import { ChatMessage, Offer } from '../types';
import { usuariosModule } from '../modules/usuarios';
import { comerciosModule } from '../modules/comercios';
import { ofertasModule } from '../modules/ofertas';
import { puntosModule } from '../modules/puntos';
import { clicsAtribucionModule } from '../modules/clics';
import { iaUsuariosAgent, iaComerciosAgent } from '../agents';
import { coreEvents } from './events';

export interface MessageInput {
  telefono: string;
  texto: string;
  imagenUrl?: string;
  tipoRemitente: 'usuario' | 'comercio';
}

class CoreMessaging {
  private mensajesUsuario: ChatMessage[] = [
    {
      id: 'msg_u_01',
      remitente: 'bot',
      texto: '¡Hola Carlos! Bienvenido a Yuddit. Escribe *Oferta* para ver las mejores promociones cerca de ti en Miraflores.',
      tipo: 'texto',
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
    }
  ];

  private mensajesComercio: ChatMessage[] = [
    {
      id: 'msg_c_01',
      remitente: 'bot',
      texto: '¡Hola! Este es el canal oficial de Yuddit Comercios. Escribe *quiero publicar* para crear una nueva oferta para tu negocio.',
      tipo: 'texto',
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ];

  private estadoFlujoPublicacion: Map<string, {
    paso: 'fotos' | 'descripcion' | 'precios' | 'tipo' | 'confirmar';
    datos: {
      titulo?: string;
      descripcion?: string;
      precioNormal?: number;
      precioOferta?: number;
      imagenes?: string[];
      tipo?: string;
      categoria?: string;
    };
  }> = new Map();

  private listeners: (() => void)[] = [];

  public getHistorial(tipo: 'usuario' | 'comercio'): ChatMessage[] {
    return tipo === 'usuario' ? [...this.mensajesUsuario] : [...this.mensajesComercio];
  }

  /**
   * Procesamiento de mensaje entrante de WhatsApp
   */
  public procesarMensaje(input: MessageInput): ChatMessage[] {
    const texto = input.texto.trim();
    const ahora = new Date().toISOString();

    const historial = input.tipoRemitente === 'usuario' ? this.mensajesUsuario : this.mensajesComercio;

    // Agregar mensaje entrante al historial
    const msgEntrante: ChatMessage = {
      id: `msg_in_${Date.now()}`,
      remitente: input.tipoRemitente,
      texto,
      tipo: input.imagenUrl ? 'imagen' : 'texto',
      timestamp: ahora
    };
    historial.push(msgEntrante);

    coreEvents.emitir({
      tipoEvento: 'mensaje_recibido',
      actorTipo: input.tipoRemitente,
      actorId: input.telefono,
      origen: 'whatsapp',
      datos: { texto, tipoRemitente: input.tipoRemitente }
    });

    const respuestas: ChatMessage[] = [];

    if (input.tipoRemitente === 'usuario') {
      respuestas.push(...this.enrutarMensajeUsuario(input.telefono, texto));
    } else {
      respuestas.push(...this.enrutarMensajeComercio(input.telefono, texto, input.imagenUrl));
    }

    respuestas.forEach(r => historial.push(r));
    this.notificar();
    return respuestas;
  }

  /**
   * Enrutador de comandos de Audiencia (F-AUD-02, F-AUD-03, etc.)
   */
  private enrutarMensajeUsuario(telefono: string, texto: string): ChatMessage[] {
    const usuario = usuariosModule.obtenerPorTelefono(telefono);
    const ahora = new Date().toISOString();

    // 1. Si no está registrado: invitar a registro obligatorio
    if (!usuario) {
      // Verificar si está enviando un código de vinculación de 6 dígitos
      const codigoMatch = texto.match(/\b\d{6}\b/);
      if (codigoMatch) {
        const vinculado = usuariosModule.vincularPorCodigo(codigoMatch[0], telefono);
        if (vinculado) {
          return [{
            id: `msg_bot_${Date.now()}`,
            remitente: 'bot',
            texto: `🎉 ¡Excelente, ${vinculado.nombre}! Tu número de WhatsApp quedó vinculado con tu cuenta de Yuddit.\n\nYa puedes escribir *Oferta* para recibir oportunidades cerca de ti en ${vinculado.distrito}.`,
            tipo: 'texto',
            timestamp: ahora
          }];
        }
      }

      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `👋 ¡Hola! Para pedir ofertas y promociones cercanas en Lima primero debes registrarte gratis.\n\nRegístrate aquí: ${window.location.origin}/registro\n\nSi ya te registraste en la web, envíame tu código de verificación de 6 dígitos.`,
        tipo: 'texto',
        timestamp: ahora,
        botones: [
          { texto: 'Ir al Registro Web', accion: 'abrir_registro' }
        ]
      }];
    }

    // 2. Interpretar comando mediante ia-usuarios o reglas directas
    const analisis = iaUsuariosAgent.interpretarMensaje(texto, usuario.distrito);

    // COMANDO: "Oferta" (F-AUD-02)
    if (analisis.intencion === 'oferta') {
      const permiso = usuariosModule.registrarSolicitudOferta(usuario.id);
      if (!permiso.permitido) {
        return [{
          id: `msg_bot_${Date.now()}`,
          remitente: 'bot',
          texto: `Has alcanzado el límite diario de 10 solicitudes de ofertas por hoy. ¡Mañana podrás consultar más novedades en ${usuario.distrito}!`,
          tipo: 'texto',
          timestamp: ahora
        }];
      }

      const resultado = ofertasModule.buscarOfertasCercanas({
        usuarioId: usuario.id,
        distrito: usuario.distrito,
        categorias: analisis.categoriaSugerida ? [analisis.categoriaSugerida] : usuario.categoriasInteres,
        limite: 5
      });

      if (resultado.ofertas.length === 0) {
        return [{
          id: `msg_bot_${Date.now()}`,
          remitente: 'bot',
          texto: `Por el momento no hay nuevas ofertas activas en tus categorías cerca de ${usuario.distrito}. ¡Te avisaremos en el resumen diario!`,
          tipo: 'texto',
          timestamp: ahora
        }];
      }

      return [
        {
          id: `msg_bot_intro_${Date.now()}`,
          remitente: 'bot',
          texto: `✨ Encontré estas ${resultado.ofertas.length} oportunidades activas cerca de ${usuario.distrito}:`,
          tipo: 'texto',
          timestamp: ahora
        },
        {
          id: `msg_bot_cards_${Date.now()}`,
          remitente: 'bot',
          texto: 'Tarjetas de ofertas:',
          tipo: 'tarjetas_oferta',
          ofertasData: resultado.ofertas,
          timestamp: ahora
        }
      ];
    }

    // COMANDO: "puntos" (F-AUD-03)
    if (analisis.intencion === 'puntos') {
      const saldo = puntosModule.obtenerSaldo(usuario.id);
      const recompensas = puntosModule.listarRecompensas(usuario.distrito);

      let textoRecompensas = '';
      if (recompensas.length > 0) {
        textoRecompensas = '\n\n🎁 *Recompensas disponibles para canjear en tu zona:*\n' +
          recompensas.map(r => `• *${r.titulo}* (${r.comercioNombre}) — ${r.puntosRequeridos} pts`).join('\n');
      }

      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `💰 Tu saldo acumulado en Yuddit es de *${saldo} puntos*.\n\nRecuerda: ganas 10 pts cada vez que compartes una oferta y 50 pts cuando un amigo invitado se registra.${textoRecompensas}\n\nEscribe *canjear* para obtener un premio con tu saldo.`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    // COMANDO: "canjear" (F-AUD-07)
    if (analisis.intencion === 'canjear') {
      const saldo = puntosModule.obtenerSaldo(usuario.id);
      const recompensas = puntosModule.listarRecompensas(usuario.distrito);

      if (recompensas.length === 0) {
        return [{
          id: `msg_bot_${Date.now()}`,
          remitente: 'bot',
          texto: `Actualmente no hay recompensas con stock en ${usuario.distrito}. Tienes ${saldo} puntos guardados para cuando ingresen nuevos premios.`,
          tipo: 'texto',
          timestamp: ahora
        }];
      }

      // Preparar botones de canje
      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `🎯 *Catálogo de Canje en ${usuario.distrito}*\nTienes ${saldo} puntos disponibles. Toca una recompensa para generar tu código único de 8 caracteres:`,
        tipo: 'botones',
        botones: recompensas.map(r => ({
          texto: `${r.titulo} (${r.puntosRequeridos} pts)`,
          accion: 'ejecutar_canje',
          datos: { rewardId: r.id }
        })),
        timestamp: ahora
      }];
    }

    // COMANDO: "baja" o "stop" (F-TRA-01)
    if (analisis.intencion === 'baja') {
      usuariosModule.darDeBaja(usuario.id, 'todo');
      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: 'Has sido dado de baja de Yuddit. No recibirás más mensajes ni resúmenes. Si deseas volver en el futuro, solo vuelve a escribirnos.',
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    // Respuesta de ayuda o general
    return [{
      id: `msg_bot_${Date.now()}`,
      remitente: 'bot',
      texto: analisis.respuestaTexto || `Hola ${usuario.nombre}. Escribe *Oferta* para ver descuentos en ${usuario.distrito}, o *puntos* para revisar tu saldo.`,
      tipo: 'texto',
      timestamp: ahora
    }];
  }

  /**
   * Enrutador de comandos de Comercio (F-COM-02: publicación guiada)
   */
  private enrutarMensajeComercio(telefono: string, texto: string, imagenUrl?: string): ChatMessage[] {
    const comercio = comerciosModule.obtenerPorTelefono(telefono);
    const ahora = new Date().toISOString();

    if (!comercio) {
      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `👋 Hola. Este número no está registrado como comercio aprobado en Yuddit.\n\nPara registrar tu negocio con RUC de 11 dígitos y publicar tus ofertas, visita: ${window.location.origin}/comercio/registro`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    if (comercio.estado !== 'activo') {
      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `Estimado ${comercio.nombreComercial}, tu registro con RUC ${comercio.ruc} se encuentra en estado *${comercio.estado.toUpperCase()}*.\n\nEl equipo de administración revisa cada comercio antes de habilitar publicaciones. Te avisaremos por correo apenas seas aprobado.`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    const estadoPub = this.estadoFlujoPublicacion.get(comercio.id);
    const tLower = texto.toLowerCase();

    // Iniciar flujo guiado
    if (tLower.includes('publicar') || tLower.includes('oferta') || !estadoPub) {
      this.estadoFlujoPublicacion.set(comercio.id, {
        paso: 'fotos',
        datos: {}
      });

      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `¡Hola ${comercio.nombreComercial}! Vamos a publicar tu oferta en 4 pasos rápidos.\n\n📸 *Paso 1:* Envía de 1 a 3 fotos de tu producto o promoción (la primera será la portada en WhatsApp).`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    // Paso 1: Fotos recibidas
    if (estadoPub.paso === 'fotos') {
      estadoPub.datos.imagenes = [
        imagenUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'
      ];
      estadoPub.paso = 'descripcion';

      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `✅ Foto recibida.\n\n📝 *Paso 2:* Escribe el título y la descripción de tu oferta (máximo 150 caracteres, indicando claramente qué incluye).`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    // Paso 2: Descripción recibida
    if (estadoPub.paso === 'descripcion') {
      // El agente IA analiza y extrae
      const propuesta = iaComerciosAgent.analizarPublicacion(texto);
      estadoPub.datos.titulo = propuesta.titulo;
      estadoPub.datos.descripcion = propuesta.descripcion;
      estadoPub.datos.categoria = propuesta.categoria;
      estadoPub.paso = 'precios';

      return [{
        id: `msg_bot_${Date.now()}`,
        remitente: 'bot',
        texto: `Título detectado: *${propuesta.titulo}*\nDescripción: "${propuesta.descripcion}"\n\n💵 *Paso 3:* Envía el Precio Normal y el Precio de Oferta (Ejemplo: "Precio normal S/ 50 y oferta S/ 35").`,
        tipo: 'texto',
        timestamp: ahora
      }];
    }

    // Paso 3: Precios recibidos
    if (estadoPub.paso === 'precios') {
      const matchPrecios = texto.match(/\d+(\.\d+)?/g);
      let pNormal = 50;
      let pOferta = 35;
      if (matchPrecios && matchPrecios.length >= 2) {
        const p1 = parseFloat(matchPrecios[0]);
        const p2 = parseFloat(matchPrecios[1]);
        pNormal = Math.max(p1, p2);
        pOferta = Math.min(p1, p2);
      }

      estadoPub.datos.precioNormal = pNormal;
      estadoPub.datos.precioOferta = pOferta;
      estadoPub.paso = 'confirmar';

      // Crear oferta en cola de validación
      const creacion = ofertasModule.crearOferta({
        comercioId: comercio.id,
        titulo: estadoPub.datos.titulo || 'Oferta Especial',
        descripcion: estadoPub.datos.descripcion || 'Gran promoción por tiempo limitado.',
        tipo: 'descuento',
        precioNormal: pNormal,
        precioOferta: pOferta,
        categoria: estadoPub.datos.categoria || comercio.categoria,
        imagenes: estadoPub.datos.imagenes || ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80'],
        diasVencimiento: 30
      });

      this.estadoFlujoPublicacion.delete(comercio.id);

      if (creacion.ok && creacion.oferta) {
        return [{
          id: `msg_bot_${Date.now()}`,
          remitente: 'bot',
          texto: `🎉 ¡Oferta registrada exitosamente!\n\n• *Título:* ${creacion.oferta.titulo}\n• *Precios:* S/ ${creacion.oferta.precioOferta} (Antes S/ ${creacion.oferta.precioNormal})\n• *Ubicación:* ${comercio.distrito}\n• *Vigencia:* 30 días\n\nEstado: *En validación*. El equipo de administración supervisará el contenido y quedará activa en menos de 24 horas.`,
          tipo: 'texto',
          timestamp: ahora
        }];
      } else {
        return [{
          id: `msg_bot_${Date.now()}`,
          remitente: 'bot',
          texto: `Hubo un error al registrar: ${creacion.error}`,
          tipo: 'texto',
          timestamp: ahora
        }];
      }
    }

    return [{
      id: `msg_bot_${Date.now()}`,
      remitente: 'bot',
      texto: 'Escribe *quiero publicar* para crear una nueva oferta o revisa tu panel web.',
      tipo: 'texto',
      timestamp: ahora
    }];
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

export const coreMessaging = new CoreMessaging();
