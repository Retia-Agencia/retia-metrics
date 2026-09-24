# Retia Metrics — Context

Retia es una agencia de gestion de infoproductos que vende programas de alto ticket por
llamada. Este glosario fija el lenguaje del embudo comercial: los mismos terminos que usa el
equipo en la operacion son los que se usan en el codigo, en la base de datos y en la UI.

This file is a **glossary and nothing else** — the project's ubiquitous language. No implementation details, no specs, no decisions (those go in `docs/adr/`). Keep definitions to one or two sentences: define what a term **is**, not what it does. Only include terms specific to this domain — general programming concepts don't belong.

`/grill-with-docs` fills this in as terms get resolved during alignment.

## Language

### Los programas

**Programa**:
Una linea de formacion que Retia vende con su propia BBDD de leads, su Calendly, su meta y sus
recursos. Hoy son dos (Comunicarte y Tactical Investor) y los gerentes pueden crear mas.
_Sus tasas nunca se combinan; solo se suman conteos y dinero en la misma moneda, en la vista "todos
los programas" (ADR 0048)._ Un closer ve solo los programas de su membresia. **Es parte de la
identidad de un Lead, no un filtro sobre el:** la llave es `(program_id, email_normalizado)`, asi que la misma persona en los dos
programas son **dos Leads** (ADR 0043).

**Comunicarte**:
Programa de formacion en comunicacion ejecutiva. Programa completo USD 797 _(abierto: las hojas y la
comision usan 697 como estandar; lo confirma Gerencia)_. Su ICP son gerentes
y jefes de area con equipo a cargo, de 30 a 50 anos.

**Tactical Investor** (tambien **De Cero a Tactical Investor**, o el programa de JP Vieira):
Programa de formacion en trading. Programa completo USD 1.500. Su ICP son personas con ingreso
declarado de USD 1.000 o mas.

**Producto**:
Algo concreto que se vende dentro de un programa, con su precio de lista: el programa completo,
la reserva de cupo, la mentoria 1:1. Gerentes y closers los crean cuando los necesitan.


### El origen y la atribucion

**Area**:
Una de las cuatro unidades en que Retia se organiza: **Gerencial, Comercial, Pauta** (paid
traffickers) y **Media** (redes sociales). Agrupa Leads y Deals por su origen. Es una fila editable,
no un valor del codigo, y **no es un rol**: el rol dice que puede hacer alguien, el area dice a
quien se le atribuye un Lead (ADR 0043). Se deriva del **Canal** del envio, nunca se escribe.

**Canal** (el "Origen" del builder):
Un par `utm_source` + `utm_medium` con su Area: `facebook / cpc` es Pauta, `closer / referido` es
Comercial. Declara ademas que significa `utm_content` en ese canal (ADR 0051).
_Evitar_: "origen" a secas, que es el catalogo `origenes` del ADR 0015 y significa otra cosa.

**Destino**:
Una URL base de un programa hacia la que apunta un link: el formulario o un checkout (ADR 0051).

**Builder** (generador de links):
La pantalla que arma un link con sus UTM a partir de un Destino, un Canal, una Campana y los dos
opcionales. El link se calcula, no se guarda. Replica el builder de 30X.

**Campana**:
Una campana de pauta de un programa, con su plataforma y su cohorte. Es la duena de su patron UTM y
de lo que se invirtio: `ad_spend` cuelga de ella, por fecha. _No tiene niveles debajo: no hay
conjuntos ni anuncios_ (ADR 0045 enmienda 2, ADR 0046 enmienda).

**Patron UTM**:
Una regla que dice a quien pertenece una combinacion de los UTM. Desde el ADR 0051 se expresa en dos
catalogos: el **Canal** (source + medium) y la **Campana** (campaign). Es lo unico que traduce el
origen crudo de un envio a un dueno.

