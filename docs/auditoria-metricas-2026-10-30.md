# Auditoría de las métricas del CRM (30-oct-2026)

Alcance: toda la lógica de métricas, de la base a la pantalla y al mensaje de WhatsApp, en seis ejes: (1) datos que se
muestran, (2) lógica de cálculo, (3) redundancia, (4) contradicciones, (5) UI críptica o sobrediseñada, (6) consistencia
de etiquetas, filtros, textos y formato. Solo lectura: código de `main` (`ac2d13eb`) y la base de producción con `SELECT`
(ids opacos). Los hallazgos de mayor peso (C-01, C-09, R-02, K-01, K-05, U-01) se volvieron a comprobar contra el código y
la base antes de escribirlos aquí.

**Qué sale de aquí:** los tickets 351 a 362 (los arreglos, agrupados por causa y no por síntoma), enmiendas a los tickets
123, 248, 249, 299, 341 y 350, y las **reglas de norte de las métricas** (ADR 0115, resumidas en `AGENTS.md` y en
`docs/metricas.md` §0) para que esto no vuelva a pasar.

Severidad: **crítica** = una cifra falsa visible hoy · **alta** = falsa o contradictoria en cuanto cambie un dato normal
· **media** = confunde o diverge en un caso raro · **baja** = deuda.

## 1. Resumen

El CRM no tiene un error de fórmula aislado: tiene **varias respuestas para la misma pregunta**, y cada una se ve bien por
separado. Los tests pasan porque cada función está probada sola, y nadie las compara entre sí. Cinco cosas pasan hoy:

1. **El ROAS de octubre está inflado ×2,2 en ComunicArte** (1,24 contra ~0,56) porque el gasto de Meta solo existe desde
   el 8-oct y las ventas cuentan desde el 1-oct. Nada lo avisa (C-01).
2. **El % de show se mide sobre el 19 a 21 % de las citas pasadas**: el resto sigue en "agendada" sin resultado (242 de 300
   deals en ComunicArte, 271 de 345 en Tactical). Ese % alimenta el % de cierre, agenda → venta y la proyección (C-02, C-05).
3. **La comisión visible de octubre se queda corta un 35 a 47 %** porque la mitad de las ventas no tiene el % congelado
   (16 de 32 en ComunicArte, 9 de 18 en Tactical). Faltan unos USD 702 y USD 790 (C-09).
4. **"Vendidos de la cohorte" da 32 en Cupos y 27 en Proyección** en la misma pantalla para ComunicArte C3, y "venta" se
   cuenta con tres reglas distintas que hoy coinciden por casualidad (C-07, C-08, R-03).
5. **El embudo del formulario no ve los parciales de Typeform**: el 100 % llega sin `fecha_envio` y se descarta, así que
   "Dejó datos" = "Completó" (C-04).

Y una deuda de fondo: el diccionario (`docs/metricas.md`) cita como canónicas funciones que nadie llama (R-02); la pestaña
Pauta calcula el mismo embudo con dos cargadores (R-01); el mismo concepto tiene hasta cinco nombres en pantalla (G-02 a
G-08), y la jerga técnica (`utm_content`, `ad_id`, "ADR 0099", "macro") llega a gerencia (U-01).

Lo que está limpio (comprobado con `SELECT`): ventas sin valor vendido, sobrepagos, abonos sin deal o con deal anulado,
leads con dos deals abiertos, gasto duplicado y fechas centinela dan **cero**. Tinta se cumple en lo duro: no hay color,
sombra ni radio escrito a mano fuera de `components/ui` y `globals.css`.

## 2. Causas raíz

