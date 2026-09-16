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
El ciclo de venta de un programa que termina el mismo dia en que arrancan clases, inclusive. Se
nombran C1, C2, C3. La siguiente cohorte arranca al dia siguiente, sin pausa, y hay como maximo
una cohorte activa por programa.
_Avoid_: "corte" (nombre anterior, reemplazado el 16-sep-2026).

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

### El equipo

**Closer**:
El vendedor que toma la llamada de postulacion. Puede vender en varios programas. Su
`closer_id` es el nombre exacto con el que aparece en la columna de closer de la BBDD, y es el
mismo valor que se copia a sus registros nativos del CRM cuando esta logueado (ADR 0011). Desde
ADR 0009 ve el mismo dashboard que un gerente, pero sigue sin poder entrar a rutas exclusivas de
gerente como `/ajustes/fuentes` (ADR 0003).

**BDR**:
Quien agenda y rescata pipeline. No cierra en frio.

**Gerente** (tambien **Manager**):
El rol que ademas del dashboard administra el sistema: programas, cohortes, fuentes, catalogos,
recursos y usuarios.

**Developer**:
El rol que ve todo el sistema y su salud tecnica (Nerd Stats). Aun no existe en el codigo.

**Nerd Stats**:
La vista del developer sobre la salud de la herramienta: corridas de sync, errores, cambios
recientes, version desplegada.
