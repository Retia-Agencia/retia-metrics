# F2b: paridad de lo que F2 no cubrió (ticket 388, hijo del 385)

> **Veredicto: ninguna divergencia crítica.** Toda cifra reconstruida por SQL coincide con lo que muestran Hub, MCP y semáforo (ROAS, gasto, metas, Origen, costo por agenda, los tres CSV). Lo que hay son conceptos con el mismo rótulo y tres problemas de alta severidad que no son de cálculo: cuatro "agendas" distintas para el mismo programa y mes (F2B-01), 807 leads fuera del Hub (F2B-02) y tres herramientas del MCP cuya respuesta excede el límite de lectura (F2B-03). No hay que abrir ticket antes de la ola 1; los tres ya tienen dueño en el plan (397, 389, 399/400).

- **Fecha:** 7-nov-2026, noche (Bogotá). **Base:** producción, ref `hfqmiyiuyqapdsbywrag` verificado dentro de la connection string antes de cada corrida (sin imprimirla).
- **Método:** `SELECT` escritos a mano en `BEGIN READ ONLY` (con `savepoint` por consulta), sin importar `lib/queries/`. Se contrastaron contra (a) el MCP `retia-crm` en vivo y (b) las funciones reales de la app (`leerMetasDelMes`, `leerVamosALlegar`, `costoPorAgendaDeVentana`, `origenDelPrograma`, `cargarRoasDePauta`, `csvDeCitasPauta`, `dealsParaCsv`, `llamadasDelPrograma`) que alimentan Hub, WhatsApp y los CSV. Periodos: `mes_cerrado` (2026-10-01 a 10-31), `custom14` (10-24 a 11-06), el día 11-06 y `este_mes` (11-01 a 11-07).
- **Límites, dichos sin adornar:**
  1. **Las funciones de la app se corrieron con la conexión directa sin forzar solo lectura** (el parámetro `options` no se aplicó: `default_transaction_read_only` salió `off`). Solo invoqué funciones que leen (revisé su código); no hay escrituras en mi script, pero esa corrida no estuvo dentro de `BEGIN READ ONLY`. Las consultas SQL propias sí.
  2. "Paid" en mi SQL = `utm_medium` en `cpc|paid_social|paid` o `utm_id` presente en `pauta_objetos`. No replica el emparejamiento por nombre de campaña. Coincide con el código en los tres programas de octubre, pero es una aproximación.
  3. "Día de venta" en mi SQL = primera entrada a Abonado o Completo, **sin** la regla de reversa. El código usa la primera entrada tras la última reversa; difiere en 1 venta (F2B-09).
  4. WhatsApp: no leí el texto enviado. Reconstruí los datos que arma (`costoPorAgendaDeVentana`), no el mensaje. No hay `mensaje.ts` ejercido.
  5. Nada de personas en este documento: solo conteos y montos.

## 1. Casillas del ticket

| Casilla del "Done cuando" | Estado | Dónde |
|---|---|---|
| Reconstrucción de metas del mes y de la cohorte, ROAS, gasto convertido, Origen, costo por agenda y los tres CSV | **Hecho, todo coincide** | §2 |
| Ninguna suma agrupa Comunicarte COP con USD (insumo del 395) | **Hecho: ninguna lo hace hoy; dos puntos latentes** | §3 |
| Ventas antes del primer día de gasto y envíos pagos sin `utm_id` | **Hecho con conteo** | §4 |
| Impacto de los leads sin fecha por programa y mes (insumo del 389) | **Hecho** | §5 |
| Divergencias nuevas con clase y severidad | **Hecho, 12** | §7 |
| Las otras 9 herramientas del MCP y el periodo del mes en curso | **Hecho** | §6 |

## 2. Lo que cuadra

### 2.1 Metas (mes y cohorte)

SQL propio: ritmo = meta de cupos ÷ días hábiles (lunes a viernes) de la ventana de la cohorte; meta del mes = ritmo × hábiles de la intersección con el mes; USD = cupos × precio de la cohorte. Octubre, contra `leerMetasDelMes` y el MCP:

| Programa | Cohorte | Meta octubre (cupos) | Meta octubre (USD) | Vendidos (SQL / app) |
|---|---|---|---|---|
| Comunicarte | C3 | 31,43 | 25.049 | 28 / 28 |
| Comunícate con Confianza | C1 | 28,57 | 22.857 | 4 / **3** (ver F2B-09) |
| Tactical Investor | C3 | 34,38 | 51.563 | 17 / 17 |

Meta de la cohorte (cupos × precio): Comunicarte C3 USD 39.850, Confianza C1 USD 40.000, Tactical C3 USD 75.000; "esperado a hoy" y "por día hábil" coinciden con `esperadoLineal` y `metaDeHoy`. `leerVamosALlegar` y el bloque `metasDelMes` del MCP traen los mismos números que la función. Dato de entorno: **`cohorts.meta_leads_dia` es nulo en las 10 cohortes**; `metaLeadsDia: null` y cumplimiento `null` en el MCP. La decisión 354 alcance 3 (Envíos o Leads) no tiene hoy ninguna meta que medir.

### 2.2 ROAS y gasto convertido (octubre)

| Programa | Gasto USD (SQL) | Gasto USD (MCP) | Vendido Paid | ROAS SQL | ROAS MCP |
|---|---|---|---|---|---|
| Comunicarte | 8.022,98 | 8.022,98 | USD 10.281 (13 ventas) | 1,281 | 1,281 |
| Confianza | 2.947,18 | 2.947,18 | USD 1.547 (2) | 0,525 | 0,525 |
| Tactical | 11.148,92 | 11.148,92 | USD 10.500 (7) | 0,942 | 0,942 |

Gasto de octubre por moneda (SQL = semáforo): Comunicarte COP 23.270.503 (748 filas) **y** USD 757,70 (89 filas) = COP 25.666.274 / USD 8.022,98 con la TRM del día; Confianza COP 9.343.246; Tactical COP 35.491.754. 0 filas sin TRM en todo el gasto; 0 solapes en `tasas_cambio`. Con `desde_el_inicio` (Comunicarte) el MCP responde ROAS `—` con "Gasto de Meta desde el 1 oct 2026" (base 13, faltan 4): es la regla N3 funcionando.

### 2.3 Costo por agenda del semáforo (datos de WhatsApp)

| Programa | Ventana | Gasto de agenda COP | Agendas de Meta | Costo SQL | Costo app |
|---|---|---|---|---|---|
| Comunicarte | octubre | 23.270.503 | 301 | 77.311 | 77.311 |
| Comunicarte | 24-oct a 6-nov | 7.699.973 | 105 | 73.333 | 73.333 |
| Comunicarte | 6-nov | 475.413 | 7 | 67.916 | 67.916 |
| Confianza | 24-oct a 6-nov | 5.993.037 | 63 | 95.128 | 95.128 |
| Confianza | 6-nov | 835.001 | 6 | 139.167 | 139.167 |
| Tactical | octubre | 24.870.881 | 312 | 79.714 | 79.714 |
| Tactical | 24-oct a 6-nov | 12.127.981 | 131 | 92.580 | 92.580 |
| Tactical | 6-nov | 739.063 | 7 | 105.580 | 105.580 |

Confianza octubre: SQL da 89.839; la app devuelve **`null`** con "Gasto de Meta desde el 6 oct 2026" (5 días sin gasto cargado). La diferencia es la cobertura (N3), no un error. Agendas CRM de pauta en la misma ventana: 258 / 100 / 327 (octubre), contra 301 / 104 / 312 de Meta.

**Qué parte del gasto entra al costo:** por propósito de campaña, en octubre: Comunicarte agenda 80,7 % · lanzamiento 9,3 % · sin clasificar 9,9 %; Confianza 93,2 % / 0 / 6,8 %; Tactical 70,0 % / 29,9 % / 0,1 %. Lo "sin clasificar" cuenta como agenda (documentado). **El gasto de lanzamiento de Comunicarte (COP 2.395.771) es exactamente el de sus dos cuentas en USD**: en ese programa la moneda y el propósito coinciden. Solo hay 7 campañas clasificadas de 161 en Comunicarte, 7 de 15 en Confianza y 5 de 256 en Tactical (las demás sin propósito).

