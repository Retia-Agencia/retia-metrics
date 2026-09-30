---
id: 087
etapa: E3
serves: "plan v2 §12.8.5 · ADR 0044 punto 6"
depends: [085, 086]
status: done
---

# 087 — 🩸 El CPL deja de preguntar por `entrada`

## Objetivo

Arreglar la regla que el ticket 086 rompe en el mismo movimiento en que la rompe.

## El problema que crea el enlace del closer

El ADR 0021 dice —y el comentario de `lib/db/schema.ts` lo repite— que *"el CPL usa solo las del
formulario, porque la pauta solo paga esas"*. Esa regla se apoya en `entrada`, que tiene dos valores:
`formulario` y `crm`.

**Con el enlace del closer, un lead de Comercial entra por el formulario.** Desde ese momento
`entrada = 'formulario'` **deja de significar "lo pago la pauta"**, y el CPL empieza a dividir la
inversion de Meta entre leads que Meta no trajo: **el costo por lead sale mas barato de lo que es y una
campana mala se ve aceptable.** Sin lanzar un error.

## Alcance

- **Dentro:** el denominador del CPL pasa a **la clasificacion del UTM**: cuenta los leads cuyo patron
  resuelve al area **Pauta** (ticket 085).
- **Dentro:** enmienda anotada en el **ADR 0021** y en el **ADR 0037**, que repite la regla, y en el
  comentario de `lib/db/schema.ts`.
- **Dentro:** `entrada` sobrevive, pero **deja de ser la llave del CPL**: pasa a decir solo por donde
  entro el lead.
- **Fuera:** el CPL por rebanada, que es el ticket 090.

## ⚠️ La regla que no se rompe

**Este ticket va con el 085, nunca despues.** Separadas, la pantalla del CPL y la clasificacion darian
cifras distintas sobre lo mismo, que es exactamente la herida del ADR 0024.

## Done cuando

- [x] Un lead con `entrada = 'formulario'` y patron de area Comercial **NO cuenta** en el CPL, con test.
- [x] Un lead organico de Media con `entrada = 'formulario'` **tampoco cuenta**, con test. (Antes si
      contaba: la regla vieja tambien estaba mal por este lado.)
- [x] `grep` confirma que ninguna consulta de costo pregunta por `entrada`.
- [x] Los tres ADR y el comentario del esquema quedan enmendados.

## Kiro

Si, con revision. La enmienda de los ADR la escribe la sesion principal.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Sin cambio de fondo: el denominador del CPL es el área Pauta. Se suma que un registro es un **token**, no una fila (ADR 0063): el parcial y su completa cuentan una vez.


---

## Cierre 2026-09-30 (sesión 55, Mani)

**Se cerró sin código de costo, porque no había costo que arreglar.** Medido al tomarlo: ninguna consulta calcula
un CPL, `ad_spend` estaba vacía y nadie la leía (el 120 la retira). La regla vieja vivía solo en dos comentarios
(`lib/db/schema.ts` sobre `leads.entrada` y `components/historial-persona.tsx`), que se corrigieron.

- **Los criterios, cumplidos así:** los dos casos (lead de Comercial y orgánico de Media con `entrada =
  'formulario'`) no pueden contar porque el área la decide `emparejar` (085), que los manda a su canal; su test
  vive en `tests/atribucion-emparejador.test.ts`. El test del costo con esos leads lo escribe el 123, que es
  donde nace la consulta. `grep`: ninguna consulta de costo lee `entrada` (la única lectura es `leadsDelRango`,
  meta de leads, que no es costo).
- **ADR:** el 0021 está retirado; la regla vive en el **0044 punto 5**, enmendado con el cierre. El 0037 no la
  repite. `docs/analytics.md` §6 ya tenía la fórmula ("costo por X = gasto del área ÷ X del área").
- **Decisión de Mani:** la meta de leads por día (`leadsDelRango`) sigue contando `entrada = 'formulario'`: es
  cumplimiento de meta, no costo. Si con los objetivos por área (122) esa meta pasa a ser por área, se revisa ahí.
- **Queda para el 123:** el denominador por token y por área con `emparejar`, y los dos tests de arriba sobre
  la consulta real.
