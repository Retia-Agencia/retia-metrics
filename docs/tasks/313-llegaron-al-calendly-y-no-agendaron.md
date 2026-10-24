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
- **Abierta (Mani):** si el closer ve esta lista con nombres. Son sus propios deals y ya los ve en Deals, y la lista
  sirve justo para que alguien llame. Hasta decidirlo rige la regla del 309 (nombres solo para quien administra).
- **Fuera:** avisar a los closers (Juanito, Inbox): si la lista sirve, va en otro ticket.

## Done cuando

- [ ] La cifra "No agendaron" es igual al total de su lista, con anuladas y otro programa en el test.
- [ ] Un registro que agenda al día siguiente sale de la lista.
- [ ] Un closer que forja la URL de otro programa recibe 404; un paid trafficker ve la cifra pero no abre la lista
  (trae closer y etapa, que son de `veEquipoComercial`).
- [ ] Recorrido con clic en todo lo que se abre, escritorio y 375 px, consola limpia.
