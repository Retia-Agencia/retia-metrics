# 0049 — Calendly cuelga cada llamada de su deal, y si hay duda la llamada queda suelta

**Fecha:** 2026-09-24 · **Estado:** aceptado (Mani); la forma técnica (webhook o consulta periódica)
queda abierta · **Implementación:** ticket 096 · **Enmienda:** spec §2 ("no conecta Calendly"),
ADR 0037 (dueño por reclamo), ticket 057 ("una Call no puede existir sin deal") ·
**Origen:** `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.3 y §3.7

## El problema

- Hoy el closer se entera de una agenda no se sabe cómo (calendario, Juanito, grupo), y **solo el 53%
  de los Calendly de Tactical terminan con fila** en el registro de llamadas.
- El diseño vigente (ticket 052) crea la Call **sin fecha** cuando el envío dice "Con Calendly", y el
  closer completa fecha y link a mano al reclamar. Es trabajo manual y es la fecha que más se olvida.
- La spec §2 dejaba Calendly fuera, con la forma ya decidida (un token por programa, 21-sep).

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

**4. Efecto sobre la etapa, siempre por `moverEtapa()`:** deal en 1, 2, 3 o 9 → pasa a Agendado; deal
en 4 → se queda, ahora con la fecha real; deal en 5, 6 o 7 → es una segunda llamada y la etapa **no**
cambia. Una cancelación o un no-show reportado mueve a Pendiente Re-agenda solo si el deal está en
Agendado (propuesta T8 de la tabla de transiciones, ticket 043).

**5. El dueño.** Cada closer registra su cuenta de Calendly **en cada programa**, en su membresía. Si
el deal no tiene dueño y el host es un closer registrado en el programa, **el host queda como dueño**.
Si el host no está registrado, el deal sigue sin dueño en el Inbox. Si el deal ya tenía dueño, se
respeta y se avisa. 🔴 Quién se queda el deal en ese último caso es pregunta para los closers.

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
- La spec §2 deja de decir "no conecta Calendly".

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Que Calendly cree el deal | Duplica el origen: el envío ya trae la agenda. Dos puertas para lo mismo |
| Emparejar siempre al lead más parecido | Una asignación equivocada no se distingue de una buena |
| Emparejar también por teléfono | 37 teléfonos de Tactical tienen más de un correo (ADR 0035) |
| Que todo Agendado nazca sin dueño y se reclame | Calendly ya repartió por Round Robin; reclamar lo ya asignado es trabajo sin valor |

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".
