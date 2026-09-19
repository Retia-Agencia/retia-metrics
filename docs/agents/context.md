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
_Nunca se suman ni se promedian entre si._

**Comunicarte**:
Programa de formacion en comunicacion ejecutiva. Programa completo USD 797. Su ICP son gerentes
y jefes de area con equipo a cargo, de 30 a 50 anos.

**Tactical Investor** (tambien **De Cero a Tactical Investor**, o el programa de JP Vieira):
Programa de formacion en trading. Programa completo USD 1.500. Su ICP son personas con ingreso
declarado de USD 1.000 o mas.

**Producto**:
Algo concreto que se vende dentro de un programa, con su precio de lista: el programa completo,
la reserva de cupo, la mentoria 1:1. Gerentes y closers los crean cuando los necesitan.

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

**Lead** (tambien **Registro**):
Una fila del formulario de aplicacion. Puede haber varias del mismo ser humano.
_Avoid_: usar "lead" como sinonimo de persona.

**Persona**:
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
El dia en que el closer debe volver a una persona: la nueva cita de una reagendada o la fecha
prometida de un compromiso de pago.

**Motivo**:
La razon por la que una llamada no cerro (dinero, horario, sin fit, viaje, otro programa...).
Es una lista que el equipo amplia.

**Origen del lead**:
De donde salio la oportunidad que termino en llamada o cierre: agenda del dia, follow-up, cola
de descartados, masivos, lanzamiento. Es una lista que el equipo amplia.

**Follow-up**:
Volver a una persona con la que ya hubo una conversacion para cerrarla.

**Masivos**:
Envios de WhatsApp en tanda a personas que ya dieron opt-in, hechos con Kapso.

### El dinero

**Venta**:
El registro de que una persona compro un producto, con su closer, su cohorte y el precio del
contrato.

**Abono**:
Un pago recibido, con su fecha, monto, moneda y plataforma. Una venta puede tener varios abonos.

**Saldo pendiente**:
El precio del contrato de una venta menos todo lo que se le ha abonado. Es `null`, no cero, cuando
la venta no tiene precio del contrato (filas viejas de Sheets): sin precio no hay contra que restar.
Tiene una sola definicion, en `lib/queries/saldo.ts` (ADR 0024).
_Avoid_: calcularlo aparte en cada consulta; decir "saldo cero" cuando no hay precio.

**Sobrepago**:
Un abono que dejaria la venta con saldo negativo. Se rechaza salvo que el closer lo confirme
explicitamente, y la confirmacion queda en `change_log`.

**Historial de una persona**:
Sus llamadas, ventas y abonos en orden, en `/personas/[id]`. Es de solo lectura.

**Caja recaudada**:
La suma de los abonos recibidos en un rango de fechas.
_Avoid_: calcularla como ventas por ticket, o inferirla de las ventas cerradas.

**Ventas cerradas**:
El conteo de ventas. Es una metrica distinta de la caja recaudada y no se deriva de ella.

**Pago completo**:
Una venta cuyos abonos ya suman el precio del contrato.

**Plataforma de pago**:
Por donde entra un abono: PayPal, MercadoPago, Zelle, DollarApp, Bancolombia... Es una lista que
el equipo amplia.

**Enlace de pago**:
Un link de cobro ya generado para un monto y una plataforma, por ejemplo "PayPal 797 USD".

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
Una pestana de Google Sheets con su mapeo de columnas, de la que entran los leads de un programa.

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
ADR 0009 ve el mismo dashboard que un gerente, pero sigue sin poder entrar a rutas exclusivas de
gerente como `/ajustes/fuentes` (ADR 0003). Esa disjuncion entre gerente y closer no se toco al
sumar el **developer**: la excepcion es solo suya (ADR 0025).
Desde el ADR 0030, **`Mani` y `mani` son el mismo closer**: el texto se guarda como se escribio,
pero la pregunta "¿son el mismo?" ignora mayusculas y espacios y la contesta
`lib/closers/identidad.ts`, nunca una comparacion suelta. Un indice unico sobre esa forma
normalizada impide que dos cuentas reclamen el mismo closer.
_Evitar_: comparar `closerId` con `===` o con `eq()` a pelo.

**Responsable**:
El closer a cargo de una persona. Lo asigna el CRM, no la hoja, y una persona puede estar sin
responsable mientras nadie la toma.
_Avoid_: "dueno del lead", "asignado".

**Alta manual**:
Una persona que un closer crea en el CRM porque llego sin pasar por el formulario (WhatsApp,
masivos). Cuenta como persona del programa, pero no como lead de pauta.

**BDR**:
Quien agenda y rescata pipeline. No cierra en frio.

**Gerente** (tambien **Manager**):
El rol que ademas del dashboard administra el sistema: programas, cohortes, fuentes, catalogos,
recursos y usuarios.

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