### 2.4 Origen (octubre, registros completos)

| Programa | Registros | Paid (con macros) | Macros | Sin UTM | SQL = app |
|---|---|---|---|---|---|
| Comunicarte | 985 | 724 | 8 | 3 | sí (MCP: 985 · macro 8 · sin UTM 3) |
| Confianza | 442 | 381 | 0 | 6 | sí |
| Tactical | 809 | 643 | 3 | 68 (8,4 %) | sí |

### 2.5 Los tres CSV

| CSV | Filas (Comunicarte / Confianza / Tactical) | Contra |
|---|---|---|
| `pauta-citas.csv` (octubre) | 245 / 105 / 291 | = agendas de Pauta (`pauta_roas`); SQL independiente da 245 / 105 / 291 |
| `descargar.csv` de deals | ganados 40 / 7 / 20; agendado 350 / 95 / 415; potencial 249 / 300 / 239 | = SQL y = tablero MCP (847 deals de Confianza, mismas columnas) |
| `grain.csv` | 20 / 35 / 22 con link | = SQL de llamadas con `link_grain` |

## 3. Monedas: ninguna suma mezcla COP con USD

**Lectura de código:** todo gasto pasa por `convertirGasto`/`convertirMonto` (`lib/pauta/convertir-gasto.ts`), que **lanza 422 con una moneda que no es COP ni USD** y devuelve `null` sin TRM. Lo leen `roas-de-pauta.ts:183` y `costo-por-agenda.ts:281/335`. Los abonos van siempre por `sumaDeAbonos()` agrupado por moneda (`series-dinero.ts:60`); `saldo.ts` deja `abonado = 0` y `saldo = null` si un deal tiene monedas mezcladas. **Datos:** 0 campañas con gasto en dos monedas, 0 filas de gasto con moneda distinta de la de su cuenta, los 76 abonos son USD.

**Lo que haría una suma ingenua** (para dimensionar el riesgo de 395): Comunicarte octubre sumando `monto` sin mirar la moneda da 23.271.261, contra COP 25.666.274 correcto: queda **9,3 % corto**, y parece creíble porque el USD pesa poco en el nominal.

**Dos puntos latentes** (no fallan hoy, el tipo no los impide):
1. `convertirGasto` suma `null` (día sin TRM) como 0 (`total + (monto ?? 0)`). El ROAS no marca cobertura incompleta por TRM: el aviso "Días sin TRM" vive solo en `components/pauta-roas.tsx:90`, **no** en `roas.cobertura` ni en la respuesta de `pauta_roas` del MCP. `tasas_cambio` hoy llega hasta el 9-nov (la carga la hace el cron de pauta): si un día no se carga, el gasto en USD de las cuentas COP baja en silencio y el ROAS sube (F2B-08).
2. `lib/pauta/dia-en-curso.ts:128-138` acumula el gasto por campaña tomando la moneda de la primera fila, sin validar las demás. Es seguro mientras una campaña pertenezca a una cuenta (hoy 0 excepciones), pero lo garantiza la forma de los datos, no el código.

Para el 395: el `CHECK (moneda IN ('COP','USD'))` de `gasto_pauta` y `cuentas_publicitarias` no choca con ningún dato de hoy.

## 4. Cobertura del ROAS y envíos pagos sin `utm_id`

**Ventas antes del primer día de gasto** (el gasto empieza el 1-oct en Comunicarte y Tactical y el 6-oct en Confianza). Ventas vigentes sin cortesías:

| Programa | Ventas | Sin envío de origen | Paid | Paid con envío anterior al primer gasto | Paid vendidas antes del primer gasto | Todas vendidas antes del primer gasto |
|---|---|---|---|---|---|---|
| Comunicarte | 40 | 12 | 19 | **6** | 3 | 7 |
| Confianza | 7 | 0 | 3 | 0 | 0 | 0 |
| Tactical | 20 | 4 | 9 | **2** | 1 | 1 |

