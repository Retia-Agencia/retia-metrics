# Respuestas de Pauta: 41 contra 28 y las preguntas Q-1 a Q-9 y DM-8 (17-nov-2026)

> **Qué es:** investigación con datos del CRM de producción (solo lectura: MCP del CRM y `SELECT` sobre la base) y de los tres Excel de
> Paid Media (`Reporte_Diario_Llamada_Comunicarte.xlsx`, `Reporte_Diario_Llamadas_Tactical.xlsx`, `Reporte_Diario_Llamadas_PowerTalk.xlsx`).
> No se cambió código ni datos. No se envió ningún mensaje: los borradores del §4 son para que Mani los mande.
> **Bloquean:** tickets 417 (Q-4), 418 (cuadre), 421 (DM-8) y el cierre de 412 y 414.

## 0. Resumen

1. **41 contra 28 (ComunicArte, 26-sep a 30-oct): 7 de las 13 ventas que faltan son de fecha, no de captura.** El CRM no se equivoca de cuenta: pone la
   venta el día en que el deal entra a Abonado o Completo (`docs/metricas.md:431`), no el día del pago. El 11-nov, entre 08:09 y 08:56 (hora de
   Bogotá), alguien pasó 11 deals a venta que ya habían pagado antes; 7 de ellos pagaron dentro de la ventana y quedaron fechados 11-nov. Contados
   por fecha del primer pago, el CRM da **35 contra 41**. Las 6 que faltan **no se pueden explicar con los datos**: el Excel solo trae conteos,
   sin nombres (§1.4).
2. **Tactical tiene un hueco peor y distinto:** semana 2 a 8 de nov, Excel 9 ventas, CRM 2. Las semanas de octubre cuadran (±1). Esas ventas no
   están en el CRM, ni anuladas ni en otra etapa. Es captura (§1.5).
3. **Q-2 y Q-3 ya tienen causa medible.** "Agendas del día" del Excel se parece a las **citas con fecha de ese día** (no a las creadas). Las 124 del
   CRM salen infladas por la carga de arranque del 7-8 oct. "Llamadas realizadas" no tiene equivalente: el CRM tiene resultado marcado en
   **5 %** de las citas de Tactical (2 a 8 nov) y **12 %** de ComunicArte (§2).
4. **Para Mani (decidir aquí): Q-5 y Q-7** (§3). Mi recomendación: Q-5 dos filas con nombre distinto (ventas por día de cierre y ROAS por día
   del registro); Q-7 el CRM manda desde el 1-oct, el Excel anterior queda archivado sin migrar.
5. **Mensajes listos:** uno para Paid Media (Q-1, Q-4, Q-6, Q-8, Q-9) y uno para Michael (Q-2, Q-3, DM-8 y las ventas sin registrar) en el §4.

---

## 1. La diferencia 41 contra 28

### 1.1 Qué se comparó

| | Fuente | Qué cuenta |
|---|---|---|
| Excel | `Reporte_Diario_Llamada_Comunicarte.xlsx`, pestaña "Cohorte Oct - Nov", fila 18 "Ventas" (captura manual) y tabla semanal filas 45-61 (`=SUM` de la fila 18 por bloques de 7 columnas) | Ventas que alguien anota por día. Semanas **sábado a viernes** (26-sep fue sábado; 2-oct, viernes) |
| CRM | `consultar_metrica cierres` y `consultar_hechos venta`, programa `comunicarte`, 26-sep a 30-oct | Deals con **primera entrada a Abonado o Completo** (`lib/queries/metricas-filtros.ts:236-248`, `ventasConDiaEn`; `docs/metricas.md:431`). Total 28, igual al del ticket 412 |

Corrección al ticket 412: dice que ComunicArte corta "de viernes a jueves" (`docs/tasks/412-pauta-y-origen-una-sola-pestana.md`, bloque del
cuadre). Por las fechas de la hoja es **sábado a viernes**. Los totales semanales no cambian, pero la etiqueta sí.

### 1.2 Hipótesis y resultado

