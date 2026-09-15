# spec — Retia CRM: registro de llamadas y ventas, sin WhatsApp

> Un closer necesita registrar su llamada y su venta apenas cuelga, y logra que gerencia vea el
> embudo del corte en tiempo real, sin WhatsApp, sin calendario compartido y sin pasar por el
> Claude personal de Mike.

## 1. Qué hace

CRM interno de Retia donde los closers de Comunicarte y Tactical Investor registran cada llamada
(un único resultado: agendada, show, no_show, reagendada, cerrada o perdida, más notas) y, cuando
el resultado es cerrada, los datos de la venta en la misma pantalla (caja recaudada, precio del
contrato, tipo de pago, plataforma de pago), contra un lead ya sincronizado desde Google Sheets. Cualquier closer o gerente puede entrar al
perfil de una persona y ver el historial completo de sus llamadas, en orden. Un dashboard central,
visible para cualquier closer o gerente (política "todos ven todo": incluye el comparativo entre
closers), muestra en tiempo real cierres, tasas y caja por closer, por programa y por fecha (hoy,
esta semana, o cualquier rango), sin generar ni depender de un PDF. Reemplaza WhatsApp, el
calendario compartido y el second brain personal de Mike como el lugar donde vive esta información.

## 2. Qué NO hace

- No reemplaza el sync de leads desde Google Sheets: los leads (formulario de aplicación) siguen
  entrando por ahí, como hoy. ADR 0004 se mantiene para leads.
- El dashboard en pantalla es el reporte y la fuente en vivo. No hay un pipeline de generación de
  PDF a la Mike (revisar WhatsApp, contrastar comprobantes, armar el documento a mano). Lo que sí
  se permite es tomar un **snapshot descargable del estado actual del dashboard** a demanda, para
  quien necesite compartirlo fuera de la app: refleja lo que ya se ve en pantalla, no re-calcula ni
  agrega nada nuevo. Decidido con Mani el 15-sep: reemplaza la restricción anterior de "ningún
  reporte exportable".
- No permite crear un comprador que no exista ya como lead sincronizado. Toda llamada se vincula a
  una persona ya deduplicada por el sync.
- No incluye el lead magnet de Juan Pablo ni el newsletter de SendGrid. Son iniciativas separadas
  que salieron en la misma reunión, fuera de este alcance.
- No migra retroactivamente el historial completo como parte del MVP. El import de los dos
  consolidados de Michael (Comunicarte y Tactical) es una tarea de migración aparte, no bloqueante
  para el lanzamiento (ver supuestos).
- No redefine caja recaudada ni ventas cerradas: el CRM las captura con la misma definición que ya
  rige el proyecto, no las cambia.
- No conecta Calendly todavía. Cada closer podría en el futuro generar su propio token de Calendly
  (confirmado: un token de un usuario individual solo trae los eventos de ese usuario) para que sus
  llamadas agendadas aparezcan solas. Se deja para una segunda fase, no bloquea este MVP.
- No conecta Kapso (WhatsApp) ni ninguna herramienta externa. La idea de mandar alertas o eventos a
  Kapso queda anotada como dirección futura validada, no como trabajo de este spec.
- No expone una API propia para que herramientas externas se conecten al CRM. Construir esa puerta
  antes de que exista una herramienta real esperando del otro lado sería trabajo especulativo (ver
  ADR 0006). Se construye cuando Calendly, Kapso o cualquier otra integración concreta la necesite.
- No incluye recordatorios de seguimiento ("esto te toca hoy"). Los datos reales muestran que el
  equipo ya sobrevive hoy a mano con estos follow-ups; se decidió no sumarlo a esta entrega por el
  plazo del 22 de septiembre. Candidato claro para la siguiente iteración.
- No incluye una vista tipo kanban del embudo. La prioridad fijada en la reunión fue velocidad
  sobre estética, números y tablas primero; el kanban es una mejora visual, no una que resuelva un
  problema nuevo.

## 3. Usuario

Dos usuarios, dos momentos de tensión:

- **Closer** (Andrea, Maru, Jero, y quien se sume): su momento de mayor tensión es justo al colgar
  una llamada, cerró una venta o no. Hoy tiene que salir de ese momento a escribir un mensaje de
  WhatsApp con el comprobante en vez de seguir con la siguiente llamada. El CRM le ahorra ese
  cambio de contexto.
- **Gerente** (Alejandro Carvajal, Daniel Tovar, Michael): su momento de mayor tensión es cuando
  necesita saber "cómo vamos" del corte y hoy depende de que Mike arme el PDF a mano desde su
  Claude. No puede consultarlo él mismo ni verificar los números.

## 4. Flujo (5 pasos)

1. El closer termina una llamada y entra al CRM con su cuenta (mismo login y roles que ya existen).
2. Busca y selecciona el lead correspondiente entre los ya sincronizados desde Sheets. El corte
   (cohorte) se asigna solo, según el corte activo del programa: el closer no lo elige.
