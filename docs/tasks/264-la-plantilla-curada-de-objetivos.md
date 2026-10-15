---
id: 264
etapa: hub
serves: "ADR 0063 · ADR 0077 (lo que no se usa se quita) · ADR 0088 (el costo en COP) · la pantalla del 122, recorrida el 14-oct"
depends: [122]
status: en curso
---

# 264 — La plantilla curada de objetivos

## Objetivo

Que quien llena los objetivos de una cohorte no tenga que preguntar qué significa cada campo: elige la métrica y le
aparece su plantilla, escrita en colores, con el valor de hoy al lado.

## Por qué

Mani, 15-oct, después de usar la pantalla del 122: "Meta" y "Aceptable" no dicen cómo llenarse, la moneda se puede
elegir aunque la decide el CRM, y aparecen métricas que nada usa. La pantalla pide pensar como el código.

## Alcance

- **Dentro: la definición de cada métrica se amplía en `lib/objetivos/metricas.ts`** (una sola fuente, tipo del
  código): nombre, una frase de qué es, sentido (más bajo o más alto es mejor), **unidad fija** (costos en COP, ADR
  0088; conteos sin unidad; ROAS y conversión como razón o porcentaje), si admite área, y **quién la lee** (el ticket
  del panel o del semáforo). La pantalla solo ofrece las métricas con un lector ya construido; hoy es una sola,
  `costo_por_agenda` (lector: 258). Las demás aparecen cuando su ticket se construye (124, 253, 123, 090).
- **Dentro: la moneda deja de ser un selector.** Se escribe al lado del campo según la unidad de la métrica. En la
  base `objetivos.moneda` se llena desde la definición, nunca desde el input (el servidor ignora una moneda que
  llegue en el cuerpo). El CHECK de la 0083 sigue valiendo.
- **Dentro: la plantilla se lee en colores.** Para "más bajo es mejor": *🟢 Verde si cuesta hasta [__] · 🟡 Amarillo
  si cuesta hasta [__] · 🔴 Rojo si cuesta más de eso*. Para "más alto es mejor": *🟢 Verde desde [__] · 🟡 Amarillo
  desde [__] · 🔴 Rojo por debajo*. En la base siguen siendo `meta` (borde del verde) y `aceptable` (borde del
  amarillo): cambia el texto, no el modelo. Una vista previa dice con un ejemplo qué color saldría con el valor de hoy.
- **Dentro: el valor de hoy al lado**, por la misma función que usará el semáforo (ADR 0024: una cifra, un módulo),
  últimos 7 días hábiles del programa. Si aún no existe esa función (258 sin construir), la plantilla dice "sin dato
  todavía" en vez de inventar uno.
- **Dentro:** el área solo aparece en las métricas que la admiten. La tabla de objetivos cargados usa las mismas
  frases ("hasta 70.000 COP verde, hasta 93.000 amarillo").
- **Fuera:** el semáforo (258), el reporte por WhatsApp (265), las métricas sin lector.

## Done cuando

- [ ] La pantalla ofrece solo `costo_por_agenda`, con su frase, su unidad escrita y los campos en colores; con test
  de la definición (cada métrica ofrecida tiene lector, unidad y sentido).
- [ ] Una moneda enviada a mano en el cuerpo de la acción se ignora: se guarda la de la definición, con test.
- [ ] Recorrido con clic: alguien que no conoce el modelo llena el objetivo sin preguntar (Mani lo valida), claro y
  oscuro, escritorio y celular, sin errores de consola.

## Notas

Sin migración: la tabla de la 0083 no cambia.
