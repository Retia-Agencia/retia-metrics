# 0023 — Las métricas por closer salen de las mismas consultas, y la meta no se reparte

**Fecha:** 2026-09-17 · **Reescrito:** 2026-09-27 (el dueño vive en el deal desde el ADR 0037; el
dashboard es una tab desde el ADR 0050) · **Estado:** aceptado

Mani, 17-sep: **saber todas las métricas a nivel individual de closer es no negociable.**

## Decidimos

**1. El filtro por closer vive dentro de las consultas del dashboard, en su alcance.** Toda consulta
recibe `Alcance = { programId, rango, closerId? }` y agrega su propia condición. Sin closer, la
consulta es idéntica, así que filtrar no puede cambiar el total del programa. Se descartó un módulo
aparte por closer: duplicaría el anclaje de fecha en Bogotá, el universo del embudo y el agrupado por
moneda, y esas copias se desincronizan sin que nadie lo note (ADR 0024).

**2. No existe meta individual.** La meta de cupos y la de leads por día hábil son de la cohorte
(ADR 0022) y la base no tiene reparto por closer. Con un closer seleccionado se muestra su
**contribución** (sus ventas de la cohorte) al lado de la meta de la cohorte, nunca una meta suya.
Repartir la meta sería inventar un número con el que se mide a personas.

**3. El comparativo entre closers no se puede filtrar, y lo impide el tipo.** Su alcance es
`Omit<Alcance, "closerId">`: filtrarlo lo dejaría en una fila. Es una garantía del compilador, no una
convención.

**4. Los leads de un closer son los deals de los que es dueño.** Como "sin dueño" es un estado
válido, la suma de los closers **no** da el total del programa, y la pantalla lo dice en vez de
cuadrarlo a la fuerza.

**5. El filtro vive en la URL, nunca en la sesión.** Rango y closer son parámetros de la tab
Dashboard. Un closer que entra sin filtro ve el programa completo (dentro de sus programas, ADR
0048). Un dashboard filtrado por la sesión no se podría compartir ni recargar, y el armado de la
vista no recibe rol ni sesión, así que no hay dónde esconder una diferencia.

## Consecuencias

- Una consulta nueva del dashboard nace con `Alcance`: si necesita un filtro más, crece el objeto.
- Un rango que no se puede cumplir (cohorte sin ventana, fechas inválidas) cae a "hoy" y el selector
  muestra "hoy": la pantalla nunca dice que ves algo distinto de lo que ves.
- El día que el negocio quiera meta por closer, se decide y se guarda como dato (ADR 0012), no se
  deriva en el código.
