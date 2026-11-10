# Los Excels de reporte diario de Pauta contra el CRM (10-nov-2026)

> **Documento de reunión** (ADR 0115, N8): manda ADR vigente > ticket > este documento. Lo escribió la sesión hija G del 412
> (solo análisis, sin código ni migraciones). Cruza dos archivos que Mani descargó (`Reporte_Diario_Llamada_Comunicarte.xlsx`
> y `Reporte_Diario_Llamadas_Tactical.xlsx`) con la pestaña Hub › Pauta que ya está en `main`. Los archivos **no se copian al
> repo**: tienen datos de negocio. Aquí solo hay estructura, fórmulas y cifras agregadas como ejemplo de forma.
> Un tercer archivo, `Reporte_Diario_Llamadas_PowerTalk.xlsx`, se agregó el mismo día (§1.5 y §3.1).

## Resumen

1. Son el Excel de Pauta que Dani Rodríguez pidió reemplazar (F1 de `paid-media-2026-11-09.md`). Un archivo por programa, **un
   renglón por métrica y una columna por día**, una hoja por cohorte, más un bloque semanal y un "Resumen del periodo". La nota
   de Tactical lo dice: *"Inversión y agendas se toman de Meta; llamadas y ventas del CRM"*; solo se capturan a mano las celdas azules.
2. **Casi todo ya existe en el CRM**: inversión, ventas, costo por agenda, ROAS y show/cierre los cubre la tabla semanal del 412
   (algunos con otra definición, §2). Faltan sin migración el CAC y la inversión por cuenta; y el plan diario ("inversión sugerida") no existe.
3. **Lo que falta no son métricas, es una vista por día**: la tabla del 412 es semanal. Dani pidió "sección semanal y diaria". El Excel
   es diario por construcción.
4. **El Excel miente en tres lugares que el CRM no debe copiar**: ingresos = ventas × un ticket fijo y una TRM fija (3.184), ROAS y
   conversión del mismo día (se vio 150 % y `#DIV/0!`), y totales con rangos que no cubren toda la hoja.
5. **Medido con el CRM de producción (solo lectura, Tactical, 5 a 11 oct)**: ventas 5 en el Excel contra 6 en el CRM (USD 8.850
   vendido contra ≈ USD 7.500 que da 5 × el ticket fijo); agendas 88 contra 124 de Paid creadas (162 en todas las áreas), y
   llamadas realizadas 30 contra 8 shows con tasa "parcial". **Las agendas y las llamadas no cuadran y no sé decir por qué**: Q-2 y Q-3.
6. **El bloqueo real para apagar el Excel es el dato, no la pantalla**: el CRM tiene pocos resultados de llamada marcados y el gasto de
   Meta cargado solo desde el 1-oct (el ROAS de la semana del 21 al 27 de sep sale "—", y el CRM ve 1 venta donde el Excel ve 13).
7. **Recomendación**: no hacer una pestaña ni una vista "reporte diario" aparte. Dar a la tabla del 412 un interruptor **Por semana | Por
   día** (misma consulta, otro paso), agregar 3 filas (CAC, inversión por cuenta, plan) y cerrar las 4 preguntas de definición.
8. **¿Reorganizar el Hub?** No las cuatro pestañas (Hoy, Comercial, Dinero, Pauta). Sí hay que decidir si Pauta, que hoy junta ocho
   bloques, se parte en dos vistas. Esa decisión se toma con la pestaña ya mostrando el diario (§5.3), no antes.
9. Seis tickets propuestos: **413 (audit total, prioridad 1)** y 414 a 418, uno con migración (el plan de inversión diario). Ver §9.
10. **PowerTalk (tercer Excel)** tiene otra estructura: ya trae el bloque KPI General/Comercial/Tráfico del Excel de 30X (§1.5). Evidencia fuerte, no prueba, de que es Comunícate con Confianza, que ya existe en el CRM (§3.1, Q-1).
11. Nueve preguntas abiertas para Mani y Paid Media (§6). Ninguna se asumió.

## 1. Inventario de los Excels

### 1.1 Estructura común

| Elemento | Qué es |
|---|---|
| Hojas | Comunicarte: `Comunicarte Llamada` (12-ago a 25-sep, 46 columnas de día) y `Cohorte Oct - Nov` (26-sep a 13-nov, 50). Tactical: `Tactical` (19-ago a 4-oct, 48) y `Cohorte Oct - Nov` (5-oct a 15-nov, 43). **Una hoja por cohorte**; el CRM tiene cohortes y las hojas no las nombran. |
| Eje | Fila 4 = fecha (una columna por día, **incluye sábados y domingos**), última columna = TOTAL. |
| Bloque diario | Filas 5 a 25 (Comunicarte) o 5 a 16 (Tactical): un renglón por métrica. |
| Resumen del periodo | Bajo el diario: meta de cupos, ticket, presupuesto, ventas acumuladas, etc. Una sola columna de valores. |
| Bloque semanal | Más abajo: las mismas métricas sumadas por semana más TOTAL. Semanas de Comunicarte: sáb a vie en la cohorte (26-2 oct, 3-9 oct…); en Tactical: lun a dom (5-11 oct, 12-18 oct…). |
| Formato | Celdas azules = captura manual. Formato condicional que pinta de color cada renglón cuando la celda contiene la palabra `NONE` (es el "vacío" del libro; no hay umbrales de semáforo). Sin comentarios ni validaciones de datos. |
| Quién parece servir | **Ambos**. Inversión y agendas de Meta son de Pauta (César llena). Llamadas y ventas son comerciales (Michael las llena a mano con lo que le pasan los closers, F1). Costo por agenda, CAC y ROAS son el cruce de los dos. Por eso nadie lo puede dejar. |
| Título | Dice `REPORTE DIARIO \| 3 - 29 SEPTIEMBRE 2026` en tres de las cuatro hojas aunque cubren ago a nov. Es un dato de lo mal mantenido que está. |

### 1.2 Hojas de Comunicarte (dos cuentas de Meta: Milena y Rosario)

Mismas filas en las dos hojas. `F` = fórmula; `M` = captura manual.