| Hipótesis | Prueba | Resultado |
|---|---|---|
| Ventas de otras áreas | El CRM cuenta las 28 de **todas** las áreas: Paid 16, Orgánico 7, sin envío de origen 5 | **Descartada**: el CRM ya incluye todo |
| Ventas de otro programa | Ventas 26-sep a 30-oct: Comunícate con Confianza 3, LiderArte 0, Tactical 18 | **Descartada**: ni sumando Confianza llegan a 13 sin mezclar programas, y el Excel es de un programa |
| Ventas anuladas | `SELECT` sobre `deals.anulado_en` y `abonos.anulado_en` de ComunicArte | **Descartada**: 0 deals y 0 abonos anulados |
| Perdidos con pagos o cortesías | `consultar_metrica perdidos_con_pagos` y `cortesias` | **Descartada**: 0 y 0 |
| Cuenta pagos, no ventas | 38 abonos (36 ticket y 2 adicionales) en la ventana contra 41 | **Descartada**: no coincide ni en el total ni por semana (4·9·6·11·8 contra 5·10·9·7·10) |
| Definición distinta de venta | Todo deal Abonado o Completo cuenta; hay 1 compromiso verbal con pago (21-oct) que no es venta | **Parcial**: explica como máximo 1 |
| **Fecha de venta** | Se comparó la fecha de entrada a venta contra la fecha del primer pago (`deal_etapa_historial` y `abonos`) | **Confirmada para 11 deals**: ver 1.3 |
| Ventas sin registrar | El Excel no trae nombres | **Abierta** para 6: ver 1.4 |

### 1.3 La causa que sí se encontró: 11 ventas fechadas el 11-nov

En todo ComunicArte, 11 deals tienen la venta puesta el **2026-11-11** y su primer pago antes (de 5 a 34 días antes). Se registraron seguidos
(los abonos se crearon el 11-nov entre las 08:09 y las 08:56, todos por la app). Como el CRM fecha la venta cuando el deal entra a Abonado o
Completo y no cuando se pagó, el `hecho venta` los muestra **todos en un solo día: 13 ventas el 11-nov** (las 11 más 2 que sí pagaron ese día).

| Deal (8 primeros caracteres del id) | Fecha de la venta en el CRM | Primer pago | ¿Cae en 26-sep a 30-oct? |
|---|---|---|---|
| 1f91d6a0 | 11-nov | 8-oct | Sí |
| bf4090f6 | 11-nov | 17-oct | Sí |
| 78f5eccf | 11-nov | 22-oct | Sí |
| 93db0c4e | 11-nov | 27-oct | Sí |
| dc1d3f62 | 11-nov | 27-oct | Sí |
| 7ce9ba7a | 11-nov | 28-oct | Sí |
| a58ceb46 | 11-nov | 30-oct | Sí |
| 76426c9c | 11-nov | 31-oct | No (31-oct) |
| 5bd51f4e | 11-nov | 31-oct | No |
| 2e4ab774 | 11-nov | 3-nov | No |
| b6147622 | 11-nov | 6-nov | No |

**Es una coincidencia de números, no la causa total:** 41 − 28 = 13 y hay 13 ventas fechadas el 11-nov, pero solo 7 de las 13 tienen pago dentro de
la ventana (las otras 6 son de después del 30-oct o pagaron el mismo 11-nov). La reconciliación honesta:

| Semana (sáb a vie) | Excel | CRM por fecha de venta (hoy) | CRM por fecha del primer pago, solo deals ganados |
|---|---|---|---|
| 26-sep a 2-oct | 5 | 4 | 4 |
| 3 a 9-oct | 10 | 8 | 9 |
| 10 a 16-oct | 9 | 5 | 5 |
| 17 a 23-oct | 7 | 7 | 9 |
| 24 a 30-oct | 10 | 4 | 8 |
| **Total** | **41** | **28** | **35** |

- 28 → 35 lo explica la **fecha** (7 ventas registradas tarde).
- Los **6 restantes** (41 − 35) no se explican. Dato útil: **después de la ventana sí cuadra exacto**. Del 31-oct al 11-nov, Excel 15 (56 − 41) y CRM 15
  deals con primer pago. Y el total del Excel hasta el 11-nov es 56 contra 50 deals ganados con primer pago entre 28-sep y 11-nov: la brecha de 6 es **toda**
  de la ventana de octubre.
- **Hipótesis sin verificar** (no se afirma): el Excel fecha la venta el día de la llamada y el pago llega después. Hay 6 deals con primer pago el
  31-oct (4) y el 3-nov (2), y el Excel de las semanas del 24 al 30 tiene +2 y +6 por encima. Podría ser, pero también podrían ser ventas sin registrar.
  No hay forma de distinguirlo sin nombres.

### 1.4 Qué falta para cerrar los 6

El Excel de Paid Media no tiene nombres ni correos, solo conteos por día. Para listar cada venta que falta o sobra hace falta **una de dos cosas**:

1. La lista de ventas por día que usan los closers (nombre y día de cierre) para el 26-sep a 30-oct, o
2. El reporte de la plataforma de pago (Hotmart u otra) de ese periodo, con fecha y correo.

Con cualquiera se cruza por correo (restricción de dedup) y se marca cada una como "ya está en el CRM con otra fecha" o "no está". Es la pregunta 1 del
mensaje a Michael (§4.2).

### 1.5 Hallazgo nuevo: el mismo patrón en Tactical, pero por captura

| Semana (lun a dom) | Excel | CRM por fecha de venta | CRM por primer pago |
|---|---|---|---|
| 5-oct | 5 | 6 | 6 |
| 12-oct | 3 | 3 | 3 |
| 19-oct | 6 | 5 | 5 |
| 26-oct | 1 | 1 | 1 |
| **2-nov** | **9** | **2** | **2** |
| 9-nov (parcial, hasta hoy) | 3 | 1 | 1 |

Octubre cuadra. La semana del 2 al 8 de noviembre tiene **7 ventas en el Excel sin deal ganado en el CRM**. No hay deals de Tactical en Compromiso verbal ni
Atendido movidos desde el 26-oct, y no hay anulados. Por eso es captura: las ventas ocurrieron y nadie las registró (o las registró en otro lado). **No**
es un tema de fecha como en ComunicArte.

### 1.6 Lo que esto cambia

- **Regla de captura, no de cálculo.** Mientras la fecha de venta sea "cuando alguien mueve el deal", todo registro tardío mueve ventas de semana. El 412 se
  puede cerrar con la diferencia explicada en "Cómo se calcula" (ya está pendiente el punto 3 del 412) y con la lista del §1.4.
- **Para el 418 (cuadre del Excel):** el cuadre fila por fila no puede cerrarse en ventas mientras existan ventas sin registrar (Tactical, 7) y ventas
  registradas con fecha tardía (ComunicArte, 11). La condición de retiro del Excel debe incluir "cero ventas del Excel sin deal en el CRM".
- Posible mejora de producto (no se implementa aquí; es una decisión para Q-5): mostrar un conteo "ventas registradas con más de N días de rezago" junto
  a la cifra, para que el rezago no se esconda (N3, nunca esconder).

---

## 2. Q-2 y Q-3 rehechas con la fecha de hoy (17-nov)

### 2.1 Q-2 "Agendas del día"

La medida original (Tactical, 5 a 11 oct): Excel 88; CRM 124 Paid creadas, 162 de todas las áreas, 65 citas con fecha en la semana
(`docs/paid-media-excels-2026-11-10.md:21`, `:191`). Se rehizo **día por día** y con una semana limpia (después del arranque).

**Semana 5 a 11 oct (Tactical)**

| Día | Excel "Agendas del día" | Excel "Agendas en Meta" | CRM agendas creadas Paid | CRM citas con fecha ese día |
|---|---|---|---|---|
| lun 5 | 16 | 1 | 0 | 16 |
| mar 6 | 15 | 16 | 0 | 12 |
| mié 7 | 26 | 19 | 1 | 9 |
| jue 8 | 12 | 12 | **95** | 12 |
| vie 9 | 17 | 12 | 13 | 19 |
| sáb 10 | 2 | 16 | 14 | 1 |
| dom 11 | 0 | 1 | 1 | 0 |
| **Total** | **88** | **77** | **124** | **69** |

- **El 8-oct tiene 95 agendas Paid creadas**: es la carga del arranque (el CRM de ComunicArte y Tactical se reinició en cero el 7-oct y volvió a
  entrar lo nuevo; `docs/operations.md:401-405`). Esas agendas se reservaron antes y quedaron con la fecha de carga. Por eso el CRM da 124 y 162. No es un error de
  cálculo: del 9-oct en adelante las creadas de Paid (13, 14, 1) se parecen a "Agendas en Meta" del Excel (12, 16, 1).
- **El Excel "Agendas del día" se parece más a las citas con fecha ese día que a las creadas** (16 contra 16, 12 contra 12 en dos días exactos).

**Semana 2 a 6 nov (Tactical, lun a vie, sin efecto de arranque)**

| Día | Excel "Agendas del día" | CRM agendas creadas (todas las áreas) | CRM citas con fecha ese día |
|---|---|---|---|
| lun 2 | 12 | 10 | 12 |
| mar 3 | 8 | 10 | 9 |
| mié 4 | 15 | 11 | 17 |
| jue 5 | 8 | 18 | 6 |
| vie 6 | 10 | 8 | 15 |
| **Total** | **53** | **57** | **59** |

