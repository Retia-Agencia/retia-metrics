# Overview del CRM de Retia

Qué es la herramienta, para quién, qué hace y qué no, de principio a fin. Es la lectura para entender
el producto sin abrir código. Los diagramas y los componentes están en
[`structure.md`](./structure.md); cómo se opera, en [`operations.md`](./operations.md); en qué orden
se construye y qué falta decidir, en [`plan.md`](./plan.md); el porqué de cada decisión, en
[`adr/`](./adr/README.md).

Consolidado el 27-sep-2026 a partir de la spec (16 al 24-sep), el diseño del producto, el glosario,
las reuniones de septiembre y los datos de las dos hojas. Leyenda: ✅ decidido · 🟡 propuesta · 🔴 falta
decidir.

---

## 1. El problema

Retia es una agencia de gestión de infoproductos que vende programas de alto ticket por llamada. Hoy
tiene dos: **ComunicArte** y **Tactical Investor**.

El pipeline de ventas está desconectado:

- Los closers mandan los comprobantes de pago como **screenshots a un grupo de WhatsApp**, y se pierden.
- Hay **una hoja de Google Sheets por programa**. Ahí caen los leads del formulario, un Apps Script los
  clasifica, y los closers registran las llamadas **a mano**, en texto libre.
- El reporte diario lo armaba Michael a mano: grupo de WhatsApp, calendario compartido y resumen de
  las closers, pasados por su Claude personal, y un PDF para Gerencia. **El dato quedaba atrapado ahí.**

La pregunta más cara de la empresa la hizo Daniel Tovar: *"no sé si estoy perdiendo plata o no con la
pauta"*. Nadie la puede responder sin trabajo manual porque la cadena se corta en tres puntos:

1. El UTM entra con el lead y **no llega a la venta**.
2. El comprobante de pago **nace en un chat** y alguien lo transcribe a mano.
3. El ROAS se calculaba a mano y **se dejó de calcular** sin que nadie lo decidiera.

| Hoy | Con el CRM |
|---|---|
| Comprobantes como screenshots en un grupo | El abono registrado como dato, con su comprobante |
| Dos hojas manuales, una por programa | Una base central, con la misma forma para todos los programas |
| Michael reconcilia tres fuentes y arma un PDF | El dashboard se calcula solo desde lo registrado |
| "¿Cómo vamos?" depende de que alguien lo genere | Cualquier gerente o closer lo ve en vivo y lo verifica |
| Las etapas viven en etiquetas de WhatsApp Business | Las etapas viven en el deal, con historial |

## 2. Qué es

**El lugar donde vive la operación comercial de Retia: los leads, los deals, las llamadas, los pagos y
la plata cobrada, con las métricas calculándose solas encima.** No es un dashboard que refleja lo que
sigue viviendo en WhatsApp: es donde se trabaja el pipeline.

**Lo que tiene que trackear, sí o sí:**

1. **El camino de cada deal**, desde que llega el lead hasta que se pierde o se paga completo, con todo
   colgado: programa, producto, cohorte, closer, llamadas, Grain, abonos, comprobantes, acuerdo de
   pago e historial.
2. **El origen de cada lead**: UTM estandarizado cruzado con la inversión en pauta, para saber qué
   canal, qué campaña y qué closer convierten.

**Principios** (del diseño del 20-sep, vigentes):

- **Toda la información de la operación en un solo lugar.** Lo que no entra hoy (Kapso, Grain por API)
  queda con su enganche previsto.
- **Cero error humano en los campos.** Cada etapa tiene requisitos; el sistema mueve el deal cuando el
  requisito se cumple y bloquea cuando no. Nada que decida se escribe a mano.
- **Base normalizada:** lo derivable se calcula, no se guarda.
- **Nada escrito a mano en el código que el negocio deba poder cambiar:** programas, productos,
  campañas, closers y motivos son filas que el equipo crea (ADR 0012). *"El equipo crea sus productos;
  Mani construye la herramienta."*
- **Cada programa es independiente:** la misma persona en dos programas son dos leads, y las tasas de
  dos programas nunca se combinan (ADR 0043).