**Estandar de UTM**:
La asignacion fija de que lleva cada campo, igual para todos los programas. **Tres se leen**:
`utm_source` la plataforma, `utm_medium` el tipo de trafico, `utm_campaign` la campana. **Dos se
capturan**: `utm_content` (quien o que pieza, segun el Canal) y `utm_term` (variante libre). Minusculas
y `snake_case` (ADR 0051, que enmienda la enmienda 2 del ADR 0045).

**Sin UTM**:
Un envio que llego **sin origen**: el campo viene vacio. **No es un estado de error, es un hecho del
lead** —tan valido como `facebook / cpc`— y contesta *"a esta persona no sabemos como la
conseguimos"*. Es un problema de **captacion** y para lo que ya entro es **irrecuperable**.

**(sin clasificar)**:
Un envio que **si trae UTM** pero no casa con ningun patron. Es un problema de **configuracion**: se
arregla con una fila y **repara hacia atras**, porque el UTM crudo sigue ahi.
_No se funde con **Sin UTM**: uno se arregla en un minuto y el otro no se arregla nunca. Las dos se
muestran siempre, con su conteo y su porcentaje._

**Origen humano** (`traido_por`):
El usuario que trajo a un Lead: un closer con su referido. Es una llave a `users`, nunca texto, la
escribe solo la ingesta a partir del **codigo del closer** que viaja en `utm_content`, y **el primero
que la escribe gana** (ADR 0044, ADR 0051).

**Link de captacion**:
La URL de un Destino de un programa (formulario o checkout) con sus UTM ya puestos. Lo **genera** el CRM y **no se guarda**:
se calcula. Hay dos clases, la de un anuncio y la de un closer, y **las arma la misma funcion**.

**Enlace de captacion** (el del closer, "Mi link"):
Un **Link de captacion** con el Canal Closer y el **codigo del closer** en `utm_content`. Es **por
closer y programa**. Es lo que hace que el closer no tenga que teclear un UTM.

**Codigo del closer**:
El identificador opaco que el CRM le da a un closer para su link. Nunca es su nombre (ADR 0030, ADR
0051).

**Registro** (vocabulario de Media):
Un **Envio** de formulario: todo el que lleno el Typeform, haya calificado o no. Es el denominador de
la tasa de calificacion de un canal. _No confundir con el "Registro" del vocabulario v1, que era la
fila del formulario vista como lead._

**Agenda** (como metrica):
Un Deal que alcanzo la etapa Agendado. Es el numerador de esa tasa. _Un Registro no es una Agenda: la
diferencia entre los dos, por canal, es la metrica de Media._ Mas abajo, **Agenda** a secas es la cita
en si; aca es el conteo.

### El ciclo

**Cohorte**:
El ciclo de venta de un programa, con su propia meta de cupos, su precio y su ventana de venta. Se
nombran C1, C2, C3, y hay como maximo una cohorte activa por programa.
_Avoid_: "corte" (nombre anterior, reemplazado el 16-sep-2026).

**Ventana de venta**:
Los dos dias entre los que una cohorte vende, inclusive: el inicio y el cierre de ventas. Los
declara el negocio por cohorte, no salen de una regla (ADR 0022): ni el inicio se deduce del
cierre de la cohorte anterior, ni el cierre del inicio de clases. Sobre esta ventana se cuentan
los dias habiles de la cohorte y la meta dinamica.

**Cohorte activa**:
La cohorte de un programa que esta vendiendo hoy. Toda llamada y venta registrada en la app se
asigna a ella sin que el closer la elija.

**Dia habil**:
Cualquier dia que no sea sabado ni domingo. Los festivos cuentan como habiles.
_Esta es una regla de Retia, no del calendario colombiano._

**Meta de cupos**:
Cuantas ventas debe cerrar una cohorte.

**Meta dinamica**:
Lo que falta para la meta de cupos dividido entre los dias habiles que le quedan a la cohorte,
recalculado cada dia.

### Las etapas del embudo

