# 0039 — Un programa, una fuente de leads: `sources` deja de significar "pestana que leemos"

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 21-sep; decision **D2** del plan v2 y la
respuesta a E1-4 el mismo dia) · **Implementacion:** etapa 1 del plan v2; la recuperacion de
`Forms viejo`, en la etapa 7 · **Aplica:** ADR 0004, ADR 0005, ADR 0031 · **Toca:** ADR 0019

## El problema

Textual de Mani, 20-sep: *"cada programa tiene un intake de Sheets que recibe Leads crudos"*.

La tabla `sources` de hoy no dice eso. Dice *"pestana de una hoja que el CRM lee, con un destino"*,
y por eso guarda cuatro clases de cosas mezcladas. **Medido contra `dev` el 21-sep**, las 10 filas
reales:

| programa | fuente | destino | activo | pestana |
|---|---|---|---|---|
| comunicarte | Formulario actual | people | **si** | `New form` |
| comunicarte | Formulario anterior | people | **si** | `Forms viejo` |
| comunicarte | Estudiantes | sales | no | `Estudiantes Agosto` |
| comunicarte | Pauta | ad_spend | no | `ROAS ESTUDIASTES AGOSTO` |
| comunicarte | Registro de llamadas | calls | no | `Registro de llamadas` |
| tactical-investor | Formulario | people | **si** | `De Cero a Tactical Investor` |
| tactical-investor | Estudiantes C1 | sales | no | `Estudiantes Cohort Julio` |
| tactical-investor | Estudiantes C2 | sales | no | `Septiembre Estudiantes Cohort` |
| tactical-investor | Pauta C1 | ad_spend | no | `ROAS COHORT JULIO` |
| tactical-investor | Registro de llamadas | calls | no | `Registro de llamadas` |

⚠️ **Correccion al plan v2 §10, medida:** son **7** filas con `destino != people`, no 5. El plan
contaba las 5 filas de ComunicArte. La decision no cambia; el numero si.

Dos consecuencias concretas:

1. **El indice unico que pedia el insumo §2.10 (`unique(program_id)`) no se puede crear sobre esta
   tabla.** ComunicArte tiene 5 filas con el mismo `program_id`, dos de ellas activas de leads.
2. **`Forms viejo` no es una segunda fuente activa: es una pestana muerta hace dos meses.** Medido
   el 21-sep leyendo las dos pestanas: `New form` 2.258 filas → 2.070 personas (6-ago a 21-sep,
   VIVA); `Forms viejo` 67 filas → 65 personas (20-jul a 22-jul, MUERTA), de las cuales **10 ya
   estan en `New form` y 55 no**.

## Decidimos

**1. `sources` significa exactamente una cosa: el intake de leads crudos de un programa.**

Mani, 21-sep, respondiendo a E1-4:

> *"Borrar todas. Porque eso era solo para la migracion inicial ya que todo se manejaba manual en
> Sheets... Pero cuando el CRM se vuelva el centro, las llamadas, etc. solo van a vivir aqui. Lo
> unico que va a entrar de afuera son Leads crudos que llenan un forms de un programa."*

Las **7 filas con `destino != people` se borran** en el corte de la etapa 1, y **la columna
`destino` se elimina con ellas**: cuando todas las filas valen lo mismo, la columna no informa, y
una columna que no informa es una invitacion a volver a meter otra clase de cosa aqui.

Las coordenadas de esas pestanas (archivo + pestana, la tabla de arriba) **se copian al ticket de
la etapa 7 antes de borrarlas**, que es donde la migracion one-time las necesita. Un insumo que se
usa una vez es un dato del ticket, no configuracion del sistema.

**2. El indice unico es PARCIAL: `unique (program_id) WHERE activo`.**

No un unico a secas sobre `program_id`, y la razon no es comodidad:

- **`Forms viejo` se queda como fuente INACTIVA**, no se borra. Es una fuente de **leads** (su
  destino siempre fue `people`), y la etapa 7 va a recuperar sus 55 personas **con sus envios**:
  esos `submissions.source_id` necesitan apuntar a algo que diga la verdad sobre de donde salieron.
  Apuntarlos al formulario actual seria escribir un origen falso; dejarlos sin fuente seria perder
  el unico dato que explica por que esas 55 se ven raras.
- **Un formulario se reemplaza alguna vez** (Typeform → Dapta, insumo §5.7). Con un unico a secas,
  cambiar de formulario obliga a destruir el registro del anterior en el mismo movimiento.

Lo que **nunca** puede existir es **dos intakes ACTIVOS en el mismo programa**: eso es lo que
duplica la superficie del dedup y lo que hacia ambigua la atribucion de una corrida (F-07,
ADR 0031). Eso es justo lo que el indice parcial garantiza, y lo garantiza **la base** (ADR 0005),
no el codigo.

⚠️ **Orden de la migracion:** ComunicArte tiene **dos** fuentes de leads activas hoy. El indice
se crea **despues** de desactivar `Forms viejo`, en la misma migracion. Al reves falla, que es la
misma leccion del `CHECK` de la migracion 0009 (AGENTS.md).