- **Inspiración: HubSpot**, su forma de conectar objetos (contactos, deals, actividades), adaptada. No
  se compra HubSpot: se decidió construir el 19-sep, y la revisión del 22-sep lo recomendó de nuevo
  (queda por ratificar, R10) porque reproduciría la dispersión que
  tiene 30X (un pipeline por programa, dinero en campos duplicados) y no expresa el programa como
  frontera ni los abonos como filas.

## 3. Los programas

| | ComunicArte | Tactical Investor |
|---|---|---|
| Qué es | Comunicación ejecutiva. Virtual en vivo, 2 meses. Facilitan Milena Morales y Rosario Gómez | De Cero a Tactical Investor, trading, con Juan Pablo Vieira. Mes 1: 12 sesiones de 2 h (mar, mié y jue, 6 a 8 p.m.); mes 2: 4 sesiones. Grabaciones por un año |
| ICP | Gerentes y jefes de área con equipo a cargo, de 30 a 50 años | Personas con ingreso declarado de USD 1.000 o más |
| Precio de lista | USD 797 desde el 13-ago (antes 697, que se respetó a quien ya lo tenía cotizado). ✅ Confirmado por Mani el 28-sep: el de lista es 797 | USD 1.500 a la TRM del día |
| Condiciones | Único descuento: USD 100 por dificultad real de pago (beca). Mentoría 1:1 de USD 1.590 (6 sesiones), solo si la piden | Pago único con 10% de descuento, USD 1.350, vigente 24 h desde la llamada. Reserva con USD 500 y saldo con fechas; 2 o 3 cuotas |
| Quién ve el Calendly en el formulario | ingreso de ~USD 1.500 o más (medido el 23-sep) | ingreso de USD 3.000 o más (observado) |
| Comisión del closer (hoja) | 80 por cada 697 | 100 por cada 1.500 |
| Cohorte C2 | meta 50 cupos · venta del 14-ago al 21-sep (27 días hábiles) · clases el 22-sep | meta 50 cupos del equipo (lo del webinar no cuenta) · venta del 19-ago al 29-sep (30 días hábiles) · clases el 29-sep · C3: clases el 10-nov, venta desde el 30-sep |

Datos de los consolidados de C2 de Michael (14-sep) y de las hojas; cada cohorte guarda su propia
ventana, meta y precio (ADR 0022). Las URLs de cada programa están en `operations.md`.

**Medios de pago en uso:** PayPal, MercadoPago, Hotmart, Bancolombia, Zelle, DollarApp, Global66 y
Binance/USDT. Los abonos se registran siempre en **USD** (Michael, 16-sep).

## 4. Quién lo usa

| Rol | Quiénes | Su momento de tensión hoy |
|---|---|---|
| **Closer** | Andrea Machado y Maru Marquez (confirmadas por Michael el 16-sep) y Jero (Jerónimo, del equipo de Vieira), los tres en la reunión del 24-sep. La spec nombraba además a Sebastián Salazar y Sebastián Rodríguez, sin confirmar | al colgar una llamada: sale a mandar un screenshot al grupo o a pedir un link de PayPal |
| **Gerente** | Alejandro Carvajal (Alejo) y Daniel Tovar; Michael Castellanos (Ops) está saliendo | preguntar en el grupo "¿cuántas calls, cuántos no-show, cuántas ventas hoy?" y esperar el PDF |
| **Paid Trafficker** | el equipo de pauta, externo | armar links de campaña sin un estándar de UTM |
| **Developer** | Mani y quien mantenga la herramienta | saber si algo falló o qué cambió sin abrir la base a mano |

**Cuentas.** Cada closer entra con **su propia cuenta de Google**, así sus llamadas y pagos quedan a su
nombre. Los gerentes comparten `administrativa@retiagrowth.com`, que no registra llamadas atribuidas a
un closer. El developer entra con cualquier cuenta a la que se le asigne el rol. Quien controla el
acceso es la tabla `users`, no Google.

Retia se organiza además en **cuatro áreas** (Gerencial, Comercial, Pauta y Media), que no son roles:
agrupan leads y deals según su origen (ADR 0043).

### Lo que cada rol hace en el CRM terminado

**Closer** (ve solo los programas de su membresía, ADR 0048):

1. Abre el **Inbox** de su programa: lo que no tiene dueño, las llamadas que Calendly no pudo colgar sin
   duda, y lo suyo que necesita atención (llamada de hoy sin resultado, re-agenda sin fecha, compromiso
   vencido, fecha límite de pago vencida con saldo).
