---
id: 116
etapa: E6
serves: "ADR 0062 puntos 2 y 7 · docs/analytics.md PT-14, PT-16, PT-17, PT-18"
depends: []
status: en curso
---

# 116 — Las UTM completas en el envío: `utm_id`, `utm_content` y `utm_term`

## Objetivo

Que cada envío guarde en columnas las seis UTM de la plantilla de Pauta, para que el emparejador (085) y
el cruce con el gasto de Meta (120) las lean sin abrir `respuestas`.

## 🩸 Lo medido el 29-sep

`utm_content` y `utm_term` **ya llegan**, pero viven en `submissions.respuestas` (6.911 envíos de la hoja y
101 del webhook); sus columnas están vacías y marcadas "deliberadamente sin leer". `utm_id` no llega:
Typeform no tiene ese campo oculto (tarea O-1 de `docs/analytics.md` §7, sin código).

## Alcance

- **Dentro:** migración aditiva (la genera y aplica la sesión principal): `submissions.utm_id` (texto). En
  la **misma** migración, rellenar `utm_content`, `utm_term` y `utm_id` desde `respuestas` de la misma fila
  (determinista, SQL leído antes de aplicarlo).
- **Dentro:** el adaptador de Typeform y el de la hoja escriben las seis UTM en sus columnas, y dejan de
  duplicarlas en `respuestas` (ADR 0036: lo promovido no se repite).
- **Dentro:** corregir el comentario del esquema sobre `utmTerm` y `utmContent`.
- **Dentro:** el valor se guarda **como llegó**, incluida una macro sin expandir (`{{ad.name}}`): la
  interpreta el emparejador (085, DP-21), no la ingesta (ADR 0004).
- **Fuera:** leer o interpretar las UTM (085), el árbol de Meta (120).

## Las reglas

- Orden de despliegue: la migración aditiva va a producción **antes** que el código que la usa (handoff,
  sesión 51: se perdieron envíos por el orden inverso).
- El relleno toca solo las columnas nuevas o vacías; nunca reescribe una UTM que ya estaba.

## Done cuando

- [ ] Un envío por webhook con las seis UTM las deja en sus columnas y no en `respuestas`, con test.
- [ ] Después del relleno, `count(utm_content)` coincide con los envíos que la traían en `respuestas`
      (consulta guardada en la nota de cierre).
- [ ] Un envío con `{{ad.name}}` lo guarda tal cual, con test.
- [ ] `npm test`, `typecheck`, `lint` y `build` limpios.

## Kiro

Sí para el adaptador y los tests. La migración y el relleno en producción, la sesión principal con el ok de
Mani.
