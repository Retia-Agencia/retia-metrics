# spec — Retia CRM: llamadas, ventas, métricas y recursos, sin WhatsApp

> Un closer necesita registrar su llamada, su venta y cada abono apenas pasa, y encontrar el
> brochure o el link de pago correcto sin preguntar en un grupo; gerencia necesita ver el embudo
> de cada cohorte en vivo; y el negocio necesita agregar programas, closers y productos sin
> esperar a un desarrollador.

Última revisión: 16-sep-2026 (ADR 0012 a 0017), con enmiendas del 21-sep (plan v2) y del 24-sep (ADR 0048 a 0052). La versión anterior, centrada solo en el
registro de llamadas, está en el historial de git.

> ⚠️ **Enmienda del 21-sep-2026 (plan v2, insumo §11).** El CRM pasa al **modelo HubSpot**:
> `persona → llamada → venta → abonos` se convierte en **Lead → Deal → Calls / Abonos**, con diez
> etapas y un motor único que las mueve. El orden de construcción está en
> [docs/plan-crm-v2.md](./plan-crm-v2.md) y las decisiones, en los **ADR 0035 a 0042**.
>
> **Qué sigue vigente de este documento:** el usuario (§3), los criterios de aceptación (§5) salvo
> donde digan "venta" —que ahora es un Deal en etapa Abonado o Completo—, los datos y su marco
> regulatorio (§6), y todo el pilar 0 (el contrato de extensión).
> **Qué queda desactualizado:** la forma de los pilares 1 y 2 y el flujo de §4, que describen la
> época anterior. Donde este documento y un ADR de la serie 0035-0042 discrepen, **mandan los
> ADR**, y las cinco enmiendas puntuales del insumo §11 están marcadas ⚠️ abajo.

> 🧭 **Enmienda del 24-sep-2026 (dirección de producto y UI, ADR 0048 a 0052).** Documento de
> referencia: [docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md](./auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md),
> guía del desarrollo hasta que la reunión con Comercial la corrija. Lo que cambia aquí, marcado 🧭 abajo:
> un closer ve **solo sus programas** (ADR 0048); el dashboard puede mostrar "todos los programas"
> **solo con lo sumable**; Calendly **entra**, para colgar llamadas de deals (ADR 0049); la navegación
> es por objetos, con Inbox y una tab Dashboard (ADR 0050); los UTM son **tres leídos y dos capturados**,
> con un builder dentro del CRM (ADR 0051); y hay un cuarto rol, **Paid Trafficker** (ADR 0052).
> También se corrigen aquí contradicciones que esta spec arrastraba desde el 16 y el 22-sep.

## 1. Qué hace

CRM interno de Retia con cuatro pilares, construidos en este orden:

0. **Contrato de extensión (la base).** Programas, cohortes, closers, productos, plataformas de
   pago, motivos, orígenes del lead, fuentes y recursos son **instancias** que se crean y editan
   desde la app. El código solo conoce **tipos** (ADR 0012). Un gerente agrega un programa
   nuevo, con su hoja de Sheets, su Calendly, su web y sus recursos, sin tocar código; un closer
   nuevo empieza a contar en las métricas apenas se le da de alta.
1. **Llamadas y ventas de los closers.** El closer registra cada llamada contra un lead ya
   sincronizado, con un único resultado (agendada, show, no_show, cancelada, reagendada,
   compromiso_pago, cerrada, perdida; ADR 0015), una nota, el origen del lead y, según el
   resultado, fecha de seguimiento o motivo. Si cerró, en la misma pantalla registra la venta
   (producto, precio del contrato, plataforma) y su primer **abono**. Los pagos posteriores de
   una venta se registran como abonos nuevos (ADR 0013). El comprobante es un link opcional
   (ADR 0017).
