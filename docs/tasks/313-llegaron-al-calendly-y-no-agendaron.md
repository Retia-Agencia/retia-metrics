---
id: 313
etapa: hub
serves: "Mani, 24-oct: los que llegan a la agenda son los más probables de comprar; hay que poder contactarlos · ADR 0067 (toda cifra abre su lista)"
depends: [309, 312]
status: todo
---

# 313 — La lista de los que llegaron al Calendly y no agendaron

## Por qué

Mani, viendo el embudo por pregunta: los que "se fueron" en la pregunta de la agenda existen en el CRM y hay que
contactarlos. Dos cosas distintas, y solo una se puede listar:

- **"Se fueron aquí"** (`components/embudo-por-pregunta.tsx`) es el `dropoffs` de la API de insights de Typeform
  (`lib/typeform/insights.ts`): un conteo **anónimo**. Typeform no dice quiénes son, así que no hay lista posible. La
  pantalla lo dice en una línea para que nadie la busque.
- **Llegó al Calendly y no agendó** sí son personas del CRM: registros completos con calidad High sin agenda
  (`embudoDelFormulario`: `llego && !agendo`). Por la regla de entrada (ADR 0069) su deal nació en Calificado.

## Alcance

- **Dentro:** en el embudo del formulario, la diferencia "Llegó al Calendly − Agendó" se muestra como cifra propia,
  **"No agendaron"**, y abre su lista (molde de `lib/queries/metricas-con-filas.ts`, métrica nueva): persona (con la
  regla de nombres del 309: solo para quien administra), closer responsable, etapa actual del deal, días desde el envío
  y "Ver deal". Más antiguos sin contactar primero.
- **Dentro:** **un solo predicado** de "llegó al Calendly" y de "agendó": la lista y el embudo lo importan del mismo
  módulo (`agendoElEnvio` ya es la respuesta de "¿agendó?"; "llegó" se extrae de `embudo-formulario.ts` sin copiarlo).
  Un test compara la cifra con el total de su lista.
- **Dentro:** un registro que agendó después (deal en Agendado o más adelante) deja de estar en la lista: lo decide la
  cita, no la foto del día del envío. Se escribe en `docs/metricas.md`.
- **Decidido (Mani, 24-oct):**
  - **El closer ve la lista con nombres** en los programas donde tiene membresía activa: son sus propios deals y la
    lista existe para que alguien llame. Excepción nombrada a la regla de nombres del 309, solo para esta lista.
  - **La cifra es viva y va aparte del embudo:** "No agendaron" = llegó al Calendly y hoy no tiene cita vigente ni deal
    en Agendado o más adelante. El paso "Agendó" del embudo no cambia (sigue siendo el hecho del envío), así que la
    cifra puede ser menor que Llegó − Agendó; la pantalla lo dice en una línea.
  - **Unidad: personas.** Una fila por lead, con la fecha de su registro más antiguo que llegó; la cifra cuenta
    personas, no registros. El deal mostrado es el abierto o, si no hay, el más reciente. Cierre perdido sale de la
    lista (el closer ya lo cerró).
  - **Orden:** por fecha de envío y por fecha de la última actividad del deal (las dos ordenables; por defecto, envío
    más antiguo primero). El CRM no tiene un hecho "contactado": no se inventa (A-160).
- **Fuera:** trackear los contactos de los deals (A-160).
- **Fuera:** avisar a los closers (Juanito, Inbox): si la lista sirve, va en otro ticket.

## Done cuando

- [ ] La cifra "No agendaron" es igual al total de su lista, con anuladas y otro programa en el test.
- [ ] Un registro que agenda al día siguiente sale de la lista.
- [ ] Un closer que forja la URL de otro programa recibe 404; un paid trafficker ve la cifra pero no abre la lista
  (trae closer y etapa, que son de `veEquipoComercial`).
- [ ] Recorrido con clic en todo lo que se abre, escritorio y 375 px, consola limpia.
