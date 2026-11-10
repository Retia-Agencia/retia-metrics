# Paid Media en el CRM: extracción completa y plan de la ola del 412 (9-nov-2026)

> **Documento de reunión** (ADR 0115, N8): manda ADR vigente > ticket > este documento. Lo escribió la sesión del 9-nov
> con el contexto completo de cuatro fuentes. Existe para que **ninguna sesión siguiente tenga que improvisar**: aquí está
> lo que se pidió, lo que se midió en el código, lo que se decidió, el reparto, el brief de cada sesión hija y el prompt de
> la sesión padre. El ticket que ejecuta todo esto es el **412** (`docs/tasks/412-pauta-y-origen-una-sola-pestana.md`).
> Los transcripts crudos no se guardan en el repo; lo útil de cada uno está resumido aquí con citas cortas.

## Índice

1. Las fuentes
2. Lo que pidió cada fuente, extraído
3. El catálogo depurado de métricas (deduplicado), cruzado con el CRM
4. Lo que hay hoy en el CRM (medido el 9-nov)
5. Huecos y la migración
6. La pestaña que se construye (diseño)
7. Decisiones
8. El reparto: sesión padre y sesiones hijas
9. Briefs de las hijas (copiar tal cual)
10. Prompt de la sesión padre (copiar tal cual)
11. Verificación y demo
12. Fuera del 412: lo que queda anotado para después
13. Tareas de Mani que no son código

---

## 1. Las fuentes

| # | Fuente | Fecha | Quiénes | Qué es |
|---|---|---|---|---|
| F1 | Reunión con Paid Media | 7-nov (viernes) | Mani, Dani Rodríguez (paid media, "Ingdanirodriguez"), Michael Castellanos | Recorrido del CRM y del Hub; Dani pide reemplazar el Excel de pauta |
| F2 | Weekly con Daniel Tovar | 3-nov | Mani, Daniel Tovar, Alejandro Dávila | Ya resumida en `docs/weekly-2026-11-03.md`; aquí solo lo que toca a pauta |
| F3 | Artifact "Paid Media Diario 30X" | datos del 5-oct al 8-nov | Paid Media de 30X | Reporte diario de 11 programas de 30X. Es **referencia de métricas y de forma**, no de UI |
| F4 | Artifact "Reporte Semanal · Crece 30X" | semanas 5 a 8 (14-sep a 11-oct) | Paid Media de 30X | Reporte semanal con cumplimiento y metas |
| F5 | Imagen "KPI · Total · Semana 1 \| 05-11 Oct" | 9-nov | la pasó Mani | Las 16 filas del Excel de Paid Media, en General, Comercial y Tráfico |

F3 y F4 son de 30X, otra empresa: de ellos se toma **la estructura, las fórmulas y los umbrales**, nunca sus datos ni
sus programas. URLs: F3 `https://claude.ai/artifact/1vADMkPxwLLjPDN9fFJ2Pd`, F4 `https://claude.ai/artifact/XtKVcLrQtUUMwUuJaejcaX`.

## 2. Lo que pidió cada fuente, extraído

### F1 · Reunión con Paid Media (7-nov)

- **El Excel de pauta hoy.** Son tres Excels, uno por programa (Dani nombra "Tactical, ComunicArte y PowerTalk"). César
  llena la parte de pauta día a día; Michael llena a mano la parte comercial con lo que le mandan los closers. En el daily
  de pauta "revisamos Excel por Excel" (Michael). El CRM no está conectado a ese Excel.
- **El pedido de Dani Rodríguez:** *"Sería bueno que esa data semanal del Excel se pueda ver acá, para no estar
  diligenciando eso todos los días."* Una **sección semanal y una sección diaria**. Filtrable *"de tal fecha a tal fecha"*.
  Mientras se valida se sigue llenando el Excel; *"ya cuando eso esté validado, ya no volverlo a hacer en el Excel"*.
- **Preguntó dónde ver show up y close rate.** Hoy están en Hub › Hoy y Comercial, no al lado del gasto.
- **Preguntó cómo se integra la venta con la pauta.** Respuesta dada: por UTM del envío; al pasar el deal a Abonado o
  Completo se devuelve el evento de compra a Meta (281). Hotmart solo en lanzamientos; las llamadas cobran por PayPal,
  Bancolombia, etc.
- **Acceso:** no pudo entrar con el link en la reunión. Su rol es paid trafficker: ve solo una parte (`manejaPauta`).
  Hay que verificar que su usuario existe, está activo y entra (tarea de Mani, §13).
- **Problemas que Mani le contó:** campañas de Meta sin `utm_id`; landings que pierden UTM al editar los botones.
- Dani quedó en pasar el Excel y "el del diario" (el de F3 es la referencia que llegó).

### F2 · Weekly con Daniel Tovar (3-nov), solo lo de pauta

- ROAS por el día en que se **creó** el envío, no por el de la llamada (hecho, 355).
- Alerta de agendas pendientes que bajan el ROAS (hecho, 355) y ROAS proyectado por closer con las tasas de ~3 semanas
  (hecho, 375).
- **Plantilla de UTM unificada**: Mani es el dueño; sesión de 30 min con César, anuncio por anuncio. *"¿Tú puedes
  identificar qué ads son los que están trayendo eso mal?"*: el CRM tiene que listarlos (→ 412, hija E).
- Toda gráfica en cupos y en plata; meta de mes y de cohorte (hecho, 370 y 371).
- *"Poder conectar pauta con comercial y poder proyectar"*: el norte de esta pestaña.

### F3 · Diario 30X: todo lo que muestra

**Estructura de datos por día y por programa** (sacada del JSON del artifact):
- Día: `inv` (inversión), `ag` (agendas), `cpa` (costo por agenda), `cpm`, `ctr`, `clp` (% clicks a landing), `conv`
  (% conversión de landing), `freq` (frecuencia), `vn`/`vf` (ventas de pauta en número y en dinero), `invExtra` (inversión
  de campañas que no son de agenda) con `extraCamps` (nombre y monto de cada una), `invAg` (inversión de agenda),
  `utmOnly`/`utmAmt` (ventas con UTM de pauta que el CRM de ellos no marcó como pauta).
- Acumulado de la cohorte (`acc`): lo mismo sumado, más `tn`/`tf` (ventas **totales**, no solo de pauta).
- Cohorte: `cohort` (nombre), `since` (desde cuándo vende), `end`, `elapsed` y `total` (días transcurridos y totales),
  `exp` (= elapsed ÷ total, lo esperado a la fecha), `kpi` (`ag` agendas, `inv` inversión, `vf` facturación), `cupos`,
  `left` (días que faltan), `leftAg`, `agEnd` (último día de agendas), `dailyAg` (agendas por día requeridas),
  `dailyInv` (inversión diaria requerida), `budget` (presupuesto diario).
