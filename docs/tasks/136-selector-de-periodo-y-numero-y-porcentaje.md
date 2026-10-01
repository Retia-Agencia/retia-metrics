---
id: 136
etapa: NC1
serves: "ADR 0067 puntos 1 a 4 · comercial.md GC-36, GC-37, GC-38, §9.4"
depends: []
status: done
---

# 136 — Un selector de periodo A contra B, y número y porcentaje en toda cifra

## Objetivo

Que toda cifra del CRM se pueda comparar contra el periodo que el usuario elija, y que siempre diga cuánto
cambió en número y en %.

## Alcance

- **Dentro:** `lib/periodo.ts` (o dentro de `lib/format.ts` si es corto): de un atajo o dos rangos a `{ a, b }`
  en fechas de Bogotá, con `hoyEnBogota()` y nunca `new Date(a, m, d)`. Atajos: hoy, ayer, mañana · esta
  semana, semana pasada (lunes a domingo) · este mes, mes pasado · cohorte actual, cohorte anterior (ventana
  de venta, ADR 0022). B por defecto = **el mismo punto del periodo anterior por día hábil** (reusar la cuenta
  de días hábiles que ya existe; no escribir otra). Puro y con tests de bordes (fin de mes, lunes, mes con 4 y
  con 5 semanas, cohorte sin anterior).
- **Dentro:** el periodo en la URL (`?a=...&b=...` o `?periodo=este_mes`), parseado con zod en el borde.
- **Dentro:** el componente del selector (Tinta, `structure.md` §9), un solo control para dashboard y listas.
- **Dentro:** la regla de número y %: una función que da `{ actual, anterior, delta, deltaPct }` con `deltaPct`
  `null` si la base es 0 (se escribe "—"), y el componente que la pinta (*"358 → 4 · −354 · −99%"*). Todo
  porcentaje con su base (*"50% de 12"*). Formato por `lib/format.ts`.
- **Dentro:** varias series de una dimensión en la misma gráfica (GC-37) sobre `serie.ts` (089), ejes lineales.
- **Dentro:** el contrato en `structure.md` §9 y una fila en `AGENTS.md` §Contratos.
- **Fuera:** cablear cada gráfica del dashboard (095); las listas con filtros relativos (141).

## Done cuando

- [x] "Este mes" el día hábil 7 compara contra los 7 primeros días hábiles del mes anterior (test).
- [x] A las 8 pm de Bogotá "hoy" sigue siendo hoy (test con reloj fijado en UTC del día siguiente).
- [x] Un porcentaje con base 0 sale "—".
- [x] El selector abre, cambia la URL y la página recarga con el periodo (recorrido visual, consola).

## Cierre (1-oct-2026, Alejo)

Implementó Codex en un worktree; revisó Claude (pidió el estilo del repo y unificar las dos búsquedas de
hábiles en `diaQueCompletaHabiles`). Contrato, URL y decisiones en `docs/structure.md` §9. A alimenta las
consultas existentes del dashboard; B se resuelve y se muestra sin cablear KPI ni gráficas (095). La gráfica
de varias series (SVG propio) queda sin montar. Sin paquetes ni migraciones.

Validación: suite completa 1.777 en verde, typecheck, lint y build limpios. **Recorrido visual** contra la
base local (`dev:local`, usuario developer): el selector abre, cada atajo cambia la URL (`?periodo=este_mes`)
y la página recarga con A en las cifras y B en el disparador; los rangos libres van a
`?periodo=custom&a_desde…&b_hasta`; claro y oscuro; consola sin errores. Hoy (jue 1-oct) compara contra el
30-sep; "este mes" el 1-oct contra el 1-sep; "semana pasada" (21 al 27-sep) contra los 5 hábiles del 14 al
18-sep. El recorrido destapó que el disparador del atajo pintaba el valor crudo (`hoy`): arreglado con `items`.
A 390 px no hay desborde horizontal y el disparador parte su texto, pero el zoom no activó el diseño móvil en
esa ventana: falta mirarlo en un teléfono de verdad.

Fuera, para quien siga: sin cohorte activa, "Cohorte anterior" no se ofrece aunque haya cohortes pasadas.

## Codex

Sí, esfuerzo `medium`.