El ROAS ancla la venta al día del envío que abrió el deal, así que la columna que importa es "envío anterior al primer gasto": con `desde_el_inicio` esas ventas quedan fuera de cobertura y el ROAS sale `—` (el MCP, con periodo desde el 16-sep, marca 4 de 17 para Comunicarte). Además **12 de 40 ventas de Comunicarte (30 %) y 4 de 20 de Tactical no tienen envío de origen**: no entran a ningún ROAS ni a Origen por construcción.

**Envíos pagos sin `utm_id`** (`utm_medium` `cpc`, `paid_social` o `paid`; envíos completos y parciales; conteo total de pagos entre paréntesis):

| Programa | Ago | Sep | Oct | Nov (1 a 7) | Total sin `utm_id` | Último sin `utm_id` |
|---|---|---|---|---|---|---|
| Comunicarte | 1 | 19 | 339 de 1.210 | 10 de 451 | **369** | 5-nov |
| Confianza | | | 514 de 992 | 0 de 271 | **514** | **21-oct** |
| Tactical | | 45 | 472 de 1.122 | 4 de 379 | **521** | 4-nov |
| Second Brain Jurídico | | | 0 de 103 | 1 de 211 | 1 | 4-nov |
| **Total** | | | | | **1.405 de 4.812 (29 %)** | |

Confianza dejó de mandar envíos pagos sin id desde el 22-oct (0 en 12 días seguidos). Comunicarte y Tactical siguen con goteo (10 y 4 en noviembre, la mayoría de la plantilla vieja `facebook / cpc`). En octubre, de los registros **completos** pagos faltaba el id en 283 de 724 (Comunicarte), 200 de 381 (Confianza) y 382 de 643 (Tactical).

Aclaración que corrige a F3-09: los envíos con `utm_id` numérico fuera del árbol de Meta (F3-09: 301) **son todos de Second Brain Jurídico** (313 de 314 envíos pagos, 103 en octubre y 210 en noviembre): ese programa no tiene ninguna cuenta publicitaria cargada en el CRM, así que no hay árbol ni gasto, y su ROAS no se puede calcular. En los otros tres programas: 0 ids fuera del árbol, 0 ids no numéricos, 1 macro sin expandir en Comunicarte y 3 en Confianza durante noviembre.

## 5. Impacto de los leads sin fecha (insumo del 389)

**Hoy son 807** (F3 midió 784 al mediodía): 789 de formulario y 18 de alta manual. Los 789 son personas que **solo tienen parciales** de Typeform (`fecha_primera_aplicacion` nula porque el parcial no trae `fecha_envio`). Los 807 tienen deal (potencial) y **todos nacieron en octubre o noviembre**: no es una laguna histórica, es el mes en curso fuera del Hub. De los 807, 16 tienen venta vigente (Comunicarte 12, Tactical 4) y 4 tienen cita.

| Programa | Sin fecha | Con deal | Con venta | Con cita | Nacidos en oct / nov |
|---|---|---|---|---|---|
| Comunicarte | 263 (249 + 14 manuales) | 263 | 12 | 2 | 181 / 82 |
| Confianza | 300 | 300 | 0 | 1 | 236 / 64 |
| Tactical | 244 (240 + 4) | 244 | 4 | 1 | 168 / 76 |
| Second Brain Jurídico | 0 | 0 | 0 | 0 | 0 / 0 |

**"Leads" del Hub contra la lista** (mes y programa):

| Programa | Mes | Leads Hub | Leads lista | Diferencia | Agendas creadas | Ventas |
|---|---|---|---|---|---|---|
| Comunicarte | oct | 927 | 1.108 | +181 (+20 %) | 348 | 28 |
| Comunicarte | nov (1 a 7) | 184 | 266 | +82 (+45 %) | 57 | 5 |
| Confianza | oct | 428 | 664 | **+236 (+55 %)** | 122 | 4 |
| Confianza | nov | 122 | 186 | +64 (+52 %) | 39 | 3 |
| Tactical | oct | 764 | 932 | +168 (+22 %) | 406 | 17 |
| Tactical | nov | 145 | 221 | +76 (+52 %) | 69 | 2 |

**Razones de dos conteos del mes** (agendas creadas ÷ leads, ventas ÷ leads; no son tasas del Hub, son el insumo para ver cuánto se mueven según el denominador):

