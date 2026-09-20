---
id: 034
fase: F2
serves: "ADR 0032 · cierra F-01 y F-06 · spec §5 criterio 3 (la parte de arriba del embudo)"
depends: [016]
status: todo
---

# 034 — Las categorias del lead salen de la hoja, no del codigo

> **Mani lo quiere en su propia sesion** (19-sep). Es el ticket mas grande que queda: toca una
> columna con 4.688 filas y pide migracion.

## Objetivo

El equipo clasifica sus leads en la columna `estado` de la hoja. La app **lee que valores existen y
agrupa por ellos**, sin ninguna lista escrita en el codigo, y permite **combinar** dos valores que
son la misma categoria escrita distinto.

## Por que

Decision completa y datos medidos en el **ADR 0032**. En corto:

- Hoy el sync lee `estado` y lo **descarta** (deuda F-01, abierta desde agosto).
- La solucion que estaba propuesta —traducir los valores de la hoja a un enum nuestro— **la rechazo
  Mani el 19-sep**: es una lista fija en el codigo, justo lo que prohibe el ADR 0012. *"No debe
  haber nada hard coded"* (textual).
- `people.estado` es hoy un `pgEnum` de seis valores y es **decorativo**: las 4.688 personas de
  `production` estan en el default `cola_setteo`, y **ningun `if` ni `where` del codigo depende de
  su valor**. El unico lector es `lib/queries/personas.ts:229`, que solo lo proyecta.

## Alcance

- **Dentro:** `people.estado` deja de ser `pgEnum` y pasa a texto. Migracion (los 6 valores del
  enum se van; nunca tuvieron un dato).
- **Dentro:** el sync deja de descartar `estado` y lo guarda **tal como viene**.
- **Dentro:** backfill desde `people.raw`, que **ya tiene el dato para 4.633 personas**. No hace
  falta re-sincronizar.
- **Dentro:** agrupamiento dinamico en el dashboard: se lee que valores hay y se agrupa por ellos.
  Una categoria nueva en la hoja aparece sola, sin migracion ni despliegue.
- **Dentro:** **combinar** dos valores en una categoria. La union es un acto HUMANO guardado como
  DATO (una fila que dice "este valor pertenece a esta categoria"), **nunca** una funcion de
  normalizacion: `Con Calendly` y `Con Calendly (Juanito)` no se derivan una de otra por ninguna
  regla, a diferencia del caso del ADR 0030.
- **Dentro (F-06):** "desaparecio de la hoja" es **una categoria mas** (Mani, 19-sep). El sync
  detecta que una persona dejo de venir y la mueve de categoria. **Nunca se borra una persona.**
- **Fuera:** import del historico de C2 (Mani lo dejo de ultimo, ver spec §7).

## Las categorias reales, contadas en `production` el 19-sep

| programa | valor en la hoja | personas |
|---|---|---|
| comunicarte | `🗑️ Descartado` | 919 |
| comunicarte | `📞 Setteo No Calificado` | 768 |
| comunicarte | `📅 Con Calendly` | 294 |
| tactical-investor | `📞 Setteo No Calificado` | 1.303 |
| tactical-investor | `🗑️ Descartado` | 1.029 |
| tactical-investor | `📅 Con Calendly (Juanito)` | 319 |
| tactical-investor | `Cerrado` | 1 |

El caso de "combinar" esta ahi sin buscarlo: `📅 Con Calendly` y `📅 Con Calendly (Juanito)` son la
misma categoria en dos programas.

## Decisiones que NO estan tomadas y hay que tomar en la sesion

- Donde vive la union: tabla de categorias con sus valores crudos asociados. La forma exacta se
  decide **con la pantalla delante**.
- Que pasa con un valor que nadie ha clasificado: lo natural es que aparezca como su propio grupo
  sin pedir permiso, y que combinarlo sea opcional.
- 🔴 **EL ORDEN Y LAS ETAPAS SE DISENAN EN SESION PROPIA, ANTES QUE ESTE TICKET** (Mani, 19-sep).
  Lo que sigue quedo escrito aqui para no perderlo, pero **la decision NO se toma en este ticket**:
  Mani quiere mirar como HubSpot modela etapas y pipelines y **copiar el modelo probado en vez de
  improvisarlo**, con el objetivo de que un closer vea exactamente donde esta cada lead y lo pueda
  mover. Hay tarea de Notion propia (prioridad 1) y **bloquea este ticket**.

  ⚠️ **Y la tension de arquitectura que hay que resolver alli, porque si nadie la mira se decide
  sola:** hoy **Google Sheets es la fuente de verdad de los leads (ADR 0004)** y este ticket asume
  que la hoja es la duena de `estado`. Un pipeline donde **el closer mueve el lead** hace que el
  CRM pase a ser el dueno de la etapa. Las dos cosas a la vez son **dos escritores sobre el mismo
  campo**, que es justo lo que produce cifras que no cuadran sin lanzar un solo error. Hay que
  decidir quien manda: la hoja, el CRM, o un reparto explicito (p.ej. la hoja aporta la
  clasificacion inicial y el CRM manda desde que un closer la toca).