| # | Causa | Hallazgos que explica | Regla de norte que la cierra (ADR 0115) |
|---|---|---|---|
| CR-1 | **Un concepto, varias funciones.** Venta (3 reglas), show (3 a 4 fórmulas), cita sin resultado (4), "Sin UTM" (3), registros/leads (2), deal creado (2 fechas), vendidos de la cohorte (2) | C-03, C-06, C-07, C-08, C-10, C-11, C-14, R-03 a R-09 | N1, N2 |
| CR-2 | **La cobertura del dato no es parte de la métrica.** Una razón con medio dato se pinta igual que una completa | C-01, C-02, C-04, C-09, C-13 | N3 |
| CR-3 | **La capa de hechos (262) se construyó al lado y no reemplazó lo viejo**, y cada pedido de Pauta (093, 349, 350) sumó su cargador con su ancla | R-01, R-02, R-06 | N1, N7 |
| CR-4 | **La migración Dashboard → Hub movió rutas, no podó**: módulos, componentes, textos y docs viejos siguen | R-10 a R-13, U-03, U-06, U-18, K-06 | N7 |
| CR-5 | **No hay vocabulario ni formato únicos de pantalla.** Cada componente escribe su rótulo y su `pct` | G-02 a G-12, U-04, U-05, U-07 a U-17 | N4, N5 |
| CR-6 | **Las explicaciones de diseño se escriben como texto de pantalla** (ADR, `utm_*`, "periodo A", "macro") | U-01, U-02, U-09, U-16, U-20, U-21 | N5 |
| CR-7 | **Las enmiendas se escriben al pie**: el título del ADR, su índice, el vocabulario y el diccionario quedan con la versión vieja; tres reglas de precedencia distintas | K-01 a K-04, K-07, K-09, K-10, K-11 | N8 |
| CR-8 | **Lo que se captura mal no tiene reja**: resultado de llamada sin marcar, % de comisión nulo, `utm_id` ausente, gasto sin backfill | C-02, C-09, C-13, C-01 | N3, N6 |
| CR-9 | **"Done" sin evidencia**: tickets cerrados con sus casillas vacías y tracker contra archivo desfasados | K-05 | N9 |

## 3. Hallazgos

### 3.1 Datos y cálculo (ejes 1 y 2)

