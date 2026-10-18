/**
 * MODULO 8: clics-atribucion (esquema: clk)
 * El evento que se vende: el clic. Enlaces firmados, códigos personales,
 * confirmación de ventas sin QR, reportes y calificaciones.
 */
import { ClickRecord, ConfirmedSale } from '../types';
import { coreEvents } from '../core/events';
import { ofertasModule } from './ofertas';
import { comerciosModule } from './comercios';
import { facturacionModule } from './facturacion';
import { puntosModule } from './puntos';

class ClicsAtribucionModule {
  private clics: ClickRecord[] = [
    {
      id: 'clk_init_01',
      ofertaId: 'ofr_01',
      comercioId: 'merch_01',
      usuarioId: 'usr_demo_01',
      tipo: 'contactar',
      codigoPersonal: 'CV88-91',
      canal: 'whatsapp',
      valido: true,
      facturable: true,
      creadoEn: new Date(Date.now() - 3600000 * 5).toISOString()
    },
    {
      id: 'clk_sh_01',
      ofertaId: 'ofr_01',
      comercioId: 'merch_01',
      usuarioId: 'usr_demo_01',
      tipo: 'compartir',
      codigoPersonal: 'VUUY-CV88',
      referidoPor: 'VUUY-CV88',
      canal: 'whatsapp',
      valido: true,
      facturable: false,
      creadoEn: new Date(Date.now() - 3600000 * 38).toISOString()
    },
    {
      id: 'clk_sh_02',
      ofertaId: 'ofr_02',
      comercioId: 'merch_02',
      usuarioId: 'usr_demo_02',
      tipo: 'compartir',
      codigoPersonal: 'VUUY-LR26',
      referidoPor: 'VUUY-LR26',
      canal: 'web',
      valido: true,
      facturable: false,
      creadoEn: new Date(Date.now() - 3600000 * 24).toISOString()
    },
    {
      id: 'clk_sh_03',
      ofertaId: 'ofr_03',
      comercioId: 'merch_03',
      usuarioId: 'usr_demo_03',
      tipo: 'compartir',
      codigoPersonal: 'VUUY-MA73',
      referidoPor: 'VUUY-MA73',
      canal: 'whatsapp',
      valido: true,
      facturable: false,
      creadoEn: new Date(Date.now() - 3600000 * 18).toISOString()
    },
    {
      id: 'clk_sh_04',
      ofertaId: 'ofr_04',
      comercioId: 'merch_04',
      usuarioId: 'usr_demo_04',
      tipo: 'compartir',
      codigoPersonal: 'VUUY-VM91',
      referidoPor: 'VUUY-VM91',
      canal: 'web',
      valido: true,
      facturable: false,
      creadoEn: new Date(Date.now() - 3600000 * 10).toISOString()
    },
    {
      id: 'clk_init_02',
      ofertaId: 'ofr_02',
      comercioId: 'merch_02',
      usuarioId: 'usr_demo_03',
      tipo: 'contactar',
      codigoPersonal: 'MA73-44',
      canal: 'whatsapp',
      valido: true,
      facturable: true,
      creadoEn: new Date(Date.now() - 3600000 * 6).toISOString()
    }
  ];

  private ventasConfirmadas: ConfirmedSale[] = [
    {
      id: 'vnt_init_01',
      codigoPersonal: 'CV88-91',
      comercioId: 'merch_01',
      ofertaId: 'ofr_01',
      montoVenta: 24,
      confirmadaEn: new Date(Date.now() - 3600000 * 2).toISOString()
    }
  ];

  private reportes: { id: string; ofertaId: string; usuarioId: string; motivo: string; fecha: string }[] = [];
  private calificaciones: { id: string; comercioId: string; usuarioId: string; puntaje: number; comentario: string; fecha: string }[] = [];
  private listeners: (() => void)[] = [];