2. **Reclama** el Setteo, que viene ordenado por ingreso declarado y por recencia. El reparto por turno
   de la hoja se retira.
3. Registra cada contacto con canal y nota (reemplaza las columnas `Registro 1-5`).
4. Después de la llamada **pega el link de Grain** y el deal pasa solo a Atendido. Responde **"¿Cómo
   terminó?"** con uno de seis botones: pagó ahora, compromiso, seguimiento, otra llamada, próxima
   cohorte o perdido. No existe "no cerró" sin decir qué sigue.
5. Si cerró: elige el producto (el precio viene del producto), registra el abono con su comprobante
   (foto o link) y, si queda saldo, la **fecha límite de pago** (prellenada con el inicio de clases) y
   una nota del acuerdo. El deal pasa solo a Abonado, y a Completo con saldo cero.
6. Encuentra brochures y links de pago en **Resources**, en un clic.
7. Ve el **Dashboard** de sus programas completo, incluido el comparativo entre closers, y su comisión
   calculada.
8. Tiene **su link de captación** por programa, para que el lead que trae cuente como suyo.

Deja de hacer: mandar el comprobante al grupo, llenar el registro a mano, escribir Sí/No, buscar links
en WhatsApp, calcular su comisión.

**Gerente:** abre el **Dashboard** de un programa o de "todos los programas" (ahí solo aparece lo que
se puede sumar); ve cierres, show, caja, meta y meta dinámica, rendimiento por closer, por canal y por
área, y el origen de cada venta hasta la campaña; revisa la cartera vencida y los deals sin dueño y
reasigna; registra campañas y su gasto y genera los links con UTM; administra programas, cohortes,
productos, usuarios y membresías.

**Paid Trafficker:** crea las campañas de sus programas, genera sus links desde el builder y carga su
gasto. No ve deals, llamadas ni abonos (ADR 0052). 🔴 Qué ve del Dashboard lo decide Gerencia.

**Developer:** todo, sin restricción, más Nerd Stats (salud de la herramienta y bitácora de cambios) y
"ver como" gerente o closer (ADR 0025, 0028).

## 5. El recorrido de un lead, de principio a fin

1. **Llega el envío.** La persona llena el formulario del programa (Typeform hoy; Dapta Forms es la
   alternativa evaluada) y el envío llega al CRM por webhook, con todas sus respuestas y sus UTM. Se
   guarda aunque esté a medias: un envío parcial es un abandono contactable.
2. **Se identifica a la persona.** Mismo correo, mismo lead. Mismo teléfono con otro correo: se une y
   se marca para que un gerente lo revise, nunca se fusiona a ciegas.
3. **Se clasifica.** El envío sale como Descartado (no hay deal), Setteo (calificó pero no agendó: deal
   nuevo en Pendiente Setteo, sin dueño) o Con Calendly (agendó dentro del formulario: deal nuevo en
   Agendado). 🔴 Si esa clasificación la da el formulario o la calcula el CRM está por decidir
   (`plan.md` §7, A1).
4. **Se trabaja.** El closer reclama el Setteo desde el Inbox y lo contacta (En Contacto). Cuando hay
   cita, Calendly cuelga la llamada del deal con su fecha real y su host; si no hay certeza de a qué
   deal va, queda suelta en el Inbox.
5. **La llamada.** Si ocurre, se pega el Grain (Atendido). Si falla, el deal va a Re-agenda con motivo.
   Un deal tiene todas las llamadas que haga falta y nunca se duplica.
6. **Cómo terminó.** Pagó (Abonado o Completo), dijo que sí y paga después (Compromiso Verbal, con
   fecha límite), lo va a pensar (Seguimiento), quiere la siguiente cohorte (Próxima Cohorte), o dijo
   que no (Cierre Perdido, con motivo).
7. **El pago.** Cada abono es una fila con su comprobante. La etapa la mueve la plata: primer abono,
   Abonado; saldo en cero, Completo.
8. **Estudiante.** Un deal en Abonado o Completo es un estudiante de la cohorte de su deal. Se marca
   cuándo se le hizo el onboarding (`onboarded_at`), sin checklist.