2. **Métricas para gerentes.** Un dashboard por programa, visible para cualquier closer o
   gerente ("todos ven todo", ADR 0009) 🧭 *(24-sep: un closer solo ve los programas de su
   membresía; dentro de ellos, todo. El dashboard es una tab con selector de programa y la opción
   "todos los programas", que solo suma lo sumable. ADR 0048 y 0050)*, muestra por día, semana, cohorte y mes: agendas,
   llamadas realizadas, % de show, ventas, % de cierre, caja recaudada, meta y meta dinámica,
   con desglose por closer y por origen del lead. El desglose por closer llega hasta sus
   métricas y su contribución a la cohorte: **la meta y la meta dinámica son de la cohorte y no
   se reparten entre closers** (ADR 0023). Se puede entrar al historial de cualquier persona. Se puede
   descargar un snapshot de lo que se ve en pantalla.
3. **Recursos centralizados.** Una pantalla con los links que el equipo usa a diario (brochures,
   web del programa, guiones, formulario del RUT) y los enlaces de pago por monto y plataforma,
   filtrables por programa, con marca de vigente e historial.
4. **Nerd Stats para developers.** Un rol developer que ve todo y una vista de salud de la
   herramienta: corridas de sync y sus errores, cambios recientes de configuración, versión
   desplegada y estado del cron.

Reemplaza WhatsApp, el calendario compartido y el second brain personal de Mike como el lugar
donde vive esta información.

- ⚠️ **ENTRA el 21-sep: la atribución por área.** Todo Lead pertenece a un **área** —Gerencial,
  Comercial, Pauta, Media— derivada de su origen, y el CRM sabe **qué campaña** y **qué persona** lo
  trajo. Sale del dolor declarado por Gerencia: *"rendimiento de las áreas · cantidad de leads por
  área"*. Incluye el **enlace de captación por closer y programa**, que es lo que hace visible al
  lead traído por un humano, hoy invisible. ADR 0043, 0044 y 0045; etapa **E1b** del plan.
- ⚠️ **ENTRA el 21-sep: el costo de la pauta cuelga de una campaña.** `ad_spend` pasa a grano
  **campaña + fecha**, y la campaña es dueña de su patrón UTM. Es lo que permite dividir inversión
  entre leads **cortando las dos mitades con la misma llave**, o sea CPL, CPI, CAC y ROAS rebanados
  por **campaña, canal o fecha**.
- ⚠️ **NO entra, decidido el mismo día: el desglose por conjunto ni por anuncio.** El estándar de UTM
  son **tres** campos leídos (`utm_source`, `utm_medium`, `utm_campaign`). *"Qué anuncio está
  vendiendo"* deja de ser una pregunta del producto (ADR 0045, enmienda 2).
  🧭 **24-sep (ADR 0051):** `utm_content` y `utm_term` **se capturan** siempre, aunque ningún reporte
  los lea; `utm_content` lleva el código del closer en su link y solo se lee en ese canal. El CRM
  tiene un **builder de links** (destinos, canal, campaña y los dos opcionales), replicado del de 30X.
- 🧭 **ENTRA el 24-sep: Calendly por programa, para colgar cada llamada de su deal** con su fecha real
  y su host. No es forzoso: si hay duda, la llamada queda suelta y el closer la asigna (ADR 0049).
- 🧭 **ENTRA el 24-sep: un cuarto rol, Paid Trafficker**, que crea campañas y links de sus programas
  (ADR 0052).
- ⚠️ **ENTRA: dos categorías de origen huérfano, y no se funden.** **Sin UTM** (llegó sin origen:
  problema de captación, irrecuperable) y **(sin clasificar)** (trae UTM pero falta el patrón: se
  arregla con una fila y repara hacia atrás). Las dos siempre visibles, con conteo y porcentaje.

## 2. Qué NO hace

- ~~No reemplaza el sync de leads desde Google Sheets~~ ⚠️ **Superado el 22-sep** (revisión del 22-sep,
  T1 y T3): los leads entran por **webhook de Typeform**, y lo que hay en Sheets se traslada por la
  misma puerta de ingesta. El CRM calcula el `Estado` con las reglas del Apps Script, por fuente (T2).
- No genera el PDF narrativo de Mike. El dashboard es el reporte; lo único exportable es un
  **snapshot** de lo que ya se ve en pantalla (decidido el 15-sep).