  /**
   * Registro de clic en "Contactar comercio" (F-AUD-06):
   * Deduplicación de 24 horas por usuario/oferta (antifraude).
   */
  public registrarClicContactar(params: {
    ofertaId: string;
    usuarioId: string;
    usuarioCodigoRef?: string;
    canal: 'whatsapp' | 'web';
  }): { ok: boolean; waUrl: string; codigoPersonal: string; facturable: boolean } {
    const oferta = ofertasModule.obtenerOferta(params.ofertaId);
    if (!oferta) {
      return { ok: false, waUrl: '', codigoPersonal: '', facturable: false };
    }

    const comercio = comerciosModule.obtenerComercio(oferta.comercioId);
    const ahora = Date.now();
    const ventana24h = ahora - 24 * 3600 * 1000;

    // Deduplicación en las últimas 24h
    const clicPrevio = this.clics.find(c =>
      c.ofertaId === params.ofertaId &&
      c.usuarioId === params.usuarioId &&
      c.tipo === 'contactar' &&
      new Date(c.creadoEn).getTime() > ventana24h
    );

    const facturable = !clicPrevio;
    const codigoPersonal = `${params.usuarioCodigoRef || 'VUUY'}-${Math.floor(10 + Math.random() * 90)}`;

    const id = `clk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevoClic: ClickRecord = {
      id,
      ofertaId: oferta.id,
      comercioId: oferta.comercioId,
      usuarioId: params.usuarioId,
      tipo: 'contactar',
      codigoPersonal,
      canal: params.canal,
      valido: true,
      facturable,
      motivoNoFacturable: facturable ? undefined : 'Deduplicado: clic en ventana de 24 horas',
      creadoEn: new Date().toISOString()
    };

    this.clics.unshift(nuevoClic);
    oferta.clics += 1;

    if (facturable) {
      oferta.leadsCalificados += 1;
      // Débito atómico del paquete de clics (F-COM-04)
      facturacionModule.debitarClic(oferta.comercioId);
    }

    coreEvents.emitir({
      tipoEvento: 'clic_contactar',
      actorTipo: 'usuario',
      actorId: params.usuarioId,
      distrito: oferta.distrito,
      origen: params.canal,
      datos: {
        ofertaId: oferta.id,
        comercioId: oferta.comercioId,
        codigoPersonal,
        facturable
      }
    });

    // Mensaje prearmado hacia el WhatsApp del negocio
    const telComercio = (comercio?.telefono || oferta.comercioWhatsapp).replace(/\D/g, '');
    const mensaje = encodeURIComponent(
      `Hola ${oferta.comercioNombre}, vi tu oferta en Yuudit: "${oferta.titulo}" (S/ ${oferta.precioOferta}). Mi código de usuario es ${codigoPersonal}. ¿Sigue disponible?`
    );
    const waUrl = `https://wa.me/${telComercio}?text=${mensaje}`;

    this.notificar();
    return { ok: true, waUrl, codigoPersonal, facturable };
  }