La diferencia absoluta día por día contra las **citas del día** es 10 (0, 1, 2, 2, 5); contra las **creadas**, 19 (2, 2, 4, 10, 2). Lo más cercano es la cita
del día, pero **no es exacto**: el total semanal se parece a las dos (53 contra 57 y 59). **Conclusión con cautela:** la lectura más probable es "citas con
fecha de ese día" (la agenda del closer), con un margen por canceladas y reagendadas. Hay que confirmarlo con quien llena el Excel.

- **Recomendación (la misma de DM-8):** dos filas con nombre distinto. **Agendadas** = citas creadas ese día, para Pauta (qué compró la inversión).
  **Citas del día** = citas con fecha ese día, para Comercial. Que "Agendas del día" del Excel se mapee a **Citas del día** (no a Agendadas) si
  Michael o Paid Media confirman que es la agenda del día del closer.
- **Quién responde:** Michael, quien llena o conoce la hoja; Paid Media si la fila la arma Pauta.

### 2.2 Q-3 "Llamadas realizadas"

| Semana | Excel "Llamadas" | CRM shows (resultado marcado) | Citas con fecha | Cobertura del CRM |
|---|---|---|---|---|
| Tactical, 5 a 11 oct | 30 | 8 | 69 | 35 % (`paid-media-excels-2026-11-10.md:192`) |
| **Tactical, 2 a 8 nov** | **16** | **1** | 57 | **5 %** (`resumen_del_hub`) |
| **ComunicArte, 2 a 8 nov** | **28** | **3** | 47 | **12 %** (`resumen_del_hub`) |

- **Empeoró.** En octubre había 8 shows marcados y hoy, en la semana del 2 al 8 de nov, 1 de 57 citas en Tactical. Las tasas de show y de cierre siguen
  saliendo "parcial" (`parcial: true`).
- **El Excel mide lo que el closer dice que hizo.** El CRM mide lo que el closer **marcó**. Esa diferencia no es de fórmula, es de hábito.
- **Recomendación:** "Llamada realizada" = cita con resultado Show marcado en el CRM (DM-8: "una llamada es una cita realizada"), y el trabajo previo
  es un **cierre diario de resultados** (los closers marcan antes de cerrar el día; ya existe la bandeja `citas_sin_marcar`). Hasta que la cobertura
  pase de, por ejemplo, 80 %, el Excel no se retira en esta fila.
- **Quién responde:** Michael (él sabe si los closers aceptan marcar al final de cada llamada). Lo que Michael no decide: la regla, que es de Mani.

---

## 3. Preguntas para Mani (decidir en esta sesión)

### Q-5: ¿qué día cuenta una venta en el reporte diario de Pauta?

**Qué dicen los datos:**

- El Excel cuenta la venta el día que el closer la anota (día de cierre) y divide ventas e ingresos del mismo día entre la inversión del mismo día:
  por eso salió 150 % y `#DIV/0!` (`paid-media-excels-2026-11-10.md`, §1).
- El CRM tiene **dos fechas** y las dos son legítimas: la **fecha de venta** (entrada a Abonado o Completo, `docs/metricas.md:431`, ancla del CAC y de
  Comercial) y el **día del registro del lead** (ancla del ROAS, `docs/metricas.md:432`: "aunque compre semanas después").
- La fecha de venta depende de **cuándo alguien mueve el deal**: el 11-nov movió 11 ventas a un solo día (§1.3). Lo que Pauta ve cada día puede cambiar de
  semana por un registro tardío.
- La caja y las ventas son métricas separadas; la fecha del pago no debe reemplazar la de la venta (`docs/agents/restricciones.md:80-84`).

**Opciones:**

| | Qué | A favor | En contra |
|---|---|---|---|
| a | Una sola: día de la venta para todo | Es lo que ve el Excel; un solo número | El ROAS diario queda lejos de lo que compró el anuncio |
| b | Una sola: día del registro del lead para todo | El ROAS responde "¿valió la pena el anuncio?" | Las ventas del día no coinciden con lo que Comercial ve ese día |
| **c (recomendada)** | **Dos filas con nombre distinto:** "Ventas del día" (día de cierre) y "ROAS por día del registro" | Es lo que ya hay en `metricas.md` y en el boceto de Pauta; cada una dice su ancla; la propuesta de Mani del 12-nov ("se podrían mostrar ambos") | El gerente tiene que leer dos anclas |