| Fila | Renglón | Cómo se llena / calcula | Notas |
|---|---|---|---|
| 5 | Inversión Milena | M (COP) | Cuenta publicitaria Milena. |
| 6 | Agendas en Meta (Milena) | M | Pixel de Meta, no el CRM. |
| 7 | Costo por agenda (Milena) | F `=IFERROR(inv/agendas, "NONE")` | |
| 8 | Inversión sugerida (Milena) | M (constante por semana: 300.000 al inicio) | El plan. Rótulo con typo ("Inervsión"). |
| 9 | Inversión Rosario | M (COP); en la hoja de octubre muchas celdas son `=(total_de_la_cuenta - inversión Milena)` | O sea: Rosario = total de una cuenta menos Milena, calculado a mano. |
| 10 a 12 | Agendas Meta, costo, inversión sugerida (Rosario) | igual que Milena | |
| 13 | Inversión total | F `=Milena + Rosario` | |
| 14 | Agendas en Meta (total) | F `=Milena + Rosario` | |
| 15 | Costo por agenda (total) | F `=IFERROR(13/14)` | Es el "Costo por agenda según Meta" (D-1). |
| 16 | Agendas del día | M | **Sin fuente declarada.** Ver Q-2. |
| 17 | Llamadas realizadas | M | Del CRM según la nota de Tactical, a mano. |
| 18 | Ventas | M | Idem. |
| 19 | % Conversión (ventas/llamadas) | F `=IF(17>0, 18/17, "NONE")` | El mismo día: ventas de hoy ÷ llamadas de hoy. Se vio 150 %. |
| 20 | CAC (costo por venta) | F `=IF(18>0, 13/18, "NONE")` | Gasto total del día ÷ ventas del día. |
| 21 | Ingresos | F `=IF(18>0, 18 × $ticket, "NONE")` | **Ventas × ticket fijo en COP** (2.537.648 = USD 797 × 3.184). No es la plata vendida ni la caja. |
| 22 | ROAS estimado | F `=IF(18>0, 21/13, "NONE")` | Ingresos ÷ inversión del mismo día. Da `#DIV/0!` un día con ventas y sin inversión. |
| 23 | Ventas necesarias hoy | F solo en el último tramo: `=(meta − ventas acumuladas) ÷ NETWORKDAYS(hoy, fecha fija)` | La fecha fija (22-sep) y la meta (`$AB$29`, celda vacía) están mal: no calcula. |
| 24 | Inversión sugerida (total) | F `=Milena sugerida + Rosario sugerida`; en octubre constantes (750.000, 840.000) | Se escalona por semana: 300.000, 560.000, 750.000, 840.000. |
| 25 | Diferencia vs plan | F `=inversión real − sugerida` | Positivo = gastó de más. |
| 29 a 40 | Resumen del periodo | meta de cupos (50/60), ticket, presupuesto del periodo (15,3 M / 35 M COP), "agendas/día necesarias" (texto a mano: `~12`, `~16`), ventas acumuladas (`SUM`), % cumplimiento, inversión acumulada, % presupuesto usado, agendas totales, agendas/día real, CAC del periodo, ROAS del periodo | En la hoja de octubre solo hay las constantes; **las fórmulas no están** (F34 a F40 vacías). |
| bloque semanal | las 15 filas de arriba, por semana | `SUM` de las columnas de cada semana; costo, conversión, CAC y ROAS recalculados sobre las sumas | Los rangos de semana están escritos a mano (`SUM(G5:M5)`). |

### 1.3 Hojas de Tactical (una sola cuenta)

Tactical usa 12 renglones diarios más 6 filas de resumen y 4 de notas. Diferencias con Comunicarte:

| Fila | Renglón | Cómo se calcula |
|---|---|---|
| 5 | Inversión | M (COP). Algunas celdas son sumas de dos gastos (`=(549770+252820)`). |
| 6 | Agendas en Meta | M. |
| 7 | Costo por agenda | F `inv/agendas` |
| 8 | Agendas del día | M |
| 9 | Llamadas realizadas | M |
| 10 | Ventas | M |
| 11 | Porcentaje de cierre | F `ventas/llamadas` (el mismo día) |
| 12 | Ingresos | F `ventas × $Q$20` (4.776.000 = USD 1.500 × 3.184) |
| 13 | ROAS | F `ingresos ÷ inversión` |
| 14 a 16 | Ventas necesarias hoy / Inversión sugerida / Diferencia vs plan | La "sugerida" es **la inversión real copiada** (`=(B5)`) hasta una fecha y después `real − …`: no es un plan, es un espejo. |
| 19 a 30 | Resumen | meta de cupos (60), ticket COP, presupuesto del periodo (16,74 M COP), agendas/día necesarias (3,7 escrito a mano), ventas acumuladas, % cumplimiento, inversión acumulada, `% presupuesto utilizado = AW5/$Q$21` (usa el total de la columna de la hoja, no la suma del rango), agendas acumuladas, agendas/día promedio real (cuenta los días en cero), CAC del periodo, ROAS del periodo `= ventas × ticket ÷ inversión` |
| 33 a 36 | Notas | *Celdas azules: captura manual diaria. Inversión y agendas se toman de Meta; llamadas y ventas del CRM. Plan: $620.000/día sobre 27 días. Ticket USD 1.500 (TRM 3.184). Referencia al 3 de septiembre: costo por agenda $139.448, cierre 47,8 %.* |
| 41 a 50 | Bloque semanal | 10 filas: inversión, agendas Meta, costo, agendas del día, llamadas, ventas, conversión, CAC, ingresos, ROAS |

### 1.5 PowerTalk (`Power Talk Oct Nov`, rótulo "FRANCISCO - LLAMADA")

Una sola hoja, 5-oct a 20-nov (48 columnas de día). **Su estructura difiere de las otras dos**: es la más nueva y la más parecida a lo que pide Paid Media.

| Elemento | Qué hay | Diferencia con Comunicarte y Tactical |
|---|---|---|
| Cuentas | Una sola (inversión, sin Milena/Rosario) | Como Tactical |
| Filas diarias (5 a 18) | Inversión · Agendas en Meta (Invite) · Costo por agenda · **Typeform** (registros) · **Costo por Typeform** (`inv/typeform`) · Agendas del día · Llamadas realizadas · Ventas · % de cierre · Ingresos (`ventas × ticket`) · ROAS · Ventas necesarias hoy · Inversión sugerida · Diferencia vs plan | Las dos filas de Typeform son nuevas: el CRM las tiene (registros, CPL). Las otras son las mismas |
| Inversión sugerida | Constantes: 620.000 y luego 1.100.000 por día. Hasta una fecha es un espejo (`=(C5)`) | Mismo patrón que Tactical, con un plan real desde la tercera semana |
| Resumen (filas 21 a 32) | Meta de cupos 40, ticket 2.538.232 COP, presupuesto, agendas/día necesarias, ventas acumuladas, % cumplimiento, inversión acumulada, % presupuesto (da `#DIV/0!` porque el presupuesto está vacío), agendas, CAC, ROAS | Igual que Tactical, con el mismo error E-4 |
| **Bloque semanal en tres secciones** (filas 34 a 51) | **General**: Inversión, Agendas, Costo por agenda, Ventas, Facturación, ROAS, Profit. **Comercial**: % de presentación a zoom, % de cierre zoom a cliente, % de cierre agenda a cliente. **Tráfico**: Agendas Meta, CPM, CTR enlace, % clics a landing, % conversión landing, costo por agenda, Frecuencia | **Es el bloque KPI de la imagen F5 del Excel de 30X** (M1 a M19 casi renglón por renglón). Por eso el 412 lo cubre mejor que a los otros dos |
| Cómo se llenan los renglones de tráfico | **A mano**, semana a semana: CPM y frecuencia son números escritos; CTR y % clics a landing son divisiones de dos números pegados (`=3158/145037`); conversión landing = agendas Meta ÷ clics a landing, también con un denominador pegado | Es justo lo que el 412 (hija D) trae de Meta |
| Facturación | `SUM` de "Ingresos" (ventas × ticket fijo), no el valor vendido | Misma observación que E-1 |
| Calendario | Semanas lun a dom (05-11 oct…), como el CRM (D-3) | Comunicarte es sáb a vie |

