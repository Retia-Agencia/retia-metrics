# Auditoría de coherencia de las métricas (18-nov-2026)

**Alcance:** solo lectura. No se cambió código de producción ni datos. Línea base para el ticket 407 (esquema de vistas `mcp_lectura`).
**Sin datos personales:** ninguna fila de persona, nombre ni correo; las cifras son agregados.
**Actualización (misma fecha, tarde):** Mani inició sesión y se leyó la pantalla (A) del Hub en el navegador integrado: Comunicarte octubre en
Comercial, Dinero y Pauta, y Tactical octubre en Pauta (cohorte «Todas», periodo elegido 1 a 31 oct). Resultado en §3 y hallazgos D-13 y D-14. Hoy y las
ventanas del 1 al 17 de nov quedan sin leer en pantalla.

**Cómo se midió:** (B) MCP `resumen_del_hub`, `consultar_metrica`, `consultar_hechos`, `pauta_roas` contra producción; (C) `SELECT` independiente sobre
la base de producción (ref `hfqmiyiuyqapdsbywrag`), escrito a mano sin llamar a las funciones de la app; (A) la pantalla del Hub se leyó después, con la sesión de Mani (ver la actualización de arriba). `lib/mcp/salidas/resumen.ts` arma el resumen desde la misma
`VistaDelDashboard` que pinta el Hub, pero la prueba en pantalla mostró que (A)=(B) **no** siempre se cumple (D-13). Lo que la pantalla pinta distinto de la
vista (formato, vacíos) se auditó en `components/**` (D-3).

Filtros de cada lectura: programa único; periodo `2026-10` (1 a 31 oct) o 1 a 17 nov; cohorte «Todas» (el MCP no aplica filtro de cohorte
salvo que se pida; el Hub de Comercial sí trae cohorte por defecto, otra población); sin filtro de closer ni de origen salvo donde se indica «Paid».

## 1. Resumen

El código está mucho más limpio de lo que el miedo sugiere: **0** `sum(abonos.monto)` fuera de `saldo.ts`/`sumaDeAbonos`, **0** literales de etapa de venta
fuera de `etapas.ts`/`etapaVendida`, **0** lecturas de `abonos`, `calls` o `deals` sin `vigente()`, y las fechas pasan por `fechas.ts`/`format.ts`
(los guardianes funcionan). **Las divergencias graves ya no están en predicados duplicados: están en el ANCLA de la venta, en cifras que se pintan una al
lado de otra con bases distintas y en vacíos que se muestran de cuatro maneras.** Ventas, vendido, recaudado y entró a caja de los dos programas cuadran
al peso entre MCP y SQL independiente (§3).

## 2. Tabla de divergencias (ordenada por severidad)

Severidad: **R** = rompe una cifra que gerencia ve · **L** = riesgo latente · **C** = cosmético.