| Programa | Mes | Agendas ÷ leads Hub | Agendas ÷ leads lista | Ventas ÷ leads Hub | Ventas ÷ leads lista |
|---|---|---|---|---|---|
| Comunicarte | oct | 37,5 % | 31,4 % | 3,02 % | 2,53 % |
| Confianza | oct | 28,5 % | 18,4 % | 0,93 % | 0,60 % |
| Tactical | oct | 53,1 % | 43,6 % | 2,23 % | 1,82 % |
| Comunicarte | nov | 31,0 % | 21,4 % | 2,72 % | 1,88 % |
| Confianza | nov | 32,0 % | 21,0 % | 2,46 % | 1,61 % |
| Tactical | nov | 47,6 % | 31,2 % | 1,38 % | 0,90 % |

Lo que esto dice para el 389: la decisión previa es **si una persona que solo dejó un parcial es un "lead"**. Hoy el Hub la cuenta como deal (embudo "Deals creados desde un parcial", ADR 0069) y no como lead, y la lista Leads la cuenta como lead. El Hub no está equivocado por la regla escrita; los dos números responden preguntas distintas con el mismo nombre (clase B). Rellenar la fecha (M1) mueve el Hub de golpe: Confianza octubre pasaría de 428 a 664.

## 6. Las otras nueve herramientas del MCP y el periodo del mes

| Herramienta | Resultado |
|---|---|
| `programas_visibles` | 4 programas activos, igual que `programs.activo`. Correcto |
| `pauta_roas` | = SQL y = función de la app (§2.2). `este_mes` Tactical: registros 147, gasto USD 3.711,65, ambos = SQL |
| `origen_del_programa` | = SQL (§2.4) y = `origenDelPrograma` |
| `consultar_metrica` (caja) | Confianza `este_mes`: 3 abonos, USD 932 = SQL |
| `resumen_del_hub` | Confianza `este_mes`: leads 122 = SQL; metas, dinero y embudo = función de la app. **Respuesta de 82.939 caracteres** (F2B-03) |
| `tablero_de_deals` | Total 847 y columnas = SQL por etapa. **Respuesta de 931.364 caracteres** |
| `bandeja` | Secciones coherentes con la pantalla. **Respuesta de 300.147 caracteres**; "atención" trae 687 de 847 deals |
| `cartera_vencida` | Confianza: 0 filas (filtra por la cohorte activa por defecto). Sin datos que contrastar |
| `buscar_leads`, `ficha_de_lead`, `ficha_de_deal` | **No ejercidas**: leen personas por nombre y correo, no lo necesité y no lo hice. Su paridad queda sin medir |

**Periodo `mes_en_curso`:** el enum del MCP no lo trae ni acepta un mes `AAAA-MM`; trae `este_mes` (1° del mes a hoy, 11-01 a 11-07 hoy), que se comprobó contra SQL y coincide. Un mes completo hay que pedirlo como `custom` con las dos fechas (ticket 400).

## 7. Divergencias nuevas

Escala: crítica, alta, media, baja. Clases del ticket: A (mismo rótulo, dos conceptos), B (dos definiciones vivas), C (un concepto, dos nombres), D (dato faltante en la captura), E (esperado y mal explicado).