9. **El origen.** Todo el tiempo, el lead lleva su canal, su área, su campaña y, si lo trajo un closer,
   quién. Con el gasto de cada campaña cargado, el CRM dice qué canal y qué campaña convierten.

**Las once etapas del deal** (el número es un nombre, no el orden): 1 Pendiente Setteo · 2 En Contacto ·
4 Agendado · 3 Pendiente Re-agenda · 5 Atendido · 11 Seguimiento · 6 Compromiso Verbal · 7 Abonado ·
8 Completo · 9 Próxima Cohorte · 10 Cierre Perdido. Qué mueve cada una y con qué requisito, en
`structure.md` (el motor de etapas).

## 6. Qué información guarda, y las reglas que no se rompen

| Se guarda | Para qué |
|---|---|
| El lead y todos sus correos y teléfonos | que la misma persona no sea tres |
| Cada envío del formulario, con todas sus respuestas | volver atrás a ver qué contestó, aunque hoy no se use ese campo |
| Los UTM de cada envío | la atribución: de qué canal y qué campaña vino |
| El deal, su etapa y su dueño | en qué va cada oportunidad y de quién es |
| Cada cambio de etapa, con fecha y persona | la conversión y el tiempo en cada etapa. **No se puede reconstruir después** |
| Las llamadas, con su Grain y su resultado | saber qué pasó en cada una |
| Cada abono por separado | la caja cobrada es distinta de las ventas |
| Todo movimiento, con quién y cuándo | auditoría: *"¿quién cambió esto?"* tiene respuesta |

- **Toda tasa se cuenta sobre personas, nunca sobre filas.** Contar filas infla las tasas cerca de un
  60% (Tactical tenía ~2.950 filas que eran ~1.840 personas).
- **Caja recaudada ≠ ventas.** La caja es la suma de los abonos por la fecha del abono; las ventas son
  los deals en Abonado o Completo. Nunca se deriva una de la otra.
- **Anular ≠ Cierre Perdido.** Perdido es "el lead dijo que no" y cuenta en el embudo. Anulado es "este
  registro nunca debió existir" y no cuenta en ninguna métrica.
- **Nunca se convierte moneda en silencio.** El ticket va en USD, la pauta en COP; la moneda va al lado
  del número.
- **Todas las fechas son de Bogotá** (`-05:00`, sin horario de verano).
- **Días hábiles:** todo lo que no sea sábado o domingo; los festivos cuentan como hábiles (regla de
  Retia, no del calendario colombiano).
- **Nada es público.** Sin sesión no se ve ni una cifra, y ningún dato personal va en una URL.
- **Retención: para siempre** (Mani, 19-sep). No se borra ni el lead ni sus respuestas.
- **No se guarda** ningún dato de tarjeta, cuenta bancaria ni instrumento de pago (solo monto y
  plataforma), ni la cédula. Marco regulatorio revisado con el equipo el 19-sep: sin obligaciones
  extra, porque los datos los entregaron los leads y los pagos no guardan datos delicados.

## 7. Qué mide

| Métrica | Qué es |
|---|---|
| Lead a venta | ventas ÷ leads (personas) |
| Invitado a venta | ventas ÷ leads que agendaron. Umbral operativo 15%: por debajo, el problema es la operación, no el volumen de leads |
| % de show | llamadas con show ÷ llamadas agendadas en el rango |
| % de cierre | cierres ÷ llamadas con show. 🟡 Propuesta: el cierre se cuenta en deals, no en llamadas |
| Caja recaudada | suma de abonos cuya fecha cae en el rango |
| Meta de cupos y meta dinámica | de la cohorte; la dinámica es lo que falta ÷ días hábiles que quedan, cada día |
| Contribución | las ventas de la cohorte de un closer. **No existe meta individual** (ADR 0023) |
| Conversión etapa a etapa y tiempo en etapa | cuenta deals distintos, no entradas |
| Registros vs agendas por canal | la métrica de Media: TikTok puede traer muchos registros y pocas agendas |
| CPL, costo por agenda, CAC, ROAS | por campaña y canal, solo donde hay gasto cargado ("sin pauta" en vez de $0). Estándar de Daniel Tovar: costo por agenda USD 20, alerta en USD 100 |
| Leads por área | Gerencial, Comercial, Pauta, Media, derivados del canal |
| Comisión | tasa del programa × precio del producto, calculada |