| Id | Sev. | Hallazgo | Evidencia | Arreglo |
|---|---|---|---|---|
| C-01 | crítica | ROAS (y costo por agenda de ventana) con ventas desde el 1-oct y gasto desde el 8-oct. CA ~1,24 contra ~0,56 en la misma ventana; Tactical 1,08 contra 0,90 | `gasto_pauta` y `tasas_cambio`: `min(fecha)` = 2026-10-08, 22 días; `lib/queries/roas-de-pauta.ts` no mira cobertura; `components/pauta-roas.tsx:50` solo dice "sin pauta" si el gasto es 0 | 351 |
| C-02 | alta | % de show sobre el 19-21 % de citas pasadas; el resto sigue `agendada`. Si los pendientes fueran no show: 11 % / 9,6 % en vez de 56,9 % / 44,6 % | `lib/queries/tasas-del-grupo.ts:~150` deja fuera los pendientes; backlog: CA 255, Tactical 290, Confianza 38 | 341 (captura), 351 (cobertura), 353 |
| C-03 | media | Tres fórmulas de show con el mismo nombre en Hoy: por deal (56,9 %) y por cita (10,5 %) lado a lado | `tasas-del-grupo.ts`, `tasa-show-por-cita.ts`, `pauta-interina.ts` | 353 |
| C-04 | alta | Embudo del formulario sin parciales: 100 % de parciales de Typeform con `fecha_envio` NULL (515/515, 675/675, 517/517) y `leerEnvios` los descarta; el ROAS sí los cuenta con `created_at` | `lib/queries/embudo-formulario.ts:~97-111`; `roas-de-pauta.ts:93` | 354 |
| C-05 | alta | Escalera: ~25 % del escalón 7 son deals con cita vencida sin marcar (CA 245 de 999, Tactical 278 de 867) | `lib/queries/escalera.ts:~119,~180` | 353 |
| C-06 | media | Cuatro definiciones de "cita pasada sin resultado" (251 contra 255 en CA); la bandera del Hub cambia con el periodo y el Inbox no | `metricas-filtros.ts:~385` y su vecino, `roas-de-pauta.ts:~232`, `pauta-interina.ts:~237`, `tasas-del-grupo.ts:~155`, `dashboard.ts:301` | 353 |
| C-07 | media | "Venta" con tres reglas: por evento (historial), evento + etapa actual, solo etapa actual. Hoy coinciden (0 vendidos luego perdidos) | `metricas-filtros.ts:164,217`; `dashboard.ts:708`; `tasas-del-grupo.ts:150`; `alertas.ts:144` | 352 |
| C-08 | alta | Cupos › Cohorte cuenta 32 y Proyección 27 en CA C3: 5 ventas anteriores a `fecha_inicio_ventas` sin límite inferior en Cupos | `dashboard.ts:708` contra `proyeccion.ts:~430` | 352 |
| C-09 | alta | 50 % de ventas sin `comision_porcentaje` congelado; comisión visible corta ~35-47 % | `lib/deals/mover-etapa.ts:~327`, `lib/queries/comision.ts:16`; SQL: CA 16/32, Tactical 9/18 | 356 |
| C-10 | media | Dos "Leads": personas en Comercial (875 en CA) y registros en Hoy (927) | `components/dashboard/operacion.tsx:457`, `hoy.tsx:114` | 354, 357 |
| C-11 | media | "Deals creados" por fecha del envío en el Hub y por `created_at` en la escalera (Tactical 885 contra 948) | `metricas-filtros.ts:~291`, `escalera.ts:~227` | 354 |
| C-12 | media | El cumplimiento de "Cupos del día" divide por una meta que ya descuenta las ventas de hoy: sube sin tope (333 %) | `vista-hoy.ts:~101`, `dias-habiles.ts:~109` | 352 |
| C-13 | media | 24-63 % de envíos pagos sin `utm_id` (CA 24 %, Confianza 55 %, Tactical 63 %); 15 % de Tactical sin campaña posible | SQL de octubre | 351 (cobertura visible); operación con Pauta |
| C-14 | media | Tres definiciones de "Sin UTM" que hoy coinciden (0 divergentes) | `canal.ts:100`, `canal-sql.ts:~25`, `pauta-interina.ts:~110` | 354 |
| C-15 | media | Las reagendas cuentan como agendas nuevas (CA 336 agendas, 320 deals) y el mensaje de horas lista cada una | `lib/deals/llamadas.ts:~597`, `hechos/agenda.ts`; ticket 298 dice lo contrario | 353 (decisión con Pauta) |
| C-16 | media | "Closer" significa tres cosas en Mis métricas (quien tomó la llamada, dueño del deal, quien tecleó el abono); 3 ventas de CA sin dueño | `filtroLlamadas`, `filtroCierres`, `filtroCaja`, `comisionesPorCloser` | 356 |
| C-17 | baja | Constantes de negocio en código: `MUESTRA_MINIMA_CONVERSION = 20`, `DIAS_PARA_MADURAR = 30`, ventanas de ritmo | `proyeccion.ts:28`, `tasas-del-grupo.ts:37` | 352 |
| C-18 | baja | "Leads requeridos por día" divide agendas de la cohorte por registros del programa | `proyeccion.ts:~230` | 352 |

### 3.2 Redundancia (eje 3)

