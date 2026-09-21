---
id: 088
etapa: E5
serves: "plan v2 §12.4 · la metrica que pidio Media"
depends: [049, 052, 085]
status: todo
---

# 088 — Registros vs agendas por canal: la vista de Media

## Objetivo

Contestar la metrica que pidio Media: cuantos **registros** trae cada canal contra cuantas **agendas**
produce. Ejemplo que puso Alejo: *TikTok trae muchos registros y pocas agendas.*

## Lo bueno: el modelo ya lo soporta, sin agregar una columna

```
Registro = una fila de submissions        todo el que lleno el Typeform
Agenda   = un deal que alcanzo la etapa 4  (Agendado)
El puente = deals.submission_origen_id     ya esta en el esquema (ADR 0037)
```

`submission_origen_id` se puso para saber de que envio nacio un deal. Resulta que es la llave que
permite dividir agendas entre registros **por UTM**.

## ⚠️ El detalle que hace honesta la cuenta

El ticket **052** decide que un `estado` Descartado o vacio **no crea deal**. Por eso **el denominador
sale de `submissions`, no de `deals`**. Si sale de deals, la tasa de calificacion de TikTok daria
**100%** y el ejemplo que Alejo puso a mano desapareceria de la pantalla.

## Alcance

- **Dentro:** registros, agendas y **tasa de calificacion** agrupadas por `utm_source / utm_medium`, y
  por area via el emparejador (ticket 085).
- **Dentro:** **`sin UTM`** y **`(sin clasificar)`** visibles y **separadas**, con conteo y porcentaje.
- **Dentro:** todo **dentro de un programa**. El tipo de la consulta no admite cruzarlos (ADR 0043).
- **Fuera:** costo. Media es organica: ahi no hay CPL (ADR 0045 punto 7).

## Done cuando

- [ ] El denominador sale de `submissions` y hay un test que falla si alguien lo mueve a `deals`.
- [ ] Un canal sin agendas muestra **0%**, no se esconde.
- [ ] Las dos categorias de huerfano aparecen **por separado**, con su conteo.
- [ ] La consulta **no compila** si se le pide sin programa.

## Kiro

Si.