Lo que pidió cada área (Alejo, 21-sep): **Comercial**, close rate, show rate y el estado del lead por
etapa; **Pauta**, todo por UTM, por fecha, canal e inversión; **Media**, registros contra agendas por
canal; **Gerencial**, rendimiento de las áreas, % de cierre por closer y leads por área. Gerencia pidió
además números y tablas antes que estética, y un reporte de un botón. Los umbrales de éxito llegan
cuando haya datos. Criterio para el dashboard: el número que no soporta una decisión, no va.

Dos cubetas de origen huérfano, siempre visibles y nunca juntas: **sin UTM** (llegó sin origen:
irrecuperable; el 21-sep era el 15% de los leads, 26% en Tactical) y **sin clasificar** (trae UTM pero
no casa con ningún canal o campaña: se arregla con una fila y repara hacia atrás).

## 8. Alcance

**Entra en v1:** leads por formulario y alta manual; deals con once etapas y Kanban; llamadas colgadas
del deal, con Calendly; abonos con comprobante (link o foto); acuerdo de pago como nota con fecha
límite; Students por cohorte con onboarding; productos, recursos y links de pago; Inbox; Dashboard por
programa y agregado de lo sumable; atribución por canal, campaña y área; builder de links; roles
closer, gerente, paid trafficker y developer; Nerd Stats con bitácora; snapshot del dashboard en PDF (lo toman todos los roles y recibe el mismo
objeto que pintó la pantalla, 19-sep);
el traslado y la migración de lo que hay en Sheets.

**No entra en v1:**

- Kapso o WhatsApp dentro del CRM, y recordatorios automáticos (se guarda la fecha que necesitarían).
- Análisis de los transcripts de Grain. Mani propuso a futuro algo que prepare el guion de la llamada
  según lo que convierte (24-sep).
- El PDF narrativo de Michael: el dashboard **es** el reporte.
- Ventas que vuelven solas desde los checkouts (Hotmart, PayPal, MercadoPago).
- Acortador de links, URL libre en el builder, desglose por conjunto o por anuncio.
- Constructor de consultas y vistas guardadas (entran cuando alguien se queje de rearmar un filtro).
- Cuotas pactadas fila por fila (ADR 0053), calendario, checklist de onboarding.
- Unir el lead de un programa con el del otro (solo un aviso en la ficha).
- El lead magnet de Juan Pablo, el newsletter, el dashboard de videos por creador ("primero ventas").
- Una API propia para herramientas externas.

## 9. Criterios de aceptación

1. Un closer registra una llamada cerrada con su venta y su primer abono, y quedan con su closer,
   cohorte, programa y producto correctos, visibles en el dashboard sin usar WhatsApp.
2. Un cierre de cualquier closer lo ven igual otro closer **del mismo programa** y un gerente; un closer
   sin membresía en ese programa no lo ve.
3. Un gerente que filtra por programa y fechas ve agendas, show, ventas, % de cierre y caja calculados
   desde los registros, con la caja sumando los abonos del rango aunque la venta sea de antes.
4. Un gerente crea un programa nuevo con su cohorte, su fuente y sus recursos desde la app, y el
   programa funciona sin tocar código.
5. Un gerente da de alta un closer, lo asigna a un programa, y ese closer registra y aparece en las
   métricas del programa.
6. Un closer que necesita un brochure o un link de pago lo encuentra vigente en Resources y lo copia en
   un clic. ✅ hecho.

Qué paso del plan cumple cada uno: `plan.md` §6.

## 10. De dónde salió

