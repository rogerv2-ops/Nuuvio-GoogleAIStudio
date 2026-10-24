/**
 * CSV seguro para exportaciones del panel admin.
 *
 * escapeCsvCelda envuelve cada valor en comillas y, si empieza por = + - @
 * TAB o CR, lo prefija con una comilla simple: sin eso, Excel/Sheets
 * ejecutarían el contenido de una celda como fórmula (formula injection)
 * al abrir una exportación que mezcla datos escritos por terceros.
 */
export const escapeCsvCelda = (v: unknown): string => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};

export const filaCsv = (valores: unknown[]): string => valores.map(escapeCsvCelda).join(",");