- `s7`: promedio diario de los últimos 7 días (`invDia`, `agDia`, `costoAg`, `cpm`, `ctr`, `clicksLP`, `convLP`,
  `frecuencia`), contra el que se compara el día.
- `camps`: por campaña, `inv`, `ag`, `cpa`.
- `creatives`: ranking de anuncios del acumulado de la cohorte: `inv`, `ag`, `ctr`, `nc` (en cuántas campañas está),
  ventas de los últimos 7 días y de la cohorte; `rev` = "Revisar: gastó $X sin agendas"; `best` = el que más vendió
  fuera del top; `cov` = cobertura (ventas con creativo identificado, y `noad` ventas sin creativo).
- `accionable` y `recs`: texto escrito por una persona (o por IA) por día.
- `series`: series diarias de `inv`, `ag`, `vn`, `vf`, `invAg` para las gráficas.

**Pantalla:**
- Selector de rango con **atajos**: Último día, Último día −1, Últimos 7 días, Últimos 14 días, Últimos 28 días, Esta
  semana, La semana pasada, Este mes, El mes pasado, Todo; y un calendario para elegir días.
- "El día · vs promedio diario S7": Inversión, Agendas, Costo/agenda, Ventas pauta, CPM, CTR, Conv. landing, Frecuencia,
  cada una con su variación en % contra el promedio de 7 días.
- **Cumplimiento del período** (o del día): agendas contra la meta del período recalculada; revenue contra la meta
  diaria recalculada; cantidad de ventas contra la meta diaria; **inversión contra la requerida a $20 por agenda** y
  contra la requerida al costo promedio de la cohorte, "para X agendas/día requeridas"; si la meta ya se cumplió, "no
  hay inversión adicional requerida".
- **Avance de la cohorte**: agendas `A / meta · %`, barra con marca de lo esperado, "atraso N" o "adelanto N", "requiere
  X agendas/día hasta el <fecha>"; revenue `$A / $meta · %` con atraso o adelanto en dinero; "Ventas totales $X · N
  ventas · pauta Y %".
- Costo por agenda **sin** la inversión de otras campañas: *"6 agendas a $86,17 (sin contar $57 de tráfico a IG)"*.
  Las otras campañas se nombran: *"Otras campañas: …"*.
- Aviso de calidad: *"N ventas del día con UTM de pauta pero sin origen Pauta en HubSpot"*.
- Ranking de creativos con "Revisar" y "Más ventas fuera del top", y "N ventas sin creativo".
- Gráfica de **agendas diarias por programa** (pixel de Meta: Invite y AssignerBook), con interruptores por programa; el
  eje se ajusta a lo encendido; "Total" es la suma.
- Asks de 30X (campañas de reconocimiento para retargeting; campañas por ICP medidas aparte) y un playbook de seteo y
  seguimiento con indicadores propuestos (tiempo al primer contacto, intentos en 24 h, % de leads con estatus y próximo
  paso, % contactados que agendan, % de agendas que asisten, % con secuencia completa, cierre agenda → venta con meta
  10 %, días de agenda a venta).

### F4 · Semanal 30X: todo lo que muestra