| Fecha | Qué pasó |
|---|---|
| 18 y 19-ago | Esqueleto con login de Google, roles y el motor de datos: sync con Sheets y dedup |
| 29-ago al 14-sep | Revisión externa y remediación (21 de 33 hallazgos cerrados) |
| 14-sep | Reunión con Mike, Alejo y Daniel Tovar: CRM propio con dashboard central, los closers registran con su perfil, reporte de un botón, rapidez sobre estética |
| 15 al 20-sep | Spec, ADR y el MVP: programas y catálogos configurables, registro de llamadas y abonos, dashboard, recursos, Nerd Stats |
| 19-sep | Se decide construir el CRM propio y no comprar HubSpot |
| 20 y 21-sep | Modelo tipo HubSpot (Lead, Envío, Deal, etapas), leyendo las hojas y los Apps Script. Reunión con Alejo: las cuatro áreas y el UTM como base de las métricas |
| 22-sep | Revisión del modelo: el setteo vive en el deal. La base se muda a Supabase. Los leads entrarán por webhook, con corte directo |
| 23-sep | La ingesta escribe y califica (6.397 de 6.400 envíos coinciden con la hoja). Sistema de diseño Tinta y paleta de la agencia |
| 24-sep | Dirección de producto (ADR 0048 a 0052). Reunión con los closers (abajo). Mani adopta la tabla de transiciones, el acuerdo de pago como nota (ADR 0053) y "operación antes que analítica" |
| 27-sep | Comercial da luz verde. Se consolida el plan y la documentación. Mani pide que el Estado lo asigne el formulario y un webhook estándar para cualquier formulario |

### Lo que dijeron los closers (24-sep)

Mani con Andrea, Maru y Jero, unos 30 minutos. Las etapas y el modelo Lead → Deal quedaron validados
sin objeciones (*"súper intuitivo"*, *"no vi que se saltaran ninguna parte"*).

- **Validado:** las once etapas y el Kanban; el Grain como requisito para Atendido (todas las llamadas
  se graban); cada closer tiene su cuenta de Calendly y es dueña de sus llamadas (Andrea y Maru tienen
  un correo por programa); el Setteo lo toma el primero que lo ve (el turno fijo de la hoja está
  desactualizado y se retira); onboarding como un sí/no; productos y recursos, sin objeción.
- **N1. Priorizar el Setteo, ya ordenado y no como filtro:** primero quien declaró más de 10.000, luego
  más de 3.000, y así bajando; y qué tan caliente está (quien se acaba de registrar cierra más).
- **N2. El dolor número uno es registrar después de varias llamadas seguidas.** El cierre de una
  llamada tiene que costar pegar el Grain y un clic.
- **N3. Los acuerdos de pago se conversan, no son cuotas fijas.** Regla general: pagar todo antes del
  inicio del programa; como caso extremo, a la mitad. Hay descuentos, con un límite que no se dijo.
- **N4. Los closers no traen leads propios** hoy.
- **N5. UTM: prioridad altísima.** Jero consigue la reunión con Pauta.
- **N6. Juanito** (la automatización de recordatorios, fuera del CRM) falla en los push; los números
  "equivocados" eran de leads que pusieron un teléfono en el formulario y otro en la agenda.
- **N7.** Los Grain se analizan a mano: Andrea y Maru solo pegan el link; Jero saca la transcripción y
  la pasa por Claude.
- Ya usan las **etiquetas de WhatsApp Business** como etapas ("seguimiento", "pagado"): la evidencia de
  que el CRM tiene que reemplazarlas.

## 11. Vocabulario

Los términos del negocio son los mismos en la conversación, en el código, en la base y en la pantalla.

**El modelo**

- **Programa:** una línea de formación con sus leads, su formulario, su Calendly, su meta y sus
  recursos. Es parte de la identidad de un lead: una frontera, no un filtro.
- **Lead:** una persona dentro de un programa. La misma persona en dos programas son dos leads.
- **Envío:** cada vez que alguien llenó el formulario, parcial o completo. Su llave es el token del
  formulario. *No confundir con "registro" en el sentido de Media, que es un envío contado como métrica.*
- **Sobre crudo:** un envío de webhook que llegó con la firma buena y no se pudo procesar (sin correo,
  payload raro, la ingesta falló). Se guarda el cuerpo tal como llegó para reprocesarlo; no es un envío
  todavía (tabla `sobres_crudos`, ticket 106).
- **Deal:** la oportunidad de venderle un programa a un lead. Tiene dueño, etapa, producto y cohorte.
  Como máximo uno abierto por lead y programa.
- **Etapa:** en cuál de los once pasos está un deal. La escribe el CRM. *No confundir con el **Estado**,
  la clasificación de llegada del envío (Descartado, Setteo, Con Calendly).*
- **Dueño:** el closer responsable de un deal. Los deals nacen sin dueño y se reclaman.
- **Llamada suelta:** una llamada de Calendly que no se pudo colgar de un deal sin duda; espera en el
  Inbox.