- ~~No permite crear un comprador que no exista ya como lead sincronizado.~~ ⚠️ **Superado el
  16-sep por el ADR 0021:** el closer crea a mano el lead que llegó sin formulario (WhatsApp,
  referido, evento), y el deal nace en Pendiente Setteo, En Contacto o Compromiso Verbal.
- No sube archivos **como recursos**: los recursos son links (ADR 0017). ⚠️ **El comprobante de un
  abono sí puede ser una foto** (ticket 035), guardada en Supabase Storage (ADR 0047).
- No convierte monedas: cada monto va con su moneda y la caja se suma por moneda.
- No incluye el lead magnet de Juan Pablo ni el newsletter de SendGrid.
- No migra el historial completo como parte del MVP (ver supuestos).
- No conecta Kapso ni Addi todavía. ⚠️ **Typeform** entra por webhook (22-sep, T1). 🧭 **Calendly**
  entra el 24-sep (ADR 0049): un token **por programa**, y la cuenta de Calendly de cada closer
  **por programa**, en su membresía, para emparejar al host. Sin la integración, la fecha de la
  llamada la pone el closer.
- 🧭 **No recibe todavía las ventas de los checkouts** (Hotmart, PayPal, MercadoPago): el builder genera
  links con UTM hacia ellos, pero que la venta vuelva sola al CRM es una integración posterior. Mientras
  tanto el closer registra el abono (ADR 0051 punto 7).
- No expone una API propia para herramientas externas (ADR 0006).
- No envía recordatorios de seguimiento. Sí guarda la fecha de seguimiento, que es el dato que
  esa función futura va a necesitar.
- ⚠️ **El kanban ENTRA (21-sep).** Era la línea *"No incluye vista kanban ni calendario"*. El
  Kanban por programa con las diez etapas es la vista principal del closer (ADR 0037, etapa 6 del
  plan v2). **El calendario sigue fuera.**
- ⚠️ **Del onboarding entra UN dato y nada más (21-sep):** `onboarded_at` en el deal, un
  timestamp para saber **cuándo** se hizo. El Excel de Daniel Rincón, los accesos, los bonos y la
  factura siguen fuera.
- ⚠️ **NO entra (21-sep, dicho por Alejo):** el dashboard de **videos editados y publicados por
  creador**. Él mismo lo marcó como no prioritario —*"primero ventas"*— y además no es de este
  producto: es producción de contenido, y pertenece a la herramienta de contenido.
- ⚠️ **NO entra: ingerir ni analizar transcripts de llamadas.** El CRM guarda **el link de Grain**,
  que es lo que marca que la llamada sucedió (ticket 058). Analizarlos es sales enablement, otro
  ciclo y otro calendario.
- ⚠️ **NO entra: un constructor de consultas.** El dashboard gana filtros **desde la URL** (ADR 0023)
  y las consultas devuelven series con sus dimensiones, que es lo que hace posible filtrar sin
  reescribir. Las **vistas guardadas** entran cuando exista la queja de re-armar el filtro, no antes.
- ⚠️ **NO entra: normalizar los UTM ni reescribir el histórico.** El texto se guarda como llegó
  (ADR 0004). El estándar de UTM rige **hacia adelante** y lo impone el builder del CRM (ADR 0046 y
  0051); el histórico se clasifica con reglas del catálogo de Canales, sin reescribir el crudo.
- ⚠️ **NO entra: unir un Lead de un programa con el del otro.** El programa es **frontera, no
  filtro**. Lo único cruzado es un aviso de pantalla en la ficha del Lead, que **ninguna métrica
  usa** (ADR 0043).

## 3. Usuario

- **Closer** (Andrea Machado, Maru Marquez, Jero, Sebastián Salazar, Sebastián Rodríguez, y quien se
  sume; 🧭 cada uno ve solo los programas donde tiene membresía): su momento de mayor tensión es al colgar una
  llamada. Hoy sale de ese momento a mandar un screenshot al grupo o a pedir un link de PayPal.
- **Gerente** (Alejandro Carvajal, Daniel Tovar, Michael): su momento de mayor tensión es
  preguntar en el grupo "¿cuántas calls, cuántos no-show, cuántas ventas hoy?" y depender de que
  Mike arme el PDF.
