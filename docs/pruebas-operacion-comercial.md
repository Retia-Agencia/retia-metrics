# Pruebas de la operación comercial (ticket 153)

Lista para recorrer **a mano, en local**, la operación comercial completa de 30X como closer antes de migrar
(ola O2). Sale del motor (`lib/deals/etapas.ts`, `lib/deals/requisitos.ts`) y de
`docs/manual-gestion-comercial.md`, no de memoria: cada flecha citada (E1, P, R…) es una fila de la tabla de
transiciones.

## Cómo se usa

- Base y app: `npm run db:local` y `npm run dev:local` (nunca `npm run dev`, que escribe en producción).
  Entra en `http://localhost:3000/login` solo con el correo, sin Google.
- Cuentas: `carlos.closer@retia.local` (closer, dos programas) · `lucia.closer@retia.local` (closer, solo
  ComunicArte Local) · `gerente@retia.local` · `dev@retia.local` (developer).
- Programa de trabajo: **ComunicArte Local**, slug `comunicarte-local`. Las rutas abajo usan `/p/comunicarte-local/…`.
- Cada prueba: **qué hacer · dónde · qué debe verse**. Marca la casilla al pasarla. Ten la consola del navegador
  abierta: un error rojo en consola también es un fallo.
- **Lo que falle o confunda** va a `docs/anotaciones.md` (Recorrido 2) con su `A-NN` y el número de prueba.
  Lo pequeño se arregla dentro del 153; lo grande sale como ticket de la O2-d.

## A. Entrada

- [ ] **1. Las 11 etapas tienen deals.** `/p/comunicarte-local/deals` (Kanban). Debe verse una columna por
  etapa, en este orden: Potencial, Registrado, En gestión, Contactado, Calificado, Agendado, Atendido,
  Compromiso Verbal, Ganado Pago Parcial, Ganado Pagado Completo, Cierre perdido. Ninguna vacía.
- [ ] **2. Un lead con dos envíos.** Abre el lead que llegó primero parcial y luego completo
  (`/p/comunicarte-local/leads`, búsqueda). En su ficha se ven **los dos envíos**, con lo que cambió; la
  tarjeta y la ficha de su deal avisan "N envíos". No hay un segundo deal.
- [ ] **3. El reenvío sube la puerta (151, ADR 0073).** Ese mismo deal: si nació en Potencial, el completo lo
  subió a Registrado (o a Calificado si trajo calidad High). El historial del deal muestra el movimiento con
  nota del sistema.

## B. Setteo

- [ ] **4. Tomar un lead sin dueño (E1).** `/p/comunicarte-local/inbox`, sección sin dueño → **Reclamar** en un
  deal de Potencial o Registrado. Debe quedar con Carlos como dueño y pasar a **En gestión**.
- [ ] **5. Intento fallido.** Ficha de ese deal → Actividades → "Intento sin respuesta". Queda registrado y el
  deal **no** cambia de etapa.
- [ ] **6. Contacto logrado (E2).** Misma ficha → "Registrar contacto" con fecha y canal. El deal pasa a
  **Contactado**.
- [ ] **7. Calificar (E3).** Desde Contactado, mover a **Calificado**. Pide el contacto registrado (ya está):
  pasa sin preguntar más.
- [ ] **8. Lo que falta, dicho en pantalla.** En un deal de En gestión sin contacto, intenta moverlo a
  Contactado o Calificado. Debe decir "Falta registrar el contacto, con fecha y canal." y no moverse.

## C. Llamada

- [ ] **9. Agendar (E4).** Desde Calificado, "Agregar llamada" con fecha. El deal pasa a **Agendado**.
- [ ] **10. Mover la cita (E7).** Cambia la fecha de esa llamada. Sigue en Agendado con la fecha nueva.
- [ ] **11. No show y re-agenda (PR1).** Marca la llamada como no-show. El deal se queda en Agendado marcado
  **Re-agenda**, y aparece en el Inbox como re-agenda sin fecha. Agenda otra llamada: el aviso se apaga.
- [ ] **12. Atendido con Grain (E8).** En un Agendado, pega el link de Grain en la llamada. Pasa a **Atendido**
  sin alerta.