> ⚠️ **Las dos definiciones que siguen quedaron SUPERADAS el 21-sep por el modelo v2** (ver
> _Vocabulario del modelo v2_ al final). Se conservan porque describen el vocabulario con el que se
> escribio el MVP y lo que todavia dice la hoja. **En el modelo nuevo: Lead = la persona en un
> programa, y la fila del formulario se llama Envio.** Y "Registro", en el vocabulario de Media,
> significa otra cosa: ver _El origen y la atribucion_.

**Lead** ~~(tambien **Registro**)~~ — _v1, superado_:
Una fila del formulario de aplicacion. Puede haber varias del mismo ser humano.

**Persona** — _v1, superado; hoy es el **Lead**_:
Un lead deduplicado por correo normalizado. Es la unidad real de conteo: toda tasa se calcula
sobre personas, nunca sobre filas.

**Descartado**:
Persona que no califica. Se filtra antes de setteo.

**Cola de setteo** (tambien **cola**):
Persona que califica pero que nadie ha contactado todavia.

**Invitado**:
Persona que agendo una llamada por Calendly.

**Agenda**:
La cita agendada en si.

**Show**:
La persona se presento a la llamada. Se deriva de que su llamada tenga resultado `show`,
`compromiso_pago` o `cerrada`.

**Cierre** (tambien **cupo**):
La persona compro. Se deriva de que su llamada tenga resultado `cerrada`.

**Resultado de llamada**:
El estado de una llamada puntual, un unico valor entre: agendada, show, no_show, cancelada,
reagendada, compromiso_pago, cerrada, perdida.
_Avoid_: tratar show y cierre como dos casillas separadas de la misma llamada.

**No show**:
La persona no aparecio a la llamada y no aviso.

**Cancelada**:
La persona aviso antes que no llegaba a la llamada.

**Compromiso de pago**:
La persona se presento, quiere entrar y prometio pagar en una fecha concreta, pero aun no hay
venta.

**Fecha de seguimiento**:
El dia en que el closer debe volver a una persona: la nueva cita de una reagendada, la fecha
prometida de un compromiso de pago, o 🟡 (propuesta del 24-sep) el dia de volver a un deal que se queda
en Atendido porque el lead "lo va a pensar".

**Motivo**:
La razon por la que una llamada no cerro (dinero, horario, sin fit, viaje, otro programa...).
Es una lista que el equipo amplia.

**Origen del lead** (catalogo `origenes`, vocabulario v1):
De donde salio la oportunidad que termino en llamada o cierre: agenda del dia, follow-up, cola
de descartados, masivos, lanzamiento. Es una lista que el equipo amplia. _No es el **Canal**: el
Canal sale del UTM; este catalogo lo elegia el closer al registrar una llamada en el MVP._

**Follow-up**:
Volver a una persona con la que ya hubo una conversacion para cerrarla.

**Masivos**:
Envios de WhatsApp en tanda a personas que ya dieron opt-in, hechos con Kapso.

### El dinero

**Venta**:
Desde el modelo v2 (ADR 0037), un **Deal en Abonado o Completo**; nunca un deal a secas. Su ticket es
el precio de lista del producto. _La tabla `sales` y el "precio del contrato" eran del MVP y ya no
existen._

**Abono**:
Un pago recibido, con su fecha, monto, moneda y plataforma. Una venta puede tener varios abonos.

**Saldo pendiente**:
El precio de lista del producto del deal menos todo lo que se le ha abonado. Es `null`, no cero, cuando
no hay precio contra que restar. Tiene una sola definicion, en `lib/queries/saldo.ts` (ADR 0024), que
**hoy no existe**: salio con `sales` en el corte 0020 y la recrea el ticket 060 sobre el deal.
_Avoid_: calcularlo aparte en cada consulta; decir "saldo cero" cuando no hay precio.

**Sobrepago**:
Un abono que dejaria la venta con saldo negativo. Se rechaza salvo que el closer lo confirme
explicitamente, y la confirmacion queda en `change_log`.