| Id | Sev. | Hallazgo | Evidencia | Arreglo |
|---|---|---|---|---|
| R-01 | alta | Pauta pinta el mismo embudo con dos cargadores y dos anclas de venta (`PautaInterina` por fecha de venta, `PautaRoas` por fecha del envío); Origen es un tercero | `app/(app)/p/[programa]/hub/page.tsx:431-432`; `pauta-interina.ts:23-26`; `roas-de-pauta.ts:89-94`; `origen.ts:81` | 355 |
| R-02 | alta | `hechos/abono.ts` y `hechos-embudo.ts`/`embudoPorCanal` no los llama nadie fuera de tests, y `metricas.md` §1.3, §1.5, §3.1 los cita como canónicos | grep: cero importadores en `lib/`, `app/`, `components/` | 361, 362 |
| R-03 | alta | Venta por evento y por estado (= C-07 visto desde la duplicación) | ver C-07 | 352 |
| R-04 | media | "Ocurrió" envuelto ≥ 8 veces sobre `RESULTADOS_QUE_OCURRIERON` | `mover-etapa.ts:964` y 8 wrappers | 353 |
| R-05 | media | Cuatro fórmulas de % no show; el no show no está en el diccionario | `pauta-interina.tsx:140-146`, `vista-metrica.ts:375`, `dashboard.ts:677` | 353 |
| R-06 | media | Dos convertidores de gasto: el del semáforo avisa sin TRM; el del ROAS devuelve 0 en silencio y no suma las fotos del día | `semaforo/costo-por-agenda.ts:~76`, `roas-de-pauta.ts:292,165-169` | 351, 355 |
| R-07 | media | ~19 `AT TIME ZONE` fuera de `hechos/fechas.ts`; el día del envío tiene 4 expresiones | `metricas-filtros.ts` (6), `metricas-con-filas.ts`, `leads.ts`, `roas-de-pauta.ts:94`, `pauta-interina.ts:109`… | 354 |
| R-08 | media | `lunesDe` ×4, `sumarDias` ×2, calendario repartido entre `rangos.ts` y `dias-habiles.ts` | `rangos.ts:37`, `proyeccion.ts:207`, `vista-hoy.ts:64`, `metas.ts:96` | 354 |
| R-09 | media | "Faltan ÷ días hábiles" y "cumplimiento lineal" calculados 3 veces con bordes distintos (desde hoy contra desde mañana) | `dias-habiles.ts:122`, `proyeccion.ts:288-301`, `dashboard.ts:784`, `metas.ts:181,230`, `alertas.ts:76` | 352 |
| R-10 | media | `/ajustes/areas` enlazada y sin efecto en ninguna cifra (habla del "origen declarado", retirado); `canales-admin.tsx` muerto; comentarios de `lib/ingesta` citan `estados_llegada` (borrada en 0059) | `ajustes/page.tsx:44`, `ajustes/areas/page.tsx:13,46` | 361 |
| R-11 | media | Código sin llamadores: `embudoPorCanal`, `dealsPerdidosPorMotivo`, `periodoAnterior`, `colorDeCupos`, `components/proxima-fase.tsx`, `perfil-propio.tsx` y otros | lista completa en el ticket 361 | 361 |
| R-12 | baja | Tres selectores de fecha y tres `tasa()` de presentación; `filtro-dashboard.tsx` con nombre viejo; la vista "todos" rearma tablas a mano | `components/filtros/filtro-fecha.tsx`, `filtro-fecha-lista.tsx`, `selector-periodo.tsx`; `piezas.tsx:11`, `tabla-de-origen.tsx:26` | 358, 360 |
| R-13 | baja | Dos sistemas de color para cupos (`colorDeObjetivo` y `colorDeCupos`, este último muerto) y las alertas con su propio umbral | `lib/objetivos/semaforo.ts`, `alertas.ts` | 361 |

### 3.3 Contradicciones (eje 4)