| # | Concepto | Dónde diverge (archivo:línea) | Cifra A vs B vs C | Causa probable | Sev. |
|---|---|---|---|---|---|
| D-1 | **Venta: día de la venta ≠ día del pago** | `lib/queries/metricas-filtros.ts:133` (`diaDeVenta` = primera entrada a Abonado/Completo) frente a `filtroCaja` (fecha del abono, `:295`) | Comunicarte oct: **28** ventas por día de venta (MCP = SQL) vs **37** por primer pago (SQL). Comunicarte 1-17 nov: **20** vs **11**. 13 ventas fechadas el 11-nov, 11 de ellas con el pago 5 a 34 días antes (lote capturado el 11-nov). Tactical coincide (17=17, 5=5) | La venta toma la fecha del movimiento de etapa, no la del pago. Un lote de captura tardía mueve 9 ventas de octubre a noviembre: octubre sale corto, noviembre inflado, cohorte y ROAS por mes igual. Es la causa que `respuestas-pauta-2026-11-17.md` §1.3 midió para los «41 contra 28» | R |
| D-2 | **ROAS no es Vendido ÷ Inversión de la misma fila** | Fila Total de la tabla semanal (`lib/queries/hechos/pauta-semanal.ts`, fila `roas`/`profit`) frente a filas `ventas`/`facturacion` | Tactical oct: fila «Vendido» **USD 12.000** y «Ventas» **8**; ROAS **1,19** y Profit **USD 2.101**. `pauta_roas` (mismo ROAS) usa **9 ventas y USD 13.250** ÷ gasto USD 11.149. 12.000 ÷ gasto da 1,08, no 1,19. Comunicarte oct igual: «Vendido» USD 11.775 / 15 ventas con ROAS 2,03 | Vendido y Ventas se anclan al día de la venta; el ROAS al día del envío (cohorte de registro, 355). Es el I-2 del 10-nov, ahora con la prueba de que el MCP lo reproduce en una sola respuesta y nadie puede reconstruir el ROAS con los números que ve | R |
| D-3 | **«Entró a caja» sin abonos: cuatro maneras** | `components/dashboard/piezas.tsx:37` («—») · `components/dashboard/reporte-diario.tsx:65` («—») · `components/dashboard/hoy/cifras-clave.tsx:90` (USD 0) · `components/hub-reporte/reporte.tsx:43` (USD 0) · `components/dashboard/hoy/dinero.tsx:70` (texto «no se registró ningún abono») · `components/mi-espacio/tab-metricas.tsx:51` (USD 0) · `app/(app)/p/[programa]/hub/page.tsx:569` (`[]`) · listas `lista/page.tsx:184` (nada) · MCP `lib/mcp/salidas/resumen.ts:180` (`[]`) | Comunicarte 22-23 nov (sin abonos): MCP `entro_a_caja: []` mientras `recaudado`, `vendido` y `ventas` dicen 0 | `cajaRecaudada` (`lib/queries/dashboard.ts:443`) devuelve una fila por moneda presente; sin abonos no hay fila y cada pantalla inventa su vacío. Por N5 una suma sin filas es **0** (calculable), no «—». Hoy: «—» en 2 sitios (mal), 0 en 3 (bien), texto en 1, nada en 2, `[]` en 2 | R (una pantalla dice «no se puede calcular» de un cero real) |
| D-4 | **Leads vs Registros vs personas** | `lib/queries/hechos/envio.ts:82,108` (solo `es_parcial=false`) frente a `fechaAnclaLead` (todas las personas) | Comunicarte oct: **Leads 1.096** (resumen) vs **Registros 985** (hechos y métrica, MCP=SQL) vs **928** personas con envío completo (SQL). Tactical oct: 930 vs 809 vs 768 | (a) Leads incluye personas que solo dejaron un formulario parcial (161 de las 1.096): ver D-5. (b) Registros cuenta filas de envío, no personas: 57 envíos repetidos en Comunicarte. «Personas, no filas» (N1 de restricciones) dice que toda tasa usa personas; un denominador de registros por fila sub-cuenta el costo por persona | R/L (según qué cifra use gerencia como denominador) |
| D-5 | **Parciales invisibles: `fecha_envio` es NULL** | `lib/db/schema.ts:736` (`fechaEnvio` nullable) · ancla `dimensiones.dia` en `hechos/envio.ts` | 100 % de los formularios parciales tiene `fecha_envio` nulo: Comunicarte **1.215**, Tactical **1.332** (personas 1.094 y 1.173) frente a 1.461 y 1.389 completos. Una consulta «parciales por día» da 0 aunque hay más parciales que completos | El ancla del envío no existe para el parcial; cualquier `between(dia, …)` lo descarta sin error. **Corrige el hallazgo del ticket 429:** «parciales = 0 en el rango» es un artefacto, no un hecho. Cualquier decisión D-1 del 429 («completos con parciales aparte») necesita antes un ancla (`created_at` o respaldo a `fecha_envio`) | R (latente hasta decidir el 429; ya engaña si alguien mide) |
| D-6 | **Tasas: dos coberturas distintas en la misma respuesta** | `resumen_del_hub`: `tasas.*.cobertura` vs `pauta[show|cierre_ventas|agenda_venta].cobertura` | Comunicarte oct: Asistencia **66,2 %** (cobertura 22,5 %, base todas las áreas, 313 citas) vs **66 %** (parcial «182 de 232 citas pasadas siguen sin resultado», base Paid). Tactical oct: 45,3 % vs 46,3 %. Cierre: 59,6 % vs 57,6 % | Dos universos (todas las áreas / Paid) con el mismo nombre en una respuesta; la cobertura se mide con otra base cada vez (fracción de citas vs «N de M pasadas»). Ya conocido (I-7 del 10-nov); sigue sin rótulo que diga el universo | L |
| D-7 | **Ventas sin deal: Excel vs CRM** | Captura, no código | Tactical 2 a 8 nov: CRM **2** (ambas el 7-nov, USD 3.000) vs Excel **9** (`respuestas-pauta-2026-11-17.md`: 7 sin registrar; el ticket 418 dice «7»). ComunicArte 26-sep a 30-oct: Excel **41** vs CRM **28**; **7** se explican por D-1 (35 por primer pago) y **6 quedan sin explicar** | Ventas que Pauta anota y nadie registró como deal. Confirmado: ComunicArte **6** (no es de fecha) y Tactical **7** (el rango de «6 o 7» se cierra en 7 contra Excel 9 y CRM 2) | R (el cuadre del 418 no cierra) |
| D-8 | **`metas_del_mes` ignora el periodo pedido** | `lib/mcp/salidas/resumen.ts:199-205` (`vista.metasDelMes`) | Pedir octubre devuelve `vendidos: 20` y `meta_cupos: 26,3` (valores de noviembre); `cohorte.vendidos: 52` idéntico en cualquier periodo. Tactical oct y 1-17 nov devuelven el mismo `vendidos: 5` | Son «metas del mes en curso» pegadas a una respuesta de otro periodo, sin rótulo en la salida del MCP | L |
| D-9 | **Dos coberturas de «agendas»: citas vs Agendadas** | `cifras.citas` (por hora de la cita) vs `pauta[agendas]` (por creación, Paid) | Tactical 1-17 nov: `citas` **173** (todas las áreas) < `Agendadas` **185** (solo Paid). Un subconjunto mayor que el total | Dos anclas de fecha distintas; DA-4 del diccionario lo documenta, pero la respuesta no lo dice | L |
| D-10 | **Lead de prueba cuenta** | `leads` / registros; guardián `tests/lead-de-prueba-guardian.test.ts` | 1 lead de prueba por programa y rango (SQL), y un deal de prueba aparece en la lista de «Registros» de Comunicarte oct | El guardián cubre rutas de creación, no la lectura: el lead de prueba entra a Leads, Registros y a las etapas | L |
| D-11 | **Semana: dos implementaciones del corte lunes** | `lib/queries/hechos/pauta-semanal.ts:471,497` (`date_trunc('week', …)`) y `lib/queries/hechos/fechas.ts:45` | Mismo `date_trunc` escrito dos veces; el Excel de Comunicarte corta sáb a vie | Una copia del convertidor de semana en SQL fuera de `fechas.ts` | C |
| D-12 | **«Caja» en el MCP de métricas por responsable** | `consultar_metrica registros` | `entro_a_caja: []` en un `registros` (por diseño no aplica) | Mismo vacío que D-3 | C |
| D-13 | **Pantalla de Pauta ≠ `resumen_del_hub` en Comunicarte octubre** | Tabla semanal de Pauta, columna Total (`lib/queries/hechos/pauta-semanal.ts`) frente a `lib/mcp/salidas/resumen.ts` (`pauta`) | Comunicarte oct, misma cohorte y periodo: Agendadas **258** (pantalla; suma de las 5 semanas) vs **257** (MCP, repetido dos veces con el mismo resultado). Asistencia 66,7 % vs 66,0 %; Cierre 58,8 % vs 57,6 %; Cita a venta 39,2 % vs 38,0 %; ROAS 2,1× vs 2,03 (parcial: «1 agenda pendiente»); **Profit USD 9.091 vs USD 8.294 (diferencia USD 797 = un ticket)**. En **Tactical octubre todo coincide** al peso (inversión, 327 agendas, 8 ventas, USD 12.000, ROAS 1,19, Profit USD 2.101) | Causa **no determinada**. Hipótesis: la pantalla suma semanas (el Profit del Total = suma de las cinco semanas) mientras el MCP calcula el Total sobre el periodo entero, y una agenda cuya madurez cambia entre ambas lecturas mueve una venta de ROAS. No se confirmó con el código | R (una cifra de Pauta cambia según quién la lea) |
| D-14 | **Embudo de Comercial: pasos que no cuadran con las cifras clave** | Embudo comercial de la pantalla Comercial (`lib/queries/embudo-comercial.ts`) frente a las cifras clave | Comunicarte oct en pantalla: «Tuvieron show» **45** vs Shows **47** (cifras clave y MCP); «Compraron» **15** vs Ventas **28** (la pantalla aclara «13 ventas sin llamada registrada»: 15 + 13 = 28); «Deals creados» **1.110** vs Leads 1.096, Registros 985, 928 personas (cinco poblaciones distintas del mismo mes) | Son poblaciones por diseño (deals por creación, show por grupo de citas, compraron solo con show antes del pago), pero ninguna cifra dice contra cuál otra se compara; 45 ≠ 47 en el mismo programa y periodo es lo que primero ve un gerente | L |

