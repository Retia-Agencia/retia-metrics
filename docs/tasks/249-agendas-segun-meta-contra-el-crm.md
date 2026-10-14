---
id: 249
etapa: hub
serves: "ADR 0088 punto 2 · docs/hub.md §2.4 (CA: Meta 51 contra CRM 35), §5.2 (diferencia Meta contra CRM) · runbook-meta-vs-forms del vault, hecho producto"
depends: [120, 123]
status: todo
---

# 249 — Las agendas según Meta contra las del CRM: el control

## Objetivo

Que el Hub diga, por campaña y semana cerrada, cuántas agendas contó Meta y cuántas el CRM, la diferencia en número
y en %, y por qué puede ser, para que nadie decida pausar o subir una campaña con el número equivocado.

## Alcance

- **Dentro:** en Hub › Pauta, una tabla por programa y campaña: semana cerrada (terminó hace tres días o más), agendas
  según Meta, agendas del CRM de esa campaña (por el envío que abrió el deal, ADR 0060), diferencia en número y %, y
  su tono: menos de 10% normal, de 10% a 40% revisar, más de 40% rojo (ADR 0088).
- **Dentro:** la explicación que el CRM puede dar sola, como desglose de la diferencia: llamadas sueltas de Calendly
  sin deal, agendas de deals cuyo envío de origen es orgánico o sin UTM, deals con varias citas.
- **Dentro:** la semana en curso se muestra marcada "abierta", nunca con tono.
- **Fuera:** corregir nada en Meta o en el pixel; eso es una acción (257) que alguien toma con esta cifra.

## Done cuando

- [ ] Con un árbol y unas agendas armados a mano, la diferencia y su tono dan lo esperado, con test.
- [ ] La semana del 9 al 13-oct en CA reproduce lo medido a mano el 14-oct (51 contra 35) o explica por qué cambió
  (nota de cierre).
- [ ] Cada cifra abre su lista: las citas del CRM y, del lado de Meta, la fila de insights.
