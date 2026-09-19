# 0032 — El estado del lead es una categoria de la hoja, no un enum del codigo

**Fecha:** 2026-09-19 · **Estado:** aceptado (Mani, 19-sep) · **Implementacion:** ticket 034, en su
propia sesion · **Aplica:** ADR 0012 · **Reemplaza la propuesta previa de F-01**

## El problema

`estado` es la columna con la que el negocio clasifica sus leads en la hoja. El sync la lee y **la
descarta**: esa es la deuda F-01, abierta desde agosto.

La solucion que estaba propuesta en el tracker era **traducir** los valores de la hoja a un enum
nuestro (`🗑️ Descartado` → `descartado`, `📞 Setteo No Calificado` → `cola_setteo`, ...). **Mani la
rechazo el 19-sep** y tiene razon: esa traduccion es una lista fija escrita en el codigo, o sea
exactamente lo que el ADR 0012 prohibe. El dia que el equipo agregue `Reagendado` en la hoja, la
base **rechaza la fila con un error** y hay que tocar codigo y migrar para admitir una palabra.

## Lo que se midio antes de decidir (`production`, 19-sep)

- **`people.estado` es decorativo.** Las **4.688** personas estan en el valor por defecto,
  `cola_setteo`. El enum nunca ha guardado un dato real.
- **Nadie DECIDE nada con esa columna.** El unico lector en todo el codigo es
  `lib/queries/personas.ts:229`, y solo la proyecta. No hay un `if` ni un `where` que dependa de
  su valor. Es una instancia disfrazada de tipo: el caso de libro del ADR 0012.
- **El dato de la hoja YA ESTA en la base**, en `people.raw`, para **4.633** personas. La
  migracion no necesita re-sincronizar nada.
- **Las categorias reales, contadas hoy:**

  | programa | valor en la hoja | personas |
  |---|---|---|
  | comunicarte | `🗑️ Descartado` | 919 |
  | comunicarte | `📞 Setteo No Calificado` | 768 |
  | comunicarte | `📅 Con Calendly` | 294 |
  | tactical-investor | `📞 Setteo No Calificado` | 1.303 |
  | tactical-investor | `🗑️ Descartado` | 1.029 |
  | tactical-investor | `📅 Con Calendly (Juanito)` | 319 |
  | tactical-investor | `Cerrado` | 1 |

- 🎯 **El caso que justifica "combinar" aparecio solo, sin buscarlo:** `📅 Con Calendly` y
  `📅 Con Calendly (Juanito)` son **la misma categoria** escrita distinto en dos programas. Sin la
  funcion de combinar, el embudo mostraria dos grupos donde hay uno.

## Decidimos

**1. El estado se guarda COMO VIENE. Nada hardcoded** (Mani, 19-sep, textual).

Ni traduccion, ni enum, ni lista de valores conocidos en el codigo. La ortografia de la hoja es
suya, igual que con el `closerId` (ADR 0004, ADR 0030).

**2. `people.estado` deja de ser `pgEnum` y pasa a texto.** Los seis valores
(`descartado · cola_setteo · invitado · show · cierre · perdido`) desaparecen del codigo. Es
barato: nunca tuvieron un dato.

**3. El agrupamiento es DINAMICO: se lee que valores existen y se agrupa por ellos.** Una
categoria nueva en la hoja aparece sola en la pantalla, sin migracion y sin desplegar.

**4. Combinar es un acto HUMANO sobre datos, no una normalizacion automatica.**

Es el mismo problema del ADR 0030 —dos textos que son la misma cosa— pero **no se resuelve igual**,
y la diferencia importa: alli las variantes eran de mayusculas y espacios, o sea derivables por una
regla. Aqui `Con Calendly` y `Con Calendly (Juanito)` no se derivan de ninguna regla: **solo una
persona sabe que son lo mismo**. Por eso la union la decide un humano y se guarda como DATO (una
fila que dice "este valor pertenece a esta categoria"), nunca como una funcion de normalizacion.

**5. "Desaparecio de la hoja" es una categoria mas** (Mani, 19-sep), y con eso se cierra F-06:
**nunca se borra una persona**, solo cambia de categoria. Lo que falta construir es la DETECCION
—que el sync note que alguien dejo de venir en la hoja—, no el borrado.

## Consecuencias

- **A favor:** el negocio agrega una clasificacion en su hoja y la app la refleja sin tocar codigo.
  Es el criterio 4 de la spec aplicado a una columna mas.
- **A favor:** el radio en codigo es minimo (un enum, una columna, un `select`), asi que el riesgo
  esta casi todo en la migracion y no en la logica.
- **A favor:** la parte de arriba del embudo (lead → descartado / setteo / invitado) deja de estar
  vacia, y se puede poblar desde `raw` sin esperar una corrida de sync.
- **En contra:** una columna de texto libre acepta erratas. Es el riesgo de fondo del ADR 0011, y
  aqui se acepta a sabiendas: **combinar es justamente la herramienta para repararlas**, en vez de
  una reja que las impida y que obligaria a tocar codigo.
- **En contra:** sin enum, la base ya no garantiza que el valor sea de una lista. La garantia que
  importa (que dos escrituras del mismo grupo cuenten juntas) pasa a vivir en la tabla de
  categorias, no en el tipo de la columna.

## Lo que queda abierto para el ticket 034

- Donde vive la union: tabla de categorias con sus valores crudos asociados. **La forma exacta se
  decide con la pantalla delante**, no aqui.
- Que hace el sync cuando aparece un valor que nadie ha clasificado: la opcion natural es que
  aparezca como su propio grupo, sin pedir permiso, y que combinarlo sea opcional.
- Si las categorias son por programa o globales. Los datos de arriba sugieren **por programa**
  (cada hoja tiene su redaccion), pero eso choca con querer un embudo comparable entre programas.
  **No se decide de paso.**