- [ ] **13. Atendido sin Grain (ADR 0066).** En otro Agendado, muévelo a Atendido sin Grain. Pasa, y la ficha y
  la tarjeta muestran en rojo **"atendido sin Grain"**. Pega el Grain: la alerta se apaga sola.
- [ ] **14. "¿Cómo terminó?"** En un Atendido, la ficha ofrece los seis botones (Pagó ahora, Compromiso,
  Seguimiento, Otra llamada, Próxima cohorte, Perdido). Seguimiento pide fecha; Próxima cohorte pide cohorte;
  Perdido pide motivo.

## D. Compromiso y pago

- [ ] **15. Compromiso verbal (E10).** Desde Atendido → Compromiso. Pide **fecha límite de pago** (prellenada
  con el inicio de clases) y **área declarada**. Sin ellas no pasa.
- [ ] **16. Abono parcial (E12).** En ese Compromiso, registra un abono menor que el valor vendido, con
  comprobante. Pasa solo a **Ganado Pago Parcial** y la ficha muestra el saldo.
- [ ] **17. Abono que completa (E13).** Registra el resto. Pasa solo a **Ganado Pagado Completo**, saldo 0.
- [ ] **18. Sobrepago rechazado.** En un Parcial, intenta abonar más del saldo. Se rechaza con mensaje claro.
- [ ] **19. Nadie arrastra a ganado.** En el Kanban, intenta arrastrar una tarjeta a Ganado. No se deja: a
  ganado solo se entra registrando un abono.

## E. Venta solo por WhatsApp (sin llamada)

- [ ] **20. Abono antes del contacto se rechaza.** En un deal En gestión (sin contacto registrado) intenta
  registrar un abono. Se rechaza: de En gestión no hay flecha a ganado.
- [ ] **21. E2 → E6.** Registra el contacto (pasa a Contactado) y luego el abono con comprobante y área
  declarada. Pasa directo a Ganado Pago Parcial o Completo, sin llamada.

## F. Perder, recuperar, anular

- [ ] **22. Perder (P).** En cualquier etapa abierta → Cierre perdido. Exige motivo de la lista de pérdida.
  Desde Ganado Pagado Completo **no** se ofrece.
- [ ] **23. Recuperar (R).** Ese perdido → recuperar con motivo de recuperación. Vuelve a **En gestión** o
  **Agendado**.
- [ ] **24. Anular un abono (A1, A2).** En un Completo, anula un abono: vuelve a Parcial. En un Parcial con un
  solo abono, anúlalo: vuelve a la etapa anterior.
- [ ] **25. Anular un deal.** Anula un deal ("me equivoqué al registrar"), con texto. Desaparece de las
  cifras, queda tachado con quién y cuándo, y el lead permite crear otro deal.

## G. Students

- [ ] **26. Onboarding.** `/p/comunicarte-local/students`: aparece el ganado pendiente de onboarding. Márcalo
  como onboarded; se refleja.

## H. Inbox, alertas y urgencias

- [ ] **27. Llamada suelta.** Inbox → la cita de Calendly sin deal aparece suelta. Asígnala a un deal.
- [ ] **28. "Se perdió en el Calendly" (118).** Arriba del Inbox, si el seed dejó un caso, aparece. Si no hay
  ninguno, anótalo como aclaración.
- [ ] **29. Alertas de la ficha (128).** En un deal al que le falta algo de su etapa, la ficha lo dice en rojo
  y "Para avanzar le falta…" en amarillo. Una llamada pasada sin resultado sale en rojo y en el Inbox.
- [ ] **30. Urgencias.** `/p/comunicarte-local/urgencias` carga y lista lo vencido (compromiso vencido,
  cartera vencida, estancados).

## I. Crear y permisos

- [ ] **31. Crear un deal a mano (140).** Deals → "Nuevo deal" sobre un lead sin deal abierto. Nace en
  **En gestión** con Carlos como dueño. Sobre un lead que ya tiene deal abierto, se rechaza diciéndolo.
- [ ] **32. Un closer no ve otro programa.** Sal y entra como `lucia.closer@retia.local`. Abre
  `/p/tactical-local/deals`: debe responder **404**. El selector de programa solo le ofrece ComunicArte Local.
- [ ] **33. Gerente.** Entra como `gerente@retia.local`: ve los dos programas y el dashboard; no puede
  trabajar leads como closer (no reclama ni registra).