**Historial de una persona** (vocabulario v1):
Sus llamadas, ventas y abonos en orden, en `/personas/[id]`. En el modelo v2 lo reemplazan la ficha del
Lead y la ficha del Deal (tickets 073 y 074).

**Caja recaudada**:
La suma de los abonos recibidos en un rango de fechas.
_Avoid_: calcularla como ventas por ticket, o inferirla de las ventas cerradas.

**Ventas cerradas**:
El conteo de ventas. Es una metrica distinta de la caja recaudada y no se deriva de ella.

**Pago completo**:
Una venta cuyos abonos ya suman el precio del contrato.

**Plataforma de pago**:
Por donde entra un abono: PayPal, MercadoPago, Zelle, DollarApp, Bancolombia... Es una lista que
el equipo amplia. _Sirve a uno o varios programas, y sin ninguno queda invisible (ADR 0034)._

**Metodo de pago**:
Como cobra de verdad un programa. Es el **enlace de pago**, no la plataforma: un metodo de pago
nunca existe sin programa, una plataforma si. _La distincion la fijo Mani el 20-sep y es la que
evita confundir "PayPal" con "el link de PayPal por USD 797 de Comunicarte"._

**Enlace de pago**:
Un link de cobro ya generado para un monto y una plataforma, por ejemplo "PayPal 797 USD".
Siempre pertenece a un programa.

**Beca**:
El unico descuento autorizado: USD 100 sobre el precio de lista, y solo por dificultad real de
pago.

**TRM de la cohorte**:
La tasa COP/USD que se fija por cohorte (default 4.000), porque los links de pago se generan
manualmente segun la TRM del momento y no existe una TRM historica unica.

### Las metricas

**Lead a venta**:
Cierres divididos entre personas. Una de las dos tasas que mandan.

**Invitado a venta**:
Cierres divididos entre personas que agendaron. La otra tasa que manda. Su umbral operativo es
15%: por debajo de eso el problema es la operacion (registro, show rate, cierre), no el volumen
de leads.

**% de show**:
Llamadas con show divididas entre llamadas agendadas en el rango.

**% de cierre**:
Cierres divididos entre llamadas realizadas (con show).

**Contribucion**:
Las ventas de una cohorte que hizo un closer. Es lo que el dashboard muestra al filtrar por un
closer, y va siempre al lado de la meta de la cohorte, nunca de una meta suya: **no existe meta
individual** (ADR 0023). _Evitar_: "meta del closer", "cuota".

**Rango**:
El par de fechas que contesta el dashboard, inclusive en los dos extremos: hoy, esta semana
(lunes a hoy), este mes (dia 1 a hoy), la cohorte (su ventana de venta hasta hoy) o uno
personalizado. Vive en la URL, no en la sesion.

**Num. aplicaciones**:
Cuantas veces aplico la misma persona. Se guarda como senal de intensidad de interes, nunca como
personas distintas.

### Los recursos

**Recurso**:
Un link que el equipo necesita tener a mano: brochure, pagina web, guion, formulario del RUT.
Puede ser de un programa o de todos.

**Vigente**:
La version de un recurso o enlace que se debe usar hoy. Las anteriores se conservan como
historial.
_No confundir con **activo**_: `vigente` dice cual es la version de hoy entre el historial;
`activo` es el borrado suave del molde de catalogo (nunca se borra una fila). Una version
reemplazada queda `vigente = false` pero `activo = true`: sigue ahi, que es justo el punto.
La base solo exige una version vigente por (programa, categoria, titulo), no una activa.

### La configuracion

**Instancia**:
Algo que el negocio agrega sin tocar codigo: un programa, una cohorte, un closer, un producto,
una plataforma, un motivo, un origen, un recurso.

**Tipo**:
Algo sobre lo que el codigo toma decisiones y que solo cambia un desarrollador: el rol, el
resultado de llamada, el tipo de fuente.

**Catalogo**:
Una lista de instancias que el equipo amplia desde la app (plataformas de pago, motivos,
origenes del lead).