| Id | Sev. | Choque | Evidencia | Arreglo |
|---|---|---|---|---|
| K-01 | alta | Costo por agenda: el título del ADR 0088, su índice, `hub.md` H-4 y `overview.md` §11 dicen "agendas del CRM"; el código y `metricas.md` §3.3 usan Meta (enmienda del 16-oct, solo al pie). `metricas.md` marca ✅ un costo por agenda del Hub que no existe | `docs/adr/0088-*.md:1,56`; `lib/semaforo/costo-por-agenda.ts:221` | 362, 249 |
| K-02 | alta | `metricas.md` §3.5 D2 dice "no hay una segunda fórmula por cita"; desde el 24-oct existe y se muestra | `hoy.tsx:126-128`, ticket 299 | 362, 299 |
| K-03 | alta | `AGENTS.md` manda a `analytics.md` §6 para las fórmulas; ese bloque se declara historia y sus fórmulas ya difieren (ROAS, traza, costo por agenda) | `analytics.md:306-312` | 362 |
| K-04 | alta | `AGENTS.md` dice que `estados_llegada` sigue en el esquema (la borró la 0059), que Canales está en Ajustes (es un redirect) y que el ADR 0054 cierra D4 (está retirado; vige el 0069) | `drizzle/0059_retirar-estados-llegada.sql:8` | 362 |
| K-05 | alta | El 350 está `done` con sus 5 casillas de "Done cuando" vacías; 143, 152, 156, 157 `[x]` en el tracker y `en curso` en su archivo | `docs/tasks/350-*.md:66-71` | 350, 362 |
| K-06 | media | `structure.md` §8-9 y `overview.md` describen el Dashboard, que ya es un redirect al Hub | `structure.md:507,524,542,643` | 362 |
| K-07 | media | Escalera: el índice del ADR 0109 y `overview.md` dicen seis escalones; el ADR enmendado, el diccionario y el código, siete | `docs/adr/README.md:140`, `escalera.ts:34` | 362 |
| K-08 | media | "Agendas" significa citas en Comercial y agendas creadas en Origen y Pauta, con cifras distintas en el mismo periodo | `hechos-embudo.ts`, `origen.ts` | 357 |
| K-09 | media | La traza es por envío en `metricas.md` y por venta en `analytics.md` y `overview.md` | `metricas.md` §2 y §3.2 | 362 |
| K-10 | media | Tres reglas de precedencia: "manda el código" (`metricas.md`), "gana el ADR o el ticket" (`hub.md`), "lo de Gerencia es fuente de verdad, el ADR se reabre" (`comercial.md`); GC-45 (página de Metas) superado por el ADR 0086 sin nota | `comercial.md:5-11`, `hub.md:7-9` | ADR 0115 (N8), 362 |
| K-11 | baja | `metricas.md` usa 🟢 fuera de su leyenda y marca ✅ cosas en curso (horas de agenda del 298) | `metricas.md` §3 | 362 |
| K-12 | baja | La ruta vieja `dashboard/lista` exige `esAdministrador`; la del Hub, `veEquipoComercial`: un closer con un enlace viejo recibe 403 antes del redirect | `p/[programa]/dashboard/lista/page.tsx:12` | 361 |

### 3.4 UI (eje 5)

