import React from 'react';
import { ComercioLayout } from './comercio/ComercioLayout';

interface MerchantPanelProps {
  onVolverAWeb?: () => void;
  entrarComoId?: string | null;
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({ onVolverAWeb, entrarComoId }) => {
  return <ComercioLayout onVolverAWeb={onVolverAWeb} entrarComoId={entrarComoId} />;
};