**Fuente**:
El intake de leads crudos de un programa, con su mapeo de columnas: hay **una activa por programa**
(ADR 0039). Desde el 22-sep es el **webhook de Typeform**; antes era una pestana de Google Sheets, que
se sigue leyendo solo para trasladar lo historico.

**Corrida de sync**:
Una pasada del sincronizador sobre UN programa. Lee todas las fuentes de personas de ese programa
juntas y deduplica sobre el conjunto, asi que **no es "la corrida de una fuente"**: guarda de que
fuentes leyo y cuantas filas trajo cada una (ADR 0031). Solo puede haber una corriendo por
programa a la vez, y eso lo garantiza un indice unico parcial, no el codigo. _Evitar_: "el sync de
la pestana X", "la corrida del formulario".

**Plantilla de lead**:
El mapeo de columnas de un programa: en que encabezado de su hoja esta cada campo del lead
(nombre, correo, WhatsApp...). Cada fuente del programa la hereda y solo ajusta lo que su hoja
redacta distinto. No inventa campos: los campos son fijos en el codigo y lo demas va a `raw`
(ADR 0019). _Evitar_: "estandarizar las hojas", "esquema del sheet".

### El equipo

**Closer**:
El vendedor que toma la llamada de postulacion. Puede vender en varios programas. Su
`closer_id` es el nombre exacto con el que aparece en la columna de closer de la BBDD, y es el
mismo valor que se copia a sus registros nativos del CRM cuando esta logueado (ADR 0011). Desde
ADR 0009 ve el mismo dashboard que un gerente **en los programas de su membresia, y solo en esos**
(ADR 0048), pero sigue sin poder entrar a rutas exclusivas de
gerente como `/ajustes/fuentes` (ADR 0003). Esa disjuncion entre gerente y closer no se toco al
sumar el **developer**: la excepcion es solo suya (ADR 0025).
Desde el ADR 0030, **`Mani` y `mani` son el mismo closer**: el texto se guarda como se escribio,
pero la pregunta "¿son el mismo?" ignora mayusculas y espacios y la contesta
`lib/closers/identidad.ts`, nunca una comparacion suelta. Un indice unico sobre esa forma
normalizada impide que dos cuentas reclamen el mismo closer.
_Evitar_: comparar `closerId` con `===` o con `eq()` a pelo.

**Responsable** (vocabulario v1, superado por **Owner**):
El closer a cargo de una persona en el MVP. En el modelo v2 el dueno es de la oportunidad, no de la
persona: ver **Owner** (ADR 0037).
_Avoid_: "dueno del lead", "asignado".

**Alta manual**:
Un lead que un closer crea en el CRM porque llego sin pasar por el formulario (WhatsApp, masivos,
referido). No genera envio; su deal nace en Pendiente Setteo, En Contacto o Compromiso Verbal. No
cuenta en el CPL, porque el CPL cuenta solo los leads del area Pauta (ADR 0044).

**BDR**:
Quien agenda y rescata pipeline. No cierra en frio.

**Gerente** (tambien **Manager**):
El rol que ademas del dashboard administra el sistema: programas, cohortes, fuentes, catalogos,
recursos y usuarios.

**Paid Trafficker**:
El cuarto rol (ADR 0052): el equipo de pauta, que crea las campanas de sus programas y genera sus links
dentro del CRM. No ve deals, llamadas ni abonos, y no administra.

**Maneja pauta**:
La CUARTA pregunta de la familia de roles (`manejaPauta`): puede crear campanas, generar links y
cargar gasto. La cumplen el paid trafficker, el gerente y el developer (ADR 0052).

**Developer**:
El rol de quien construye la app. Es la UNICA excepcion a la disjuncion de roles (ADR 0025):
pasa toda guarda, sea exclusiva de gerente, exclusiva de closer o compartida. Existe desde el
ticket 024 (17-sep) y hoy lo tiene una sola cuenta. No es "gerente + closer": es una excepcion
declarada en un solo lugar del codigo.
_Evitar_: "admin", "superusuario", "root".

