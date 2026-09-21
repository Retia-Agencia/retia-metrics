---
id: 087
etapa: E3
serves: "plan v2 §12.8.5 · ADR 0044 punto 6"
depends: [085, 086]
status: todo
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

- [ ] Un lead con `entrada = 'formulario'` y patron de area Comercial **NO cuenta** en el CPL, con test.
- [ ] Un lead organico de Media con `entrada = 'formulario'` **tampoco cuenta**, con test. (Antes si
      contaba: la regla vieja tambien estaba mal por este lado.)
- [ ] `grep` confirma que ninguna consulta de costo pregunta por `entrada`.
- [ ] Los tres ADR y el comentario del esquema quedan enmendados.

## Kiro

Si, con revision. La enmienda de los ADR la escribe la sesion principal.