Tres hechos nuevos que se suman a los errores de §1.4: la tasa "% de presentación a zoom" es `llamadas ÷ agendas Meta` (no ÷ citas del CRM), la conversión de landing mezcla agendas con clics (no registros con vistas, como M18) y el título dice "3 - 29 SEPTIEMBRE" en una hoja de octubre y noviembre.

### 1.4 Errores y olores del propio Excel (hechos, no opinión)

| # | Hecho | Dónde |
|---|---|---|
| E-1 | Ticket y TRM fijos (3.184); no cambian con el día. | Comunicarte `$X$30`, Tactical `$Q$20` |
| E-2 | Conversión y ROAS del mismo día; ventas de hoy ÷ llamadas de hoy puede pasar de 100 %; sin inversión da `#DIV/0!`. | filas 19, 22 / 11, 13 |
| E-3 | `AU21` suma `c-45 : c-4`: deja fuera las tres últimas columnas de día. | Comunicarte fila 21 |
| E-4 | `% presupuesto utilizado` usa una celda de total de otra zona (`AU13`, `AW5`, `AR5`) en vez de la suma del rango. | resumen |
| E-5 | "Agendas/día promedio" divide por los días con número, incluidos los ceros y los fines de semana. | resumen |
| E-6 | "Agendas/día necesarias" es texto escrito a mano (`~12`). | resumen |
| E-7 | Rotulación vieja (títulos de septiembre en hojas de octubre; "Inervsión"; "Inversion Rosario Cuenta"). | varias |
| E-8 | Inversión Rosario es "total de una cuenta menos Milena" en muchas celdas: la regla vive en la cabeza de quien llena. | Comunicarte oct |
| E-9 | La hoja de octubre de Comunicarte no tiene las fórmulas de resumen. | Cohorte Oct - Nov |

## 2. Cruce fila por fila contra el CRM

Leyenda: ✅ existe igual · 🟡 existe con otra definición · ❌ falta · 🚫 no debe existir como está. "M#" = el catálogo de
`docs/paid-media-2026-11-09.md` §3. "412" = ya lo muestra la tabla semanal de Hub › Pauta (`lib/queries/hechos/pauta-semanal.ts`,
`DEFINICION_FILAS`).

| Renglón del Excel | Estado | En el CRM / qué difiere | ¿Lo cubre el 412? |
|---|---|---|---|
| Inversión (total) | ✅ | M1, `gastoConvertido`; en la tabla en COP, sumado de todas las cuentas del programa | Sí |
| **Inversión por cuenta** (Milena, Rosario) | ❌ | El gasto está por anuncio y `pauta_objetos.cuentaId` lo liga a la cuenta, pero **la cuenta no es una dimensión** de `lib/queries/hechos/dimensiones.ts` ni fila de la tabla. `cuentas-del-programa.tsx` muestra la salud de la cuenta, no su gasto | No |
| Agendas en Meta (total / por cuenta) | 🟡 | M4/M6: existe `gasto_pauta.agendas_meta`; en la tabla sale **dentro** de "Costo por agenda (según Meta)", no como cifra propia ni por cuenta | Parcial |
| Costo por agenda (total) | 🟡 | El Excel = inversión total ÷ agendas Meta. El CRM tiene **dos**: del CRM (M5, solo gasto de campañas `agenda` ÷ agendas CRM Paid) y según Meta (M6). D-1 y D-2 las separan; el Excel suma todo el gasto, incluida la que no es de agenda | Sí (las dos) |
| Costo por agenda por cuenta | ❌ | Mismo hueco de la dimensión cuenta | No |
| Agendas del día | 🟡 | Hoy el CRM tiene **tres** (creadas, §1.2; citas del día, §1.3; Meta, §1.9). El Excel no dice cuál. **Medido: no cuadra con ninguna** (§3) | Sí (creadas Paid) |
| Llamadas realizadas | 🟡 | CRM: `show` (cita cuyo resultado ocurrió) o "Realizadas" de Hoy. Depende de que el closer haya marcado el resultado | Sí (como base de % de show) |
| Ventas | ✅ | M7, deals en Abonado o Completo por día de venta (§1.4). El Excel es "del CRM, a mano" | Sí |
| % Conversión / % de cierre (ventas/llamadas del día) | 🟡 | M13 "Cierre de ventas" = ventas ÷ shows **del mismo grupo de citas** (ADR 0079, 187). El Excel divide dos conteos de universos distintos y puede pasar de 100 % | Sí (M13) |
| CAC (costo por venta) | ❌ | Fórmula en `metricas.md` §3.2 marcada 🟡 ("123"), nunca se construyó. Es gasto Paid ÷ ventas Paid. **Falta y no necesita migración** | No |
| Ingresos | 🚫 | Ventas × ticket fijo en COP con TRM fija. Viola "todo dinero derivado tiene UNA definición" (ADR 0024) y "nunca convertir moneda en silencio". El equivalente real es **Facturación** (M9, valor vendido, USD) | Sí (como Facturación) |
| ROAS estimado / ROAS del periodo | 🟡 | M10: vendido de Paid (USD) ÷ gasto USD con la TRM del día, anclado por **cohorte de registro** (355), con cobertura y "parcial: N agendas pendientes". El Excel ancla la venta al día de la venta y al ticket | Sí (M10) |
| Profit (no está en el Excel) | ✅ | M11. El Excel lo tiene solo en la imagen KPI de 30X | Sí |
| Inversión sugerida (por cuenta y total) | ❌ | Es un **plan diario de inversión**. En el CRM existe la meta de inversión **de la cohorte** (`objetivos.inversion`, migración 0132) y `inversionDiaMeta`/`inversionDiaPromedio` calculados (`lib/metas/cumplimiento-de-cohorte.ts`). **No hay valor por día ni por cuenta** | No |
| Diferencia vs plan | ❌ | Depende del plan diario | No |
| Ventas necesarias hoy | ✅ (en Hoy) | `metaDeHoy` en Hub › Hoy, el "Objetivo del día" (DA-5). En Pauta, `requeridos` del cumplimiento. Ver si hace falta por Paid solamente | Parcial |
| Resumen: meta de cupos, ventas acumuladas, % cumplimiento | ✅ | Cumplimiento de la cohorte (371, hija C): llevamos / meta, % sobre el total, % sobre lo esperado, estado | Sí |
| Resumen: presupuesto del periodo, inversión acumulada, % presupuesto utilizado | ✅ | `cumplimiento.inversion = { llevamos: gastoCop, meta }`. Funciona cuando alguien cargue `objetivos.inversion` de la cohorte (tarea de Mani, §13 del doc del 9-nov). **Verificar la barra en pantalla**, no se pudo ver aquí | Sí (con la meta cargada) |
| Resumen: agendas/día necesarias | ✅ | Agendas requeridas por día (`calcularProyeccion`) calculadas, no escritas | Sí |
| Resumen: agendas/día promedio real | ❌ | No está en el cumplimiento. Es trivial (agendas ÷ días hábiles del periodo). OJO a E-5: contar solo días hábiles (regla: sábado y domingo no cuentan, dato de `AGENTS.md`) | No |
| Resumen: CAC del periodo | ❌ | Mismo hueco del CAC | No |
| Bloque semanal completo | ✅ | La tabla semanal (lun a dom, Bogotá, D-3). **Difiere el calendario**: el Excel de Comunicarte corta sáb a vie | Sí |
| Nota: "referencia al 3 de septiembre" (costo por agenda de 139.448, cierre 47,8 %) | ❌ | Línea de base escrita en una nota. En el CRM sería una meta (`objetivos`, D-6) | No |
| Separación por cohorte (una hoja por cohorte) | ✅ | Filtro de cohorte `?cohorte=` (377) | Sí |

