# 0049 — Calendly cuelga cada llamada de su deal, y si hay duda la llamada queda suelta

**Fecha:** 2026-09-24 · **Reescrito:** 2026-09-27 (confirmado por los closers el 24-sep; el apéndice de Seguimiento pasó al ADR 0037) · **Estado:** aceptado (Mani); la forma técnica (webhook o consulta periódica)
queda abierta · **Implementación:** ticket 096 · **Enmienda:** la spec del 16-sep (Calendly quedaba fuera),
ADR 0037 (dueño por reclamo), ticket 057 ("una Call no puede existir sin deal")

## El problema

- Hoy el closer se entera de una agenda por su propia cuenta de Calendly y por los push de Juanito
  (reunión del 24-sep), y **solo el 53%
  de los Calendly de Tactical terminan con fila** en el registro de llamadas.
- El diseño vigente (ticket 052) crea la Call **sin fecha** cuando el envío dice "Con Calendly", y el
  closer completa fecha y link a mano al reclamar. Es trabajo manual y es la fecha que más se olvida.
- La spec dejaba Calendly fuera, con la forma ya decidida (un token por programa, 21-sep).

## Decidimos

**1. El deal lo abre el envío del formulario, no Calendly.** El Typeform le muestra el Calendly al que
califica, así que un envío "Con Calendly" **ya trae la agenda** y abre el deal en Agendado (ADR 0037).
La agenda no es una entrada aparte: es parte del mismo envío. Calendly no crea deals.

**2. La sincronización con Calendly, por programa, tiene un solo objetivo: colgar cada llamada de su
deal sin trabajo manual**, con su fecha real, su host, y sus movimientos y cancelaciones.

**3. No es forzosa. Si hay duda, la llamada queda suelta.** Se cuelga sola **solo** si el correo del
invitado pertenece a **un solo lead del programa con un solo deal abierto**. En cualquier otro caso
(el correo no aparece, casa con un lead sin deal abierto, o con más de uno) la llamada queda **suelta**
en el Inbox y el closer la asigna a un deal a mano, o crea el deal.

- La razón: **una asignación equivocada es peor que una pendiente**, porque se ve igual que una
  correcta y no lanza ningún error. Es la regla del emparejador de UTM (ADR 0045): un empate es un
  error visible, no una elección silenciosa.
- El emparejamiento automático usa **solo el correo**. El teléfono no empareja: en este repo el
  teléfono une y marca, nunca decide solo (ADR 0035).
- Si la llamada llega antes que el envío (carrera de segundos), queda suelta y se reintenta el
  emparejamiento cuando llega el envío. 🟡 Propuesta, se valida al construir.

**4. Efecto sobre la etapa, siempre por `moverEtapa()`:** deal en 1, 2, 3, 9 u 11 → pasa a Agendado; deal
en 4 → se queda, ahora con la fecha real; deal en 5, 6 o 7 → es una segunda llamada y la etapa **no**
cambia. Una cancelación o un no-show reportado mueve a Pendiente Re-agenda solo si el deal está en
Agendado (transición T8, adoptada el 24-sep).

**5. El dueño.** Cada closer registra su cuenta de Calendly **en cada programa**, en su membresía
(confirmado el 24-sep: cada closer es dueña de sus llamadas, y Andrea y Maru tienen un correo por programa). Si
el deal no tiene dueño y el host es un closer registrado en el programa, **el host queda como dueño**.
Si el host no está registrado, el deal sigue sin dueño en el Inbox. Si el deal ya tenía dueño, se
respeta y se avisa. 🔴 Quién se queda el deal en ese último caso no se alcanzó a preguntar el 24-sep.

**6. Una llamada suelta es la única Call que existe sin deal.** Enmienda al ticket 057, que exige
"una Call no puede existir sin deal": se conserva para toda Call nativa; la excepción es la que trae
Calendly y no se pudo colgar sin duda, visible en el Inbox hasta que alguien la asigna.

## Lo que queda abierto

- **Webhook o consulta periódica.** El webhook es tiempo real pero exige plan Standard de Calendly o
  superior; la consulta periódica depende de pasar Vercel a Pro para un cron cada 15 minutos.
- **Dónde se guarda la credencial de cada programa** (secreto, nunca en claro en la base).
- Sin la integración, el modelo funciona igual: el closer crea la Call con fecha y link a mano.

## Consecuencias

- `users.calendly_email` (global) no alcanza: la cuenta de Calendly pasa a ser **por membresía**.
- El ADR 0037 queda enmendado en un punto: un Agendado con host registrado ya no espera a que alguien
  lo reclame.
- Calendly entra al alcance (`docs/overview.md`).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Que Calendly cree el deal | Duplica el origen: el envío ya trae la agenda. Dos puertas para lo mismo |
| Emparejar siempre al lead más parecido | Una asignación equivocada no se distingue de una buena |
| Emparejar también por teléfono | 37 teléfonos de Tactical tienen más de un correo (ADR 0035) |
| Que todo Agendado nazca sin dueño y se reclame | Calendly ya repartió por Round Robin; reclamar lo ya asignado es trabajo sin valor |