**Recomendación: c.** Más una regla de captura en el cierre del día (cero ventas registradas más de 1 día tarde sin marca), porque el §1.3 muestra que la
fecha de venta es tan buena como la disciplina de quien registra. **Decisión que me falta de ti:** ¿pasamos un campo "fecha del cierre" que el closer pueda
poner cuando registra tarde (con rastro de quién lo cambió), o seguimos con "cuando se mueve"? Mi voto: seguir con "cuando se mueve" y atacar el rezago
con la regla de captura. Un campo de fecha editable abre la puerta a que cualquiera mueva ventas de semana a mano.

### Q-7: ¿se puede retirar el Excel de lo anterior al 1-oct o hay que cargar un histórico a mano?

**Qué dicen los datos:**

- El CRM no tiene gasto de Meta antes del 1-oct (`paid-media-excels-2026-11-10.md:197-200`: el ROAS de la semana 21-27 sep sale "—, Gasto de Meta desde el 1 oct").
- ComunicArte y Tactical **no migraron su historia**: producción se respaldó, la historia se borró y arrancaron en cero el 7-oct
  (`docs/operations.md:401-405`, decisión del 7-oct, ticket 203).
- Lo que está solo en el Excel y no tiene equivalente en el CRM:

| Programa | Ventana en el Excel | Inversión | Agendas Meta | Ventas |
|---|---|---|---|---|
| Tactical (hoja "Tactical") | 19-ago a 4-oct | COP 36.874.006 | 238 | 36 |
| ComunicArte (hoja "Comunicarte Llamada") | 12-ago a 27-sep | COP 22.598.374 | 200 | 44 |

**Opciones:**

| | Qué | A favor | En contra |
|---|---|---|---|
| a | Cargar todo a mano al CRM | Todo en un lugar | Son conteos sin correo: rompe la regla de personas deduplicadas por correo (`restricciones.md#dedup-obligatorio-por-correo`) y los pondría como "agendas" sin lead |
| **b (recomendada)** | **El CRM manda desde el 1-oct; el Excel de agosto y septiembre se archiva en solo lectura (con fecha de corte)** | Cero migración; coherente con la decisión del 7-oct; el gerente compara cohortes con los tableros viejos si los necesita | Pauta tiene dos fuentes para el comparativo de cohortes C2 y C3 |
| c | Cargar solo agregados semanales como "referencia" con etiqueta de fuente | Permite una línea de base | Un número sin persona detrás en una pantalla de tasas; si se hace, que sea un objetivo (Q-9), no un dato |

**Recomendación: b.** Quienes necesiten el comparativo contra la cohorte anterior lo tienen en el Excel archivado. **Decisión que me falta de ti:** ¿quieres que
la fecha de corte del Excel sea el 30-sep (último día sin gasto en el CRM) o la de cada cohorte?

---

## 4. Borradores (para que Mani los mande; nada enviado)

> Redacción en lenguaje de negocio, sin jerga. Mani decide si los manda por WhatsApp o por otro canal.

### 4.1 Para Paid Media (Dani, Milena, Rosario): Q-1, Q-4, Q-6, Q-8, Q-9

> Hola equipo. Estamos dejando el reporte diario de Pauta dentro del CRM y para apagar el Excel me faltan cinco respuestas cortas. Con "sí" o "no" me sirve.
>
> **1. Power Talk.** En el CRM el programa se llama Comunícate con Confianza y la cuenta de Francisco ya está ahí. ¿Es el mismo programa que ustedes llaman Power Talk? *(Lo que vimos: inversión y ventas de cuatro semanas cuadran entre el Excel y el CRM.)* Si es sí, no hay nada que crear.
>
> **2. Inversión sugerida.** En el Excel de ComunicArte la pusieron en escalones: 600.000 diarios del 22 al 25 oct, 560.000 del 26 al 29, 480.000 del 30 al 3 nov y 750.000 desde el 4. ¿Ustedes fijan ese número cada vez que cambia, o sale de repartir el presupuesto de la cohorte entre los días que quedan? *Recomiendo que Pauta lo fije por tramos de fechas (un número desde tal día hasta tal día) y el CRM calcule la diferencia contra lo gastado.* ¿Les sirve?
>
> **3. Semana.** El reporte de ComunicArte cuenta la semana de sábado a viernes y los de Tactical y Power Talk, de lunes a domingo. ¿Dejamos todo de lunes a domingo? *Recomiendo lunes a domingo, para que las semanas de los tres programas se puedan comparar.*
>
> **4. Cuentas de Milena y Rosario.** Hoy el Excel muestra siempre las dos filas. La cuenta de Milena casi no gasta desde noviembre (5,9 de 31,3 millones en la cohorte). ¿Les basta un botón "Total / Por cuenta" que abra el detalle, o necesitan las dos filas siempre a la vista? *Recomiendo el botón.*
>
> **5. Línea de base.** La nota "referencia al 3 de septiembre: costo por agenda 139.448 y cierre 47,8 %" está solo en el Excel de Tactical. Hoy el costo por agenda de Tactical anda cerca de 75.000 (semana 12 a 18 oct: 6,1 millones entre 82 agendas). ¿Quién la llena y la quieren como meta de la cohorte, con semáforo? Si sí, dime el número que quieren ver como meta (costo por agenda y cierre).
>
> Gracias.

