# ADR-0001: La zona de servicio es la provincia, no el distrito

- Estado: aceptada
- Fecha: 2026-10-21
- Decidido por: el dueño (Roger)

## Contexto

Yuddit operaba en Lima, y el bot filtraba las ofertas por el **distrito exacto** de la
persona. Si no había ninguna oferta en ese distrito, le mandaba **todas** las del país:
alguien de Chiclayo recibía ofertas de Barranco.

En el Perú hay 1.954 distritos y **99 nombres de distrito repetidos** ("Santa Rosa" 10
veces, "Miraflores" 4, "San Isidro" 2), así que el nombre de distrito no identifica un
lugar. Hace falta un código y hace falta un nivel superior donde decidir.

## Decisión

**La unidad de negocio es la provincia.** El distrito es la *ubicación* de la persona
dentro de una provincia.

- La columna `activo` de `geo_territorios` se pone en las **provincias**, nunca en un
  distrito suelto. Un distrito se sirve si su provincia está encendida.
- El bot ofrece las ofertas de la **provincia** de la persona (primero las de su distrito
  exacto, después el resto de la provincia).
- Si su provincia **no** está encendida, el bot se lo dice con franqueza y **no** le
  manda ofertas de otra zona. El interés se registra (evento `zona_sin_servicio`): es la
  señal de dónde expandirse.
- "Lima primero" deja de estar en el código y pasa a ser un dato que el panel enciende
  (`/gestion/zonas`).

## Consecuencias

- Abrir una ciudad nueva es cambiar un dato, no tocar código.
- La persona recibe ofertas de su zona real, no de la otra punta del país.
- Los listados de geolocalización (formularios y filtros) son siempre
  **provincia → distrito**: el distrito no se puede elegir sin provincia.
- La audiencia guarda el **código** del distrito y de la provincia, no solo el nombre.
