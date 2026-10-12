import React from 'react';
import { 
  Store, Building2, MapPin, Phone, Mail, Instagram, 
  ShieldCheck, Clock, User
} from 'lucide-react';
import { Merchant } from '../../../types';

interface MiNegocioComercioViewProps {
  comercio: Merchant;
  rutaActual: string;
}

export const MiNegocioComercioView: React.FC<MiNegocioComercioViewProps> = ({
  comercio
}) => {
  return (
    <div className="space-y-6">
      {/* Resumen del comercio */}
      <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xl">
            🍃
          </div>
          <div>
            <h3 className="text-lg font-black text-[#0F172A]">{comercio.nombreComercial}</h3>
            <p className="text-xs text-stone-500 font-mono">RUC: {comercio.ruc} · {comercio.razonSocial}</p>
          </div>
          <span className="ml-auto text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200">
            Comercio Aliado Activo
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Datos de contacto y WhatsApp verificado */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
          <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
            <Phone className="w-4 h-4 text-emerald-700" />
            <span>Contacto y WhatsApp de Ofertas</span>
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Número de WhatsApp del Negocio</span>
              <strong className="text-stone-800 font-mono">{comercio.telefono}</strong>
              <p className="text-[10px] text-emerald-700 mt-0.5">Aquí llegan los contactos de los usuarios interesados</p>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Persona Responsable</span>
              <strong className="text-stone-800">{comercio.contactoNombre}</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Correo Electrónico</span>
              <strong className="text-stone-800">{comercio.email}</strong>
            </div>
          </div>
        </div>

        {/* Local y Ubicación */}
        <div className="bg-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3">
          <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-700" />
            <span>Sede del Local</span>
          </h4>
          <div className="space-y-2 text-xs">
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Distrito</span>
              <strong className="text-stone-800">{comercio.distrito}, {comercio.provincia}</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Dirección Física</span>
              <strong className="text-stone-800">{comercio.direccion}</strong>
            </div>
            <div className="p-2.5 bg-stone-50 rounded-xl">
              <span className="text-[10px] text-stone-400 block">Categoría Comercial</span>
              <strong className="text-stone-800">{comercio.categoria}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