### 4.2 Para Michael: Q-2, Q-3, DM-8 y las ventas sin registrar

> Michael, necesito tu ayuda con cuatro cosas para poder apagar el Excel de Pauta.
>
> **1. Ventas que no aparecen.** (a) ComunicArte, del 26 sep al 30 oct: el Excel de Pauta trae 41 ventas y el CRM 35 cuando las ponemos en el día en que pagaron (28 por el día en que se registraron: 11 se registraron todas el 11 de nov). Me faltan 6 por entender. ¿Me pasas la lista de ventas por día (nombre y día de cierre) de los closers para ese periodo? (b) Tactical, semana del 2 al 8 de nov: el Excel trae 9 ventas y el CRM 2. ¿Esas 7 se cerraron y no se registraron? Si es así, ¿las registran hoy?
>
> **2. "Agendas del día".** El Excel de Pauta suma 53 en Tactical del 2 al 6 de nov; el CRM tiene 59 citas con fecha de esa semana y 57 agendas nuevas creadas. Parece que la fila del Excel es la agenda que tiene el closer ese día (citas del día), no las que se reservaron ese día. ¿Es así?
>
> **3. "Llamadas realizadas".** El Excel dice 16 llamadas en Tactical del 2 al 8 de nov y el CRM solo tiene marcadas 1 de 57 citas (5 %); en ComunicArte 3 de 47 (12 %). ¿Los closers pueden marcar el resultado (llegó / no llegó) al final de cada llamada, o al cerrar el día? *Recomiendo que marquen al cerrar el día y que Pauta lea de ahí.* Sin eso, el Excel y el CRM nunca van a coincidir en llamadas.
>
> **4. Cita confirmada.** Habías dicho que querías que los closers puedan marcar "confirmada" cuando el lead ya dijo que va. Propongo una sola cita con estados: Agendada, Confirmada, Realizada, No asistió, Reagendada, Cancelada. "Agendas" de Pauta = las creadas ese día; "Citas del día" de Comercial = las que tienen fecha ese día; "Llamada" deja de ser un conteo aparte y pasa a ser una cita realizada. ¿Estás de acuerdo con esos estados y con esos nombres? Si sí, abrimos el cambio en el CRM.

---

## 5. Evidencia y recomendación por pregunta