| Id | Sev. | Clase | Qué | Cifras | Fuente |
|---|---|---|---|---|---|
| F2B-01 | **Alta** | A | **Cuatro "agendas" distintas para pauta en el mismo programa y mes.** (1) Pauta: citas de los envíos de pauta del rango, anclado al día del envío; (2) Origen y semáforo: citas creadas en el rango de área paid; (3) Meta: conversión del pixel; (4) Hub total: todas las citas creadas. Pauta resta 13 a Origen por el ancla | Comunicarte oct: **245 / 258 / 301 / 348**. Semáforo CRM contra Meta: Confianza 100/104, Tactical 327/312 | `cargarRoasDePauta` (ancla en el envío) contra `agrupar` de `hechos/agenda.ts`; MCP `pauta_roas` (245) y `origen_del_programa` (255 + 3 de macros = 258) |
| F2B-02 | **Alta** | B | **"Leads": 807 personas solo-parcial fuera del Hub y dentro de la lista** (§5). El Hub las cuenta como deals y no como leads | Confianza oct 428 contra 664; razones del mes distintas hasta 10 puntos | consulta de §5; F2-02, F3-01 |
| F2B-03 | **Alta** (MCP) | E | **Tres herramientas devuelven más de lo que un modelo puede leer:** `tablero_de_deals` 931.364 caracteres (Confianza, un solo programa), `bandeja` 300.147 (277.919 son la sección "atención") y `resumen_del_hub` 82.939 (73.877 son `embudoEtapas`, que el cliente no pidió). El MCP también devuelve nombre y correo por fila. En `bandeja`, 687 de 847 deals aparecen en "atención" (632 "estancado"): la señal está saturada | Tope práctico muy por debajo | MCP en vivo, archivos de resultado |
| F2B-04 | Media | B | **Meta del mes de Confianza en noviembre suma la cohorte futura C2.** C1 vende hasta el 20-nov y C2 desde el 16-nov (5 días solapados, F3-11): la meta del mes es 43,43 cupos / USD 34.743 (21,43 de C1 + 22 de C2) y "¿Vamos a llegar?" muestra 9,2 % de avance, contra 18,7 % si solo contara C1 (4 ÷ 21,43). Depende de la decisión de solape (la 3 de Mani) | Meta noviembre 43,43 contra 21,43 | `armarMetasDelMes`: `filas` incluye toda cohorte cuya ventana toca el mes; MCP `metasDelMes` |
| F2B-05 | Media | D | **Envíos pagos sin `utm_id`**: 1.405 de 4.812 (29 %), con goteo vivo en Comunicarte (10 en noviembre) y Tactical (4). Confianza ya lo cerró (último 21-oct) | §4 | consulta de §4; F3-09 |
| F2B-06 | Media | D | **Second Brain Jurídico no tiene cuenta publicitaria en el CRM:** 313 de 314 envíos pagos con `utm_id` fuera del árbol; sin gasto, sin ROAS, sin costo por agenda. Corrige a F3-09, que lo daba por defecto de datos de todos los programas | 313 envíos | consulta de §4 |
| F2B-07 | Media | E | **Una venta es "de pauta" por el día del envío, no por el de la venta.** Comunicarte octubre: 28 ventas del Hub y 13 en Pauta; en el ROAS también faltan las 12 ventas sin envío de origen. Con el periodo `este_mes` Tactical da ROAS **0,00 "completa"** con gasto de USD 3.711 y 2 ventas del mes (ambas sin envío, no son de pauta). El MCP no entrega la ventana de maduración (`ventanaCierreDias`) que sí calcula la vista | 28 contra 13; ROAS 0,00 | `roas-de-pauta.ts` (`diaDelEnvio`), MCP `pauta_roas`; H-18 |
| F2B-08 | Media | D | **Día sin TRM = gasto 0 en silencio dentro del ROAS** (§3, punto 1): no baja la cobertura ni sale por el MCP. `tasas_cambio` llega al 9-nov | Latente | `convertir-gasto.ts` (suma `monto ?? 0`), `pauta-roas.tsx:90` |
| F2B-09 | Baja | E | **El día de una venta depende de la última reversa.** Un deal de Confianza pasó a Pagado parcial el 30-oct, se revirtió y volvió el 3-nov: el Hub lo cuenta en noviembre y octubre muestra 3 ventas, no 4 (SQL con la primera entrada). 6 deals tienen más de una entrada a Abonado o Completo. El ROAS no cambia (ancla en el envío) | Confianza oct 3 contra 4; contratado oct 2.347 contra 3.094 | historial de etapas; regla de reversa de `ventasConDiaEn` |
| F2B-10 | Baja | E | **Caja y Recaudado en la misma pantalla con cifras distintas:** Confianza noviembre, caja USD 932 (abonos del periodo) y Recaudado USD 1.999 (abonos de las 4 ventas del periodo, a hoy). Documentado en `metricas.md` (369, DH-2); el riesgo es de lectura | 932 contra 1.999 | MCP `consultar_metrica` y `resumen_del_hub` |
| F2B-11 | Baja | B | **Paid como "registros": 724 en Pauta y 716 en el cuadro de canales de Origen** (Comunicarte); los 8 restantes son envíos pagos con macro, contados aparte en Origen y como pagos en Pauta | 724 contra 716 + 8 | `origenDelPrograma`, `cargarRoasDePauta` |
| F2B-12 | Baja | A, C | **Los CSV.** `pauta-citas.csv`: las filas salen por el día del envío, no de la cita; 21 / 13 / 25 filas tienen fecha de cita fuera del periodo del nombre del archivo. `descargar.csv`: sin periodo (40 ganados acumulados, no los 28 de octubre); su columna "Valor" es el valor del lead (texto) y no el vendido, y "Origen (UTM)" es la tripleta cruda y no el área del Hub. `grain.csv`: solo 5 % de las llamadas tienen link (20 de 410, 35 de 162, 22 de 477); el listado de Calls trae 1 llamada menos que las vigentes en Confianza y en Tactical (161 y 476), causa no determinada | §2.5 | `csv-citas.ts`, `deals-para-csv.ts`, `csv-deals.ts`, `llamadas.ts` |

