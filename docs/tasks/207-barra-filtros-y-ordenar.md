---
id: 207
etapa: O7
serves: "docs/anotaciones.md A-107, A-110, A-111; enmienda el ticket 202 (A-105)"
depends: [202]
status: todo
---

# 207 — La barra de lista: buscar, Filtros y Ordenar

## Por qué existe

Recorrido del 8-oct (Mani + Claude, producción). La barra del 202 hizo una pieza reutilizable, pero cada
pantalla decide qué filtros van "a la vista", y el resultado es distinto en cada pestaña:

| Pantalla | Fila de hoy |
|---|---|
| Leads | buscar · Fecha · Deal · Filtros · (2.ª fila) orden · Tarjetas/Tabla |
| Deals | Fecha · Dueño · Filtros · orden |
| Calls | Closer · Resultado · Filtros |
| Students | Cohorte · Filtros |

Además: el orden cae en lugares distintos, el chip de orden se parece a un filtro, y en Deals hay un
filtro activo por defecto (**Cohorte activa**) **escondido** dentro del popover y sin contar en
"Filtros · n" (A-111). Cambiar un filtro o el orden no da ninguna señal mientras el servidor responde: en
el recorrido tardó más de 2 s y parecía que no había funcionado (A-110). Quienes usan el CRM no son
técnicos (ADR 0077): la misma barra tiene que leerse igual en todas las pestañas.

## Decisión (Mani, 8-oct)

Una sola forma, en todas las pantallas que usan `BarraDeLista`:

**`[ Buscar ]  [ Filtros · n ]  [ Ordenar: <vigente> ]  ……  [ acciones de vista ]`**

- **Todos** los filtros, incluido el de fecha, van dentro de **Filtros**. Desaparece la decisión
  `aVista` por pantalla.
- **Filtros · n** cuenta todo filtro con un valor distinto de "todos", **también los que vienen por
  defecto** (la cohorte activa cuenta y se ve): una lista filtrada siempre lo dice.
- Debajo, la línea de estado de siempre: el conteo y un chip por filtro activo con ×, y "Quitar todo". Es lo
  que deja ver qué está aplicado sin abrir nada.
- **Ordenar** es un botón propio con su ícono, siempre en el mismo lugar, solo donde la pantalla lo
  declara.
- Mientras la URL cambia y el servidor responde, la lista se atenúa y el botón tocado muestra que está
  cargando.
- **Excepción, una sola:** el selector de periodo A contra B del Dashboard (ADR 0067) no es un filtro, es el
  marco de la comparación, y sigue fuera del popover.
- Los nombres de los parámetros de la URL no cambian (enlaces guardados y "Volver" siguen funcionando).

## Done cuando

- [ ] Las 10 pantallas que usan `BarraDeLista` muestran la misma fila; ninguna declara `aVista`.
- [ ] El filtro por defecto de Deals cuenta en "Filtros · n" y sale como chip.
- [ ] Señal de carga al cambiar filtro u orden.
- [ ] Tests de la declaración (conteo con valores por defecto); typecheck, lint y build limpios.
- [ ] Recorrido en producción: abrir cada popover y cada orden en las 10 pantallas, sin errores en consola.