| # | Pregunta | Evidencia (fuente) | Recomendación | Responde |
|---|---|---|---|---|
| Q-1 | ¿PowerTalk es Comunícate con Confianza? | La cuenta de Meta de Francisco está asignada a ese programa (`docs/metricas.md` §4); inversión y ventas de 4 semanas cuadran (`docs/tasks/412-pauta-y-origen-una-sola-pestana.md`, tabla "Semana", ventas 9 contra 10 del 5-oct al 8-nov, TRM implícita ≈ 3.164 a 3.396). ADR 0087 línea 20: la plantilla de Pauta del 29-sep solo la usa Power Talk. Pesa en contra: ventas pocas por semana (1 a 6) | **Sí, es el mismo.** Pedirle a Paid que lo confirme; no crear programa (sin ADR 0012 ni migración) | Paid Media |
| Q-2 | "Agendas del día" | §2.1: el Excel se parece a las **citas con fecha ese día**; las creadas del CRM están infladas por la carga del 8-oct (95 de 124) | Dos filas: Agendadas (creadas) y Citas del día (fecha); mapear "Agendas del día" a Citas del día | Michael (Paid Media si la arma Pauta) |
| Q-3 | "Llamadas realizadas" | §2.2: cobertura de resultado marcado 5 % (Tactical) y 12 % (ComunicArte); el Excel mide lo que el closer dice | Llamada = cita realizada marcada en el CRM; cierre diario de resultados; el Excel no se retira en esa fila hasta pasar un umbral | Michael |
| Q-4 | "Inversión sugerida" | Escalones por rango de días en ComunicArte (600k, 560k, 480k, 750k) y Power Talk (620k, 1,1M); en Tactical, copia del gasto diario (14 al 19 oct). **La fija Pauta a mano, a veces por tramos de 3 a 7 días y a veces es el gasto del día** | Forma **b** de `paid-media-excels-2026-11-10.md` §5.4, pero por **tramos de fechas** (programa, cuenta opcional, desde, hasta, monto), no por día; el 417 queda con migración | Paid Media |
| Q-5 | Día de la venta | §3 | **c**: dos filas con ancla distinta | **Mani** |
| Q-6 | ¿Semana lun-dom o sáb-vie? | ComunicArte (cohorte Oct-Nov) corta sábado a viernes; Tactical y Power Talk, lunes a domingo; la hoja de ago-sep de ComunicArte, lunes a domingo (`Comunicarte Llamada`, columnas "Sem 2 (17-23 ago)"). El CRM usa lunes a domingo (D-3, ticket 412 línea 98) | Lunes a domingo para los tres. El corte sábado-viernes parece haber nacido del primer día de la cohorte (26-sep fue sábado), no de una regla | Paid Media |
| Q-7 | Retirar el Excel de antes del 1-oct | §3 | **b**: archivar solo lectura | **Mani** |
| Q-8 | Por cuenta: columnas fijas o desplegable | Solo ComunicArte tiene dos cuentas; Milena 5,9 M COP y Rosario 25,4 M COP de 31,3 M en la cohorte; Milena en 0 del 5 al 10 de nov | Interruptor Total y Por cuenta, con el total por defecto (como el boceto) | Paid Media |
| Q-9 | Línea de base 139.448 y 47,8 % | Está solo en Tactical, en una nota (`A36`), "al 3 de septiembre", antes de que el CRM existiera. Hoy el costo por agenda de Tactical es ≈ 75.000 COP (12-18 oct: 6.136.870 ÷ 82) | No cargarla tal cual. Pedirle a Paid el objetivo por cohorte (costo por agenda y cierre) y cargarlo como objetivo con semáforo (D-6) | Paid Media |
| DM-8 | Una sola cita con estados | Tasas "parcial" por cobertura baja (§2.2); Mani 10-nov (`diseno-cifra-y-pauta.md:575-576`): quiere "confirmada" en el pipeline | Aprobarla tal cual está en `diseno-cifra-y-pauta.md` §7.1. Escribir el cierre diario de resultados como regla de proceso (no como cambio de código) | Michael (y Mani, cuando lea la respuesta) |

---

## 6. Cuando Mani responda: qué se actualiza

- **`docs/paid-media-excels-2026-11-10.md` §7:** poner estado y fecha en cada Q-.
- **417:** Q-4 respondida y escrita ahí (línea 21 de la casilla).
- **418:** agregar la condición "cero ventas del Excel sin deal en el CRM" y el §1.5 (Tactical) como parte del cuadre.
- **421:** el sí de Michael a DM-8 (línea 11, "Bloqueado por").
- **414:** el bloqueo para cuadrar (línea 21) pasa a "esperando el cierre diario de resultados".
- **412:** corregir "viernes a jueves" por "sábado a viernes" y registrar la causa de 41 contra 28 y lo que falta (§1.3 y §1.4).
- **`docs/diseno-cifra-y-pauta.md` §7.1:** DM-8 de Propuesta a Aprobada cuando haya sí.

## 7. Qué no se pudo verificar

- Las 6 ventas de ComunicArte entre las 41 y las 35 (§1.4): requiere nombres.
- Si el Excel fecha la venta el día de la llamada (hipótesis, §1.3).
- La inversión y las agendas de Meta por semana contra el CRM: `pauta_roas` falló con "Error interno" en producción el 10-nov
  (`paid-media-excels-2026-11-10.md:§8`); no se volvió a probar aquí.
- Quién registró las 11 ventas del 11-nov: se pudo leer (usuario del abono), pero no se incluyó para no poner datos de personas en este documento.

## 9. Respuestas del 17-nov y las dos verificaciones que pidió Michael

**Respuestas (Mani, de Paid Media y Michael).** Q-1 sí, Power Talk es Comunícate con Confianza. Q-2 el CRM manda; el Excel tiene error humano. Q-3 los closers no marcan. Q-4 Pauta fija la inversión sugerida (417 necesita migración, espera el ok de Mani). Q-6 semanas de lunes a domingo. Q-8 botón Total / Por cuenta para N cuentas. Q-9 descartada. DM-8 aprobada (421 necesita migración, espera el ok de Mani). Tickets y §7 ya actualizados.