**3. Las 55 personas no se pierden, cambian de mecanismo.** Ya estan en la base (el CRM nunca borra
un lead, F-06). Lo que pasa es que dejan de tener **envio**, porque `submissions` lo reconstruye el
primer sync v2 desde la hoja que si se lee. Se recuperan en la **migracion one-time de la etapa 7**,
que es donde el insumo §9 ya pone las pestanas viejas.

**4. La pauta es lo unico que NO desaparece con su fuente, pero deja de entrar por Sheets.**

Mani, mismo dia:

> *"el CRM si va a tener las metricas por UTMs ya que todo lead entra con su origen, pero el costo
> de una campana y demas para calcular el CPI, CAC, ROAS si toca indicarlo manualmente o traerlo de
> los Paid Traffickers; las pautas deben poderse asignar un costo."*

O sea la asimetria es esta, y es la que ordena el diseno:

| | De donde sale | Donde vive |
|---|---|---|
| **El origen** de un lead (UTM) | entra solo con el envio | `submissions.utm_*` (ADR 0036) |
| **El costo** de una campana | no lo sabe ningun formulario | se **captura en el CRM** |

`ad_spend` se conserva como tabla y **deja de ser una fuente de Sheets**: pasa a ser un dato que un
gerente carga desde la app (o que despues llegue de los Paid Traffickers), con su programa, su
cohorte, su campana, su fecha y su **inversion**. Sigue el molde de `lib/catalogo/` como todo lo
demas: un solo esquema zod, guarda por rol, y cada cambio a `change_log` (ADR 0012, ADR 0029).
🩸 La inversion es en **COP** y el ticket en **USD**: la moneda va al lado del numero, siempre
(regla dura de AGENTS.md).

⚠️ Consecuencia tecnica para la etapa 1: `ad_spend.huella_fila` y `ad_spend.raw` son artefactos de
la ingesta por hoja (la huella existe para deduplicar filas de un Sheet). Con la carga manual
dejan de tener sentido como llave. **El indice `ad_spend_huella_idx` se re-piensa en la etapa 5**,
cuando el ROAS (E5-4) diga cual es la unicidad real de una linea de pauta; hasta entonces no se
toca, porque la tabla tiene 0 filas y no hay nada que proteger.

## Consecuencias

- **A favor:** `sources` pasa a tener un solo significado, y la pantalla `/ajustes/fuentes` deja de
  mostrar siete filas inactivas que nadie va a volver a activar. El paso a paso del gerente
  (insumo §5.3) se vuelve cierto: *"un programa solo puede tener una hoja"*.
- **A favor:** el candado del ADR 0031 deja de tener que elegir entre fuentes: con una sola activa
  por programa, `fuentes_leidas` tiene un solo elemento en el caso normal y F-07 no puede volver.
- **En contra:** la etapa 7 depende de un dato que ya no esta en la base, sino en un ticket. Si el
  ticket se pierde, se pierden las coordenadas. Mitigacion: quedan tambien en este ADR (la tabla de
  arriba) y en `docs/estructura-bbdd.md`, que es el mapa real de las hojas.
- **En contra:** el ROAS pasa a depender de que alguien **cargue** la inversion. Antes dependia de
  que alguien mantuviera una pestana. No es mas fragil, es fragil en un lugar visible: una cohorte
  sin pauta cargada se ve vacia en la pantalla, y eso se nota; una pestana desactualizada no.
- **Abierto:** si la carga de pauta es por campana/dia (como la hoja) o un total por cohorte. Lo
  decide E5-4 con la pantalla del ROAS delante, no este ADR.

## Alternativas descartadas

**Dejar `destino` vivo con el indice parcial `WHERE destino='people' AND activo`.** Era la opcion
que yo recomendaba: no borra nada y le deja casa a `ad_spend`. Mani la tumbo con el argumento
correcto y mas fuerte: **esas filas existian porque en la epoca anterior las llamadas y las ventas
vivian en Sheets.** En el modelo v2 nacen en el CRM (ADR 0037), asi que mantenerlas configuradas
es mantener viva la puerta de una epoca que este plan cierra. Y la pauta no las necesita, porque su
problema no es de lectura sino de captura.

**Borrar tambien `Forms viejo`.** Deja sin origen a los 55 leads y a sus envios de la etapa 7, y
convierte el indice en uno a secas al precio de perder la unica explicacion de por que esas 55
personas no tienen envio en el modelo nuevo.

**Escribir el indice unico tal cual lo pedia el insumo §2.10.** No se puede crear sobre la tabla
real, y ese es el tipo de detalle que solo aparece midiendo.

---

## Nota 2026-09-24: de dónde cuelga `ad_spend`, ya resuelto

Este ADR decía que el grano de `ad_spend` lo decidía la etapa 5. Lo decidieron los ADR 0045 y 0046
(enmienda del 21-sep): **`ad_spend` cuelga de la campaña, por fecha**. El ADR 0051 (24-sep) no lo
cambia.
