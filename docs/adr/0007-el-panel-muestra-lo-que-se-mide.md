# ADR-0007: El panel muestra lo que se mide; lo que no se puede medir, "sin medir"

- Estado: aceptada
- Fecha: 2026-10-21
- Decidido por: el dueño (Roger)

## Contexto

El panel mostraba números que **nunca se habían medido**: los KPI tenían mínimos
escritos a mano (`Math.max(usuarios, 240)`, `Math.max(vistas, 625)`, CTR 13,6%),
había un gráfico de seis meses fabricado multiplicando el valor actual por
porcentajes fijos, y 21 eventos semilla ("Carlos Vásquez") se presentaban como leads
reales. En producción, con la base vacía, el panel se veía lleno.

## Decisión

**Un número que no se mide no se muestra.** Si no se puede medir, es `null` y la
pantalla dice "sin medir" o "—".

- Los KPI los mide el **servidor** (`GET /api/analitica/kpis`), que es el único que ve
  la base.
- Los gráficos se arman con las **fechas** de la base (serie mensual y diaria reales).
- Las tendencias necesitan un periodo anterior **real**; si no lo hay, el badge dice
  "sin dato" (no "0% sin cambio", que también es inventar).
- Los datos de demostración (eventos semilla, "Probar Alerta") se marcan como tales o se
  quitan.

## Consecuencias

- Un tablero con ceros es un tablero **honesto**: dice que no hay datos.
- Cada hueco es una señal de lo que falta medir (por ejemplo, las ventas confirmadas no
  tienen tabla).
- Consecuencia directa: el dueño puede volver a **decidir** con los números.
