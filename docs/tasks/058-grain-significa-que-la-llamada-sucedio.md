---
id: 058
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-2 · insumo §2.5, ADR 0037"
depends: [057]
status: todo
---

# 058 — Pegar el link de Grain **es** decir que la llamada sucedio

## Objetivo

Quitarle al closer un formulario y sustituirlo por el gesto que ya hace: pegar el link de la
grabacion.

Pegar el Grain pone `resultado = show`, llena `fecha_llamada` si estaba vacia, y mueve el deal a
**Atendido**. Los tres, juntos, en una sola operacion.

## Por que esto no es azucar

Es la regla de "cero error humano en los campos" (insumo §1.3) aplicada al campo que mas se
olvida. El `show` teclease a mano es el dato del que sale el **% de show**, que es la metrica que
el equipo mira todos los dias: derivarlo de un hecho verificable (existe la grabacion) en vez de
una casilla es la diferencia entre una cifra y una opinion.

## Alcance

- **Dentro:** la mutacion, con su movimiento de etapa **por `moverEtapa()`** y su fila de
  `change_log`.
- **Dentro:** que pasa si el link se quita o se corrige. **Quitar el Grain NO devuelve el deal a
  Agendado por su cuenta**: es un retroceso y pasa por el motor, con motivo (ticket 047).
- **Fuera:** Grain por API e insights de llamadas. Fase posterior.
- **Fuera:** validar que el link sea de Grain de verdad. Un formato razonable basta; una reja que
  rechace un link valido de otra herramienta cuesta mas de lo que protege.

## Done cuando

- [ ] Pegar el Grain deja `show`, fecha y deal en Atendido, en una operacion.
- [ ] Si la fecha ya estaba, **no se pisa**.
- [ ] El movimiento tiene su fila de `deal_etapa_historial`.
- [ ] Quitar el link no mueve nada solo.

## Kiro

Si.
