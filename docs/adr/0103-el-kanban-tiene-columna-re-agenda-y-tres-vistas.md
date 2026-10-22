# 0103: El Kanban tiene una columna Re-agenda y tres vistas, sin etapas nuevas

- **Estado:** aceptado, 22-oct-2026 (Mani). Se construye con el ticket 296.
- **Enmendado el 22-oct (Mani):** Setteo suma Compromiso Verbal, Ganado Pago Parcial, Ganado Pagado Completo y
  Cierre perdido, para que el setter cierre por chat (flechas E5 y E6) sin cambiar a la vista Llamada. Llamada no
  cambia: el closer no ve las columnas de setteo.
- **Confirma:** ADR 0070 (Re-agenda es un pendiente, no una etapa), ADR 0076 (setter es una función, no un rol), ADR
  0037 (el orden de las etapas no es un embudo ni una regla).
- **Fuentes:** loom de Nicolás (22-oct), `docs/manuales/pipeline-comercial.md` §5, anotaciones A-157 y A-158.

## Contexto

Nicolás, closer de llamada:

1. Las citas a re-agendar se mezclan con las nuevas en la columna Agendado (65 de 548 el 22-oct) y le cuesta encontrar
   lo que tiene que mover al salir de una reunión.
2. No trabaja las cinco columnas de setteo, que son las más llenas (1.108 deals en Potencial y Registrado), y tiene
   que desplazarse a la derecha cada vez que entra.

## Decisión

1. **Columna "Re-agenda", derivada.** Muestra los deals con el pendiente Re-agenda, estén en Agendado o en Atendido, y
   va **a la izquierda de Agendado**. Agendado y Atendido muestran solo los que no lo tienen. No es una etapa: la etapa
   del deal no cambia (el embudo sigue sabiendo hasta dónde llegó) y el motor, el historial y las migraciones no se
   tocan.
2. **Entrar y salir de la columna sigue las flechas que ya existen.** Entra cuando el sistema marca no-show o
   cancelada (PR1) o cuando el closer pide otra llamada desde Atendido (PR2). Sale a Agendado con la cita nueva, que
   limpia el pendiente (ADR 0070 punto 7), o a Próxima Cohorte o Cierre perdido.
3. **Tres vistas de columnas:**

   | Vista | Columnas |
   |---|---|
   | Llamada | Re-agenda, Agendado y todo lo que sigue hasta Cierre perdido |
   | Setteo | Potencial, Registrado, En gestión, Contactado, Calificado, Compromiso Verbal, los dos Ganados y Cierre perdido |
   | Todo | todas |

4. **La vista vive en la URL** como el resto de los filtros del Kanban, y **la app recuerda la última de cada persona**
   para abrirla al entrar. No es un permiso: no esconde datos, no cambia totales ni cifras, y cualquier persona puede
   cambiar de vista.

## Consecuencias

- Los totales por columna se calculan sobre la columna mostrada: la suma de Re-agenda, Agendado y Atendido es la de
  antes.
- Un deal en Atendido con Re-agenda aparece en Re-agenda, no en Atendido. Su tarjeta dice de qué etapa viene.
- Si mañana hace falta otra vista, es una fila más en la lista de vistas, no un rol ni una pantalla.
