import React from 'react';
import { ComercioLayout } from './comercio/ComercioLayout';

interface MerchantPanelProps {
  onVolverAWeb?: () => void;
}

export const MerchantPanel: React.FC<MerchantPanelProps> = ({ onVolverAWeb }) => {
  return <ComercioLayout onVolverAWeb={onVolverAWeb} />;
};
