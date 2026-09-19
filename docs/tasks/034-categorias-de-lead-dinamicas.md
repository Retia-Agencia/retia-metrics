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

## Done cuando

- [ ] No queda ningun valor de `estado` escrito en `lib/`, `app/` ni `components/`.
- [ ] Un valor nuevo en la hoja aparece como grupo en el dashboard **sin migracion ni despliegue**.
- [ ] Dos valores combinados cuentan como uno solo en el embudo, y se pueden separar otra vez.
- [ ] Las 4.633 personas con `estado` en `raw` quedan clasificadas sin correr un sync.
- [ ] Una persona que desaparece de la hoja cambia de categoria y **sigue existiendo**.