**Acceso total**:
La propiedad de pasar toda guarda de rol. Solo la tiene el developer (`esAccesoTotal`). Es
distinta de **administrar**, que la cumplen el gerente Y el developer (`esAdministrador`) y es
la que usa la salvaguarda del ultimo administrador. Dos preguntas, dos funciones: pasar toda
guarda no es lo mismo que poder administrar (ADR 0025, enmienda al ADR 0024).

**Trabaja leads**:
La TERCERA pregunta de la familia de roles (`trabajaLeads`), distinta de **acceso total** y de
**administrar**: quien tiene `closer_id` propio y membresias de programa, puede ser responsable de
una persona y registrar llamadas y abonos. La cumplen el closer y el developer; el gerente NO,
porque administra pero no registra (ADR 0003). Nacio el 18-sep, cuando se vio que
`/ajustes/usuarios` preguntaba `rol === "closer"` a mano y por eso a un developer no se le podia
cargar su `closer_id` desde la app.

**Vista** (y **rol de vista**):
Con que rol se PROYECTA y se GUARDA una pantalla, que no siempre es el rol real de la sesion
(ADR 0028, ticket 028). Un developer puede ponerse en vista `gerente` o `closer` y usar la app
como la ve ese rol, sin cambiarse el rol en la base. Hay tres vistas: `todo` (la mas ancha, por
defecto), `gerente` y `closer`; `todo` **no es un rol**, es un valor de la cookie.

La regla que la hace segura: **la vista solo puede ESTRECHAR, nunca ensanchar.** Si el rol de la
sesion no es de acceso total, el valor de la cookie se ignora entero. Un closer que se ponga a
mano una cookie de vista `gerente` sigue siendo closer. El unico efecto posible de la vista es
que un developer PIERDA acceso.

`rolDeVista(session)` en `lib/auth/vista.ts` es LA definicion, y contesta la pregunta *"¿con que
rol actua esta sesion ahora?"*. Es distinta de **acceso total**, **administrar** y **trabaja
leads**, que preguntan por el rol REAL. Un test guardian recorre `app/` y `lib/` y falla si
alguien decide alcance o permiso leyendo `session.user.rol` crudo; las pocas lecturas legitimas
—las de IDENTIDAD, como `/api/me` o el destino al entrar— van como excepciones nombradas.
_Evitar_: "modo", "simular rol", "impersonar" — no se suplanta a nadie, se estrecha la propia.

**Anular**:
Dejar un registro —una llamada, una venta o un abono— **fuera de toda metrica sin borrarlo**, con
quien lo anulo, cuando y por que (ADR 0026). Un registro anulado desaparece del embudo, de la caja
y del comparativo entre closers, y sigue viendose **tachado** en el historial de la persona. La
regla en una linea: *fuera de las metricas, dentro del historial*.
_Evitar_: "borrar un registro", "eliminar una venta", "cancelar" — borrar es otra cosa y solo
aplica al catalogo (ADR 0026 punto 5).

**Vigente**:
Lo contrario de anulado: el registro cuenta. Es un predicado, no una columna
(`vigente(tabla)` en `lib/queries/vigente.ts`), y es LA definicion: ninguna consulta escribe
`is null` a mano y un test guardian recorre todo el codigo para comprobarlo. Una consulta que
quiere ver lo anulado lo dice con su nombre (`incluyendoAnulados`), nunca omitiendo el filtro.

**Cascada de la anulacion**:
Lo que una anulacion arrastra (ADR 0026 punto 2): una **venta** se lleva sus abonos; una **llamada
cerrada** se lleva su venta y los abonos de esa venta; un **abono** no se lleva nada, porque una
venta puede tener un pago devuelto y seguir viva. Todo en una sola escritura atomica.

**Nerd Stats**:
La vista del developer sobre la salud de la HERRAMIENTA, no del negocio: corridas de sync,
cambios recientes hechos desde la app, conteos por programa y por origen, usuarios activos por
rol y el commit desplegado. Es la unica ruta exclusiva del developer (ticket 025). Solo conteos
y metadatos: por diseno no puede mostrar un dato personal.

