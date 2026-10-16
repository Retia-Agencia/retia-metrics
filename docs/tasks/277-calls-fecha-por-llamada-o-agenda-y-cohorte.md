---
id: 277
etapa: llamadas
serves: "Bajar los Grain de una semana de llamadas, de una semana de agendas o de una cohorte (Mani, 16-oct, tras el recorrido del 275)"
depends: [275]
status: done
---

# 277 — Calls: fecha por llamada o por agenda, y filtro de cohorte

## Por qué

En el recorrido del 275, el filtro Desde/Hasta de Calls usaba la fecha de la cita y la columna del CSV mostraba la de la
llamada. Una llamada reagendada caía fuera de "la última semana" aunque hubiera ocurrido esa semana. Mani pidió dos
formas de filtrar por fecha, y además poder filtrar por cohorte. "Todas las del programa" ya existe: es Calls sin
filtros.

## Qué

Cambia la lista de Calls **y** el export (comparten `filtroDeLlamadasDesdeUrl`, así que salen iguales).

### Decisiones

1. **Dos fechas, un selector.** Nuevo parámetro `?fecha=` con dos valores (lista blanca con zod, cualquier otro valor
   cae al de por defecto):
   - `llamada` (**por defecto**): el día en que se tiene la llamada = `fechaLlamada ?? fechaAgenda`. Si ocurrió, cuenta
     el día en que ocurrió; si todavía no, el de la cita.
   - `agenda`: el día en que se agendó = `calls.createdAt` (la fila nace cuando llega la cita de Calendly o cuando el
     closer la registra). Ojo: en las llamadas trasladadas de la hoja (`origen = 'sheets'`) es la fecha del traslado,
     no la de la agenda. Se acepta así y se documenta en el comentario.
   El día se calcula con `diaDeCalendario` (Bogotá), como hoy. Desde/Hasta aplican a la fecha elegida.
2. **El orden "Llamada" usa la misma fecha que el filtro `llamada`** (`fechaLlamada ?? fechaAgenda`; hoy es al revés en
   `compararLlamadas`). "Creación" sigue siendo `createdAt`. Una sola función `fechaDeLaLlamada(fila)` en
   `lib/queries/llamadas.ts` responde "¿qué día es esta llamada?" para el filtro, el orden y la columna del CSV.
3. **Filtro de cohorte:** `?cohorte=<id>` sobre la cohorte **del deal** (`deals.cohortId`), la misma que usan Students
   y el dashboard, no `calls.cohortId`. Las opciones salen de `listarCohortes(db, programa.id)` (como en Students),
   ordenadas igual que allí. Una cohorte de otro programa no casa con nada (el programa es frontera): la lista sale
   vacía, sin error.
4. **UI:** en el popover de compuestos de `BarraDeLista`, arriba de Desde/Hasta, un control "Fecha por: Llamada /
   Agendada" (el mismo patrón de select de URL que usa la barra). Cohorte va como filtro declarado `select` junto a
   Closer y Resultado, visible para todos los roles que ven Calls. `fecha` y `cohorte` entran en `clavesCompuestas` /
   filtros activos para que se vean y se quiten con ×.
5. **CSV:** la columna `Fecha llamada` pasa a ser `fechaDeLaLlamada` y se agrega `Fecha agendada` (`createdAt`, con
   `fechaHoraEnBogota`) justo después. Agregar también `Cohorte` (nombre o código, lo que muestre Students) antes de
   `Link Grain`.
6. Nada de esto toca métricas: es la lista operativa y su export.

## Done cuando

- Tests de `filtroDeLlamadasDesdeUrl`/`llamadasDelPrograma`: una llamada agendada el 2-oct para el 6-oct y ocurrida el
  9-oct entra con `fecha=llamada` en 9-oct y no en 6-oct; con `fecha=agenda` entra en 2-oct. Valor desconocido de
  `fecha` = `llamada`. Cohorte filtra por la del deal; cohorte ajena = vacío. El orden "Llamada" sigue
  `fechaDeLaLlamada`.
- `tests/csv-grain.test.ts` y `tests/grain-csv-route.test.ts` al día con las columnas nuevas y los dos parámetros.
- Typecheck, lint, tests del cambio y `tests/paginas.test.ts` limpios.
