---
id: 304
etapa: envios-falsos
serves: "ADR 0105 puntos 1, 3, 6 y 7"
depends: [303]
status: todo
---

# 304 — El veredicto de cada envío y la marca Sospechoso del deal

## Por qué

La señal se calcula por envío y la marca la lleva el deal (ADR 0105 punto 1). Cada decisión humana queda guardada al
lado de lo que dijeron las reglas y la IA, para medir la precisión antes de automatizar nada (punto 3).

## Alcance

1. **Tabla de veredictos** (migración, en la cola después de la del 301): una fila por envío **o por llamada suelta**
   (exactamente uno de `submission_id` y `call_id`, con un CHECK), con las razones de las
   reglas, el veredicto de la IA (sospechoso o no, razones, modelo) o `sin_revisar_por_ia`, la hora, y la resolución
   humana (`es_real` o `anulado_por_envio_falso`, quién y cuándo). Toda escritura con rastro.
2. **Sospechoso es derivado, nunca guardado en el deal:** un deal es Sospechoso si alguno de sus envíos tiene un
   veredicto sospechoso sin resolver. La respuesta vive en UNA función de `lib/sospecha/` que agrupa aparte y une en
   memoria (sin subconsultas correlacionadas, AGENTS.md).
3. **El juicio después de guardar:** al terminar la ingesta, `after()` de Next juzga ese envío **y todo envío que haya
   quedado sin veredicto o sin revisar por IA** (sin cron, ADR 0105 punto 6). En este ticket corre solo las reglas
   (303), con el hecho del reincidente leído de la base; la IA entra en el 305. Una falla del juicio nunca toca la
   respuesta del webhook (ADR 0058).
4. **Las citas sueltas** (ADR 0105 punto 7): cuando el webhook de Calendly deja una llamada sin deal, `after()` la
   juzga igual, con el nombre, el correo, el teléfono y las respuestas del invitado de `calls.raw`. Una cita que cuelga
   de un deal no se juzga aparte. Si después la suelta se cuelga de un deal, su veredicto pasa al deal.

## Fuera

- La IA (305) y la pantalla (306).

## Done cuando

- [ ] Un envío del troll, por la ruta real del webhook, deja su veredicto y su deal sale Sospechoso; un envío normal
  no (tests).
- [ ] Si el juicio lanza, el webhook responde 200 igual y el envío queda pendiente; el siguiente envío lo recoge (test).
- [ ] Una cita suelta con el teléfono del troll (reincidente) o con un correo de relleno sale sospechosa; una suelta
  normal no (tests por la ruta del webhook de Calendly).
- [ ] Un envío ya juzgado no se juzga dos veces (test).
- [ ] typecheck, lint, los tests tocados y los guardianes.