- 🧭 **Paid Trafficker** (el equipo de pauta, externo): crea las campañas de sus programas y genera
  sus links con UTM dentro del CRM, para que ningún link de pauta salga sin el estándar (ADR 0052).
- **Developer** (Mani y quien mantenga la herramienta): necesita saber si el sync corrió, qué
  falló y qué cambió en la configuración sin abrir la base a mano.

## 4. Flujo

🧭 **Flujo vigente desde el 21 y el 24-sep** (el de 5 pasos de abajo es el del MVP y queda como
historia). Detalle, con diagramas, en el documento de referencia §2.3 a §2.6:

1. El lead llena el formulario del programa. El envío llega por webhook y el CRM lo clasifica:
   Descartado (lead sin deal), Setteo (deal en Pendiente Setteo, sin dueño) o Con Calendly (agendó
   dentro del formulario: deal en Agendado).
2. Calendly cuelga la llamada de su deal con fecha real y host; si no hay duda del emparejamiento, el
   host queda como dueño. Si hay duda, la llamada queda suelta en el Inbox.
3. El closer abre su **Inbox**: reclama lo que no tiene dueño, asigna las llamadas sueltas y atiende
   lo vencido. Registra cada contacto.
4. Después de la llamada pega el Grain (el deal pasa a Atendido) y elige cómo terminó: pagó ahora,
   compromiso, seguimiento, próxima cohorte o perdido.
5. Si pagó, registra el abono con su comprobante y las cuotas pactadas: el deal pasa solo a Abonado y
   a Completo cuando el saldo llega a cero. La venta queda en la cohorte activa del programa.
6. Gerencia (y cada closer, en sus programas) ve el Dashboard por programa o "todos los programas".

**Flujo del MVP (historia, 16-sep):**

1. El closer termina una llamada y entra al CRM con su cuenta de Google.
2. Busca al lead entre los ya sincronizados. La cohorte se asigna sola (la activa del programa).
3. Registra resultado, origen y nota. Según el resultado aparece fecha de seguimiento, motivo, o
   los campos de venta (producto, precio, plataforma, primer abono, link del comprobante). Si
   falta un producto o una plataforma, la crea ahí mismo (productos) o se la pide a un gerente
   (plataformas).
4. El registro aparece de inmediato en el dashboard, atribuido al closer de la sesión.
5. Cualquier closer o gerente abre el dashboard del programa, filtra por fecha y closer, y ve la
   operación del día, la semana, la cohorte y el mes.

## 5. Criterios de aceptación

1. Dado un closer autenticado, cuando registra una llamada cerrada con su venta y su primer
   abono, entonces quedan guardados con su closer, cohorte, programa y producto correctos, y
   aparecen en el dashboard sin usar WhatsApp.
2. Dado un cierre registrado por cualquier closer, cuando otro closer **del mismo programa** o un
   gerente abre el dashboard, entonces ambos ven el mismo dato (ADR 0009, 🧭 acotado por el ADR 0048).
   Un closer sin membresía en ese programa no lo ve.
3. Dado un gerente que filtra por programa y rango de fechas, entonces ve agendas, show, ventas,
   % de cierre y caja recaudada calculados desde los registros, con la caja sumando los abonos
   de ese rango (aunque la venta sea de antes).
4. Dado un gerente que crea un programa nuevo con su cohorte, su fuente y sus recursos desde
   `/ajustes`, entonces el programa aparece en la navegación, su dashboard funciona y sus leads
   sincronizan, sin ningún cambio de código.
5. Dado un gerente que da de alta un closer nuevo y lo asigna a un programa, entonces ese closer
   puede registrar llamadas y aparece en las métricas del programa.
6. Dado un closer que necesita un brochure o un link de pago, cuando entra a Recursos y filtra
   por programa, entonces encuentra la versión vigente y la copia en un clic.

## 6. Datos

- **Identidad del lead**: nombre, correo y teléfono, capturados por el sync de Sheets.
- **Datos de la llamada**: resultado, nota, origen, fecha de seguimiento, motivo. Son
  observación del equipo comercial.
