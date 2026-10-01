# 0064 — Un programa puede tener varios formularios activos a la vez

- **Estado:** aceptado · 30-sep-2026 (Mani, en la sesión que llevó los Typeform a Dapta Forms). **Enmienda el
  punto 2 del ADR 0039** (una sola fuente activa por programa) y toca el punto 1 del ADR 0057 (dónde vive el
  link del formulario). Se construye en el ticket 131.
- **Relacionadas:** ADR 0005 (las garantías viven en la base), ADR 0012 (instancias en la base), ADR 0043
  (el programa es frontera), ADR 0051 (un solo generador de links), ADR 0055 (el webhook estándar).

## Contexto

Retia lleva sus formularios de Typeform a Dapta Forms (30-sep). Mani: *"cada programa puede tener 1 o más
links de forms, porque cuando se hace una migración va a haber un punto en el que ambos siguen activos"*.
Durante el cambio, el link viejo sigue en anuncios, bios y mensajes ya enviados. Si el CRM acepta solo una
fuente activa, el día del corte uno de los dos formularios deja de entrar al CRM. El 404 queda en el log,
pero el lead no llega.

El ADR 0039 puso una sola fuente activa por dos razones: el dedup y una atribución ambigua **de una corrida
del sync de Sheets** (F-07, ADR 0031). Las dos dejaron de aplicar:

- **El dedup no depende de la fuente.** La llave del lead es `(program_id, email_normalizado)` y el envío es
  idempotente sobre `(fuente, token, es_parcial)`. La misma persona por dos formularios del mismo programa es
  un lead con dos envíos, que es lo correcto.
- **El sync se retiró el 28-sep (ticket 108).** Con el webhook cada envío llega por la URL de SU fuente, así
  que nunca hay duda de por qué formulario entró.

## Decisión

1. **Un programa puede tener N fuentes activas.** Se quita el índice `sources_una_activa_por_programa_idx`.
   Ninguna regla de identidad ni de métrica cambia: todas cuelgan del programa, no de la fuente.
2. **La frontera sigue igual:** el programa de un envío sale de la fuente de la URL, nunca del payload
   (ADR 0055 punto 1). Dos fuentes activas del mismo programa no cruzan programas.
3. **Lo que no puede pasar en silencio es que una fuente activa deje de recibir.** La salud de la fuente
   (tickets 107 y 110) ya avisa "sin respuestas" y "muerta" por fuente. Con varias activas, ese aviso es lo
   que dice cuándo la vieja se puede apagar.
4. **Un formulario nuevo no es un programa nuevo.** Migrar de proveedor es registrar otra fuente en el mismo
   programa, con su mapeo y su secreto, y apagar la vieja cuando deje de recibir. Los envíos viejos siguen
   apuntando a su fuente.

## Lo que queda abierto (en el ticket 131)

**¿Qué link reparte el CRM?** Hoy el generador de links de captación (ADR 0051, ticket 092) arma el link
sobre `programs.form_url`, que es uno solo. Con dos formularios activos, el CRM tiene que repartir uno y
recibir los dos. La recomendación del 131 es mover el link público a la fuente (`sources.form_url`), con una
fuente marcada como **principal** por programa (índice único parcial `WHERE principal`). El generador usa la
principal, y `programs.form_url` deja de ser la fuente de verdad. Decide Mani al tomar el ticket.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener una activa y hacer el corte de golpe | El link viejo vive en anuncios y mensajes ya enviados; sus envíos se perderían (404) |
| Una fuente con varios proveedores adentro | Mezcla dos secretos y dos mapeos en una fila; el adaptador lo escoge la fuente (ADR 0055) |
| Un programa "de transición" para el formulario nuevo | Rompe la frontera: la misma persona serían dos leads en dos programas, y sus métricas no se suman (ADR 0043) |
