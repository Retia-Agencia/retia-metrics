---
id: 253
etapa: hub
serves: "docs/hub.md H-10, §5.2 (ritmo, proyección, ventas, agendas y leads requeridos) · el reporte del 9 y del 15-sep"
depends: [252, 262]
status: en main
---

# 253 — La proyección y lo que hace falta por día

## Objetivo

Que Hoy diga, por programa y cohorte: "a este ritmo cierras en X de Y", y cuántas ventas, agendas y leads por día
hábil hacen falta para llegar, con el supuesto que usa a la vista.

## Alcance

- **Dentro:** las fórmulas de `docs/hub.md` §5.2 (ritmo, proyección, ventas requeridas, agendas requeridas, leads
  requeridos), cada una en un módulo de `lib/queries/` sobre la capa de hechos (262).
- **Dentro:** el reparto de lo que falta por semana que queda (el bloque "Meta para llegar a 50, desde mañana" del
  reporte: resto de esta semana, cada semana siguiente, los días sueltos del final).
- **Dentro:** los dos supuestos abiertos (PQ3, `plan.md` §7 E, HQ-5) entran como parámetros con un valor por defecto
  escrito en la pantalla: la **ventana del ritmo** (por defecto, los últimos 10 días hábiles) y la **conversión agenda →
  venta** (por defecto, el objetivo declarado de la cohorte (122) y, sin él, la de la cohorte anterior completa sobre
  el mismo grupo, ADR 0079). Cuando se decidan, se cambia el valor, no el código.
- **Dentro:** los leads requeridos llenan el lugar de "Leads contra su meta" de Hoy; `cohorts.meta_leads_dia` (vacía en
  todas) queda como meta declarada opcional que, si existe, se muestra al lado de la derivada.
- **Fuera:** el reparto por área (124).

## Done cuando

- [ ] Con una cohorte armada a mano, cada cifra cuadra con un cálculo hecho aparte, con test.
- [ ] Una cohorte sin ventas o sin conversión muestra "—" con la razón, nunca 0 ni infinito (ADR 0067).
- [ ] La pantalla dice qué ventana y qué conversión usó.

## Seguimiento 24-oct: que la tarjeta se entienda (A-161 a A-163)

Mani recorrió Hoy en Tactical (C3) y la tarjeta no se entendía. Rama `claude/proyeccion-legible-40b767`, **a medio
terminar** (ver "Para retomar").

**Decidido y construido en la rama:**

- **Título "Proyección"** y la tarjeta como cadena: *"Llevamos X ventas por día → a este ritmo cerramos C3 en P de 50
  cupos"*, y debajo *"Para llegar a 50 faltan N ventas, y hacen falta por día hábil: ventas → agendas → leads"*, cada
  paso con su relación escrita (`N ventas ÷ D días hábiles hasta el cierre`, `25% de las agendas termina en venta
  (de dónde sale)`, `20% de los leads agenda (A agendas de L leads, rango)`).
- **Conversión agenda → venta, tres fuentes en orden** (`elegirConversion`): el objetivo declarado de la cohorte; la
  **medida** en la cohorte anterior; la **medida** en la cohorte en curso. Las dos medidas son la del ADR 0079
  (`grupoDeCitas` de `lib/queries/tasas-del-grupo.ts`: personas con cita ocurrida que hoy están vendidas ÷ personas
  con cita), sobre el rango de ventas de esa cohorte, y solo valen con **al menos 20 personas con cita**
  (`MUESTRA_MINIMA_CONVERSION`: con 20, una venta mueve la tasa 5 puntos) y alguna venta. La de la cohorte en curso
  dice en pantalla que puede subir mientras madura (ADR 0079 punto 5). No contradice ningún ADR: el 0079 da la
  definición y el 253 ya dejaba la conversión como parámetro con valor por defecto.
  - Cambia la fórmula de la cohorte anterior: antes era ventas ÷ agendas de los hechos (dos grupos distintos, lo que
    el 0079 prohíbe); ahora es el grupo del 0079. La cohorte anterior la elige `cohorteAnterior`
    (`lib/objetivos/cohorte-anterior.ts`), la misma de Programa, ya no un `estado = cerrado` propio.
  - Ojo: el objetivo `conversion_agenda_venta` **no se puede fijar desde la pantalla** (`lector: null` en
    `lib/objetivos/metricas.ts`), por eso ninguna razón le dice a gerencia "fíjalo".
- **Cada "—" con razón en palabras de gerencia y qué hacer** (sin cohorte, sin ventas en la ventana, sin muestra,
  sin ventas en el grupo, cohorte cerrada, sin leads o sin agendas). Nada de "mayor que cero" ni "ventana de ritmo".
- **Ventana ajustable por URL**: `?ritmo=5|10|20` (`ventanaRitmoDeUrl`, zod; cualquier otro valor vuelve a 10).
  Botones 5 · 10 · 20 en la línea que explica el ritmo (*"Ritmo: V ventas en D días hábiles (rango). Contar los
  últimos 5 · 10 · 20 días hábiles"*). Si la venta empezó dentro de la ventana, se recorta y lo dice.
- **"Cómo repartir las N ventas que faltan"** con fechas reales: *"Lo que queda de esta semana · 22 al 23 oct"*,
  *"Semana del 26 al 30 oct"*, *"Última semana, hasta el cierre · 2 al 4 nov"*.

**Archivos tocados:** `lib/queries/proyeccion.ts`, `components/dashboard/proyeccion.tsx`, `tests/proyeccion.test.ts`;
y el cableado mínimo de `?ritmo=`: `lib/queries/vista-hoy.ts` (pasa `ventanaRitmo` y `ahora`),
`components/dashboard/hoy.tsx` (prop `ventanasRitmo`) y `app/(app)/p/[programa]/hub/page.tsx` (lee `?ritmo=` y arma
los tres enlaces con `urlConSeccion`). La sesión del periodo y la barra del Hub también toca `page.tsx`: revisar
conflicto al unir.

### Para retomar

1. Typecheck limpio. `npm test -- tests/proyeccion.test.ts`: 13 de 14 pasan. Falla
   *"dice ritmo, cierre y lo que hace falta"* en el regex `/cerramos C4 en.*>20<.* de 30 cupos/`: casi seguro React
   mete `<!-- -->` entre textos; ajustar el test a lo que de verdad pinta, no la tarjeta.
2. Correr `tests/paginas.test.ts` y `tests/show-por-cita.test.ts` (tocan `armarVistaDeHoy` y la página).
3. Lint y `npm run build` (la tarjeta no es cliente, pero `hoy.tsx` y la página cambiaron). El worktree ya tiene
   `npm ci` hecho (le faltaba `echarts`).
4. Medir Tactical C3 en producción **solo leyendo**: cuántas personas con cita tiene el grupo desde el inicio de
   ventas y cuántas vendidas, para saber si la tarjeta ya muestra agendas y leads o sigue en "—" con la razón de la
   muestra. Mani contó el 24-oct 29 shows y 3 cerradas desde el 28-sep: con eso pasaría la muestra (≈10%).
5. Recorrido en `npm run dev:local`: claro, oscuro y 375 px, clic en 5 · 10 · 20, captura.
6. Commit en la rama y cerrar A-161 a A-163 en `docs/anotaciones.md`; `docs/metricas.md` §3.4 ya está al día.