  /**
   * Registro de clic en "Compartir" (F-AUD-04):
   * Genera enlace de referido y suma puntos al usuario
   */
  public registrarClicCompartir(params: {
    ofertaId: string;
    usuarioId: string;
    codigoRef: string;
    canal: 'whatsapp' | 'web';
  }): { urlCompartir: string; textoCompartir: string } {
    const oferta = ofertasModule.obtenerOferta(params.ofertaId);
    const urlCompartir = `${window.location.origin}/o/${oferta?.codigoUrl || params.ofertaId}?ref=${params.codigoRef}`;

    const id = `clk_sh_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    this.clics.unshift({
      id,
      ofertaId: params.ofertaId,
      comercioId: oferta?.comercioId || '',
      usuarioId: params.usuarioId,
      tipo: 'compartir',
      codigoPersonal: params.codigoRef,
      referidoPor: params.codigoRef,
      canal: params.canal,
      valido: true,
      facturable: false,
      creadoEn: new Date().toISOString()
    });

    // Acreditar puntos por compartir (D7)
    puntosModule.acreditarPuntos({
      usuarioId: params.usuarioId,
      cantidad: 10,
      motivo: 'compartir',
      referenciaId: params.ofertaId
    });

    coreEvents.emitir({
      tipoEvento: 'clic_compartir',
      actorTipo: 'usuario',
      actorId: params.usuarioId,
      distrito: oferta?.distrito,
      origen: params.canal,
      datos: {
        ofertaId: params.ofertaId,
        codigoRef: params.codigoRef
      }
    });

    const textoCompartir = `¡Encontré esta super oferta en Yuudit! ${oferta?.titulo} a solo S/ ${oferta?.precioOferta} (Antes S/ ${oferta?.precioNormal}). Mírala aquí: ${urlCompartir}`;

    this.notificar();
    return { urlCompartir, textoCompartir };
  }

  /**
   * Confirmar venta por el comercio (F-COM-03):
   * El comercio valida que el cliente le mostró o escribió el código personal
   */
  public confirmarVenta(params: {
    codigoPersonal: string;
    comercioId: string;
    montoVenta?: number;
  }): { ok: boolean; venta?: ConfirmedSale; error?: string } {
    const codigoLimpio = params.codigoPersonal.trim().toUpperCase();
    
    // Buscar clic asociado
    const clic = this.clics.find(c => 
      c.codigoPersonal.toUpperCase() === codigoLimpio &&
      c.comercioId === params.comercioId
    );

    if (!clic) {
      return { ok: false, error: 'Código personal no encontrado para este comercio.' };
    }

    const id = `vnt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const nuevaVenta: ConfirmedSale = {
      id,
      codigoPersonal: codigoLimpio,
      comercioId: params.comercioId,
      ofertaId: clic.ofertaId,
      montoVenta: params.montoVenta,
      confirmadaEn: new Date().toISOString()
    };

    this.ventasConfirmadas.unshift(nuevaVenta);

    coreEvents.emitir({
      tipoEvento: 'venta_confirmada',
      actorTipo: 'comercio',
      actorId: params.comercioId,
      origen: 'panel',
      datos: {
        codigoPersonal: codigoLimpio,
        ofertaId: clic.ofertaId,
        monto: params.montoVenta
      }
    });

    this.notificar();
    return { ok: true, venta: nuevaVenta };
  }

  public reportarOferta(ofertaId: string, usuarioId: string, motivo: string) {
    this.reportes.unshift({
      id: `rep_${Date.now()}`,
      ofertaId,
      usuarioId,
      motivo,
      fecha: new Date().toISOString()
    });

    coreEvents.emitir({
      tipoEvento: 'oferta_reportada',
      actorTipo: 'usuario',
      actorId: usuarioId,
      origen: 'web',
      datos: { ofertaId, motivo }
    });

    this.notificar();
  }

  public calificarComercio(comercioId: string, usuarioId: string, puntaje: number, comentario: string) {
    this.calificaciones.unshift({
      id: `cal_${Date.now()}`,
      comercioId,
      usuarioId,
      puntaje,
      comentario,
      fecha: new Date().toISOString()
    });

    coreEvents.emitir({
      tipoEvento: 'comercio_calificado',
      actorTipo: 'usuario',
      actorId: usuarioId,
      origen: 'web',
      datos: { comercioId, puntaje, comentario }
    });

    this.notificar();
  }

  public listarClics(): ClickRecord[] {
    return [...this.clics];
  }

  public listarClicsPorComercio(comercioId: string): ClickRecord[] {
    return this.clics.filter(c => c.comercioId === comercioId);
  }

  public listarVentasPorComercio(comercioId: string): ConfirmedSale[] {
    return this.ventasConfirmadas.filter(v => v.comercioId === comercioId);
  }

  public listarTodasLasVentas(): ConfirmedSale[] {
    return [...this.ventasConfirmadas];
  }

  public listarReportes() {
    return [...this.reportes];
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

export const clicsAtribucionModule = new ClicsAtribucionModule();