- **Cifras de arriba**: Inversión total actual (contra KPI a la fecha), Agendas totales (contra KPI, "% de la meta
  global"), Ventas totales (contra KPI), **ROAS blend (pauta) = facturación de pauta ÷ inversión**.
- **Cumplimiento por programa**: tres bloques, **agendas**, **ventas paid (pauta)** y **ventas totales**. Cada uno:
  - "Sobre el total" = llevamos ÷ meta de la cohorte.
  - "Sobre lo que deberíamos ir a la fecha" = (llevamos ÷ meta) ÷ esperado, con esperado = días transcurridos desde que
    abrió la venta de la cohorte ÷ días totales.
  - "KPI esperado a la fecha: X % (cantidad)".
  - Barra con la marca de lo esperado.
  - Estado: `ratio = cumplido ÷ esperado`; **≥ 1 "En meta"**, **≥ 0,65 "En seguimiento"**, si no **"Rezagado"**.
- "Costo por agenda objetivo: $20 USD en todos los programas".
- **Estadísticas semanales** con variación contra la semana anterior (verde si mejora, rojo si empeora; "s/d" si no hay
  semana anterior) y semáforo:

  | Estadística | Mejor si | Verde | Amarillo | Rojo |
  |---|---|---|---|---|
  | Agendas sem. | sube | | | |
  | Ventas sem. (dinero) | sube | | | |
  | ROAS sem. | sube | ≥ 10 | ≥ 5 | < 5 |
  | Costo/agenda | baja | ≤ 20 | ≤ 30 | > 30 |
  | CPM | baja | | | |
  | CTR | sube | ≥ 2 % | ≥ 1 % | < 1 % |
  | Clicks LP | sube | | | |
  | Conv. LP | sube | ≥ 2 % | ≥ 1 % | < 1 % |
  | Frecuencia | neutro | ≤ 3 | ≤ 3,5 | > 3,5 |

- **Curvas semana a semana de la cohorte**: las 15 métricas del bloque KPI (Inversión, Agendas, Costo por agenda, Ventas
  (deals), Facturación, ROAS, Profit, % Present. a zoom, % Cierre zoom-cliente, % Cierre agenda-cliente, CPM, CTR,
  % Clicks a LP, % Conversión LP, Frecuencia), eje X = semanas de la cohorte.
- Tarjeta de cohorte con dos fechas: **"venta desde"** (cuándo abre la venta) y **"Cohorte <fecha>"** (cuándo entra en
  vivo). Estados de cohorte: abierta, cerrada ("Cerrada · última venta 04 Oct"), nueva ("primera semana"), pendiente
  ("KPI pendiente de definir").
- Texto humano: etiqueta de escalabilidad ("Escalable", "No escalable todavía"), accionable, highlights, "Nota de datos".
- Lecciones de sus notas de datos que aplican al CRM: el "KPI esperado a la fecha" se arrastró por error de la cohorte
  anterior (→ el esperado se calcula desde la venta de la cohorte **vigente**); ventas "sin UTM ni origen" se listan por
  persona; una facturación no se puede separar en pauta y total sin la atribución.

### F5 · Imagen KPI (las filas del Excel)

| Bloque | Fila | Total | Semana 1 (05-11 oct) |
|---|---|---|---|
| General | Inversión | $17.143,16 | $2.571,45 |
| General | Agendas | 376 | 86 |
| General | Costo por agenda | $45,59 | $29,90 |
| General | Ventas | 60 | 7 |
| General | Facturación | 105.065 | $14.050 |
| General | ROAS | 6,13 | 5,46 |
| General | Profit | $87.921,84 | $11.478,55 |
| Comercial | % de presentación a zoom | 57 % | 57 % |
| Comercial | % de cierre zoom a cliente | 18 % | 18 % |
| Comercial | % de cierre agenda a cliente | 8,68 % | 8,14 % |
| Tráfico | CPM | 13,654 | 13,8 |
| Tráfico | CTR | 1,96 | 2,04 |
| Tráfico | % Clicks a landing page | 89,98 | 90 |
| Tráfico | % Conversión landing page | 2,79 | 3,93 |
| Tráfico | Costo por agenda | $54,97 | $29,90 |
| Tráfico | Frecuencia | 2,34 | 2,36 |

Comprobaciones: Profit = Facturación − Inversión (105.065 − 17.143 = 87.922 ✔). ROAS = Facturación ÷ Inversión
(105.065 ÷ 17.143 = 6,13 ✔). % cierre agenda a cliente ≈ % show × % cierre zoom (57 % × 18 % ≈ 10 %; en la tabla 8,68 %:
**no cuadra exacto**, porque el Excel calcula cada tasa sobre grupos distintos; el CRM las calcula sobre el mismo grupo
(187) y lo dice en "Cómo se calcula"). El costo por agenda sale dos veces con valores distintos en el Total (45,59 y
54,97) e iguales en la semana: uno con agendas del CRM y otro con agendas del pixel (D-1). Estos números son de 30X: sirven
de **prueba de forma**, no de valores.

## 3. El catálogo depurado (deduplicado), cruzado con el CRM

Cada fila: el nombre del Excel → el concepto del CRM → dónde vive o qué falta. Lo que ya existe **no se reescribe** (N1).

| # | Fila (Excel / 30X) | Concepto del CRM | Fórmula | Existe | Dónde / falta |
|---|---|---|---|---|---|
| M1 | Inversión | Gasto | Σ gasto del programa, TRM del día | ✅ | `lib/queries/hechos/gasto.ts` (`gastoConvertido`) |
| M2 | Inversión de agenda / Otras campañas | Gasto de agenda | gasto de campañas con propósito `agenda` | ✅ (semáforo) | `lib/semaforo/costo-por-agenda.ts`; "Otras" = total − agenda − lanzamiento, falta exponerlo |
| M3 | Agendas | Agendadas (CRM, área Paid) | citas creadas en el rango | ✅ | `lib/queries/hechos/agenda.ts` |
| M4 | Agendas según Meta | Agendas según Meta | `gasto_pauta.agendas_meta` | ✅ | `metricas.md` §1.9 |
| M5 | Costo por agenda (General) | Costo por agenda del Hub | gasto de agenda ÷ agendas CRM de Paid | 🟡 249 | se construye (hija E) |
| M6 | Costo por agenda (Tráfico) | Costo por agenda del semáforo | gasto de agenda ÷ agendas según Meta | ✅ | `costoPorAgenda` |
| M7 | Ventas | Ventas de Paid | deals de Paid en Abonado o Completo | ✅ | módulo de venta (352) |
| M8 | Ventas totales | Ventas | todas las áreas | ✅ | ídem |
| M9 | Facturación | Vendido de Paid (USD) | Σ valor vendido | ✅ | ídem (369) |
| M10 | ROAS / ROAS blend | ROAS | Vendido Paid ÷ gasto USD, ancla por paso | ✅ | 355 |
| M11 | Profit | Profit (nuevo nombre) | Vendido Paid USD − gasto USD | ❌ | trivial sobre M9 y M1; fila nueva en `metricas.md` y en `overview.md` §11 |
| M12 | % presentación a zoom | % de show | `showPorCita` | ✅ | `lib/deals/resultados-de-llamada.ts` |
| M13 | % cierre zoom a cliente | Cierre de ventas | ventas ÷ shows | ✅ | ídem |
| M14 | % cierre agenda a cliente | Agenda → venta | ventas ÷ agendas del grupo | ✅ | ídem |
| M15 | CPM | CPM | gasto ÷ impresiones × 1000 | ❌ | migración + sync (hija D) |
| M16 | CTR | CTR | clics al enlace ÷ impresiones | ❌ | ídem |
| M17 | % Clicks a landing | Llegada a la landing | vistas de landing ÷ clics al enlace | ❌ | ídem |
| M18 | % Conversión landing | Conversión de la landing | registros Paid del CRM ÷ vistas de landing | ❌ | ídem |
| M19 | Frecuencia | Frecuencia | impresiones ÷ alcance (D-5) | ❌ | ídem |
| M20 | Cumplimiento: agendas / ventas pauta / ventas totales | Cumplimiento de la cohorte | llevamos ÷ meta; ÷ esperado a la fecha | 🟡 371 tiene cupos y USD | agendas e inversión de cohorte faltan (migración); hija C |
| M21 | Agendas/día requeridas, inversión requerida | Agendas requeridas por día | `calcularProyeccion` | ✅ agendas · ❌ inversión | `lib/queries/proyeccion.ts:246`; inversión requerida = agendas requeridas × costo por agenda (meta o promedio) |
| M22 | Día vs promedio de 7 días | Variación contra el promedio | (día − prom. 7) ÷ prom. 7 | ❌ | fase 2 (§12) |
| M23 | Ventas con UTM de pauta sin origen | Ventas sin atribución | ventas con `utm_medium` pago y sin área Paid | ❓ | en Retia el área sale de la regla (`resolverCanal`), así que no debería pasar; la hija E lo verifica y, si da 0, no se muestra |
| M24 | Ranking de anuncios | ROAS por anuncio | 350 | ✅ | vista Anuncio de la tabla del 355 |
| M25 | Anuncios sin id / registros sin UTM | Traza (290) | | 🟡 cuenta, no lista por anuncio | hija E |
| M26 | Variación semana contra semana | Variación | `lib/variacion.ts` | ✅ | reusar |
| M27 | Semáforo por métrica | Objetivos | `objetivos.meta` / `aceptable` | ✅ tabla | cargar filas (D-6) |

**Vocabulario en pantalla (N4, N5):** se usan los nombres del CRM. Para que Paid Media reconozca su Excel, el "Cómo se
calcula" de la tabla trae una sola línea de equivalencias: *"% presentación a zoom = % de show; % cierre zoom a cliente =
Cierre de ventas; % cierre agenda a cliente = Agenda → venta"*. Nombres nuevos que hay que agregar a `overview.md` §11 y
a `lib/vocabulario-*` en el mismo commit que los muestra: **Profit**, **CPM**, **CTR**, **Llegada a la landing**,
**Conversión de la landing**, **Frecuencia**, **Otras campañas**, **Cumplimiento**, **En meta / En seguimiento /
Rezagado**.

## 4. Lo que hay hoy en el CRM (medido el 9-nov, `main` en `7d52adf2`, CI verde)

- Hub: `app/(app)/p/[programa]/hub/page.tsx` (697 líneas). Pestañas en `?seccion=`: hoy, comercial, dinero, origen,
  pauta. `SeccionPauta` (línea ~596): semáforo del programa, `PautaRoas` (tabla con "Ver por: Campaña de Meta | Canal",
  `?ver_por=`), CSV de citas, `PautaProyeccion`; sincroniza el día en curso en `after()` si toca
  (`debeSincronizarDesdeElHub`). `SeccionOrigen` (línea ~663): `Origen` (`components/dashboard/origen.tsx`),
  `EmbudoFormulario`, `EmbudoPorPregunta`. El bloque "¿Vamos a llegar?" (371) va al pie de todas las pestañas.
- Vista de todos los programas: `app/(app)/hub/page.tsx`.
- Consultas: `lib/queries/roas-de-pauta.ts` (`cargarRoasDePauta`), `lib/queries/origen.ts` (`origenDelPrograma`),
  `lib/queries/proyeccion.ts` (`calcularProyeccion`), hechos en `lib/queries/hechos/` (abono, agenda, cita, envio,
  gasto, origen, venta, dimensiones, fechas, consultar).
- Pauta y Meta: `lib/pauta/meta-api.ts` (`insightsPorAnuncioYDia` pide `ad_id,spend,date_start,conversions,actions`;
  agendas = `offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled`, registros =
  `offsite_conversion.fb_pixel_complete_registration`), `lib/pauta/sincronizar.ts` (escribe `gasto_pauta`),
  `lib/pauta/dia-en-curso.ts`, `lib/pauta/proposito.ts` (propósito de campaña: `agenda` | `lanzamiento`, columna
  `pauta_objetos.proposito`; también existe `pauta_objetos.objetivo`, el objetivo de Meta, solo en campañas).
- `gasto_pauta` (`lib/db/schema.ts:2626`): `program_id, fecha, monto, moneda, agendas_meta, registros_meta, origen
  (meta_api|manual), pauta_objeto_id | area`. **No tiene tráfico.**
- `objetivos` (`schema.ts:2816`): por cohorte, `metrica` en `cupos, agendas_por_dia, costo_por_agenda, costo_por_lead,
  costo_por_venta, roas, conversion_agenda_venta`; `meta` (verde), `aceptable` (borde del amarillo), `moneda`. **No tiene
  agendas de la cohorte ni inversión de la cohorte.**
- Periodo (`lib/periodo.ts`): atajos hoy, ayer, mañana, esta semana, semana pasada, este mes, mes pasado, desde el
  inicio, y rango propio. Cohorte como filtro aparte (`?cohorte=`, 377). Comparar hasta tres periodos (`?comparar=`).
- Gráficas: contrato en `components/graficas/` (ADR 0091), interruptores en la URL `?g_<clave>=plata,semana,acum`
  (`lib/series-pasos.ts`).
- Roles: `manejaPauta` (paid trafficker, gerente, developer) abre el Hub; `veEquipoComercial` no incluye al paid
  trafficker (las listas con closers se proyectan `sinListas`).
- Último checkpoint con tag: `cp-20261029-1`. Desde entonces CI verde en la punta pero sin tag: 370, 248 y 350 siguen
  "en main, falta checkpoint". **La sesión padre marca el checkpoint antes de empezar.**

## 5. Huecos y la migración

**Una sola migración** (la escribe y aplica la sesión padre; nunca una hija; la siguiente libre después de `drizzle/0131_rls_proyecciones_roas.sql`, o sea 0132 salvo que otra sesión haya migrado antes: mirar `drizzle/` y la cola de `docs/plan-reparto.md` §5):

```sql
SET lock_timeout = '5s';
ALTER TABLE gasto_pauta
  ADD COLUMN impresiones integer,
  ADD COLUMN alcance integer,
  ADD COLUMN clics_enlace integer,
  ADD COLUMN vistas_landing integer;
ALTER TYPE metrica_objetivo ADD VALUE IF NOT EXISTS 'agendas';
ALTER TYPE metrica_objetivo ADD VALUE IF NOT EXISTS 'inversion';
```

- Columnas nulas a propósito: lo anterior a la migración queda nulo y la pantalla dice "—" con cobertura (N3), nunca 0.
- Antes de aplicar: `pg_stat_activity` sin transacciones largas sobre `gasto_pauta`; leer el SQL que genere drizzle-kit
  (regla de AGENTS.md); probar en PGlite (`npm test -- tests/<los de pauta>`).
- `ALTER TYPE ... ADD VALUE` no corre dentro de una transacción con uso del valor nuevo en Postgres < 12; Supabase es 15+,
  pero el valor no se puede **usar** en la misma transacción: la migración solo lo agrega.
- Después: `metricaObjetivoEnum` en `schema.ts` con los dos valores; quien lea el enum (Ajustes de metas, 310) tiene que
  mostrarlos con su unidad (agendas = número; inversión = moneda con `objetivos.moneda`).
- **Las metas**: los valores de agendas e inversión de cada cohorte los carga Mani (o gerencia) desde Hub › metas (310),
  por el molde; nunca un seed con valores inventados.

## 6. La pestaña que se construye

Nombre: **Pauta**. `?seccion=origen` redirige a `?seccion=pauta` conservando el resto de la URL (y `?ver_por=canal`
si venía de Origen, para caer en la vista que reemplaza a las tarjetas).

Orden, de arriba a abajo (lo principal arriba y nunca plegado; `docs/structure.md` §9):

1. **Cifras del periodo** (siguen el periodo y la cohorte): Inversión · Agendas · Costo por agenda (CRM) · Ventas ·
   Facturación · ROAS (con "parcial: N agendas pendientes") · Profit. Cada una abre su lista por `urlDeLista`.
2. **Cumplimiento de la cohorte** (solo el filtro de cohorte; no el periodo): tres barras —agendas, ventas de pauta,
   ventas totales— con llevamos/meta, % sobre el total, % sobre lo esperado, marca de lo esperado, estado, atraso o
   adelanto, y debajo "requiere X agendas/día hasta el <fecha>" e "inversión requerida $Y/día a la meta de costo por
   agenda ($Z/día al promedio de la cohorte)". Sin meta: "Sin meta de <cosa> para esta cohorte" + enlace a cargarla. Las
   ventas en cupos **y** en USD (lo pide el norte, 371). El esperado se calcula desde el inicio de ventas de la cohorte
   **vigente** (la lección de F4).
3. **La tabla semanal**: filas M1-M19 en los tres bloques (General, Comercial, Tráfico) con el orden de F5; columnas =
   **Total del periodo** + una por semana (lunes a domingo, Bogotá) del periodo elegido, la más reciente a la izquierda o
   a la derecha según el contrato de tablas de Tinta (la hija B lo resuelve leyendo `structure.md` §9). Cada celda:
   cifra, semáforo si la métrica tiene fila en `objetivos`, y en la semana la variación contra la anterior (`Variacion`).
   Celda sin fuente: "—"; sin dato aún: "Sin datos"; cero: 0 (regla del vacío, `lib/format.ts`). Exportable a CSV
   (mismo patrón que `pauta-citas.csv`). Cada cifra abre su lista cuando la métrica tiene lista.
4. **Gráfica por día** (contrato del 370; `crearOpcionGrafica`): por defecto inversión (barras) contra agendas (línea);
   las demás series de la tabla elegibles; interruptores en la URL.
5. **Tabla del 355** con "Ver por: Canal | Campaña | Anuncio". Canal = las tarjetas de Origen (canal que se abre en sus
   UTM, 311, con la regla que lo clasificó, 248). Anuncio = ranking por inversión con agendas, costo por agenda, ventas y
   ROAS (350), marcando "gastó sin agendas".
6. **La traza**: anuncios con gasto en el periodo cuyos envíos pagos llegan sin `utm_id` (lista por anuncio: nombre,
   campaña, gasto, envíos sin id) y registros sin UTM (conteo y %, que ya existe). Es la lista para la sesión con César.
7. **ROAS proyectado** (375), como hoy.
8. **Embudo del formulario** y por pregunta, como hoy en Origen.

**Rol:** gerente, developer y paid trafficker. Lo que muestra closers (listas) se proyecta `sinListas` para el paid
trafficker, como hoy. El closer no entra (404, ADR 0082).

**Todos los programas** (`/hub`): las magnitudes sumables (inversión en una moneda, agendas, ventas, facturación) se
suman; ROAS, costos, tasas y cumplimiento van **por programa, lado a lado** (ADR 0048). La tabla semanal en "todos" es
una tabla por programa.

## 7. Decisiones

Aprobadas por Mani el 9-nov ("sí" a D-1 a D-7). D-6 queda con los valores pendientes de Paid Media.

| # | Decisión |
|---|---|
| D-1 | Costo por agenda en dos filas: **del CRM** (General) y **según Meta** (Tráfico) |
| D-2 | El costo por agenda usa solo el gasto de campañas con propósito `agenda` (el predicado del semáforo); lanzamiento va a su CPL; el resto se muestra como "Otras campañas: $X" con nombres. ROAS y Profit usan el gasto total |
| D-3 | Semana = lunes a domingo, Bogotá |
| D-4 | Inversión y costos en la moneda del gasto (COP); Facturación, ROAS y Profit en USD con la TRM del día; nunca una suma de monedas |
| D-5 | Frecuencia: por día mientras no exista el alcance del rango; la hija D evalúa pedir a Meta el alcance por semana (`time_increment=7` o `time_range` por semana) y lo guarda solo si es barato; si no, la fila semanal dice "—" con la razón |
| D-6 | Umbrales como filas de `objetivos`; los de 30X (§2 F4) son la propuesta, se cargan solo cuando Paid Media de Retia los confirme |
| D-7 | Estado de cumplimiento: ≥ 100 % de lo esperado En meta; ≥ 65 % En seguimiento; < 65 % Rezagado. Los cortes son tipo (constantes en el módulo de cumplimiento), no filas |

**Preguntas abiertas que no bloquean la demo** (anotar respuesta en este doc cuando lleguen):
- PQ-1 (Paid Media): ¿"PowerTalk" es un programa de Retia que hay que crear en el CRM?
- PQ-2 (Paid Media): ¿los umbrales de D-6 valen para Retia y en qué moneda (el costo por agenda de 30X es USD, el de
  Retia se mide en COP)?
- PQ-3 (Paid Media): ¿qué semana cerrada se usa para cuadrar contra el Excel? (criterio de aceptación del 412).
- PQ-4 (Mani): ¿la inversión requerida usa la meta de costo por agenda de `objetivos` o el promedio de la cohorte? La
  propuesta muestra las dos, como 30X.

## 8. El reparto: sesión padre y sesiones hijas

**Sesión padre** = la sesión principal en el checkout de `main`. Hace: checkpoint, migración, lanzar hijas, revisar
diffs, integrar, build, recorrido, CI, documentos. **Nunca** implementa lo de una hija (Codex implementa, Claude evalúa;
`~/.claude/CLAUDE.md` §Coding 5).

**Sesiones hijas** = una por pieza, cada una en su worktree (`use_worktree: true`), con Codex implementando. Sin
migraciones, sin `npm test` de la suite completa, sin tocar el tracker, el handoff ni `hub/page.tsx` (salvo A).

| Hija | Rama | Toca (exclusivo) | Lee (no toca) | Espera |
|---|---|---|---|---|
| A · Fusión | `t412-a` | `app/(app)/p/[programa]/hub/page.tsx`, `app/(app)/hub/page.tsx`, la lista de pestañas del Hub, `tests/paginas.test.ts` (casos de Origen → Pauta) | componentes de B, C, E por su nombre de export acordado (abajo) | — |
| B · Tabla semanal | `t412-b` | `lib/queries/hechos/pauta-semanal.ts` (nuevo), `components/pauta/tabla-semanal.tsx` (nuevo), `tests/pauta-semanal.test.ts` (nuevo), filas M11 y M15-M19 en `docs/metricas.md`, vocabulario | hechos existentes | — (Tráfico con "—" hasta D) |
| C · Cumplimiento | `t412-c` | `lib/metas/cumplimiento-de-cohorte.ts` (nuevo, junto a `lib/metas/frase-de-avance.ts`; reusa `lib/queries/vamos-a-llegar.ts` del 371), `components/pauta/cumplimiento.tsx` (nuevo), `tests/cumplimiento-de-cohorte.test.ts` | `lib/queries/proyeccion.ts`, `objetivos` | migración para agendas e inversión (antes, con cupos y USD) |
| D · Tráfico de Meta | `t412-d` | `lib/pauta/meta-api.ts`, `lib/pauta/sincronizar.ts`, sus tests | `gasto_pauta` nuevo | migración en `main` |
| E · Traza y costo CRM | `t412-e` | `lib/queries/traza-por-anuncio.ts` (nuevo), `components/pauta/traza.tsx` (nuevo), costo por agenda del CRM en `lib/queries/hechos/` (función nueva), tests | 290, 249 | — |

**Contratos entre hijas** (para que A componga sin esperar): cada hija exporta un componente de servidor con estas props
y A los llama; si una hija no llegó, A deja el hueco con un comentario y nada visible.

```ts
// B
export async function TablaSemanalDePauta(p: { programId: string; slug: string; rango: { desde: string; hasta: string }; periodo: PeriodoResuelto; origen: string; hoy: string; cohorteId: string | null }): Promise<JSX.Element>
// C
export async function CumplimientoDeCohorte(p: { programId: string; slug: string; cohorteId: string | null; hoy: string }): Promise<JSX.Element>
// E
export async function TrazaDePauta(p: { programId: string; slug: string; rango: { desde: string; hasta: string }; periodo: PeriodoResuelto; origen: string }): Promise<JSX.Element>
```

Si al leer el código el tipo real de `periodo`, `rango` o la cohorte difiere, manda el código: la hija ajusta la firma y
lo dice en su informe; la padre ajusta A al integrar.

**Orden:**
1. Padre: checkpoint del estado actual (tag `cp-20261109-1` si el CI de la punta está verde) → migración (§5) → push.
2. Padre lanza en paralelo **A, B, C y E** (cada una con su brief de §9).
3. Cuando la migración esté en `main`, lanza **D**.
4. Padre integra en orden **E → B → C → A → D** (A al final porque compone a las demás), una rama a la vez, con
   typecheck, lint, tests de la rama, guardianes y `npm run build`.
5. Recorrido (§11), push, CI, checkpoint.

**Para la demo de mañana** basta A + B (General y Comercial) + C (cupos y USD). D y E no bloquean.

## 9. Briefs de las hijas (copiar tal cual en cada sesión)

Prefijo común de todos los briefs:

```
Repo: retia-metrics (CRM de Retia). Ticket 412, hija <X>. Lee primero, en este orden: AGENTS.md (reglas duras y
contratos), docs/paid-media-2026-11-09.md (§3, §6, §7 y tu sección de §8 y §9), docs/tasks/412-pauta-y-origen-una-sola-pestana.md,
docs/metricas.md (las filas que nombra tu brief), docs/structure.md §9 (Tinta y contrato de entendimiento).
Reglas: implementa con Codex (/delegate), tú evalúas. Sin migraciones ni db:generate/db:migrate. Toca SOLO los archivos de
tu fila en la tabla de §8. Nada de suite completa: typecheck, lint, tus tests y los guardianes
(tests/contrato-extension.test.ts, tests/vigencia-centralizada.test.ts, tests/graficas-guardian.test.ts,
tests/frontera-cliente-guardian.test.ts). npm run build si tocas un componente cliente. Toda fecha en Bogotá, todo formato
por lib/format.ts, ningún programa escrito en el código, ningún color a mano. Commit en tu rama t412-<x> nombrando
archivos (nunca git add -A), mensaje en español; no empujes a main. Al terminar informa: archivos, decisiones que tomaste,
lo que quedó fuera y cómo lo verificaste.
```

### Hija A · Fusión

```
Objetivo: Origen y Pauta pasan a ser una sola pestaña "Pauta" en el Hub de un programa y en el de todos los programas.
1. ?seccion=origen redirige a ?seccion=pauta conservando la URL (si no trae ver_por, pon ver_por=canal). Quita "origen" de
   la lista de pestañas. Busca con grep todo enlace a seccion=origen en app/, components/, lib/ y cámbialo.
2. SeccionPauta compone, en este orden (§6 del doc): cifras del periodo (si B no expone aún las tarjetas, usa las de
   PautaRoas tal como están), <CumplimientoDeCohorte/> (C), <TablaSemanalDePauta/> (B), gráfica por día (si B no la trae,
   deja hueco), <PautaRoas/> con ver_por canal|campana|anuncio, <Origen/> dentro de la vista Canal o justo debajo si
   PautaRoas no la absorbe aún, <TrazaDePauta/> (E), <PautaProyeccion/>, <EmbudoFormulario/> y <EmbudoPorPregunta/>.
   Las consultas de Origen (origenDelPrograma, embudoDelFormulario, embudoPorPregunta) se mueven a SeccionPauta; borra
   SeccionOrigen (N7). Todo en Promise.all; solo corre en la pestaña activa (197 §5).
3. Los componentes de B, C y E: impórtalos por el nombre de §8. Si la rama de la hija no está, crea un stub local que
   devuelva null con un comentario "412-<x>: lo reemplaza la integración" — la padre lo cambia al integrar.
4. El InfoDePagina de Pauta explica la pestaña en 3 líneas (de dónde vienen los registros, qué rindió la plata, cómo va la
   cohorte) y trae la línea de equivalencias del Excel (§3).
5. tests/paginas.test.ts: el redirect y que el paid trafficker abre Pauta; el closer recibe 404.
Done: el redirect funciona, no queda seccion=origen, la página carga como gerente y paid trafficker en dev:local.
```

### Hija B · Tabla semanal

```
Objetivo: la tabla del Excel de Paid Media (filas M1 a M19 de §3, en General/Comercial/Tráfico, orden de F5), columnas
Total del periodo + una por semana lunes-domingo Bogotá, y la gráfica por día.
1. Consulta en lib/queries/hechos/pauta-semanal.ts: una agregación por semana sobre los hechos existentes (gasto, agenda,
   cita, venta) con el builder tipado (contrato C-2): agrupa en SQL, no en memoria. Cada fila REUSA la función de su
   concepto (columna "Dónde" de §3); prohibido reescribir un predicado (N1). Devuelve por celda {valor, cobertura}.
2. Profit (M11) = Vendido Paid USD − gasto USD, ambos ya convertidos por el convertidor único; si falta TRM, "—" y razón.
3. Tráfico (M15-M19): lee las columnas impresiones, alcance, clics_enlace, vistas_landing de gasto_pauta SOLO si existen en
   schema.ts; si la migración no está aún en tu rama, devuelve null con cobertura "sin dato de Meta" y la pantalla dice "—".
   Fórmulas de §3, siempre sumando numeradores y denominadores, nunca promediando porcentajes. Frecuencia según D-5.
4. Costo por agenda: General = M5 si la hija E ya lo expuso; si no, deja la celda con "—" y un TODO 412-e. Tráfico = M6.
   D-2: solo gasto de propósito agenda; "Otras campañas: $X" como nota bajo Inversión.
5. Semáforo: lee objetivos de la cohorte (meta/aceptable, sentido por métrica). Sin fila, sin color. Variación semana
   contra semana con lib/variacion.ts y <Variacion>.
6. Componente components/pauta/tabla-semanal.tsx con Tinta (cifra para números, Badge para estado), tabla alternativa
   accesible, CSV con el mismo patrón que pauta-citas.csv. Toda cifra con lista abre su lista con urlDeLista.
7. Gráfica por día con crearOpcionGrafica (components/graficas): inversión vs agendas por defecto; nada de echarts directo.
8. docs/metricas.md: filas nuevas Profit, CPM, CTR, Llegada a la landing, Conversión de la landing, Frecuencia, con su
   función; overview.md §11 con los nombres nuevos; la línea de equivalencias en el "Cómo se calcula".
9. Tests (tests/pauta-semanal.test.ts, base por archivo): la suma de las semanas = el Total; una semana sin gasto da "—"
   en costos y 0 en agendas; dos monedas sin TRM no se suman; otro programa no se cuela; un anulado no cuenta.
Done: la tabla cuadra con una semana armada a mano en el test y con lo que muestra hoy PautaRoas para el mismo rango.
```

### Hija C · Cumplimiento

```
Objetivo: "Cumplimiento de la cohorte": agendas, ventas de pauta y ventas totales contra la meta de la cohorte y contra lo
esperado a la fecha (§2 F4 y §6 punto 2).
1. Lee primero el 371: lib/queries/vamos-a-llegar.ts, components/metas/vamos-a-llegar.tsx y lib/metas/frase-de-avance.ts; y lib/queries/proyeccion.ts (calcularProyeccion). Si el 371 ya
   calcula lo esperado a la fecha, REÚSALO: nada de una segunda fórmula de días transcurridos.
2. Esperado = días hábiles transcurridos desde el inicio de ventas de la cohorte vigente ÷ días hábiles totales (regla de
   días hábiles del repo: solo se excluyen sábado y domingo). Si el 371 usa otra base, usa la suya y dilo.
3. Estado (D-7): ratio = (llevamos ÷ meta) ÷ esperado; >= 1 "En meta", >= 0,65 "En seguimiento", si no "Rezagado".
   Constantes con nombre en el módulo. Badge variant por estado (Tinta, cinco tonos).
4. Ventas en cupos (meta_cupos de la cohorte) y en USD (la meta en dinero que ya usa el 371). Ventas de pauta = área Paid;
   ventas totales = todas. Agendas e inversión: objetivos 'agendas' e 'inversion' cuando existan en el enum; antes,
   "Sin meta de agendas para esta cohorte" + enlace a configurarla (310).
5. Requeridos: agendas/día = las de calcularProyeccion; inversión/día = agendas/día × costo por agenda (meta de
   objetivos 'costo_por_agenda' y, aparte, promedio de la cohorte). Si la meta ya se cumplió: "Meta cumplida: no hace
   falta más inversión".
6. Atraso/adelanto: meta × esperado − llevamos, en la unidad de cada barra.
7. Tests: cohorte a mitad (50 % esperado) con 40 % llevado = En seguimiento (0,8); con 30 % = Rezagado; meta cumplida;
   sin meta; cohorte cerrada; otro programa no se cuela.
Done: el componente muestra las tres barras con su estado en dev:local con la cohorte activa de un programa.
```

### Hija D · Tráfico de Meta

```
Objetivo: el sync de pauta guarda impresiones, alcance, clics al enlace y vistas de landing por anuncio y día.
Precondición: la migración del 412 está en main (columnas nuevas en gasto_pauta). Rebasa tu rama sobre main.
1. lib/pauta/meta-api.ts, insightsPorAnuncioYDia: agrega a fields impressions, reach, inline_link_clicks y lee de actions
   el action_type landing_page_view. Verifica los nombres contra la API v26.0 con META_SYSTEM_TOKEN (.env.local; solo
   lectura, ads_read) con un script desechable en scripts/ que NO se commitea; nunca imprimas el token.
2. Valores ausentes = null, nunca 0. lib/pauta/sincronizar.ts escribe las cuatro columnas en el upsert existente.
3. D-5: mide si pedir el alcance por semana es barato (una llamada extra por cuenta y semana). Si sí, propón dónde
   guardarlo (sin migrar: lo decide la padre). Si no, deja la frecuencia solo por día y dilo.
4. Tests de meta-api y sincronizar con fetch falso: los campos llegan, un campo ausente queda null, el upsert actualiza.
Done: el sync del día en curso en dev:local escribe las columnas (verificado con un select en la base local).
```

### Hija E · Traza y costo por agenda del CRM

```
Objetivo: (a) la lista de anuncios con gasto cuyos envíos pagos llegan sin utm_id; (b) el costo por agenda del CRM
(metricas.md "Costo por agenda del Hub", 🟡 249).
1. (a) Lee el 290 (alarma de la traza) y reusa su predicado. Lista por anuncio: nombre, campaña, gasto del periodo,
   envíos pagos sin id. Más el conteo y % de registros sin UTM que ya existe. Componente TrazaDePauta.
2. (b) gasto de agenda (D-2, el predicado del semáforo) ÷ agendas del CRM de área Paid (hechos/agenda.ts), en COP. Función
   en lib/queries/hechos/ y su fila en metricas.md pasa de 🟡 a ✅. Exponla para que B la use.
3. Verifica M23 (ventas con UTM de pauta sin área Paid): con resolverCanal no debería existir; si un select contra la base
   local da 0, no se muestra y lo anotas; si da > 0, lista y avisa a la padre.
4. Tests en los dos sentidos para (a) y (b), otro programa no se cuela, anulados no cuentan.
```

## 10. Prompt de la sesión padre (copiar tal cual)

```
Seguimos con el CRM de Retia. Esta sesión es la PADRE del ticket 412 (Pauta y Origen en una sola pestaña: el Excel de
Paid Media sale del CRM). Prioridad alta: hay demo con gerencia/Paid Media.

Lee, en este orden: AGENTS.md, docs/paid-media-2026-11-09.md (completo: es la fuente de todo, no improvises nada que
esté ahí), docs/tasks/412-pauta-y-origen-una-sola-pestana.md, docs/hub.md §0 y la entrada del 9-nov del 412 en
docs/agents/handoff.md (Memory).

Tu papel: orquestar. Codex implementa en las hijas; tú haces checkpoint, migración, lanzas las hijas, revisas diffs,
integras, corres build y recorrido, y actualizas los documentos. Nunca implementas lo de una hija.

Pasos (§8 del doc):
1. Checkpoint: si el CI de la punta de main está verde, tag cp-20261109-1 y marca 370, 248 y 350 como done en
   docs/tasks/README.md y en sus archivos.
2. Migración del §5 (gasto_pauta: impresiones, alcance, clics_enlace, vistas_landing; metrica_objetivo: agendas,
   inversion). Edita schema.ts, db:generate con pty, LEE el SQL, añade SET lock_timeout, prueba en PGlite con los tests
   de pauta, revisa pg_stat_activity, mira el ref de la URL, db:migrate (pide el ok de Mani antes de aplicar en
   producción), push.
3. Lanza en paralelo las hijas A, B, C y E (start_session, use_worktree true, contexto fresh) con el prefijo común + su
   brief del §9, tal cual. Lanza D cuando la migración esté en main.
4. Integra en orden E → B → C → A → D, una rama a la vez: diff contra el brief, typecheck, lint, tests de la rama,
   guardianes, npm run build; reemplaza los stubs de A por los componentes reales.
5. Recorrido en dev:local como gerente y como paid trafficker (subdominios de localhost distintos), escritorio y 375 px,
   clic en todo lo que se abre y consola limpia; npm run test:humo si hay aire. Push, CI verde, checkpoint.
6. Documentos en el mismo commit que el código que los cambia: metricas.md, overview.md §11, 412 (casillas y status),
   README del tracker, handoff (Memory + prompt de la próxima sesión), hub.md §0 si cambia el orden.
7. Para la demo, mínimo A + B (General y Comercial) + C (cupos y USD). Si no da el tiempo, eso es lo que se empuja.

Pendientes de Mani que no son código (§13 del doc): no los hagas tú, recuérdalos al cerrar.
```

## 11. Verificación y demo

- **Cuadre contra el Excel** (criterio del 412): Mani consigue de Paid Media una semana cerrada del Excel de un programa
  (PQ-3) y se compara fila por fila con la tabla. Diferencias esperadas y ya explicadas: agendas del CRM ≠ agendas del
  pixel (D-1); tasas sobre el mismo grupo (187) ≠ tasas del Excel; COP vs USD (D-4).
- **Recorrido**: gerente y paid trafficker; `?seccion=origen` viejo redirige; cada cifra abre su lista; "—" donde falta
  tráfico; cumplimiento con y sin meta; 375 px sin scroll horizontal.
- **Guión de demo (5 min)**: 1) "Esto es su Excel": la tabla semanal con Total y semanas. 2) Cumplimiento de la cohorte:
  en meta o rezagado, y cuánto hay que invertir por día. 3) De dónde vienen: Ver por Canal → Campaña → Anuncio. 4) La
  traza: los anuncios que César tiene que arreglar. 5) ROAS proyectado. Lo que falta, dicho: tráfico de Meta (CPM, CTR,
  landing, frecuencia) entra con la hija D.

