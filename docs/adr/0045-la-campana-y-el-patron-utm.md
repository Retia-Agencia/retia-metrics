# 0045 — La Campaña es una entidad, y el emparejamiento de un envío es determinista

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (consolida sus tres enmiendas y el ADR retirado
0046) · **Estado:** aceptado; la garantía contra empates tiene un pendiente técnico (P2)

## El problema

Gerencia pidió ver si la inversión se convierte en ventas, y Pauta mide todo por UTM. Para eso hay que
dividir inversión entre leads, y **las dos mitades no se podían cortar con la misma llave**: el lead
trae su UTM en el envío, y el costo vivía en `ad_spend` con la campaña como **texto libre** cargado a
mano. Unirlos sería comparar cadenas entre dos sistemas que no se hablan: el CPL de una campaña saldría
con menos leads de los que tuvo, sin error.

## Decidimos

**1. La Campaña es una entidad de catálogo** (`campanas`: programa, nombre, plataforma, cohorte,
`activo`), y **`ad_spend` cuelga de ella, por fecha**. Crear una campaña escribe en la misma operación
la regla que reconoce sus envíos (ADR 0051): el link y la regla no pueden discrepar.

**2. Un patrón UTM se expresa con dos catálogos:** el **Canal** (`utm_source` + `utm_medium`, con su
Área) y la **Campaña** (`utm_campaign`). Es lo único que traduce el origen crudo de un envío a un
dueño. No hay niveles debajo de la campaña: **conjunto y anuncio quedaron fuera de alcance** (Mani,
21-sep), así que *"qué anuncio está vendiendo"* deja de ser contestable a cambio de un modelo que se
decide donde de verdad se mueve presupuesto, en la campaña.

**3. 🩸 El emparejamiento es DETERMINISTA.** Si un envío casa con dos campañas, ese lead se cuenta en
las dos y el CPL de ambas sale mal sin un solo error: es el `fuentes[0]` sin `ORDER BY` que atribuía
corridas de sync al azar, ahora con dinero encima. Tres reglas:

1. Un envío resuelve **a lo sumo una** campaña.
2. **Gana el patrón más específico** (más campos no nulos), sin importar el orden de la consulta.
3. **Un empate es un error visible**, no una elección silenciosa. La garantía vive en un índice único
   sobre la combinación del patrón dentro del programa, más la detección en tiempo de ejecución en el
   emparejador (`lib/atribucion/emparejar.ts`, ticket 085), con un test que corre los patrones en
   distinto orden y exige el mismo resultado. ⚠️ P2: en Postgres dos `NULL` no chocan en un índice
   único salvo con `NULLS NOT DISTINCT`, así que el índice solo no alcanza.

**4. Dos cubetas de huérfanos, siempre visibles y nunca juntas.**

- **Sin UTM:** el envío llegó sin origen. Problema de captación, **irrecuperable** para lo que ya
  entró. Medido el 21-sep: 726 de 4.823 (15%); Tactical 26%, ComunicArte 1%. No es un estado de error:
  es un hecho del lead.
- **Sin clasificar:** trae UTM pero no casa con ningún patrón. Problema de configuración: se arregla
  con una fila y **repara hacia atrás**, porque el UTM crudo sigue ahí.

**5. La regla del cero: una división solo se muestra si el numerador Y el denominador existen en esa
rebanada.** Media orgánica y Comercial tienen inversión cero, así que su CPL daría $0 y la tabla las
mostraría ganándole a Pauta. Si falta una mitad, la celda dice **"sin pauta"**, no $0. **Nunca se
prorratea** un gasto entre campañas: un número inventado se ve igual que un dato. Entre áreas no se
compara costo sino aporte y calidad (cuántos leads trae cada una, qué tasa de calificación tienen,
cuántos cierran).

## Por qué el estándar de UTM se escribió así

Medido en los consolidados de C2: `utm_content` significaba **anuncio** en ComunicArte y **conjunto**
en Tactical. Cualquier código que lo leyera sin mirar el programa estaría bien en uno y mal en el otro.
La convención vigente (ADR 0051) lo resuelve leyendo solo tres campos y dejando que `utm_content`
cambie de sentido **solo según el canal**, interpretado por un único módulo.