**Cruce de lo que PowerTalk agrega:** Typeform y costo por Typeform → ✅ registros y CPL del CRM (M-registros; el CPL de Paid sigue 🟡 123 en `metricas.md` §3.2, no está en la tabla del 412). Profit, % de presentación, % de cierre zoom a cliente, % de cierre agenda a cliente, CPM, CTR, clics a landing, conversión landing, frecuencia → **todos están en el 412 (M11 a M19)**, pero con otra definición: el CRM divide por citas del grupo y por vistas de landing, el Excel por agendas Meta y por clics.

Filas del 412 que **Comunicarte y Tactical no tienen** (PowerTalk sí, a mano): M15 a M19 (CPM, CTR, llegada y conversión de la
landing, frecuencia) y los semáforos. Son las que sacan al CRM de ser solo un reemplazo.

### 2.1 Reglas duras que tocan al Excel

| Regla | Qué pasa en el Excel | Qué hacer en el CRM |
|---|---|---|
| El programa es una frontera (AGENTS.md) | Un archivo por programa: correcto. **No** hay suma entre programas. Las dos cuentas de Comunicarte son del mismo programa y la misma moneda (COP): sumarlas es válido. | Cuenta es una dimensión **dentro** de un programa; nunca se suma "todas las cuentas de todos los programas" en una tasa |
| Anulados no cuentan | Las ventas y llamadas se escriben a mano: una venta anulada puede seguir contada. | Ya lo garantiza `vigente()` |
| Nunca convertir moneda en silencio | El ticket en COP viene de USD × 3.184 fija. Ingresos y ROAS no son comparables con Meta en USD. | `convertirGasto` con la TRM del día (ya) |
| Toda fecha es de Bogotá | El Excel no dice zona; el gasto de Meta ya viene en `America/Bogota`. | Sin cambio |
| Solo días hábiles | Promedios cuentan todos los días con número (E-5). | Promedio por hábil, mostrando "por día calendario" solo si se pide |
| Cobertura, nunca un número a medias (N3) | `NONE` es un texto; `0` y "sin dato" se confunden. | `—` con razón; `0` es cero |
| Un concepto, un módulo (N1) | "Agendas del día" y "Llamadas realizadas" son lo que cada persona entiende ese día. | Una definición por columna del Excel (Q-2, Q-3) antes de dibujarlas |

## 3. Medido contra la base

**No se pudo cuadrar contra la base local.** `npm run db:local` está arriba, pero su seed es sintético (no tiene el gasto de Meta
ni los envíos reales de producción), así que cualquier cuadre ahí no prueba nada sobre los Excels. Para medir con datos reales usé
las herramientas de lectura del CRM de producción (MCP, rol del usuario, solo consulta, cifras agregadas; no se leyó ni se escribió
nada). Ninguna cifra de persona está en este documento.

**Semana 5 a 11 de octubre, Tactical** (lunes a domingo, coincide con la semana del Excel). Fuente CRM: `resumen_del_hub` y
`consultar_metrica` (`agendas_creadas`).

| Renglón | Excel (suma de la semana) | CRM | Veredicto |
|---|---|---|---|
| Ventas | 5 | 6 (por fecha de venta, §1.4) | **Difiere por 1.** Puede ser fecha de registro del Excel, una venta anulada o la regla de "perdido" (§1.4). No se pudo decir cuál sin ver la fila |
| Dinero de esas ventas | 5 × 4.776.000 COP = 23,88 M COP; a 3.184 ≈ **USD 7.500** | Vendido **USD 8.850** (recaudado 6.475, por cobrar 2.375) | **Difiere**: el Excel estima con el ticket de lista; el CRM suma el valor vendido real de 6 deals. Confirma que "Ingresos" ≠ Facturación |
| Agendas del día | 88 | 124 creadas de Paid; 162 creadas de todas las áreas; 65 citas con fecha en la semana | **No cuadra con ninguna** (Q-2) |
| Llamadas realizadas | 30 | 8 shows (citas con resultado "ocurrió"); tasa de show y de cierre salen **"parcial", cobertura 35 %** | **No cuadra** y el CRM avisa que le faltan resultados (Q-3) |
| Inversión | 5.634.397 COP (con un 5-oct en 0 y 11-oct con gasto) | **No se pudo medir**: `pauta_roas` respondió "Error interno" (se reportó al final) | Sin dato |
| Agendas según Meta | 77 | No expuesto por las herramientas de lectura | Sin dato |

**Semana 21 a 27 de septiembre, Comunicarte** (Excel: 13 ventas, 27 llamadas, 65 agendas, 3,07 M COP de inversión). CRM: **1
venta**, 0 citas, 0 agendas creadas; el ROAS de la ventana sale **"—, Gasto de Meta desde el 1 oct 2026"**. Es la cobertura (N3)
funcionando: el CRM empezó a guardar gasto el 1-oct y las agendas anteriores a esa fecha no están en su base. **Consecuencia práctica:**
mientras Paid Media quiera ver septiembre, tiene que seguir en el Excel; el CRM solo reemplaza lo posterior al 1-oct. (Aplica a Comunicarte; PowerTalk empieza el 5-oct.)

**Lo que quedó sin medir y por qué:** la inversión de la semana (necesita `gasto_pauta` de producción; no hay herramienta de lectura
del gasto, solo el ROAS que falló) y la tabla semanal tal como la ve Dani en pantalla (no la abrí; la sesión no tiene login al CRM
desplegado). Se puede cuadrar en minutos con el CRM abierto: Hub › Pauta, programa Tactical, 5 a 11 oct, cohorte del 5-oct, y comparar
Inversión, Agendadas y Ventas contra los números de arriba (PQ-3 del doc del 9-nov).

### 3.1 PowerTalk contra Comunícate con Confianza

El CRM de producción tiene el programa **Comunícate con Confianza**, y `docs/metricas.md` §4 dice que su cuenta de Meta (567726836094755) es "la de Francisco … Power Talk". El Excel se rotula "FRANCISCO - LLAMADA". Semana **12 a 18 de octubre** (lunes a domingo, igual en ambos):