## 12. Fuera del 412: lo que queda anotado para después

Ninguno tiene ticket todavía; cada uno dice de dónde sale y qué haría falta.

| # | Qué | Fuente | Qué haría falta |
|---|---|---|---|
| X-1 | El día contra el promedio de los últimos 7 días (en Hub › Hoy o en Pauta) | F3 | ticket; reusa `Variacion` |
| X-2 | Atajos de periodo "Últimos 7/14/28 días" y "Todo" | F3 | ampliar `atajosDePeriodo` (`lib/periodo.ts`) con su test; afecta a todo el Hub |
| X-3 | Ranking de creativos con ventas de la cohorte, "Revisar" y "ventas sin creativo" | F3 | sobre 350; ticket |
| X-4 | Agendas diarias por programa con interruptores (vista todos los programas) | F3 | gráfica del 370 en `/hub` |
| X-5 | Campañas de reconocimiento y por ICP medidas aparte | F3 (ask de 30X) | operativo de Paid Media; el CRM ya separa por propósito (D-2) |
| X-6 | Indicadores de seteo y seguimiento (tiempo al primer contacto, intentos en 24 h, % con próximo paso, días agenda → venta) | F3 | es Comercial, no Pauta; cruzar con 390, 391 y la sesión con las closers |
| X-7 | Texto de accionable / highlights por semana y programa | F4 | ¿un campo de nota por semana en el Hub o lo genera el MCP analítico (407)? decidir |
| X-8 | Etiqueta de escalabilidad del programa ("Escalable", "No escalable todavía") | F4 | juicio humano; ¿campo del programa? decidir |
| X-9 | Ventas cruzadas entre programas (anuncio de A vendió B) | F3 | **no se hace**: el programa es frontera |
| X-10 | Productos y SKUs | F2 | 376, fase 2 |
| X-11 | Descarga de transcripciones de Grain por tipo de cierre, programa y cohorte | F2 | frente de media (328 a 330) |
| X-12 | Parrilla de media conectada al flujo de edición | F2 | `docs/media/` |

**Los Excels diarios de Pauta (Comunicarte y Tactical) cruzados fila por fila con el CRM, con la recomendación y los tickets propuestos 413 a 418 (el 413 es el audit total, prioridad 1):** `docs/paid-media-excels-2026-11-10.md`.

## 13. Tareas de Mani que no son código

- Verificar que **Dani Rodríguez** tiene usuario activo con rol paid trafficker y que entra (no pudo en la reunión).
- Pedir a Paid Media: el Excel de una semana cerrada (PQ-3), confirmar umbrales (PQ-2) y PowerTalk (PQ-1).
- Sesión de 30 min con **César** (y Ander) para la plantilla de UTM, con la lista de la traza (hija E) en la mano. El
  plazo que puso Daniel Tovar era el viernes 7-nov: ya venció.
- Sesiones de 30 min con **Andrea, Maru y Dana** (closers), pedidas por Daniel Tovar para la semana del 3-nov.
- Escribirles a **Alfredo y Mariana** (EstadoX) para ponerse a disposición.
- Cargar las metas de agendas e inversión de cada cohorte activa cuando exista la migración (Hub › metas).