---

### Vocabulario del modelo v2 (21-sep)

> Terminos que entran con [plan-crm-v2](../plan-crm-v2.md). **Sus tablas existen desde la etapa 1
> (migracion 0020, 22-sep); la logica que los mueve llega en las etapas 2 a 6.** Estan aqui para que
> nadie invente un nombre paralelo. Los de **atribucion** (Area, Canal, Campana, Patron UTM, Origen
> humano) entran con la etapa **E1b** y viven arriba, en _El origen y la atribucion_, porque son del
> lenguaje del negocio y no del corte. Los de **pantalla** (Inbox, Llamada suelta, Selector de
> programa) son del 24-sep (ADR 0049 y 0050).
> Definicion completa en el insumo original, `crm-retia-modelo-hubspot-scaffold.md` §2.

**Lead**:
Una persona dentro de un programa. Es `people` renombrado. La misma persona en dos programas son
_dos Leads_ y no se deduplican entre si.

**Envio** (`submission`):
Cada vez que alguien lleno el formulario, parcial o completo. Un Lead tiene uno o varios envios;
son su historial de llegada. Su llave es el Token del formulario.

**Deal**:
La oportunidad de venderle un programa a un Lead. Tiene owner, etapa, producto y cohorte. Un Lead
puede tener como maximo un deal abierto por programa; los cerrados quedan.

**Seguimiento** (etapa 11):
La etapa despues de Atendido para un deal cuya llamada ocurrio y hay que volver a contactar. Separa lo
que salio bien de lo que hay que re-contactar (Mani, 24-sep).

**Etapa**:
En cual de los once pasos (diez hasta el 24-sep, mas Seguimiento) del pipeline esta un Deal. La escribe el CRM. _No confundir con
**estado**, que es la clasificacion de llegada que escribe la hoja y el CRM solo trae._

**Owner**:
El closer responsable de un Deal. Reemplaza al responsable que vivia sobre la persona: los deals
nacen sin owner y un closer los _reclama_, salvo un Agendado cuyo host de Calendly es un closer
registrado en el programa, que nace con ese owner (ADR 0049).

**Unclaimed**:
Un Deal en etapa Agendado que todavia no tiene owner (con Calendly, solo cuando el host no esta
registrado en el programa). Es una seccion del **Inbox**.

**Cuota pactada**:
Un pago prometido: su numero, su monto y su fecha. Cuando entra, se enlaza con el abono que la
cumplio.

**Student**:
Un Deal en etapa Abonado o Completo, en la **cohorte** de su deal: la cohorte define la lista de
estudiantes de un programa. Es una vista, no una tabla. _Abierto: si "estudiante confirmado" empieza
en el primer abono o con el pago completo._

**Inbox**:
La pantalla de inicio del closer, que reemplaza "Mi dia": deals sin dueno, llamadas sueltas y lo suyo
que necesita atencion, siempre de un programa (ADR 0050).

**Llamada suelta**:
Una llamada que trae Calendly y que el CRM no pudo colgar de un deal **sin duda**. Espera en el Inbox a
que un closer la asigne. Es la unica Call que existe sin deal (ADR 0049).

**Selector de programa**:
El control, arriba de la navegacion, que decide sobre que programa trabaja cada tab. Solo ofrece los
programas que la sesion puede ver (ADR 0048, ADR 0050).

**Todos los programas** (agregado):
La opcion del Dashboard que suma programas. Solo muestra magnitudes sumables en la misma unidad
(conteos, caja USD, gasto); las tasas, las metas y la comision van por programa (ADR 0048).

**Anulado**:
Marca de que un registro nunca debio existir, por error de digitacion. _No es lo mismo que Cierre
Perdido_, que es un resultado real del negocio: lo anulado no cuenta en ninguna metrica, lo
perdido si.