| Renglón | Excel PowerTalk | CRM, Comunícate con Confianza | Veredicto |
|---|---|---|---|
| Ventas | 1 | 1 (vendido USD 800) | **Cuadra** |
| Llamadas realizadas / shows | 2 | 2 shows; 7 citas con fecha en la semana; tasas "parcial", cobertura 57 % | **Cuadra** |
| Agendas del día | 8 | 7 citas con fecha en la semana | Cerca, no igual (Q-2) |
| Ingresos / vendido | 1 × 2.538.232 COP ≈ USD 797 (TRM fija) | USD 800 | Cerca, por el ticket de lista |
| Inversión (2.454.118 COP) y agendas Meta (30) | · | No medible con las herramientas de lectura (mismo límite de §3) | Sin dato |

Es una semana con 1 venta: **evidencia, no prueba**. Pero Comunícate con Confianza cuadra en ventas y shows donde Tactical y Comunicarte no, así que PowerTalk es casi seguro ese programa y **no hay que crearlo** (Q-1, sin asumirlo). En la base local solo hay `comunicarte-local` y `tactical-local`: ahí no se puede comprobar.

## 4. Qué hay que decidir antes de construir (las cuatro definiciones)

1. **Agendas del día**: ¿creadas ese día, con cita ese día o del pixel? (Q-2). Hoy no se puede decir cuál usa el Excel.
2. **Llamadas realizadas**: ¿shows marcados en el CRM o llamadas que los closers reportan sin marcar? (Q-3).
3. **Qué día cuenta una venta** en el reporte diario de Pauta: el de la venta (Comercial) o el del registro (ROAS 355). Las dos
   existen y dan cifras distintas por diseño; mezclarlas en una fila es el error medido el 30-oct (ADR 0115).
4. **El plan de inversión diario** (la fila "sugerida"): ¿lo fija Pauta día a día o sale de la meta de inversión de la cohorte? (Q-4).

## 5. Recomendación

### 5.1 Alternativas

| # | Opción | Qué es | Costo | Riesgo |
|---|---|---|---|---|
| A | **Reproducir el Excel tal cual**: una vista "Reporte diario" con sus renglones y sus fórmulas | Una pantalla nueva con 16 renglones por día y el bloque semanal | Alto: una consulta y un componente nuevos | Copia E-1 a E-9. Una segunda definición de ventas, agendas y ROAS (viola N1). Dos pantallas con cifras distintas para la misma pregunta: justo lo que la auditoría del 30-oct encontró |
| B | **Ampliar la tabla del 412 con paso diario** (recomendada) | El mismo `cargarPautaSemanal` acepta un paso (`dia` \| `semana`); las filas son las mismas y el selector de la URL (`?g_<clave>=...`, `lib/series-pasos.ts`) ya lo modela para las gráficas. Más 3 filas nuevas | Medio-bajo: sin migración para el diario, CAC e inversión por cuenta; migración solo para el plan | Hay que decidir el calendario (Excel de Comunicarte corta sáb a vie, el CRM lun a dom, D-3) |
| C | No hacer nada y que Pauta siga en el Excel | | Cero | Doble captura diaria, cifras que no cuadran, el CRM nunca es la fuente única (norte del 3-nov) |

**Recomiendo B**, por tres razones argumentadas con el repo: (1) el 412 ya tiene la consulta y la cobertura por celda; un paso
diario reutiliza `semanasDelRango` y `agrupar` de los hechos sin tocar definiciones (N1). (2) Dani lo pidió así: *"una sección semanal
y una sección diaria … de tal fecha a tal fecha"*. (3) Con A se vuelve a escribir "ventas del día" y "agendas del día" por una tercera
vía; el Excel no es una fuente de definición, es el síntoma que se quiere quitar.

### 5.2 Qué incluye B, fila por fila

| Pieza | Qué se hace | Migración |
|---|---|---|
| Paso Por día | El interruptor Por semana \| Por día de la tabla del 412. Con "Por día" las columnas son los días del periodo (con fines de semana) y se ocultan las filas que no tienen sentido diario (Frecuencia ya es "—" en varios días; D-5) | No |
| CAC | Una fila nueva `Costo por venta` en General: gasto total de Paid ÷ ventas de Paid, en COP, con cobertura. Cierra la fila 🟡 123 de `metricas.md` | No |
| Inversión por cuenta | Dimensión `cuenta` en `hechos/dimensiones.ts` (vía `pauta_objetos.cuentaId`) y un desplegable "Ver por cuenta" para Inversión, Agendas Meta y Costo por agenda según Meta | No |
| Plan de inversión diario | Valor por día (y cuenta) de lo "sugerido", con la fila "Diferencia vs plan" | **Sí** (tabla nueva o columna; ver §5.4) |
| Promedios por día hábil | "Agendas/día real" calculado, nunca escrito | No |
| Línea de base | Las notas como metas de cohorte (`objetivos`, D-6), no como texto | No |

### 5.3 ¿Hay que reorganizar el Hub?

**Respuesta corta: las cuatro pestañas no se tocan; lo que hay que revisar es cuánto cabe dentro de Pauta.**

Lo que hay hoy (`app/(app)/p/[programa]/hub/page.tsx`): **Hoy** (el reporte del día, plantilla de Michael, 373), **Comercial** (embudo y
closers), **Dinero** (caja y metas), **Pauta** (Origen más Pauta, 412). Comparten el periodo, el filtro de cohorte y el contrato de
`structure.md` §9.

Por qué no reorganizar las cuatro:

- Cada pestaña ya responde una pregunta de una persona distinta: Hoy = el cierre del día de Michael a Dani; Comercial = los closers;
  Dinero = Gerencia; Pauta = Paid Media. Mover cifras entre ellas rompería lo que Daniel Tovar pidió el 3-nov ("primero comercial,
  terminadísimo").
- El Excel reproduce Pauta + Comercial **del universo Paid**, y eso el 412 ya lo hace dentro de Pauta con `area: paid`. No hace falta
  una pestaña nueva; hace falta que la misma fila diga qué universo mide (ver abajo).

Lo que sí hay que ordenar (propuesta, a decidir con la pantalla delante):

| Pestaña | Qué vive | Por qué |
|---|---|---|
| **Hoy** | Sin cambio. Reporte del día (cupos, leads, citas, ventas, caja, por closer, PDF) | Es la plantilla v5 de Michael; no mezclarla con pauta |
| **Comercial** | Sin cambio. Embudo, show, cierre, closers, todas las áreas | Universo = todas las áreas |
| **Dinero** | Sin cambio. Caja, vendido, saldo, metas del mes y de la cohorte | |
| **Pauta** | **Resultados** (arriba y siempre visible): cifras del periodo, cumplimiento de la cohorte, tabla con Por día \| Por semana y Por cuenta, gráfica. **Origen y calidad** (más abajo, o en su propia vista): tabla por canal, campaña y anuncio (355), traza, embudo del formulario, ROAS proyectado | Hoy son ocho bloques en una sola pantalla; Paid Media pide primero lo que sustituye al Excel |

Dos riesgos de naming que sí hay que resolver (N4):

1. **Show, Cierre de ventas y Agenda → venta aparecen en Comercial (todas las áreas) y en la tabla de Pauta (solo Paid).** Son el
   mismo concepto con dos universos. La tabla debe rotular "de Paid" y el "Cómo se calcula" de Comercial "todas las áreas". Un módulo, un
   parámetro de área, nada de una segunda función.
2. **"Agendas" tiene hoy tres significados en pantalla.** Antes de poner "agendas del día" en una columna diaria, fijar cuál (Q-2).

Si tras el diario la pestaña Pauta pasa de ~8 bloques a ~10, vale partirla en dos vistas con el mismo componente de pestañas
(`Pestanas`), no con plegables: `structure.md` §9 dice que **lo principal no se pliega**. No lo afirmo hoy: no tengo la longitud
medida de la pantalla real.

### 5.4 Plan de inversión diario: tres formas, una decisión

| Forma | Cómo | Costo | Cuándo sirve |
|---|---|---|---|
| a | Reparto automático de `objetivos.inversion` de la cohorte entre los días hábiles que quedan (ya existe `inversionDiaMeta`) | Cero migración | Si "sugerida" es solo el presupuesto repartido |
| b | Tabla `plan_inversion` (programa, cuenta, fecha, monto, moneda) editable en Hub, con `change_log` por el molde | Migración + pantalla | Si Pauta fija el número cada día (hoy: 300.000 → 560.000 → 750.000 → 840.000, escalonado por semana) |
| c | Dejarlo fuera: el CRM no decide, Pauta sigue con su plan en otro lado | Cero | Si el plan es juicio de Pauta y no debe vivir en el CRM |

No elijo: depende de Q-4. Mi inclinación es **a** con una excepción **b** por semana si Pauta lo confirma (los cambios son semanales,
no diarios), pero es una inclinación sin datos.

## 6. Tickets propuestos (no creados)
> **10-nov, creados:** 414 a 418 existen en `docs/tasks/` con este alcance, más 419 (la Cifra), 420 (Pauta en dos vistas) y 421
> (cita confirmada, DM-8), del diseño aprobado [`diseno-cifra-y-pauta.md`](./diseno-cifra-y-pauta.md). La decisión de "Pauta en dos
> vistas" quedó tomada (DM-5) y es el 420. Q-2 y Q-3 tienen propuesta en DM-8. Orden y reparto: ola O12 de `plan-reparto.md`.


Los números son los siguientes libres en `docs/tasks/` (el último archivo es el 412). El 413 es el audit y va primero: los demás se re-ordenan con lo que él decida. **Verificar el tracker antes de tomarlos**: otras
sesiones pueden reservar números.

| # propuesto | Título | Alcance | Depende de | Migración |
|---|---|---|---|---|
| ~~413~~ → **403** | **Audit total del Hub y de la parte gerencial y de pauta (prioridad 1).** Mani, 10-nov: se funde en el [403](./tasks/403-registro-tipado-completo-y-diccionario-generado.md); la F0 está en [`audit-hub-2026-11-10.md`](./audit-hub-2026-11-10.md). El número 413 queda libre | Ver §9: inventario de toda cifra mostrada, redundancias, huecos, cálculos errados, una definición por concepto, simplificación y reorganización visual con flexibilidad e interactividad. Entrega un documento y los tickets que salgan; no cambia código por sí mismo | 412 | No (las correcciones que salgan pueden traer la suya) |
| 414 | Tabla de Pauta por día | Paso `dia` en `cargarPautaSemanal` y `TablaSemanalDePauta`; interruptor en la URL (`lib/series-pasos.ts`); CSV por día; el límite de columnas razonable y paginación o desplazamiento horizontal; tests de paridad día = suma de la semana | 412, Q-2, Q-3 | No |
| 415 | Costo por venta (CAC) de Paid | Fila nueva con cobertura, módulo único, fila en `metricas.md` §3.2 (cierra el 🟡 123), nombre en `overview.md` §11 | 412 | No |
| 416 | Pauta por cuenta | Dimensión `cuenta` en `hechos/dimensiones.ts`; "Ver por cuenta" para inversión, agendas Meta y costo por agenda según Meta; no suma programas | 412 | No |
| 417 | Plan de inversión diario y diferencia vs plan | Según Q-4: reparto de la meta de cohorte (sin migración) o tabla editable `plan_inversion` por el molde `lib/catalogo/`; fila "Diferencia vs plan" | 414, 416, Q-4 | **Sí** si se elige la tabla |
| 418 | Cuadre del Excel y retiro | Con una semana cerrada de Paid Media (PQ-3), probar la tabla contra el Excel fila por fila y anotar las diferencias; criterio para apagar el Excel | 414, 415, 416 | No |

Y una decisión sobre la que no propongo ticket aún: ordenar Pauta en dos vistas (§5.3). Se abre después del 414.

## 7. Preguntas abiertas (nada asumido)

| # | Pregunta | A quién | Por qué importa |
|---|---|---|---|
| Q-1 (PQ-1) | ¿PowerTalk es Comunícate con Confianza, que ya existe en el CRM? Evidencia: la cuenta de Meta de Francisco está asignada a ese programa (`metricas.md` §4) y una semana cuadra en ventas y shows (§3.1). En contra: una sola semana con 1 venta. No se asumió | Paid Media, Mani | Si sí, no hay que crear programa; si no, es el ADR 0012 y una migración de datos |
| Q-2 | "Agendas del día": ¿cita creada ese día, cita con fecha ese día, o la del pixel? Medí 88 contra 124 Paid creadas, 162 totales y 65 citas | Michael / Paid Media | Define la fila diaria; sin esto el diario no cuadra |
| Q-3 | "Llamadas realizadas": ¿lo que el closer reporta o lo marcado en el CRM? Medí 30 contra 8 shows con cobertura 35 % | Michael, closers | Si es lo marcado, el trabajo es que los closers marquen; si no, el Excel mide otra cosa |
| Q-4 | "Inversión sugerida": ¿la fija Pauta cada día o sale de un presupuesto repartido? | Paid Media | Decide si hay migración (§5.4) |
| Q-5 | ¿Qué día cuenta una venta en el reporte diario de Pauta: el de la venta o el del registro? | Mani | Define la fila de ventas y el ROAS diarios; ya existen las dos |
| Q-6 | ¿La semana de Pauta es lun a dom (D-3) o sáb a vie como en la hoja de Comunicarte? | Paid Media | Cambia todos los totales semanales |
| Q-7 | ¿Se puede retirar el Excel de lo anterior al 1-oct, o hay que cargar un histórico a mano en el CRM? | Mani | El CRM no tiene gasto ni agendas previas: el Excel de septiembre no tiene equivalente |
| Q-8 | ¿Inversión por cuenta se necesita por Milena y Rosario como columnas siempre visibles, o basta un desplegable? | Paid Media | Define el costo de pantalla de 416 |
| Q-9 | ¿Quién llena hoy la "línea de base" (costo por agenda 139.448, cierre 47,8 %) y debería ser una meta de cohorte? | Paid Media | Convierte una nota en un objetivo con semáforo (D-6) |

## 8. Lo que no pude verificar

- El estado actual de la barra de inversión del cumplimiento con una meta cargada, y cómo se ve la tabla semanal en pantalla: no abrí
  el CRM desplegado.
- La inversión y las agendas de Meta de la semana medida (§3): `pauta_roas` falló con "Error interno" en producción. **Conviene
  revisar ese error** (no es de esta sesión; lo anoto aquí para que alguien lo vea).
- PowerTalk: la inversión y las agendas de Meta de la semana comparada, por la misma razón de §3.
- Por qué ventas 5 contra 6: se necesita la lista de deals de la semana, que no traje para no meter datos de personas en este documento.

## 9. Prioridad 1: audit total del Hub, de la parte gerencial y de Pauta (pedido de Mani, 10-nov)

**Por qué es lo primero.** Después de todo lo extraído (weekly del 3-nov, reunión con Pauta del 7-nov, daily de Michael, pedidos de
Gerencia, los tres Excels, los artifacts de 30X) y de todo lo construido (371, 373, 355, 375, 412), el Hub tiene mucho más de lo
que cabe en la cabeza de quien lo mantiene. Mani sospecha que hay redundancia, huecos, cálculos errados y cifras que no significan lo
mismo en dos pantallas. Esta sesión **encontró ya ocho candidatas** leyendo solo la pestaña Pauta (§9.2). Una pantalla con cifras
que no cuadran es peor que un Excel: el Excel al menos no pretende ser la verdad. El norte del 30-oct (ADR 0115) lo dice: una
pregunta, una respuesta.

### 9.1 Alcance

| Superficie | Qué se audita |
|---|---|
| Hub del programa, 4 pestañas (Hoy, Comercial, Dinero, Pauta) y filtro de cohorte | Cada cifra, tabla, gráfica y barra: de qué función sale, qué fila de `docs/metricas.md` la define, qué test la cubre, qué lista abre |
| `/hub` (todos los programas) | Que solo sume magnitudes sumables (ADR 0048) |
| Programa › General, Mi espacio, Metas, Ajustes de metas | Las mismas cifras repetidas en otro lugar |
| Reporte de WhatsApp (semáforo), CSV (`pauta-citas`, `pauta-semanal`), PDF de Hoy, MCP (`resumen_del_hub`, `consultar_metrica`, `pauta_roas`) | Que den lo mismo que la pantalla, para el mismo periodo |
| Los tres Excels (§1) y los reportes de 30X | Como fuente de necesidades, no de definiciones |

### 9.2 Candidatas ya encontradas (hechos con fuente; falta decidir cuál es la correcta)

| # | Qué | Fuente |
|---|---|---|
| I-1 | **"Cierre de ventas" y "Agenda → venta" se calculan distinto en dos pestañas.** Comercial y Hoy usan el grupo de citas (`grupoDeCitas`, por deal, ADR 0079): la venta y el show son del mismo grupo. La tabla de Pauta divide `ventas` (por día de **venta**) entre `shows` o `citas` (por día de **cita**): dos grupos distintos con el mismo nombre. El doc del 9-nov afirma que el CRM las calcula "sobre el mismo grupo" | `lib/queries/hechos/pauta-semanal.ts:250-251` contra `lib/queries/tasas-del-grupo.ts:290` y `docs/paid-media-2026-11-09.md` §2 F5 |
| I-2 | **El ROAS de la tabla semanal y el ROAS de la tabla por campaña/anuncio (355) usan anclas distintas.** `metricas.md` §3.2 fija el ROAS por **cohorte de registro** (el día del envío que trajo a la persona). La tabla semanal divide el vendido de las ventas con **fecha de venta** en la semana entre el gasto de la semana. Las dos están en la pestaña Pauta con el mismo rótulo "ROAS" | `pauta-semanal.ts:204-206` y `leerTodasLasVentas` (usa `venta.listar` por `dia`), contra `metricas.md` §3.2 (fila ROAS) y `lib/queries/roas-de-pauta.ts` |
| I-3 | **"Agendas" tiene tres significados** (creadas §1.2, citas §1.3, Meta §1.9) y el Excel usa uno que no pude identificar. En Hoy hay dos tarjetas rotuladas; en la tabla de Pauta la fila se llama "Agendadas" | `metricas.md` §1.2, §1.3, §1.9 y §3.5 (D1, DA-4) |
| I-4 | **"% de show" tiene tres fórmulas**: por deal (DA-3, Hoy), por cita (`showPorCita`, tabla de Pauta y Hoy al lado) y, en el Excel, llamadas ÷ agendas Meta. Las tres con el mismo nombre en alguna pantalla | `metricas.md` §3.5; `pauta-semanal.ts:249` |
| I-5 | **Las tasas salen "parcial" por falta de resultados marcados** (cobertura 35 % en Tactical y 57 % en Comunícate con Confianza en las semanas medidas): la causa no es de cálculo, es de captura | §3 y §3.1 |
| I-6 | **La frecuencia es "—" en toda semana** (Meta no da alcance de varios días, D-5) y los Excels la llenan a mano por semana. El reemplazo promete menos que lo que reemplaza | `pauta-semanal.ts` (`frecuencia`) y Excel PowerTalk fila 51 |
| I-7 | **Universos que se llaman igual**: Show, Cierre y Agenda → venta aparecen en Comercial (todas las áreas) y en Pauta (solo Paid) sin que el rótulo lo diga | §5.3 |
| I-8 | **El gasto de Meta empieza el 1-oct**: cualquier rango que lo cruce da "—" en ROAS por cobertura, correcto; pero otras filas (ventas, agendas) sí tienen número en esas fechas y se ven juntas | §3 |

### 9.3 Método propuesto (una sola sesión padre, sub-sesiones por superficie, sin tocar código en la fase 1)

1. **Inventario**: una tabla con cada cifra visible en el Hub y sus hermanas (MCP, WhatsApp, CSV, PDF): rótulo en pantalla → función →
   fila de `metricas.md` → vocabulario (`lib/vocabulario-metricas.ts`) → test → lista que abre. Lo que no tenga las cinco columnas es hallazgo.
2. **Paridad por concepto**: para cada concepto del registro (`lib/metricas/registro.ts`, ADR 0120) y los que aún no están, correr el mismo
   periodo por todas las superficies y comparar. Una diferencia es hallazgo hasta que una definición la explique por escrito.
3. **Cálculo**: reconstruir cada fórmula a mano con una consulta independiente sobre la base (local con datos sintéticos conocidos; producción
   solo en lectura) y con casos que las harían divergir (N2): venta anulada, reagendada, cita cancelada, otro programa, USD y COP, día sin TRM.
4. **Redundancia y huecos**: matriz pedido (Gerencia, Pauta, Comercial) × lo construido (el trazado de `docs/hub.md` §0, `weekly-2026-11-03.md`,
   `paid-media-2026-11-09.md` y este documento). Una fila sin dueño es un hueco; una fila con dos dueños es redundancia.
5. **Una definición universal**: para cada concepto en conflicto, decidir con Mani cuál manda (ADR nuevo o enmienda, N8), reescribir en el mismo
   commit título, índice, `metricas.md` y vocabulario, y dejar un guardián que impida volver (N7).
6. **Reorganización visual**, solo cuando el cálculo esté cerrado: ver §9.4.

### 9.4 Lo que la pantalla tiene que poder hacer (requisitos de flexibilidad e interactividad)

Sacados de lo que pidieron Gerencia y Pauta; cada uno ya tiene su sitio en el contrato de `docs/structure.md` §9:

- Cualquier **periodo** y comparar hasta tres (`lib/periodo.ts`); "de tal fecha a tal fecha" (Dani); atajos Últimos 7/14/28 y Todo (X-2).
- Cualquier **paso**: por día, por semana (y por mes si Gerencia lo pide); el mismo interruptor para toda tabla y gráfica (`lib/series-pasos.ts`).
- Cualquier **corte**: cohorte, cuenta, canal, campaña, conjunto, anuncio, closer (este último solo para quien `veEquipoComercial`).
- **Cumplimiento** siempre visible: por cupos y en plata, del mes y de la cohorte (371), contra lo esperado a la fecha.
- **Toda cifra abre su lista** y toda lista sabe volver (`urlDeLista`, `enlaceConVuelta`).
- **Semáforo** por métrica con umbrales como datos (`objetivos`, D-6), no escritos en pantalla.
- **Exportar** lo que se ve (CSV) y descargar el reporte del día (PDF de Hoy).
- **Sin cruzar programas** en una tasa; la vista de todos solo suma lo sumable (ADR 0048).

### 9.5 Entregable y criterio de cierre del 413

Un documento (`docs/audit-hub-AAAA-MM-DD.md`, documento de reunión N8) con las tablas de §9.3 llenas, cada hallazgo con severidad
(cifra equivocada, cifra ambigua, redundancia, hueco, mejora visual), la decisión que necesita de Mani y el ticket que la ejecuta. Está
cerrado cuando: ninguna cifra del Hub queda sin las cinco columnas, I-1 a I-8 tienen decisión escrita, y la reorganización visual
propuesta (si la hay) cabe en el contrato de entendimiento de `structure.md` §9 sin plegar lo principal.

**Lo que esta sesión no hizo:** no se midió ninguna de las candidatas I-1 a I-8 con una consulta que demuestre la diferencia numérica; se
leyó el código y la documentación. Que existan dos anclas distintas no prueba que den cifras distintas en un periodo real: eso lo mide el
audit.

## 10. Los tres Excels como plantilla: referencia completa para quien no los tenga abiertos

Los archivos viven en `~/Downloads` de Mani y **no se mueven ni se copian al repo** (datos de negocio). Esta sección y §1 bastan para
entender su estructura sin abrirlos. Si se necesita un valor concreto, se le pide a Mani el archivo.

| Archivo | Hojas | Rango | Programa |
|---|---|---|---|
| `Reporte_Diario_Llamada_Comunicarte.xlsx` | `Comunicarte Llamada`, `Cohorte Oct - Nov` | 12-ago a 25-sep; 26-sep a 13-nov | Comunicarte (dos cuentas: Milena y Rosario), ticket USD 797 (2.537.648 COP a 3.184) |
| `Reporte_Diario_Llamadas_Tactical.xlsx` | `Tactical`, `Cohorte Oct - Nov` | 19-ago a 4-oct; 5-oct a 15-nov | Tactical Investor, meta 60 cupos, ticket USD 1.500 (4.776.000 COP), presupuesto 16,74 M COP |
| `Reporte_Diario_Llamadas_PowerTalk.xlsx` | `Power Talk Oct Nov` (rótulo "FRANCISCO - LLAMADA") | 5-oct a 20-nov | Probablemente Comunícate con Confianza (Q-1), meta 40 cupos, ticket 2.538.232 COP, plan de inversión 620.000 y luego 1.100.000 por día |

**PowerTalk es la plantilla de destino más completa que tenemos** (la inferencia de que es la más reciente es mía: tiene el bloque de
30X completo y fechas hasta el 20-nov; no está verificada). Su contenido, renglón por renglón, con el equivalente que debería tener el CRM:

| Fila | Renglón y cálculo en el Excel | Equivalente en el CRM | Estado |
|---|---|---|---|
| 5 | Inversión (a mano, COP) | Inversión (M1) | ✅ |
| 6 | Agendas en Meta (Invite) (a mano) | Agendas según Meta (M4) | ✅ |
| 7 | Costo por agenda = inv ÷ agendas Meta | Costo por agenda (según Meta) | ✅ |
| 8 | Typeform (registros, a mano) | Registros de Paid (`hechos/envio`) | ✅ en datos; sin fila en la tabla del 412 |
| 9 | Costo por Typeform = inv ÷ registros | CPL de Paid | 🟡 123 |
| 10 | Agendas del día (a mano) | Agendadas Paid | 🟡 Q-2 |
| 11 | Llamadas realizadas (a mano) | Shows | 🟡 Q-3 |
| 12 | Ventas (a mano) | Ventas de Paid | ✅ |
| 13 | % de cierre = ventas ÷ llamadas del día | Cierre de ventas | 🟡 I-1 |
| 14 | Ingresos = ventas × ticket fijo | Facturación | 🟡 no copiar |
| 15 | ROAS = ingresos ÷ inversión del día | ROAS | 🟡 I-2 |
| 16 | Ventas necesarias hoy | Objetivo del día / requeridas | ✅ |
| 17 | Inversión sugerida (espejo del gasto hasta una fecha; luego 620.000, 1.100.000) | Plan de inversión | ❌ ticket 417 |
| 18 | Diferencia vs plan = real − sugerida | Diferencia vs plan | ❌ ticket 417 |
| 21 a 32 | Resumen: meta de cupos (40), ticket, presupuesto, agendas/día necesarias, ventas acumuladas, % cumplimiento, inversión acumulada, % presupuesto, agendas acumuladas, agendas/día real, CAC, ROAS | Cumplimiento de la cohorte (371/412) | ✅ salvo CAC y promedio por hábil |
| 35 a 41 | General semanal: Inversión, Agendas, Costo por agenda, Ventas, Facturación, ROAS, Profit | M1 a M3, M5, M7 a M11 | ✅ |
| 42 a 44 | Comercial semanal: % de presentación a zoom (llamadas ÷ agendas Meta), % de cierre zoom a cliente (ventas ÷ llamadas), % de cierre agenda a cliente (ventas ÷ agendas) | M12 a M14 | ✅ con otra definición (I-1, I-4) |
| 45 a 51 | Tráfico semanal: Agendas Meta, CPM, CTR enlace, % clics a landing, % conversión landing, costo por agenda, Frecuencia (los de Meta, a mano) | M15 a M19 | ✅ (hija D del 412); frecuencia semanal "—" (I-6) |

Formato condicional: cada renglón se pinta cuando la celda contiene `NONE` (no hay umbrales de semáforo en ningún Excel). Celdas azules =
captura manual. Los semáforos de 30X (F4) son la propuesta para D-6, no algo que el Excel de Retia tenga.
