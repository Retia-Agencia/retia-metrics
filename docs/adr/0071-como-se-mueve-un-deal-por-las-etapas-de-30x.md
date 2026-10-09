# 0071 — Cómo se mueve un deal por las once etapas de 30X

- **Estado:** aceptado · 2-oct-2026 (Mani, revisión del manual de gestión comercial, dudas D-1 a D-9 y QM-12).
  Se construye con el ticket 142. **El punto 5 lo amplía el [ADR 0072](./0072-una-pregunta-por-etapa-mueve-el-deal.md):**
  la pregunta de Atendido es una de las preguntas por etapa.
- **Enmendado por el ADR 0081 (9-oct):** Mover o Anotar; los pendientes salen de lo anotado, se retiran los intentos y la alerta de tres intentos, y el origen declarado.
- **Enmienda:** ADR 0059 punto 7 (los cerrados de la hoja sin monto). **Confirma:** ADR 0037 (no hay relojes),
  0065 (valor vendido), 0069 (etapa de entrada) y 0070 (pendientes).
- **Fuentes:** [`manual-gestion-comercial.md`](../manual-gestion-comercial.md) §3, §4 y §10 (borrador de Alejo,
  1-oct); [`insumos/30x-ciclo-de-vida.md`](../insumos/30x-ciclo-de-vida.md) (el diagrama y el manual de 30X);
  [`insumos/hubspot-30x-workflow.md`](../insumos/hubspot-30x-workflow.md).

## Contexto

El 142 cambia las etapas por las once de 30X: Potencial, Registrado, En gestión, Contactado, Calificado,
Agendado, Atendido, Compromiso Verbal, Ganado Pago Parcial, Ganado Pagado Completo y Cierre perdido. El
manual de Alejo dejó abiertas las reglas donde 30X y Retia no coinciden: allá el deal nace con dueño y
los workflows cierran deals por tiempo; aquí el deal nace sin dueño y nada se mueve porque pasó el tiempo
(ADR 0037).

## Decisión

1. **Potencial y Registrado pasan a En gestión con la primera actividad comercial** (D-1), como en 30X:
   una llamada, un WhatsApp o un correo registrados en el deal. Quiere decir "nadie le ha hecho nada
   todavía". Quien registra esa actividad sobre un deal sin dueño queda como dueño, en el mismo
   movimiento. Calificado no pasa por En gestión: el puntaje alto ya dice qué hay que hacer.
2. **El contacto logrado mueve a Contactado** (D-2): la actividad con fecha y canal que hoy es la T1. El
   intento fallido se anota y deja el deal en En gestión.
3. **Calificado tiene dos entradas:** la puerta del puntaje alto (ADR 0069) y, desde Contactado (o desde
   En gestión), cuando el dueño confirma que la persona califica.
4. **Los tres intentos se cuentan; no cierran el deal.** Aquí se aparta de 30X para respetar el ADR 0037. Cada intento
   fallido en En gestión, o tras un no-show, queda como actividad. Al tercero el deal sale con una
   **alerta roja "agotó intentos"** y una persona decide: perderlo con motivo o seguir intentando. Se
   calcula al leer (ADR 0024); no hay trabajo programado que mueva nada.
5. **"¿Cómo terminó?" de Atendido sigue con seis botones** (D-3): Pagó ahora (el Reservado de 30X),
   Compromiso (Comprometido), Seguimiento (Interesado), Perdido (No interesado), y además Otra llamada y
   Próxima cohorte, que ponen los pendientes del ADR 0070. Los doce valores del HubSpot de hoy no se
   adoptan como etapa ni como pregunta.
6. **Un deal creado a mano nace en En gestión** (D-5), con quien lo crea como dueño: ya tiene dueño y
   alguien ya lo está trabajando.
7. **No hay rol de setter en la v1** (D-6): el dueño del deal hace el setteo y la venta. Un rol de setter
   se agrega cuando exista la persona.
8. **Un Ganado Pago Parcial que desiste es Cierre perdido** (D-8), con motivo: deja de ser venta y su
   persona deja de ser Student. Lo abonado sigue en la caja porque sí entró (ADR 0037).
9. **Los cerrados de la hoja sin monto cobrado entran a ganado sin abono** (D-9, enmienda del ADR 0059
   punto 7). La migración del 078 los lleva a ganado según la hoja (`Parcial` a Ganado Pago Parcial, `Ya pago` a Ganado
   Pagado Completo), con la rareza "monto cobrado
   desconocido" en vez de mandarlos a Compromiso Verbal. **Es una excepción con fecha:** cuando el CRM
   esté en vivo, el equipo se sienta a corregir ese histórico con los montos reales. Es una excepción
   de la migración (el escritor de lo histórico del ADR 0059, actor `migracion`); `moverEtapa()` sigue
   exigiendo un abono para entrar a ganado.
10. **La cortesía es un deal con 100% de descuento y una marca** (QM-12). El motor acepta valor vendido 0
    **solo** con esa marca. Es Student igual que cualquiera (deal en ganado), pero no cuenta en ventas,
    ni en la tasa de cierre, ni en la comisión, y se ve aparte.

## Consecuencias

- El 142 queda sin dudas que lo bloqueen. Lleva en su migración la marca de cortesía y en el motor las
  flechas de los puntos 1 a 3 y 6. El conteo de intentos y su alerta (punto 4) van con las alertas del
  128.
- D-7 ("se perdió en el Calendly" sin la variable `estado`) no bloquea al 142: se decide con el 118.
- `structure.md` §3.1 (la tabla T1 a T29) la reescribe el 142, que ya iba a hacerlo (D-4).
