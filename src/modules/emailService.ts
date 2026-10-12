/**
 * MODULO: emailService
 * Gestión de despacho de correos electrónicos transaccionales (SMTP / Resend API)
 * y generación de enlaces de verificación de 1 clic e invitación a WhatsApp.
 */

export interface EmailConfigData {
  provider: 'smtp' | 'resend';
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromName: string;
    fromEmail: string;
  };
  resend: {
    apiKey: string;
    fromEmail: string;
    fromName: string;
  };
}

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  provider: 'smtp' | 'resend' | 'simulated';
  status: 'entregado' | 'fallido' | 'simulado';
  timestamp: string;
  verificationToken?: string;
  verificationLink?: string;
  whatsappLink?: string;
  error?: string;
}

class EmailService {
  /**
   * Envía un correo con enlace de verificación de 1 clic e invitación al bot de WhatsApp
   */
  public async enviarCorreoVerificacion(params: {
    email: string;
    nombre: string;
    verificationToken: string;
    botPhone?: string;
  }): Promise<{ ok: boolean; message: string; simulated?: boolean; verificationLink?: string; whatsappLink?: string }> {
    try {
      const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://nuuvio.ai.studio';
      const response = await fetch('/api/email/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: params.email,
          nombre: params.nombre,
          verificationToken: params.verificationToken,
          botPhone: params.botPhone,
          originUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status} al enviar correo`);
      }

      return await response.json();
    } catch (err: any) {
      console.warn('Fallo llamada a /api/email/send-verification, usando fallback local:', err);
      // Fallback local en caso de que el backend esté reiniciándose
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const vLink = `${origin}/?verify_token=${params.verificationToken}`;
      const waNum = (params.botPhone || '51987654321').replace(/\D/g, '');
      const waLink = `https://wa.me/${waNum}?text=${encodeURIComponent('Oferta')}`;
      return {
        ok: true,
        message: 'Correo procesado (modo de contingencia)',
        simulated: true,
        verificationLink: vLink,
        whatsappLink: waLink
      };
    }
  }

  /**
   * Obtiene la configuración de correo actual del servidor
   */
  public async obtenerConfiguracion(): Promise<EmailConfigData | null> {
    try {
      const res = await fetch('/api/email/config');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.error('Error al obtener configuración de correo:', e);
    }
    return null;
  }

  /**
   * Guarda la configuración de correo en el servidor
   */
  public async guardarConfiguracion(config: EmailConfigData): Promise<{ ok: boolean; message?: string }> {
    try {
      const res = await fetch('/api/email/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, message: e.message || 'Error de red' };
    }
  }

  /**
   * Envía un correo de prueba
   */
  public async enviarCorreoPrueba(destinatario: string): Promise<{ ok: boolean; message: string }> {
    try {
      const res = await fetch('/api/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinatario })
      });
      return await res.json();
    } catch (e: any) {
      return { ok: false, message: e.message || 'Error de red' };
    }
  }

  /**
   * Obtiene el historial reciente de correos enviados
   */
  public async obtenerLogs(): Promise<EmailLogEntry[]> {
    try {
      const res = await fetch('/api/email/logs');
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (e) {
      console.error('Error al obtener logs de correo:', e);
    }
    return [];
  }
}

export const emailService = new EmailService();
