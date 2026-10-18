import React from 'react';
import { GestionLayout } from './gestion/GestionLayout';

export type AdminCategory = 'analitica' | 'crm' | 'sistema';

export type AdminSubSection = 
  | 'analitica_general'
  | 'analitica_utm'
  | 'crm_pipeline'
  | 'crm_ventas'
  | 'crm_planes'
  | 'sistema_whatsapp'
  | 'sistema_correo'
  | 'sistema_seo'
  | 'sistema_ofertas_kpis'
  | 'sistema_ofertas_moderacion'
  | 'sistema_auditoria';

interface AdminPanelProps {
  onVolverAWeb?: () => void;
  rutaInicial?: string;
}

/**
 * Consola CRM/ERP Modular de Gestión de Yuudit
 * Integra los 8 dominios principales con registro centralizado de navegación,
 * páginas resumen ejecutivas, vistas operativas y redirección canónica.
 */
export const AdminPanel: React.FC<AdminPanelProps> = ({ onVolverAWeb, rutaInicial }) => {
  return (
    <GestionLayout 
      rutaInicial={rutaInicial || '/gestion'}
      onVolverAWeb={onVolverAWeb}
    />
  );
};
