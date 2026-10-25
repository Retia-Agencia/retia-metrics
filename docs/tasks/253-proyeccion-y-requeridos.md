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

### Cerrado el 24-oct (noche)

1. El test que fallaba tenía mal la cuenta, no era React: 10 vendidas + 0,5/día × 10 días = **15**, no 20 (el
   test de la fórmula ya decía 15). `proyeccion`, `paginas` y `show-por-cita`: 162 en verde.
2. **Bug encontrado en el recorrido:** un sábado o domingo, `inicioDeVentana` contaba el día de hoy como día 1 y
   "los últimos 10" quedaban en 9 hábiles. Ahora arranca desde el último hábil; test nuevo con hoy = sábado 24-oct.
3. Typecheck, lint y `npm run build` limpios.
4. **Tactical C3 en producción (solo lectura, 24-oct):** la conversión sale de la cohorte en curso con 288 personas
   con cita y 10 vendidas = **3,5%**, madurando. Con 33 ventas faltantes en 12 hábiles (2,75/día) eso pide
   **79 agendas y 199 leads por día**, contra ~18 agendas por día que entran hoy. El número es fiel al ADR 0079
   (agenda → venta cuenta toda cita ocurrida, con o sin show); los 29 shows y 3 cierres que contó Mani son el
   **% de cierre** (sobre shows), otra tasa. Decisión abierta para Mani: ver abajo.
5. Recorrido en `dev:local` (claro, oscuro, 375 px, clic en 5 · 10 · 20): sin errores de consola ni scroll horizontal.
6. A-161 a A-163 marcadas resueltas, pendiente el checkpoint.

**Decisión abierta:** ¿la cadena de la tarjeta usa agenda → venta (3,5%, y pide 79 agendas por día) o pasa por el
show (agendas → shows → ventas)? Hoy es fiel al ADR 0079; cambiarlo es una enmienda, no un arreglo.
