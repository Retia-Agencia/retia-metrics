# 0115: Las reglas de norte de las métricas

- **Estado:** aceptado · 30-oct-2026 (Mani, tras la auditoría de métricas). Se construye en los tickets
  351 a 362.
- **Sale de:** `docs/auditoria-metricas-2026-10-30.md`, que encontró unos 90 hallazgos con nueve causas raíz (§2).
- **Confirma:** ADR 0024 (una cifra, una definición) y lo extiende de dinero a todo concepto; ADR 0067 (toda cifra abre
  su lista); ADR 0077 (cada dato en la pantalla de su objeto, lo que no se usa se quita).
- **Enmienda:** la frase de `docs/metricas.md` "si el código y este documento discrepan, manda el código" queda
  acotada por N8: el código manda sobre **qué hace hoy**; sobre **qué debería hacer** manda el ADR vigente.

## Contexto

El 30-oct el CRM mostraba un ROAS ×2,2 del real, un % de show medido sobre una de cada cinco citas, una comisión corta en
un 40 % y dos cifras distintas para "vendidos de la cohorte" en la misma pantalla, con la suite en verde. Ninguna fórmula
estaba mal escrita: cada pregunta tenía varias respuestas, cada una probada sola, y la pantalla no distinguía una cifra
completa de una a medias. Las reglas duras de `AGENTS.md` protegen el dinero, la vigencia y la frontera del programa;
nada protegía el resto de los conceptos, la cobertura del dato ni el vocabulario.

## Decisión

Nueve reglas. Cada una dice qué se enforza y dónde; una regla sin guardián es una creencia.

| # | Regla | Qué significa en la práctica | Guardián (ticket que lo construye) |
|---|---|---|---|
| N1 | **Un concepto, un módulo.** | Venta, show, no show, cita sin resultado, agenda, registro, lead, "sin UTM", ancla de fecha de cada hecho, gasto convertido y calendario tienen **una** función en SQL y su gemela en TypeScript, en el módulo que nombra la tabla "Conceptos" de `docs/metricas.md` §0. Una pantalla, una lista, una alerta o el mensaje de WhatsApp **importan**; nunca vuelven a escribir el predicado. Dos preguntas distintas son dos funciones con dos nombres (`showPorDeal`, `showPorCita`), nunca la misma palabra | un guardián por concepto en el molde de `tests/vigencia-centralizada.test.ts`, mordido en los dos sentidos (352, 353, 354) |
| N2 | **Paridad probada.** | Si dos lugares muestran la misma cifra, un test arma el caso que las haría divergir (una venta que luego se pierde, una reagenda, un parcial sin fecha, un deal anulado con llamadas vigentes) y compara las dos salidas. La gemela SQL y la TypeScript se comparan **ejecutándolas**, como ya hace el área | tests de paridad por concepto (352, 353, 354) |
| N3 | **Toda razón lleva su cobertura.** | Una tasa, un costo o un ROAS devuelve `{ valor, base, faltan, motivo }`, no un número. Si el numerador y el denominador no cubren los mismos días (gasto contra ventas), o la base resuelta es menor que el umbral, la pantalla dice "parcial" con el motivo, o "—" si no se puede calcular. Nunca se pinta una razón con medio dato como si fuera entera | el tipo: la tarjeta no compila con un `number` suelto para una razón (351) |
| N4 | **Un nombre por concepto.** | Todo rótulo visible de una métrica (Hub, listas, Mi espacio, Pauta, WhatsApp) sale de un solo vocabulario en `lib/`, alineado con `docs/overview.md` §11: Registros (envíos completos), Leads (personas), Agendadas, Citas, Llamadas realizadas, No asistió, Llamadas sin resultado, Ventas (conteo), Valor vendido (USD), Recaudado, Meta de hoy. Un rótulo literal para una de esas métricas es el olor | guardián de rótulos sobre `app/`, `components/` y `lib/reporte-whatsapp/` (357) |
| N5 | **La pantalla es para quien la usa.** | Ningún texto visible lleva `utm_*`, `ad_id`, ADR, ticket, ids, "macro", "centinela", "periodo A/B" ni nombres de tablas: el diagnóstico técnico vive en Ajustes › Salud. Número, moneda, porcentaje, razón y fecha salen **solo** de `lib/format.ts`, y el vacío tiene una regla: "—" = no se puede calcular, "0" = se calculó y es cero, "Sin datos" = aún no hay periodo medido | guardián de cadenas en JSX y de helpers de formato locales (358, 359) |
| N6 | **Lo que una métrica necesita se exige al escribir.** | Si una cifra depende de un dato, la escritura lo exige o lo avisa, no la lectura: una venta no entra sin % de comisión, una llamada pasada sin resultado genera aviso al closer, un envío pago sin `utm_id` enciende la alarma. Arreglar en la lectura esconde el dato que falta | tests de la reja en `moverEtapa` (356) y del aviso (341) |
| N7 | **Reemplazar es borrar.** | Un cargador, una pantalla o un componente que reemplaza a otro se entrega con el borrado del viejo en el mismo ticket, o el ticket no está terminado. Cada función que cita `docs/metricas.md` existe y tiene al menos un llamador fuera de `tests/` | guardián del diccionario: recorre `metricas.md`, busca cada función citada y falla si no existe o nadie la llama (361) |
| N8 | **Una jerarquía, y las enmiendas arriba.** | Sobre qué hace el código hoy manda el código. Sobre qué debería hacer: **ADR vigente > ticket > documento de reunión** (`comercial.md`, `analytics.md`, `hub.md` son contexto e historia). Las definiciones de métricas viven **solo** en `docs/metricas.md`; los demás documentos enlazan, no copian. Una enmienda reescribe en el mismo commit el título y el índice del ADR, la fila de `metricas.md` y el vocabulario de `overview.md` §11 | revisión, con la lista de N8 en el "Done cuando" de todo ticket de métricas (362) |
| N9 | **Terminado es con evidencia.** | Un ticket pasa a `done` solo con cada casilla de su "Done cuando" marcada y su evidencia (test, commit o recorrido). El estado del tracker y el `status:` del archivo coinciden siempre | `tests/tracker-coherente.test.ts` (362) |

## Consecuencias

- Una métrica nueva cuesta un poco más: entra a la tabla de conceptos, reusa la función del concepto o crea la suya con
  su gemela y su paridad, devuelve cobertura y toma su nombre del vocabulario. A cambio, no puede nacer una segunda
  respuesta a la misma pregunta sin que un test lo diga.
- Los tickets 351 a 362 traen el código actual a estas reglas. Hasta que cada guardián exista, la regla se revisa a mano
  y el olor está escrito en la tabla de arriba.
- `AGENTS.md` resume estas reglas en "Restricciones no-negociables" y `docs/metricas.md` §0 suma la tabla "Conceptos".