### 9.1 Conciliación de comprobantes (grupos «Ventas ComunicArte» y «Ventas JP Vieira», solo lectura)
**No se pudo emparejar comprobante por persona.** Los closers anuncian cada venta con un texto «Venta …» y una imagen del comprobante **sin pie de foto**: no hay nombre, correo ni monto en texto, y el puente de WhatsApp no descarga las imágenes ni las lee (`auto_download_media` apagado). Es lo que ya dijo Michael: el número se pone a mano y no hay forma de saber quién es. Lo que sí se puede es contar por día, que es una prueba más débil (cuenta, no identifica).
Leído: ComunicArte desde el 24-ago hasta hoy (4 páginas de 500 mensajes, completas); Tactical desde el 15-oct hasta hoy (1 página, **no** llega al inicio de la cohorte). Fechas en Bogotá, desde el 7-oct (inicio del historial del CRM).

| | Posts «Venta» en el grupo | Ventas del CRM (primer paso a Abonado/Completo) | Lectura |
|---|---|---|---|
| ComunicArte, 7-oct a 10-nov | 32 en 21 días | 42, de las cuales 13 el 11-nov (carga del lote de las 11 registradas ese día y su pago anterior, §1) | Sin el lote del 11-nov el CRM tiene 29 contra 32 posts. Días con post y sin venta del CRM: 9, 16, 24, 29-oct y 10-nov. Días con más posts que ventas: 31-oct (5 contra 2) y 6-nov (3 contra 1) |
| Tactical, 21-oct a 9-nov | 14 | 8 | Faltan alrededor de 6 en el CRM, en línea con los 7 de la semana del 2 al 8-nov ya medidos (§1) |

Conclusiones: (1) para Tactical la brecha es real y es de captura (ticket 418); (2) para ComunicArte los posts de más caen en días con venta tardía en el CRM, o sea fecha, no ventas perdidas, pero con esta evidencia **no se puede descartar** que haya alguna sin deal; (3) para cerrarlo hace falta que alguien con el comprobante a la vista (Pauta o los closers) pase por correo las ventas de esos días, o que el comprobante lleve el correo del lead al anunciarse. El mensaje del 3-nov de Alejo (transferencias a Global66 «no cuenten la venta hasta confirmar») y el del 9-nov (pago directo a Bancolombia sin forma de confirmar) muestran el riesgo contrario: posts de venta que aún no son plata confirmada. En ningún chat se envió ni se marcó nada.

### 9.2 ¿Salieron los avisos de Juanito (ticket 428)? Sí, y con horario exacto
Registro `avisos_pendientes_closer_envios` (producción, solo lectura), fechas de Bogotá:

| Día | Mañana 8:00 | Tarde 18:00 |
|---|---|---|
| lun 16-nov | 5 closers, 08:00:27 | 5 closers, 18:00:18 |
| mar 17-nov | 5 closers, 08:00:28 | 4 closers, 18:00:17 |

Cuatro de cuatro ventanas, a la hora, sin repetir (el índice único por closer, día y ventana lo impide). El sábado 15 y el domingo 16 no hubo envío, como debe ser. Hoy a las 6 p.m. salieron 4 y no 5: el quinto closer no tenía nada de hoy que avisar (el aviso de la tarde solo manda lo de hoy). Cada envío guarda el teléfono al que fue (últimos 4 dígitos cargados). Ya hay 10 números cargados (desde el 9-nov), no 0 como el 14-nov.
**Qué no se puede probar desde el CRM:** que el mensaje llegó al teléfono y lo leyeron. La fila se escribe cuando Juanito confirma el envío, no cuando WhatsApp entrega. Esa prueba sale de preguntar a 2 closers si lo recibieron (casilla abierta del 428) y de medir citas sin resultado por semana antes y después (D-4, línea base en el 390). Nota: el 17-nov a las 18:00 la cola de «Alertas Paid Media» muestra el semáforo de pauta, no los avisos de closers; esos van por mensaje directo y no son visibles desde aquí.
Si Michael pregunta por qué los closers siguen sin marcar: los avisos están saliendo, así que el cuello ya no es el empuje sino el hábito y el atraso (Andrea 416 y Maru 330 citas sin resultado el 14-nov, decisión de limpiarlo pendiente de Mani).