- **Student:** un deal en Abonado o Completo, en la cohorte de su deal. Es una vista, no una tabla. 🔴 Si
  "estudiante" empieza en el primer abono o con el pago completo está por confirmar.
- **Deal histórico:** un deal que vino de las pestañas de gestión de la hoja (migración de E7). Nace en la
  etapa que dice la hoja, sin recorrer el motor, y lleva su **huella de migración** (ADR 0059).
- **Rareza:** una fila de la hoja que entró (o no pudo entrar) sin poder clasificarse del todo: fecha
  aproximada, monto desconocido, plataforma fuera del catálogo, ya tenía deal vivo. Queda visible con su
  razón; *no es* un anulado, porque de la hoja sí pasó (ticket 080).
- **Anular:** dejar un registro fuera de toda métrica sin borrarlo, con quién, cuándo y por qué. Se ve
  tachado en la ficha. *Evitar: "borrar", "cancelar".*
- **Vigente:** lo contrario de anulado (un registro que cuenta). En recursos, la versión de hoy.

**El ciclo**

- **Cohorte:** el ciclo de venta de un programa, con su meta, su precio y su ventana de venta. Se
  nombran C1, C2, C3; como máximo una activa por programa. *Evitar: "corte".*
- **Ventana de venta:** los dos días entre los que una cohorte vende, inclusive. Los declara el
  negocio; no se deducen.
- **Día hábil, meta de cupos, meta dinámica, contribución:** ver §7.

**El dinero**

- **Producto:** algo que se vende dentro de un programa, con su precio de lista. Cada precio con
  descuento es un producto. Su precio es el ticket del deal.
- **Abono:** un pago recibido, con fecha, monto, moneda, plataforma y comprobante.
- **Saldo:** precio del producto menos lo abonado. Es nulo, no cero, cuando no hay precio.
- **Sobrepago:** un abono que dejaría el saldo negativo; se rechaza salvo confirmación explícita.
- **Acuerdo de pago y fecha límite:** la nota de cómo se pactó pagar el saldo y hasta cuándo. **Cartera
  vencida:** saldo pendiente con la fecha límite pasada.
- **Plataforma de pago:** por dónde entra un pago (PayPal, MercadoPago...). **Enlace de pago:** un link
  de cobro concreto de un programa ("PayPal 797 USD"). Un enlace siempre es de un programa; una
  plataforma puede servir a varios.
- **TRM de la cohorte:** la tasa COP/USD de referencia de una cohorte.

**El origen**

- **Área:** Gerencial, Comercial, Pauta o Media. Agrupa leads por su origen. No es un rol.
- **Canal:** un par `utm_source` + `utm_medium` con su área (`facebook / cpc` es Pauta; `closer /
  referido` es Comercial). *Evitar: "origen" a secas, que es otro catálogo.*
- **Campaña:** una campaña de pauta de un programa, dueña de su `utm_campaign` y de su gasto.
- **Destino:** una URL base de un programa (el formulario o un checkout).
- **Builder:** la pantalla que arma un link con sus UTM. El link se calcula, no se guarda.
- **Link de captación del closer ("Mi link"):** el link del programa con el canal Closer y el código
  opaco del closer. **Origen humano (`traido_por`):** quién trajo a un lead.
- **Sin UTM / sin clasificar:** las dos cubetas de origen huérfano (§7).

**El equipo y el acceso**

- **Closer:** vende y trabaja leads. **Gerente:** además administra. **Paid Trafficker:** crea campañas y
  links. **Developer:** acceso total, la única excepción a la disjunción de roles.
- **Membresía:** a qué programas pertenece un usuario; define qué programas ve un closer.
- **Vista ("ver como"):** con qué rol se proyecta una pantalla del developer. Solo estrecha, nunca
  ensancha.
- **Setteo:** contactar a quien calificó pero no agendó, para convertirlo en agenda.
- **Grain:** la grabación de la llamada; pegar su link es la prueba de que ocurrió.
- **Juanito:** la automatización que manda los recordatorios de las llamadas. **Kapso:** la plataforma
  de WhatsApp para contactar y enviar masivos. Ninguno vive dentro del CRM.