## 3. Paridad con datos reales (lo que cuadra)

Todas las cifras son USD y días de Bogotá, cohorte «Todas», sin anulados, sin cortesías (hay 0 en estos rangos).

| Programa y rango | Cifra | (B) MCP | (C) SQL independiente |
|---|---|---|---|
| Comunicarte · oct | Ventas / Vendido | 28 / USD 22.136 | 28 / USD 22.136 |
| Comunicarte · oct | Recaudado de las ventas del periodo | USD 18.273 | USD 18.273 |
| Comunicarte · oct | Entró a caja (abonos del periodo) | USD 24.364 | USD 24.364 (40 abonos) |
| Comunicarte · 1-17 nov | Ventas / Vendido / Recaudado / Caja | 20 / 15.350 / 13.957 / 11.524 | 20 / 15.350 / 13.957 / 11.524 |
| Tactical · oct | Ventas / Vendido / Recaudado / Caja | 17 / 25.350 / 18.175 / 18.675 | 17 / 25.350 / 18.175 / 18.675 |
| Tactical · 1-17 nov | Ventas / Vendido / Recaudado / Caja | 5 / 6.805 / 5.805 / 5.805 | 5 / 6.805 / 5.805 / 5.805 |
| Comunicarte · oct | Registros (envíos completos) | 985 | 985 |
| Comunicarte · oct | Leads | 1.096 | 1.096 (por primera aplicación) |
| Tactical · oct | Registros / Leads | 809 / 930 | 809 / 930 |

