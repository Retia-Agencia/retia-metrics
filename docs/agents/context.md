# Retia Metrics — Context

Retia es una agencia de gestion de infoproductos que vende dos programas de alto ticket por
llamada. Este glosario fija el lenguaje del embudo comercial: los mismos terminos que usa el
equipo en la operacion son los que se usan en el codigo, en la base de datos y en la UI.

This file is a **glossary and nothing else** — the project's ubiquitous language. No implementation details, no specs, no decisions (those go in `docs/adr/`). Keep definitions to one or two sentences: define what a term **is**, not what it does. Only include terms specific to this domain — general programming concepts don't belong.

`/grill-with-docs` fills this in as terms get resolved during alignment.

## Language

### Los dos programas

**Comunicarte**:
Programa de formacion en comunicacion ejecutiva. Ticket USD 797. Su ICP son gerentes y jefes de
area con equipo a cargo, de 30 a 50 anos.

**Tactical Investor**:
Programa de formacion en trading. Ticket USD 1.500. Su ICP son personas con ingreso declarado de
USD 1.000 o mas.

Los dos son independientes: BBDD distinta, Calendly distinto, meta distinta, closers distintos.
_Nunca se suman ni se promedian entre si._

### El ciclo

**Corte**:
Una cohorte. El ciclo de venta que termina el mismo dia en que arrancan clases, inclusive. Se
nombran C1, C2, C3. El ciclo del siguiente corte arranca al dia siguiente, sin pausa, y hay
como maximo dos cortes activos en simultaneo, uno por programa.

**Dia habil**:
Cualquier dia que no sea sabado ni domingo. Los festivos cuentan como habiles.
_Esta es una regla de Retia, no del calendario colombiano._

### Las etapas del embudo

**Lead** (tambien **Registro**):
Una fila del formulario de aplicacion. Puede haber varias del mismo ser humano.
_Avoid_: usar "lead" como sinonimo de persona.

**Persona**:
Un lead deduplicado por correo normalizado. Es la unidad real de conteo: toda tasa se calcula
sobre personas, nunca sobre filas.

**Descartado**:
Persona que no califica. Se filtra antes de setteo.

**Cola de setteo**:
Persona que califica pero que nadie ha contactado todavia.

**Invitado**:
Persona que agendo una llamada por Calendly.

**Agenda**:
La cita agendada en si.

**Show**:
La persona se presento a la llamada. Es una etapa del embudo de la persona, no un campo que se
marca aparte: se deriva de que su ultima llamada tenga resultado `show` o `cerrada`.

**Cierre**:
La persona compro. Se deriva de que su ultima llamada tenga resultado `cerrada`.

**Resultado de llamada**:
El estado de una llamada puntual, un unico valor entre: agendada, show, no_show, reagendada,
cerrada, perdida. No son dos preguntas independientes (show si/no, cierre si/no): una llamada
`cerrada` implica que hubo show, y una llamada no puede ser `cerrada` sin haber sido `show`.
_Avoid_: tratar show y cierre como dos casillas separadas de la misma llamada.

### Las metricas

**Lead a venta**:
Cierres divididos entre personas. Una de las dos tasas que mandan.

**Invitado a venta**:
Cierres divididos entre personas que agendaron. La otra tasa que manda. Su umbral operativo es
15%: por debajo de eso el problema es la operacion (registro, show rate, cierre), no el volumen
de leads.

**Caja recaudada**:
La suma de los abonos efectivamente recibidos. Los montos de la columna Precio de las hojas son
adelantos parciales.
_Avoid_: calcularla como ventas por ticket, o inferirla de las ventas cerradas.

**Ventas cerradas**:
El conteo de cierres. Es una metrica distinta de la caja recaudada y no se deriva de ella.

**Num. aplicaciones**:
Cuantas veces aplico la misma persona. Se guarda como senal de intensidad de interes, nunca como
personas distintas.

### El equipo

**Closer**:
El vendedor que toma la llamada de postulacion. Su `closer_id` es el nombre exacto con el que
aparece en la columna de closer de la BBDD, y es el mismo valor que se copia a sus registros
nativos del CRM cuando esta logueado (ADR 0011): un closer no elige ni escribe su propio
`closer_id`, ya vive en su cuenta. Desde ADR 0009 ve el mismo dashboard que un gerente (cierres,
caja, pauta y comparativo entre closers de cualquier programa), pero sigue sin poder entrar a
rutas exclusivas de gerente como `/ajustes/fuentes` (ADR 0003 sigue rigiendo el acceso).

**BDR**:
Quien agenda y rescata pipeline. No cierra en frio.

**Gerente**:
El rol que ademas del dashboard (compartido con closer desde ADR 0009) administra el sistema:
fuentes de sync, ajustes, alta de usuarios.

### Comercial

**Beca**:
El unico descuento autorizado: USD 100 sobre el precio de lista, y solo por dificultad real de
pago.

**TRM del corte**:
La tasa COP/USD que se fija por corte (default 4.000), porque los links de pago se generan
manualmente segun la TRM del momento y no existe una TRM historica unica.