- **Datos de la venta y abonos**: producto, precio del contrato, plataforma, monto, moneda, fecha
  y link del comprobante. Son datos financieros operativos de la empresa. No se pide número de
  tarjeta, cuenta bancaria ni ningún dato que identifique un instrumento de pago.
- ⚠️ **Comisión (21-sep): entra.** Es `tasa_del_programa × precio del producto`, **calculada y
  nunca guardada** (ADR 0024), visible en el dashboard por closer. La tasa vive en el programa como
  instancia (🩸 hoy 80/697 en ComunicArte y 100/1.500 en Tactical).
- ⚠️ **Cédula (21-sep): NO se guarda.** Aparece en la pestaña `Estudiantes Septiembre` de
  ComunicArte y no entra al CRM, salvo que el equipo lo pida explícitamente.
- **Configuración**: programas, cohortes, metas, productos, catálogos, fuentes, recursos,
  enlaces de pago. Toda alta o cambio queda en `change_log`. ⚠️ **21-sep:** el rastro deja de ser
  solo de la configuración y cubre también las tablas operativas (deals, calls, abonos,
  actividades), desde el primer día (ADR 0042).
- **Marco regulatorio**: **resuelto el 19-sep.** Mani lo consultó con el equipo: no hay
  obligaciones extra. Son datos que los leads entregaron por su cuenta en el formulario, y de los
  pagos solo se guardan montos y plataforma, nada que identifique un instrumento de pago. Todo es
  de y para Retia.
- **Retención**: **para siempre (Mani, 19-sep).** No se borra ni el lead ni `people.raw`. Eso
  convierte el crecimiento en una pregunta de escala, no de política: ver la entrada de
  escalabilidad en el roadmap del handoff, con las cifras medidas.

## 7. Supuestos por validar

🧭 **Abiertos el 24-sep, para la reunión con Comercial** (detalle en el documento de referencia §6):

- [ ] La tabla de transiciones propuesta (ticket 043): ¿sobra, falta o se salta alguna etapa?
- [ ] Qué cae en el Inbox, y el X de "deal sin actividad en X días".
- [x] **Resuelto por Mani (24-sep):** Seguimiento es una etapa (la 11); se valida con los closers.
- [ ] De quién es el deal si el host de Calendly es otra closer que la que ya lo trabajaba.
- [ ] Desde cuándo alguien es "estudiante confirmado" de la cohorte: primer abono o pago completo.
- [ ] Quién hace el onboarding y si la tab Students lleva un checklist (accesos, factura, bonos).
- [ ] Hasta cuántos días atrás se migran los leads de Setteo con deal.
- [ ] **Resuelto el 24-sep:** los deals históricos no los abre el sync; entran con la migración,
      respetando su estado de gestión.
- [ ] Gerencia: el área de cada canal; qué ve el Paid Trafficker; precio de lista de ComunicArte
      (797 o 697).

- [x] "Todos ven todo" (caja incluida): **confirmado por Mani el 16-sep** (ADR 0009 queda firme).
- [ ] Import histórico: **sí se importa el histórico de C2 (confirmado por Mani el 16-sep).** Los
      dos consolidados de Michael (`docs/insumos/historico-c2/`) tienen discrepancias
      documentadas: qué se reconcilia y qué se descarta se define al abrir el ticket.
      **Prioridad fijada el 19-sep (Mani): es lo ÚLTIMO que se revisa.** Queda anotado a propósito,
      no olvidado: no se abre ticket ni se toca hasta que todo lo demás esté cerrado.
      ⚠️ **21-sep: crece de alcance y se convierte en la migración one-time (etapa 7 del plan
      v2).** Ya no es solo el histórico de estudiantes de C2: barre también las pestañas de
      `Setteo`, `Registro de llamadas` y `Forms viejo` de las dos hojas. **Sigue siendo lo último**
      —se hace con el scaffold completo— y pasa por **la misma función de ingesta** que el sync,
      nunca por inserts crudos, dejando su rastro en `change_log` (ADR 0029). Los cobros en COP se
      convierten a la tasa del día de la migración.
- [x] Los leads se sincronizan desde Sheets (**confirmado por Michael el 16-sep**, ADR 0004 queda
      firme). Cada fuente declara sus columnas; no se exige que las hojas tengan la misma forma.