3. Registra el resultado de la llamada (agendada, show, no_show, reagendada, cerrada o perdida) y
   una nota libre. Si el resultado es cerrada, en la misma pantalla aparecen los campos de venta:
   caja recaudada, precio del contrato, tipo de pago (total/parcial) y plataforma de pago (lista
   fija con opción "otro").
4. El registro queda visible de inmediato en el dashboard central, sin pasos intermedios. El closer
   que lo hizo queda identificado solo, tomado de su propia cuenta.
5. Cualquier closer o gerente abre el dashboard y ve cierres, tasas y caja por closer, por
   programa y por fecha, filtrando el rango que necesite.

## 5. Criterios de aceptación (3, verificables)

1. Dado un closer autenticado que acaba de colgar una llamada, cuando registra el resultado y (si
   fue cerrada) los datos de la venta contra un lead ya sincronizado, entonces el registro queda
   guardado con su closer, su corte y su programa correctos, y aparece en el dashboard sin usar
   WhatsApp ni calendario compartido.
2. Dado un cierre ya registrado por cualquier closer, cuando otro closer o un gerente abre el
   dashboard, entonces ambos ven el mismo dato: monto de caja recaudada, precio del contrato,
   closer y programa (política "todos ven todo").
3. Dado que un gerente quiere saber el estado del corte, cuando abre el dashboard y filtra por
   programa y rango de fechas, entonces ve cierres, tasas y caja calculados desde los registros
   del CRM, sin que Mike tenga que generar nada a mano.

## 6. Datos

- **Identidad del comprador/lead**: nombre y correo, ya capturados hoy por el sync de Sheets desde
  el formulario de aplicación. El CRM los lee, no los vuelve a pedir. El consentimiento de esa
  captura queda cubierto por el flujo de Sheets existente, fuera de este spec.
- **Datos de la llamada** (los pide el closer, en el momento de colgar): un único resultado
  (agendada, show, no_show, reagendada, cerrada, perdida) y una nota libre. Son observación del
  equipo comercial sobre el lead, no datos que el lead entrega directamente.
- **Datos de la venta** (los pide el closer, en el momento del cierre): caja recaudada, precio del
  contrato, tipo de pago, plataforma de pago. Son datos financieros operativos de la empresa, no
  del comprador. No se pide número de tarjeta, cuenta bancaria completa ni ningún dato que
  identifique un instrumento de pago.
- **Marco regulatorio**: no se discutió en la reunión ni se validó con nadie de Retia si registrar
  datos de compra (monto, plataforma) de personas colombianas o de otros países requiere un
  tratamiento particular bajo habeas data (Ley 1581 de 2012) más allá del consentimiento que ya
  cubre el formulario de aplicación. Va a supuestos.

## 7. Supuestos por validar

- [ ] La política "todos ven todo" (incluida caja recaudada y pauta) reemplaza, para este
      dashboard, la restricción que citó ADR 0003 (ver ADR 0009). No la confirmó directamente
      Michael ni Alejandro Carvajal — confirmar antes de dar acceso real a los closers.
- [ ] Import histórico: existen `Comunicarte-C2-Consolidado-v2.md` y
      `Tactical-Investor-C2-Consolidado.md` (en Downloads al momento de escribir este spec), pero
      son reportes narrativos reconciliados a mano. Cada uno documenta discrepancias conocidas
      entre la BBDD de Sheets y los reportes de WhatsApp del equipo (ventas sin nombre, fechas que
      no cuadran). No son un insumo limpio para importar 1:1. Falta decidir con Mani/Michael qué
      se importa literal, qué se reconcilia y qué se descarta.
- [ ] Fecha exacta de entrega del MVP: se confirmó "antes de que cierren los C2 actuales"
      (Comunicarte 22 sep, Tactical 29 sep) como deadline, pero no una fecha de entrega específica
      dentro de esa ventana.
- [ ] Onboarding de closers: cuántos closers activos hay hoy (Andrea, Maru y Jero aparecen en los
      datos reales) y si ya tienen cuenta en la tabla `users` o hay que darlos de alta.
- [ ] Qué pasa si un closer no encuentra el lead en el sync, por ejemplo alguien que llegó por la
      cola de setteo o por WhatsApp directo y nunca aplicó por el formulario. Este spec asume que
      siempre existe un lead sincronizado; eso no se confirmó contra la operación real.
- [ ] Marco regulatorio de datos financieros (ver bloque 6), no validado con nadie de Retia.
- [ ] Para la futura integración con Calendly: no se confirmó si cada closer agenda desde su propia
      cuenta individual de Calendly o si el equipo comparte una sola cuenta con round robin. Un
      token personal solo sirve si la cuenta es individual; si es compartida, la integración futura
      necesita otro diseño.
