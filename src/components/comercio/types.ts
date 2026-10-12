import { LucideIcon } from 'lucide-react';

export interface ComercioSubItem {
  id: string;
  ruta: string;
  titulo: string;
  descripcion?: string;
  badge?: () => { count: number; color: string } | null;
}

export interface ComercioMenuItem {
  id: string;
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  subitems: ComercioSubItem[];
  badge?: () => { count: number; color: string } | null;
}

export type ComercioRangoTiempo = 'hoy' | '7dias' | '30dias' | 'personalizado';

export interface ComercioFiltros {
  rango: ComercioRangoTiempo;
  fechaInicio?: string;
  fechaFin?: string;
  ofertaId?: string;
  canal?: 'todos' | 'whatsapp' | 'web';
}