- [x] Qué pasa si el closer no encuentra al lead (llegó por WhatsApp directo o por masivos sin
      aplicar). **Resuelto 16-sep (ADR 0021):** el closer lo crea en el CRM y queda como su
      responsable; toda persona puede tener un responsable que se asigna en la app (ticket 026).
- [x] Formato del snapshot y quién puede tomarlo: **PDF (Mani, 18-sep) y lo toman los dos roles,
      igual que el dashboard (Mani, 19-sep).** Coherente con el ADR 0009: si un closer ya ve la caja
      y el comparativo en pantalla, impedirle bajar en PDF lo que tiene enfrente es una reja que no
      protege nada, y el PDF recibe el mismo objeto que pintó la pantalla (ADR 0024), así que no
      expone nada nuevo. El 021 deja de estar bloqueado; sigue siendo el último de la fila.
- [ ] ⚠️ **Los success floors de Gerencia (21-sep).** Alejo: *"cuando el CRM ya se tenga, se puede
      definir lo que muestran las métricas del dash gerencial y el reporte daily."* **Sin umbral, la
      vista de Gerencia no puede pasar de tabla a estado**, que es lo que su propio dolor pide. Se
      construye con el slot vacío (ticket 090) y se pide antes de la etapa 5, no después.
- [ ] ⚠️ **El mapeo UTM → área (21-sep).** Lo nombró Alejo como el trabajo que falta y **es la llave
      de su propio dolor**. No arranca en hoja en blanco: se le lleva la lista de `utm_source`
      distintos que hay en la base y se le pide asignar cada uno.
- [ ] ⚠️ **¿Un lead que trae un closer cuenta distinto para su comisión o su meta?** Es de negocio,
      no de código, y hoy no tiene respuesta. No bloquea: el dato queda escrito igual (ADR 0044).
- [ ] ⚠️ **Reconfigurar los UTM en Meta al estándar de tres campos.** Mientras el CRM no genere los
      links (ticket 092), las macros las escribe el paid trafficker y **es una acción de Ops**, que va
      al playbook antes que al repo. **Con el link generado deja de depender de él:** pega un link que
      ya trae los tres UTM correctos (ADR 0046).
- [x] Si los closers pueden agregar recursos: **sí (Mani, 19-sep).** Se aplica el molde del ADR
      0016 que ya rige los productos: quien administra entra a cualquier programa, un closer solo
      a los programas donde tiene membresía ACTIVA. **Supuesto declarado, no preguntado:** un
      closer NO puede crear un recurso global (`program_id` nulo), porque un recurso sin programa
      no es de ninguno suyo.
- [x] Si las plataformas de pago las puede crear un closer: **sí (Mani, 19-sep).** Ojo a la
      asimetría con los recursos, que se le planteó al decidir: una plataforma NO tiene programa,
      así que no hay membresía que acote el alcance — un closer que crea una plataforma la crea
      para todos los programas. Se acepta a sabiendas.
- [x] Moneda de los abonos: **todo en USD (Michael, 16-sep).** Si el pago entra en COP, el closer
      lo convierte al registrarlo (Mani, 16-sep); el sistema no convierte solo.
- [x] Calendly individual por closer o cuenta compartida: **resuelto el 21-sep.** Ni lo uno ni lo
      otro: **un Personal Access Token por programa**, porque cada programa tiene su Calendly igual
      que tiene su formulario. Eso trae la fecha real, el closer del Round Robin y las
      cancelaciones. La integración sigue fuera del alcance; lo que se cerró es su forma.
- [x] Marco regulatorio de datos financieros: **cerrado el 19-sep.** Mani habló con el equipo y no
      hay obligaciones extra bajo habeas data: la información la dieron los leads por su cuenta y
      los pagos no guardan datos delicados (solo monto y plataforma, nunca un instrumento de pago).
- [x] Retención de datos personales: **para siempre (Mani, 19-sep).** Ni el lead ni `people.raw`
      se borran. Lo que queda abierto no es la política sino la **escalabilidad**, que Mani pidió
      atacar en su propia sesión.