| Id | Sev. | Pantalla | Hallazgo | Arreglo |
|---|---|---|---|---|
| U-01 | alta | Hub › Origen y Pauta | Texto visible con `ad_id`, `utm_id={{ad.id}}`, "ADR 0099", `utm_content`/`utm_term`, "Macro sin expandir", "Sin envío de origen", "Canal (source / medium)" (`origen.tsx:48-51`, `pauta-interina.tsx:18-19,93-94,321`) | 359 |
| U-02 | media | Hub › Origen | Tres tarjetas de diagnóstico de captación (traza, contenido con código que no reconocemos, plantillas en uso) bajo el reporte de gerencia | 359 |
| U-03 | alta | Hub › Pauta | Dos tablas con las mismas columnas agrupadas distinto, sin decir cuál usar; "(interina)" en el título | 355 |
| U-04 | media | Hub › Pauta | ROAS "3,25" sin unidad; "contratado" como tercer nombre de vendido | 355, 358 |
| U-05 | media | Hub › Hoy | Dos % de show en la misma tarjeta (por deal y por cita) en nota de 12 px | 353, 357 |
| U-06 | media | Hub › Hoy | Tarjeta "Lo que viene · Se está construyendo": hoja de ruta en la pantalla de trabajo | 359 |
| U-07 | media | Hub › Comercial | "vendidos hoy" aunque el periodo sea un mes; la frase de pendientes copiada en dos sitios | 357 |
| U-08 | media | Hub › Hoy › Cupos | "meta dinámica" (término interno) y una nota de dos reglas en un párrafo | 357 |
| U-09 | baja | Hub › Todos | "Pauta y origen (interina)", "No depende del periodo A ni se compara con B", "Deuda cupos" | 357, 359 |
| U-10 | media | Hub › Dinero | Tres párrafos de reglas de diseño (ADR 0023) escritos como aviso fijo | 359 |
| U-11 | media | Pestañas del Hub | Origen y Pauta descritas casi igual; Pauta promete costo por lead que no muestra | 359 |
| U-12 | alta | Hub › Pauta en celular | Tabla de ROAS (10 columnas) y la de `pauta-interina.tsx:317` sin `overflow-x-auto` | 355 |
| U-13 | media | Hub › Pauta | La moneda sale dos veces (cabecera "USD" y celda "USD …") | 355, 358 |
| U-14 | media | Mi espacio | Pestaña "Por decidir" (es salud), "Webhook Health", "Envíos por canal", conteo en `Badge` de estado | 359 |
| U-15 | media | Mi espacio › Métricas | "Con show y vendidos hoy" con cualquier periodo; "Llamadas atendidas"; "Caja cobrada" | 357 |
| U-16 | baja | Hub › Origen | Badges "Sin token" / "Sin URL" para gerencia | 359 |
| U-17 | media | Lista detrás de una cifra | "{n} registros" para cualquier métrica; "Días" sin decir de qué; "periodo A" | 357 |
| U-18 | media | Hub › Comercial | ~10 bloques; tres cortes del mismo embudo; "owner" | 359 |
| U-19 | media | Hub › Hoy | "Shows sin Grain" y "Atendidos sin Grain" cuentan casi lo mismo | 359 |
| U-20 | baja | Semáforo | El badge imprime el enum crudo (`problema`); "0 agendas CRM"; "09h" | 358 |
| U-21 | media | WhatsApp | "fbclid", "envíos pagos", "ag", "reg", "c/u"; verde/amarillo/rojo contra "En meta / Atención / En peligro" de la UI | 357, 359 |
| U-22 | baja | Programa › Ventas | "5,00 %" contra "62,5%" del resto | 358 |
| U-23 | baja | Navegación | Menú mezclado: Leads, Deals, Calls, Inbox, Students, Nerd Stats junto a Próxima cohorte, Recursos, Ajustes | 359 (decisión de Mani) |

### 3.5 Consistencia (eje 6)

