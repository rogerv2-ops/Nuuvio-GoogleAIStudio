# ADR-0004: La identidad de la audiencia es el número de teléfono

- Estado: aceptada
- Fecha: 2026-10-20
- Decidido por: el dueño (Roger)

## Contexto

El panel de audiencia inventaba un correo para cada persona que entraba por WhatsApp
(`usr_wa_<telefono>@<dominio>`): no existía, no se podía verificar, inflaba la "tasa
de verificación" al 0% con la audiencia activa y rompía el borrado por correo. La causa
era que el modelo exigía un correo que el canal principal no produce.

## Decisión

- `audience_users.email` es **nullable** y la identidad es el **número**.
- El correo solo existe si la persona lo da (registro web) y se verifica.
- `emailDeAudiencia()` centraliza la regla; `normalizarEmailsAudiencia()` limpia los
  correos inventados que ya estaban en la base.
- El teléfono se guarda cifrado, con `telefono_idx` (índice ciego) para poder buscar sin
  descifrar.

## Consecuencias

- El panel muestra "Usuarios Verificados" y "Entraron por WhatsApp" sin mentir.
- Se puede borrar a una persona por su número.
- `audience_users` guarda ahora el **código** de distrito y provincia, porque el nombre
  del distrito es ambiguo (99 nombres repetidos en el Perú). Ver ADR-0001.