Contra la **pantalla** del Hub (A), Comunicarte oct: Citas **313**, Asistencia 66,2 % (47 ÷ 71), Cierre 59,6 %, Cita a venta 39,4 % en Comercial = MCP; Dinero: Vendido
USD 22.136, Recaudado USD 18.273, Por cobrar USD 3.863, Entró a caja USD 24.364 = MCP = SQL. Pauta de **Tactical oct** = MCP en todas las filas. Pauta de
**Comunicarte oct** no coincide (D-13).

Notas: (1) «Recaudado» (abonos de las ventas del periodo, de cualquier fecha) ≠ «Entró a caja» (abonos con fecha del periodo): por definición dos
preguntas (Comunicarte oct 18.273 vs 24.364); la respuesta las nombra distinto, no hay divergencia. (2) Abonos anulados: 0 en octubre; **USD 2.028 anulados
en Comunicarte 1-17 nov** y fuera de toda cifra, como exige la regla. (3) Ningún abono sin deal ni de deal anulado ni de cortesía en los rangos. (4) El Hub en
pantalla no se leyó (ver encabezado).

## 4. Inventario: predicados fuera de su módulo

Barrido por patrones sobre `lib`, `app`, `components`, `scripts` (todo `.ts` y `.tsx`):

| Búsqueda | Resultado |
|---|---|
| `sum(abonos.monto)` a mano | 0 fuera de `lib/queries/saldo.ts` (todo pasa por `sumaDeAbonos`) |
| Literales «Abonado»/«Completo» como etapa de venta | 0 (los 4 hits son rótulos de pantalla de envío completo/parcial y de «Abonado» en el saldo del estudiante) |
| Etapa vendida a mano (`etapa === "ganado_*"`) | 12 sitios, **todos de escritura o flujo de estado** (`lib/deals/*`, `inbox.ts`, `kanban.ts`, `ficha-deal.ts:901`), ninguno cuenta ventas. Los conteos usan `etapaVendida()`/`esEtapaVendida`. Candidato a revisar: `lib/queries/roas-de-pauta.ts:139` (`ventasCompletas`) y `lib/queries/ficha-deal.ts:901` (`esEstudiante` reescribe la lista de etapas vendidas) |
| Lecturas de `abonos`, `calls`, `deals` sin `vigente`/`filtro*` | 0 archivos |
| Fechas sin Bogotá (`toISOString().slice`, `getMonth`, `date_trunc`, `::date`) | 0 en `lib/app/components` fuera de los módulos canónicos y `lib/queries/hechos/pauta-semanal.ts:471,497` (D-11) y casts de edad en `metricas-con-filas.ts:393`, `hechos/abono.ts:46` (comparan días ya en Bogotá; sin hallazgo) |
| Conteo de filas donde la regla pide personas | `hechos/envio.ts` cuenta envíos por diseño (D-4); `lib/queries/nerd-stats.ts` cuenta filas (pantalla de diagnóstico, sin cifra de gerencia) |
| MCP con predicado propio | 0: `lib/mcp/salidas/resumen.ts` solo reempaqueta `VistaDelDashboard` |