| Id | Sev. | Concepto | Variantes en pantalla | Forma propuesta | Arreglo |
|---|---|---|---|---|---|
| G-01 | media | Nombres de pantalla | inglés y español mezclados; subtítulo que repite el menú | un diccionario `NOMBRE_DE_PANTALLA` en `lib/nav.ts` | 359 |
| G-02 | alta | Llamada que ocurrió | Show, Realizadas (show), Llamadas atendidas, Ocurridas, Atendidos (que son deals) | "Llamadas realizadas"; "No asistió" | 357 |
| G-03 | alta | Envío completo | Registros, Leads, Envíos, "Registros del día" | Registros = métrica; Lead = persona | 357 |
| G-04 | media | Meta del día | meta dinámica, Meta de hoy, Esperado, Deuda, Deuda cupos | "Meta de hoy", "Esperado a hoy", "Cupos que faltan" | 357 |
| G-05 | alta | Venta | Cierres, Ventas, Cupos vendidos, Vendido (cantidad en Metas, USD en Dinero), Contratado | "Ventas" (conteo), "Valor vendido (USD)" | 357 |
| G-06 | media | Plata cobrada | Recaudado, Caja cobrada, Caja, abonos | "Recaudado" | 357 |
| G-07 | media | Llamada sin resultado | 4 nombres (Llamadas pasadas sin resultado, Citas pasadas sin resultado, Por registrar, sin marcar) | "Llamadas sin resultado" | 357 |
| G-08 | media | Cita y agenda | Agendas, Agendas creadas, Citas de hoy, Llamadas, Agendas futuras | "Agendadas" (creación) y "Citas" (fecha de la cita) | 357 |
| G-09 | media | Mapeos de etiquetas | resultado de llamada en dos lugares ("No-show" con guion), tres vocabularios de semáforo, dos tablas de títulos de lista | un módulo por mapeo y un guardián | 357, 358 |
| G-10 | media | Calidad del lead | "Calidad", "Estado de llegada", `calificacion`; High/Mid/Low crudos con 3 variants de badge | `<InsigniaDeCalidad>` única | 358 |
| G-11 | media | Filtros | `owner`, `closer`, `leadQuality`, `calidad`, `leadValue`; tres componentes de fecha; `desde`/`hasta` viejos en Leads y nuevos en Calls; por defecto distinto por lista | parámetros en español con alias; un componente de fecha | 360 |
| G-12 | media | Formato | "62,5%" contra "5,00 %"; "COP 1.234" contra "1.234 COP" contra "$1.234 COP"; ROAS sin "×"; "—", "0", "Sin dato", "sin pauta" sin regla | `pct`, `cop`, `razon` únicos y la regla del vacío | 358 |
| G-13 | baja | Buscadores | `?q=` en Calls y Students; estado local en Leads y Deals; "celular" contra "teléfono" | uno solo | 360 |
| G-14 | baja | Rutas viejas | `dashboard/lista` y `hub/lista` | se borran el 14-nov | 361 |

## 4. Decisiones abiertas (de Mani, o de Mani con Pauta o Gerencia)

Ningún ticket las asume: cada uno lleva su valor por defecto propuesto y el argumento, y se frena ahí hasta que se decidan.

| # | Decisión | Propuesta y por qué | Ticket |
|---|---|---|---|
| DA-1 | ¿Una venta que después pasa a Cierre Perdido sigue contando como venta? | **Sí (por evento).** Es lo que ya dice `metricas.md` §1.4 y el ADR 0038, y lo que usan Ventas, Mes, escalera y ROAS; "vendidos que siguen vendidos" sería otra métrica con otro nombre | 352 |
| DA-2 | ¿Las ventas anteriores a `fecha_inicio_ventas` cuentan para la cohorte? | Decide Gerencia; hoy hay 5 en CA C3. Sin decisión, Cupos y Proyección usan la misma regla (la de Cupos, que no las descarta) para que al menos no difieran | 352 |
| DA-3 | ¿Cuál es "el" % de show de Hoy: por deal o por cita? | **Por deal** como cifra (es la del ADR 0079 y la de las tasas), por cita dentro de "Cómo se calcula" | 353 |
| DA-4 | ¿La unidad de agenda es la cita creada o el deal que agendó (las reagendas)? | Se decide con Pauta; afecta costo por agenda y horas | 353 |
| DA-5 | ¿El cumplimiento de "Cupos del día" se mide contra la meta de apertura del día? | **Sí**: el cociente de hoy no puede dividir por una meta que ya descontó lo de hoy | 352 |
| DA-6 | Menú: ¿Calls → Llamadas, Students → Estudiantes, Deals e Inbox? | Mínimo Calls y Students (no son vocabulario del negocio); Lead y Deal los decide Mani | 359 |
| DA-7 | Calidad High/Mid/Low: ¿se traduce? | Viene así del formulario; decide Gerencia | 358 |
| DA-8 | Backfill del gasto de Meta del 1 al 7-oct (escribe en la base) | Pide el ok de Mani; sin él, el ROAS de esos días sale "sin gasto" | 351 |
| DA-9 | Backfill del % de comisión de las 25 ventas sin % (escribe en la base) | Con el % vigente del programa el día de la venta; pide el ok de Mani | 356 |