### Qué pasa con lo ya conocido

- **354 alcance 3:** sin meta de leads cargada (`meta_leads_dia` nulo en 10 de 10), la pregunta "Envíos o Leads" no tiene hoy una cifra que cambie; sigue bloqueando el 397 por vocabulario, no por números.
- **355 (pauta, un cargador):** F2B-01 y F2B-07 son los anclajes que el 355 tiene que decidir. Las cifras de ROAS y gasto de hoy coinciden entre superficies, así que el 355 puede refactorizar con estas tablas como base de comparación.
- **395 (monedas):** el `CHECK` es seguro con los datos de hoy; el 395 debe resolver F2B-08 y el punto 2 de §3 con tipos, no con revisión.
- **389:** F2B-02 y §5. M1 mueve el Hub de golpe (Confianza octubre, +55 %); decidir antes qué es un lead.

## 8. Reproducción (SQL de solo lectura, sustituyendo el programa y el rango)

```sql
-- Gasto por moneda y convertido, con la TRM del día (§2.2, §3)
select p.slug, g.moneda, count(*), round(sum(g.monto),2) nominal,
  round(sum(case when g.moneda='COP' then g.monto else g.monto*t.pesos_por_dolar end),0) cop,
  round(sum(case when g.moneda='USD' then g.monto else g.monto/t.pesos_por_dolar end),2) usd
from gasto_pauta g join programs p on p.id=g.program_id
left join tasas_cambio t on g.fecha between t.vigente_desde and t.vigente_hasta
where g.fecha between :desde and :hasta group by 1,2;

-- Meta del mes: ritmo × hábiles de la intersección (§2.1)
select codigo, meta_cupos::numeric/(select count(*) from generate_series(fecha_inicio_ventas::timestamp,fecha_cierre_ventas::timestamp,'1 day') d where extract(isodow from d)<6) ritmo
from cohorts where fecha_inicio_ventas is not null and fecha_cierre_ventas is not null;

-- Envíos pagos sin utm_id, por programa y mes (§4)
select p.slug, to_char(coalesce(s.fecha_envio,s.created_at) at time zone 'America/Bogota','YYYY-MM'), count(*), count(*) filter (where s.utm_id is null or btrim(s.utm_id)='')
from submissions s join sources so on so.id=s.source_id join programs p on p.id=so.program_id
where s.utm_medium in ('cpc','paid_social','paid') group by 1,2;

-- Leads sin fecha y su efecto (§5)
select count(*) filter (where entrada='formulario' and (fecha_primera_aplicacion at time zone 'America/Bogota')::date between :desde and :hasta) hub,
       count(*) filter (where (coalesce(fecha_primera_aplicacion,created_at) at time zone 'America/Bogota')::date between :desde and :hasta) lista
from leads where program_id=:programa;
```

Los scripts desechables (`scripts/_f2b.ts`, `scripts/_f2b_app.ts`) se corrieron y se borraron sin commitear. Este archivo queda sin commitear.
