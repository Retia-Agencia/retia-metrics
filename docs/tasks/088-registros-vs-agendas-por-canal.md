---
id: 088
etapa: E5
serves: "plan v2 §12.4 · la metrica que pidio Media"
depends: [049, 052, 085]
status: done
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


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Registro = token (ADR 0063). La agenda se ancla por el día en que se agendó (`calls.created_at`), no por el de la cita (`docs/analytics.md` §6).

---

## ✅ Construido (1-oct, sesión 67, Alejo)

- `registrosYAgendasPorCanal` en `lib/queries/registros-agendas-canal.ts`. **No define registro ni agenda:** reagrupa
  la serie de `pautaInterina` (093), donde viven las dos definiciones, por el catálogo de Canales (`resolverCanal`).
  Así esta tabla y la de Pauta no pueden discrepar: en la base local las dos dan 126 registros y 51 agendas.
- Filas: cada canal con su área, registros, agendas y tasa (agendas ÷ registros, `—` sin registros); después
  **sin clasificar**, **sin UTM** y **sin envío de origen** (una agenda cuyo deal no nació de un envío), siempre,
  aunque estén en cero. Tarjeta en el dashboard (`components/registros-agendas-canal.tsx`), con el período A.
- Done: el denominador son envíos (un registro sin deal cuenta; el test falla si se cuentan solo los que agendaron,
  mordido); un canal sin agendas sale con 0; los huérfanos por separado; `programId` obligatorio en el tipo; y el
  mismo resultado con el catálogo en otro orden. `tests/registros-agendas-canal.test.ts` (6).
- Ojo: "Agendó" del embudo del formulario (126) es el hecho del FORMULARIO (trajo link de Calendly); "Agendas" aquí son
  LLAMADAS creadas (`calls.created_at`). Son preguntas distintas y pueden diferir (50 contra 51 en la base local).