- 🔴 **El ORDEN de las categorias, y esto es lo que agrupar dinamicamente NO resuelve.** Agrupar
  da *cuantos hay en cada categoria*; un embudo necesita ademas **en que orden van**, y eso no se
  deduce leyendo los valores: nadie puede inferir del texto que `📅 Con Calendly` va antes que un
  cierre. **Y la pregunta que mas pesa:** ¿`📞 Setteo No Calificado` es una ETAPA por la que se
  pasa o una SALIDA? De eso depende si esas 2.071 personas siguen vivas en el embudo o ya estan
  fuera, y con ello si la conversion lead→venta da ~0,9% o ~2,6%. **Es lo unico que sobrevive de
  la pregunta vieja a Michael** ("como se representa el estado del embudo en las hojas"): la
  traduccion murio con la decision de Mani, el orden y el significado no.
- **¿Las categorias son por programa o globales?** Los datos sugieren por programa (cada hoja tiene
  su redaccion), pero eso choca con querer un embudo comparable entre programas. No se decide de
  paso.

## 🎯 Mani, 20-sep: son DOS campos, no uno. `estado` y `etapa`

Esto **desarma la tension de "dos escritores sobre el mismo campo"** que este ticket tenia
escrita arriba, y hay que leerlo antes de disenar nada.

> *"`estado` es lo que llega desde el forms (lo que la calificacion de sus respuestas les pone
> de llegada). Ese campo deberia ser estatico y el que se mueve es la `etapa`."* (Mani, textual)

| campo | quien lo escribe | se mueve | de donde sale |
|---|---|---|---|
| `estado` | la hoja / el formulario | **NO** | la calificacion automatica de las respuestas del lead |
| `etapa` | el CRM (el closer) | **SI** | el pipeline de vida del lead |

Con eso **cada campo tiene un solo dueno** y la regla del ADR 0004 (Sheets es la fuente de verdad
de los leads) sigue intacta: la hoja manda sobre `estado` y nadie mas lo toca; el CRM manda sobre
`etapa` y la hoja no la conoce. **No hay reparto que negociar**, que era el riesgo real.

Lo que este ticket construye sigue siendo lo mismo para `estado`: leerlo tal cual, agrupar
dinamicamente y poder combinar dos redacciones. Lo que cambia es que **`estado` deja de ser el
embudo**: es la clasificacion de entrada.

### Lectura de Mani de lo que significa hoy cada valor (POR VERIFICAR con el playbook de closers)

- `📞 Setteo No Calificado` → se vuelve a contactar para ver si se agenda llamada. **No es una
  salida: sigue vivo.**
- `🗑️ Descartado` → se queda almacenado.
- `📅 Con Calendly` → ya tiene llamada, solo falta cerrar.

⚠️ **Esto NO esta confirmado y cambia la conversion casi por el triple** (0,9% contra 2,6%
segun si las 2.071 personas en "Setteo No Calificado" siguen en el embudo). Mani lo marco
explicitamente como "toca verificar cuando se tenga el playbook de Closers". **No se codea una
metrica sobre esta lectura hasta que el playbook la confirme.**

### Lo que queda por definir, y sigue siendo sesion propia

**Las etapas de vida del lead.** Mani confirmo el 20-sep que hay que **traer el modelo de
HubSpot** y copiar el modelo probado en vez de improvisarlo. Sigue bloqueando este ticket.

## Done cuando

- [ ] No queda ningun valor de `estado` escrito en `lib/`, `app/` ni `components/`.
- [ ] Un valor nuevo en la hoja aparece como grupo en el dashboard **sin migracion ni despliegue**.
- [ ] Dos valores combinados cuentan como uno solo en el embudo, y se pueden separar otra vez.
- [ ] Las 4.633 personas con `estado` en `raw` quedan clasificadas sin correr un sync.
- [ ] Una persona que desaparece de la hoja cambia de categoria y **sigue existiendo**.