## 5. Qué necesita primero el esquema `mcp_lectura` y qué guardián falta

Orden por daño evitado (cada vista sale de **una** definición y la app la importa después):

1. **`mcp_lectura.venta`** (deal, programa, cohorte, `dia_de_venta`, `dia_del_primer_pago`, `valor_usd`, `area`, `cortesia`): hoy D-1 y D-7 viven en que la venta
   se ancla a una sola fecha. El esquema debe exponer **las dos fechas con nombre** y decidir cuál es «la venta» antes de vender la vista.
   *Guardián que falta:* un test de contrato que compare, por programa y mes, ventas por día de venta contra ventas por primer pago y falle (o exija
   explicación) si la brecha pasa de un umbral. Hoy nada vigila la captura tardía.
2. **`mcp_lectura.caja`** (abono vigente, día, moneda, deal): con la vista, «sin filas» se convierte en **una fila por moneda del programa con 0** (D-3).
   *Guardián:* un test que recorra las pantallas con `caja.length === 0` y exija el mismo componente de vacío (`lib/format.ts`) en las nueve.
3. **`mcp_lectura.envio`** con `dia` = `coalesce(fecha_envio, created_at en Bogotá)` y una columna `es_parcial` (D-5): sin ancla para el parcial el 429 no se
   puede decidir. *Guardián:* un test que falle si una consulta de envíos filtra por `dia` sobre una columna nullable sin respaldo (el mismo patrón que `fecha-cruda-guardian`).
4. **`mcp_lectura.persona`** (programa, correo normalizado, primer envío completo, primera aplicación, bandera de prueba): una sola respuesta a Leads, Registros y
   personas con envío (D-4, D-10). *Guardián:* un test de paridad que exija `personas ≤ registros ≤ leads` por rango y excluya la prueba.
5. **`mcp_lectura.roas`**: expone numerador (ventas y USD por cohorte de registro) y denominador (gasto convertido) **como columnas**, para que la tabla semanal
   pinte el ROAS con los números que ve o los rotule aparte (D-2). *Guardián:* un test que recalcule ROAS = vendido ÷ gasto con las filas de la misma respuesta.
6. **`mcp_lectura.cita`** con una columna `universo` (`todas`/`paid`) obligatoria (D-6, D-9). *Guardián:* un test que impida devolver una tasa sin su universo.

Guardianes transversales que faltan:
- **Un test de «respuesta autoconsistente»** sobre `resumen_del_hub` (caja de la respuesta, ventas × ticket, tasa × base) que hoy no existe: D-2, D-6, D-8 pasan porque cada cifra es correcta sola.
- **Un test del MCP que pida un periodo pasado** y exija que ninguna parte de la salida venga del mes en curso (D-8).

## 6. Pendientes de esta auditoría

- (a) **Pantalla del Hub** leída solo para octubre (Comunicarte: Comercial, Dinero, Pauta; Tactical: Pauta). Faltan Hoy, el rango 1 a 17 de nov y Tactical en
  Comercial y Dinero. D-13 pide mirar cómo se calcula la columna Total de Pauta de Comunicarte.
- Cifras de **Envíos completos vs parciales (429)**: la tabla del ticket deja de ser comprobable hasta resolver D-5.
- No se auditaron el reporte de WhatsApp ni Mi espacio más allá de D-3.
