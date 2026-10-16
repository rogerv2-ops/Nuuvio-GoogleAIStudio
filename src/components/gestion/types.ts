import { LucideIcon } from 'lucide-react';
import { FeatureFlags } from '../../types';

export interface GestionSubItem {
  id: string;
  ruta: string;
  titulo: string;
  descripcion?: string;
  badge?: () => { count: number; color: string } | null;
  requiereFlag?: keyof FeatureFlags;
  permisoMinimo?: 'admin' | 'operador' | 'comercio';
}

export interface GestionMenuItem {
  id: string;
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: LucideIcon;
  badge?: () => { count: number; color: string } | null;
  requiereFlag?: keyof FeatureFlags;
  permisoMinimo?: 'admin' | 'operador' | 'comercio';
  subitems: GestionSubItem[];
}

export interface GestionBreadcrumb {
  titulo: string;
  ruta?: string;
}
