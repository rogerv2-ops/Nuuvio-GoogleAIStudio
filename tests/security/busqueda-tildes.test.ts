import { describe, it, expect } from 'bun:test';
import { normalizarTextoBusqueda } from '../../src/utils/textoBusqueda';

// Regresión: en la web pública, buscar "cafe" no encontraba ofertas con "café"
// porque el filtro local solo hacía toLowerCase(). El servidor ya normaliza con
// NFD + eliminación de diacríticos (server.ts, normalizarBusqueda); el helper
// del frontend replica exactamente esa normalización.
describe('normalizarTextoBusqueda', () => {
  it('elimina diacríticos y baja a minúsculas', () => {
    expect(normalizarTextoBusqueda('café')).toBe('cafe');
    expect(normalizarTextoBusqueda('Café MÍA')).toBe('cafe mia');
  });

  it('el match funciona en ambos sentidos (query con y sin tilde)', () => {
    expect(normalizarTextoBusqueda('Café con leche 2x1')).toContain(normalizarTextoBusqueda('cafe'));
    expect(normalizarTextoBusqueda('Cafe con leche 2x1')).toContain(normalizarTextoBusqueda('café'));
  });

  it('tolera vacío y valores nulos', () => {
    expect(normalizarTextoBusqueda('')).toBe('');
    expect(normalizarTextoBusqueda(null as unknown as string)).toBe('');
    expect(normalizarTextoBusqueda(undefined as unknown as string)).toBe('');
  });

  it('no altera texto sin diacríticos ni recorta espacios internos', () => {
    expect(normalizarTextoBusqueda('Pizza 2x1')).toBe('pizza 2x1');
  });
});
