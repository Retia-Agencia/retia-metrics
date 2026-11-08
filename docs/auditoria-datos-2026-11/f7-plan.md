# F7: plan de tickets hijos del 385

> Ticket padre: `docs/tasks/385-mcp-integridad-de-tools-de-metricas.md`, §F7. Solo documentación: no crea archivos de ticket,
> no toca `docs/tasks/README.md`, no escribe código ni migraciones. Escrito el 7-nov-2026 sobre `main @ 5acb6791`.
>
> **Fuentes:** `f0-linea-base.md` (reclasificación de 351 a 362), `f1-inventario.md` (H-01 a H-29), `f2-paridad.md` (F2-01 a
> F2-07), `f3-modelo-de-datos.md` (F3-01 a F3-19 y §6), `docs/contrato-metricas-y-datos.md` §8 (guardianes pendientes),
> `docs/diseno-registro-de-metricas.md` §6 y §7, ADR 0115 y 0120, y el estado de los archivos de ticket 351, 353, 354, 355, 358
> a 362. Lo que no pude verificar va marcado **a verificar**.
>
> **Decisiones de Mani del 7-nov que este plan obedece (385 §4):** registro tipado en código; números dorados sobre base
> sembrada; hechos primero; cifras antes de F4 y forma después de F5; se congelan las pantallas nuevas que usen ventas, leads
> o agendas hasta que se fijen los nombres.

## 0. Resumen

1. Hay **16 tickets hijos nuevos (388 a 403)**, uno por causa, y se **reubican** 351, 354, 355, 358, 359, 360, 361 y 375. El
   número 388 es el siguiente libre en `docs/tasks/` hoy; se re-verifica al crear cada archivo (otras sesiones pueden tomar
   números).
2. **Ninguna cifra principal está mal calculada** (F2 §1: 0 diferencias en 32 cifras por programa y periodo). Lo que da cifras
   falsas hoy es otra cosa: un dato que no se escribe al nacer (784 leads sin fecha, 21 %), un dato que no se captura (el 80 %
   de las citas sin resultado), tres ventas sin dueño y tres abonos con un closer que no existe. Por eso la primera ola es de
   escritura y captura, no de fórmulas.
3. **Siete migraciones con ADR** (M1 a M7 en §4), más una condicional. Todas las de DDL llevan `SET lock_timeout = '5s';` y
   exigen leer el SQL que genere `drizzle-kit`.
4. **Cada hijo migra a `lib/metricas/registro.ts` los conceptos que toca** (el trinquete de `lib/metricas/pendientes.ts` baja
   con cada uno; hoy 35). El 403 cierra lo que sobre. No hay un ticket gigante de "migrar el registro".

## 1. Regla de partición: una causa, un ticket

| Causa | Síntomas que cubre | Ticket |
|---|---|---|
| Lo que no se midió de F2 (metas, pauta, gasto, WhatsApp, CSV, otras nueve tools, mes en curso) | evita lo que F2 no vio | 388 |
| La ingesta y el alta no escriben lo que las métricas necesitan (N6) | F3-01, alta manual sin contacto, dos anclas de fecha del lead, 14 calificaciones que difieren | 389 |
| El resultado de la cita no se captura y la columna no distingue "no sé" | F3-02, F2-05, F2-04 (residuo tras el 353) | 390 |
| La identidad del closer vive en tres criterios y dos columnas | H-12, H-19, F3-05, F3-07 | 391 |
| Una venta tiene un predicado y seis recorridos | H-08, H-01 (parte de código) | 392 |
| El dinero se suma en varios lugares | H-05, H-20, H-21, F2-06 | 393 |
| La base no garantiza la frontera de programa | F3-03, F3-17 | 394 |
| La moneda es texto libre y la suma no está probada | F3-12 | 395 |
| Las cohortes pueden solaparse | F3-11 | 396 |
| Un concepto con dos significados lleva el mismo rótulo | F2-01, F2-02, F2-03, H-01 a H-06, H-09 a H-11, H-24, 354 alcance 3 | 397 |
| El diccionario y los docs contradicen al código | H-25 a H-28, F2-07 | 398 |
| Las tools del MCP exponen el objeto interno | F5.2, F5.3, F5.5 | 399 |
| Un rechazo de validación no queda en la bitácora y el periodo no acepta un mes | F5.4, caso del 7-nov | 400 |
| Columnas, tablas e índices sin lector | F3-04, 06, 13, 14, 15, 16, índices sobrantes | 401 |
| Tablas que crecen sin retención | F3-19 | 402 |
| El registro tipado está a medias | H-29, contrato §8 puntos 1 a 4 | 403 |

## 2. Tickets hijos nuevos

Formato: **depende** (tickets que deben estar `done`), **calientes** (archivos donde chocan dos sesiones), **migración** (ver
§4) y **Done cuando**. Toda lista de casillas termina con la de N8 del ADR 0115 (fila de `docs/metricas.md`, vocabulario de
`overview.md` §11, ADR afectado reescrito en el mismo commit) y con "ficha del concepto en el registro, y su línea borrada de
`lib/metricas/pendientes.ts` con el tope bajado" cuando el ticket toca un concepto del registro. Para no repetir, las llamo
**[N8]** y **[REG]**.

### 388. F2 tanda 2: paridad de lo que F2 no cubrió

- **Causa:** F2 midió ventas, dinero, agendas, shows y leads. No midió metas, ROAS y gasto convertido, Origen, WhatsApp y
  semáforo, CSV, Mi espacio, las otras nueve tools ni el periodo `mes_en_curso`. Sin esto el 355 y el 395 trabajan a ciegas.
- **Depende:** ninguno. Solo lectura (`BEGIN READ ONLY`, ref de la connection string verificado).
- **Calientes:** ninguno (solo `docs/auditoria-datos-2026-11/f2b-paridad.md`).
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] Reconstrucción independiente por SQL de metas del mes y de la cohorte, ROAS, gasto convertido (Comunicarte tiene COP y
        USD el mismo programa), Origen, costo por agenda del semáforo y los tres CSV, contra lo que muestran Hub, MCP y WhatsApp.
  - [ ] Verificado que ninguna suma agrupa Comunicarte COP con Comunicarte USD (insumo del 395).
  - [ ] Cuántas ventas caen antes del primer día de gasto (cobertura del ROAS) por programa, y cuántos envíos pagos no tienen
        `utm_id` (F3-09), con conteo.
  - [ ] Impacto de los 784 leads sin fecha en "Leads" y en las tasas por lead, por programa y mes (insumo del 389).
  - [ ] Divergencias nuevas con su clase y severidad; si alguna es crítica, se abre ticket antes de seguir la ola 1.

### 389. Lead bien escrito al nacer

- **Causa:** el parcial de Typeform no trae `fecha_envio` y el lead no la hereda. `fechaAnclaLead()` no tiene fallback y
  `lib/queries/leads.ts:138` sí (`coalesce(..., created_at)`): dos anclas para el mismo concepto. Es la regla N6 (lo que una
  métrica necesita se exige al escribir, no se parcha al leer).
- **Cubre:** F3-01 (784 leads, 21 %; 16 con venta vigente), los 18 leads de alta manual sin contacto de correo y 16 sin fila de
  teléfono (F3 §2.1, última fila), y las 14 calificaciones del resumen que difieren de la reconstrucción de F3 (a verificar si
  el desempate de `ingerir.ts` es el correcto antes de llamarlo defecto).
- **Depende:** 388 (mide el impacto antes de rellenar). Ok de Mani para la escritura de relleno.
- **Calientes:** `lib/ingesta/ingerir.ts`, `lib/queries/metricas-filtros.ts` (`fechaAnclaLead`), `lib/queries/leads.ts`, alta
  manual en `lib/leads/` (a verificar la ruta).
- **Migración:** M1 (relleno) y M2 (`CHECK`). ADR 0121.
- **Done cuando:**
  - [ ] La ingesta escribe `fecha_primera_aplicacion` desde el envío o desde `created_at` del sobre, con test del parcial sin
        `fecha_envio`.
  - [ ] Un solo ancla de fecha del lead, importada por la métrica y por la lista Leads; grep limpio del `coalesce` suelto.
  - [ ] El alta manual escribe su contacto de correo y teléfono por `ingerirEntradas`; 0 leads sin contacto.
  - [ ] Test de paridad de `calificacion` del resumen contra sus envíos, con el caso de desempate.
  - [ ] Relleno aplicado (784 filas, solo donde es nula), conteo antes y después, y `CHECK` validado.
  - [ ] [N8] [REG] `leads` queda como concepto con su ancla única (el nombre visible lo fija el 397).

### 390. Captura del resultado de la cita

- **Causa:** `calls.resultado` es `NOT NULL DEFAULT 'agendada'`, así que "agendada" y "no sé qué pasó" son el mismo valor. 730
  citas pasadas siguen así (610 de octubre); en octubre solo 158 de 784 tienen resultado. Los % de show y de cierre salen
  sobre el 15 a 20 % restante y el Hub los marca "parcial".
- **Es de captura, no de fórmula** (F2-05). El 353 ya dejó el predicado en `lib/deals/resultados-de-llamada.ts` y unificó
  Inbox y bandera. **A verificar antes de abrir:** si F2-04 (la cita suelta sin resultado no cuenta como "por marcar" y las de
  deals ya cerrados quedan fuera: Confianza 34 contra 38) sigue vigente tras el 353; si no, queda solo la captura.
- **Depende:** 353 (hecho). Sin migración, por decisión de F3 §1 (derivar "sin resultado" = `agendada` con `fecha_agenda`
  pasada).
- **Calientes:** `lib/deals/resultados-de-llamada.ts`, `components/` de acciones de llamada, `lib/queries/inbox.ts`,
  `lib/mi-espacio/notificaciones.ts`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] Decisión de Mani registrada: ¿la cita suelta sin resultado cuenta como "por marcar"?
  - [ ] Un mecanismo de captura que empuje al closer a marcar (recordatorio en Mi espacio o la bandeja, con conteo por
        closer); no una reja que bloquee, porque un cobro real no se frena por un dato de configuración (misma lógica del ADR
        0034).
  - [ ] La cobertura sube medida: citas pasadas sin resultado por semana antes y después, por programa.
  - [ ] El Hub dice "parcial" con base y faltan en toda razón que dependa del resultado (cierra con el 351).
  - [ ] [N8] [REG] `citas_pendientes`, `llamadas_sin_resultado`.

### 391. Closer: una pregunta y un dato

- **Causa:** "closer" significa tres cosas (quien tomó la llamada, el dueño del deal, quien registró el abono) y hay dos
  columnas de identidad por llamada y por abono (texto y FK). `embudoPorCloser` repite inline los cinco `count ... filter` de
  `embudoDelRango`.
- **Cubre:** H-12, H-19, C-16 del 30-oct, F3-05 (3 abonos con `closer_id` texto sin usuario resoluble: closers fantasma en el
  comparativo), F3-07 (3 ventas vigentes sin `owner_user_id`, deals migrados de Comunicarte C3: la comisión no se puede
  atribuir).
- **Dos fases en el mismo ticket, porque una es de datos y otra de código:**
  - **Fase A (datos, sin código, puede ir en la ola 1):** corregir los 3 abonos y asignar dueño a las 3 ventas. Escritura de
    producción con el ok de Mani, por `crearConRastro`/`editarConRastro` y no por `UPDATE` a mano.
  - **Fase B (código, después del 392 y el 393):** una sola definición de "closer" por métrica, documentada, y
    `embudoPorCloser` construido sobre `embudoDelRango`.
- **Depende:** A: ninguno. B: 392, 393 (comparten `dashboard.ts` y `metricas-filtros.ts`).
- **Calientes (fase B):** `lib/queries/dashboard.ts`, `lib/queries/metricas-filtros.ts` (`filtroLlamadas`, `filtroCierres`,
  `filtroCaja`), `lib/closers/identidad.ts`, `components/dashboard/operacion.tsx`.
- **Migración:** M3 (`CHECK` de venta con dueño, después de la fase A). ADR 0122.
- **Done cuando:**
  - [ ] Fase A: 0 abonos con closer sin usuario; 0 ventas vigentes sin dueño; cada escritura con su fila en `change_log`.
  - [ ] `CHECK` aplicado y probado (una venta sin dueño se rechaza; una anulada sin dueño no).
  - [ ] Cada métrica con closer declara en su ficha cuál de los tres criterios usa; el comparativo dice el criterio.
  - [ ] Test: `embudoPorCloser` suma lo mismo que `embudoDelRango` sin filtro (paridad N2).
  - [ ] [N8] [REG].

### 392. Venta: un solo recorrido

- **Causa:** el predicado es uno (`etapaVendida`) pero hay seis recorridos: `vendidosEn` y `ventasConDiaEn` son la misma consulta
  con otra proyección; `series-dinero.ts:71-76` vuelve a filtrar; `ficha-deal.ts:732` define "vendido" como abono o etapa;
  `ventasDelPrograma` no tiene rango; `cerradosEn` usa otra regla de reapertura; `tasas-del-grupo.ts:168` y
  `embudo-etapas.ts:379-386` reimplementan en memoria.
- **Cubre:** H-08 y la mitad de código del caso 0 (H-01). Hoy dan lo mismo (F2); el riesgo es la divergencia futura, y es
  justo el error medido el 30-oct.
- **Depende:** 351 (comparte `tasas-del-grupo.ts`), 353 (hecho).
- **Calientes:** `lib/queries/metricas-filtros.ts`, `dashboard.ts`, `series-dinero.ts`, `tasas-del-grupo.ts`,
  `embudo-etapas.ts`, `ficha-deal.ts`, `escalera.ts`, `hechos/venta.ts`, `tests/venta-una-definicion.test.ts`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] Una función de venta con día; `vendidosEn` o `ventasConDiaEn` se borra (N7); grep limpio.
  - [ ] Cada uno de los otros recorridos importa esa función o declara en su ficha por qué no (`cerradosEn` es otro concepto:
        Close date).
  - [ ] "Vendido" de la ficha del deal sale del mismo predicado que Students y el Hub.
  - [ ] Los números dorados de F0 y `tests/venta-una-definicion.test.ts` quedan idénticos; el test de la serie diaria coincide
        con `filtroCierres`.
  - [ ] [N8] [REG] `cupos_vendidos`, `llevamos`.

### 393. Dinero: una sola suma

- **Causa:** el mismo conjunto de ventas se suma varias veces: `contratadoDelRango` y `dineroDeVentas` (`vista-dashboard.ts`
  233, 260), la suma de la lista (`metricas-con-filas.ts:369,374`) y los componentes (`hoy/dinero.tsx:30`, `secciones.tsx:73`,
  `tabla-de-origen.tsx:41`). Students trata la venta sin valor distinto del Hub (F2-06, latente: hoy 0 ventas sin valor).
- **Cubre:** H-05, H-20, H-21, F2-06.
- **Depende:** 392. Ok de Mani sobre qué hace Students con una venta sin valor vendido (el Hub la excluye; Students suma su
  abonado).
- **Calientes:** `lib/queries/dinero-de-ventas.ts`, `saldo.ts`, `dashboard.ts`, `vista-dashboard.ts`,
  `metricas-con-filas.ts`, `estudiantes-totales.ts`, `components/dashboard/hoy/dinero.tsx`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] `dineroDeVentas` es la única suma; ningún componente suma una lista de ventas; ningún `sum(abonos.monto)` fuera de
        `saldo.ts` (el guardián de `saldo-centralizado` ya lo vigila).
  - [ ] Test de paridad con el caso que las haría divergir: una venta sin valor vendido, en Hub, Students y lista.
  - [ ] Los números dorados de dinero no cambian.
  - [ ] [N8] [REG] `comision`, `cupos_con_caja`.

### 394. El programa lo garantiza la base

- **Causa:** la frontera de programa en tablas hijas (`lead_contactos`, `deals`, `calls`, `abonos`) vive solo en el código;
  `programs` borra en cascada hacia `leads`, `deals`, `calls`, `abonos`, `cohorts` y `sources`, contra "no se borra lo que ya se
  usó" (ADR 0026).
- **Cubre:** F3-03, F3-17. Hoy 0 filas divergen: la migración no limpia nada, endurece.
- **Depende:** ninguno; una de las migraciones más riesgosas, va después de la ola 2 de código para no chocar con otros
  cambios de esquema.
- **Calientes:** `lib/db/schema.ts`, `drizzle/`, `tests/modelo-crm-indices.test.ts`.
- **Migración:** M4 (FK compuestas) y M5 (`ON DELETE restrict`). ADR 0123.
- **Done cuando:**
  - [ ] `UNIQUE (id, program_id)` en `leads`, `deals`, `cohorts` y las FK compuestas de §6.2 de F3, con test que intenta
        insertar un hijo de otro programa y falla.
  - [ ] `programs` hacia hijos con `restrict`; un `DELETE` de programa falla con mensaje claro.
  - [ ] Antes de aplicar: `pg_stat_activity` sin transacciones largas, SQL leído línea por línea, código desplegado.
  - [ ] [N8] ADR 0043 y 0048 enmendados (la frontera pasa a ser de la base).

### 395. Moneda: un `CHECK` y una regla de suma probada

- **Causa:** `moneda` es texto libre en seis tablas; solo `objetivos` tiene `CHECK`. Comunicarte tiene gasto en COP (890 filas) y
  en USD (126, desde el 23-oct) en el mismo programa.
- **Cubre:** F3-12. Regla de AGENTS.md: nunca convertir moneda en silencio.
- **Depende:** 388 (verifica que ninguna suma agrupa monedas antes de poner el `CHECK`).
- **Calientes:** `lib/db/schema.ts`, `lib/pauta/convertir-gasto.ts`, `lib/queries/saldo.ts`.
- **Migración:** M6. ADR 0124.
- **Done cuando:**
  - [ ] `CHECK` de `moneda` en `abonos`, `eventos_meta`, `enlaces_pago`, `cuotas_pactadas` (USD), `gasto_pauta` y
        `cuentas_publicitarias` (COP o USD), validado contra los datos de hoy.
  - [ ] Test: una suma que mezcla monedas no compila o devuelve error; el caso Comunicarte COP más USD cuadra.
  - [ ] Caso adversarial de F2 con abono en otra moneda y TRM, sobre base sembrada (producción no tiene ninguno).
  - [ ] [N8].

### 396. Cohortes: solape decidido

- **Causa:** hay dos solapes de ventana en el mismo programa (Tactical C2 y C3 el 28 y 29-sep; Confianza C1 y C2 del 16 al 20
  de noviembre) y ninguna restricción ni regla escrita de a qué cohorte va una venta de un día compartido.
- **Cubre:** F3-11.
- **Depende:** decisión de Mani (¿se permite el solape?).
- **Calientes:** `lib/db/schema.ts`, `docs/adr/0022-*`, `docs/metricas.md` (cohorte).
- **Migración:** M7, **condicional**: solo si Mani no permite el solape. Requiere `btree_gist` (**a verificar** que Supabase lo
  permita y que el flujo de migraciones de este repo lo aplique). ADR 0125, o enmienda al 0022 si se permite.
- **Done cuando:**
  - [ ] Decisión escrita. Si se permite: regla de qué cohorte toma una venta del día compartido, en el diccionario y con test.
  - [ ] Si no se permite: las dos parejas corregidas con ok de Mani y `EXCLUDE` aplicado.
  - [ ] [N8].

### 397. Un nombre por concepto: glosario y rótulos

- **Causa:** tres conceptos comparten rótulo con dos universos (ventas contra % de cierre, leads, agendas) y el vocabulario solo lo
  usan Hoy, Dinero y Metas; la lista detrás de la cifra, Comercial, Pauta, Origen, Mi espacio, WhatsApp y MCP tienen rótulos
  propios (H-24).
- **Cubre:** F2-01, F2-02, F2-03; H-01 a H-06, H-09 a H-11; la columna "Valor" del CSV de deals (que es `leads.lead_value`);
  **354 alcance 3** (decisión de Mani del 7-nov: dos cifras con nombre propio, "Envíos" por `hechos/envio.ts` y "Leads" por
  personas; `leadsDelRango` deja de llamarse así en pantalla).
- **Decisión pendiente de Mani antes de construir:** contra cuál de las dos se mide la meta de leads por día.
- **Depende:** 389, 390, 392, 393 (para no rotular lo que va a cambiar de universo). 351 (hecho antes).
- **Calientes:** `lib/vocabulario-metricas.ts`, `docs/overview.md` §11, `app/(app)/p/[programa]/hub/lista/page.tsx` (mapa
  `titulos`), `components/dashboard/operacion.tsx`, `lib/reporte-whatsapp/mensaje.ts`, `lib/mcp/herramientas/metricas.ts`,
  `lib/deals/deals-para-csv.ts`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] Cada concepto con dos universos lo dice en su nombre ("Ventas del periodo" contra "Vendidas del grupo con cita", y
        Envíos, Leads y Agendas con su universo), en glosario, pantallas, WhatsApp y MCP.
  - [ ] El mapa `titulos` de la lista sale del vocabulario; no queda un literal con número fuera de él.
  - [ ] `rotulos-sinonimos-guardian` pasa de "ningún sinónimo nuevo" a "solo el nombre canónico" y vacía sus excepciones.
  - [ ] "Valor" del CSV de deals deja de ser `lead_value` o se renombra.
  - [ ] [N8] ADR 0115 (N4) enmendado si cambia la regla; [REG] `registros`, `leads`, `agendadas`, `citas`, `shows`, `no_asistio`,
        `asistencia`, `cierre_de_ventas`.

### 398. Diccionario y documentos al día

- **Causa:** el diccionario y los docs describen cosas que el código ya no tiene o no describen lo que existe.
- **Cubre:** H-28 (unas 22 métricas sin fila: Students, cartera vencida, cortesías, descuento, perdidos por motivo, banderas del
  pulso, alertas, ventas por cohorte, Inbox, calidad del lead, entre otras), H-25 (`metricas.md:422` dice que la cartera no
  existe y el código la mantiene), H-26 (`pauta-interina.ts:23-26` cita `analytics.md` §6, ya historia), H-27, F2-07 (AGENTS.md
  y ADR 0048 dicen 5 correos en dos programas; hoy son 49), comentarios que aún nombran `estados_llegada`, y la constante
  `'High'` de `lead_quality` documentada como frontera (F3 §3.2).
- **Depende:** ninguno (solo documentación; puede ir en la ola 0). Las filas nuevas de métricas con nombre ya fijado esperan al
  397 en lo que toca rótulos.
- **Calientes:** `docs/metricas.md`, `docs/overview.md` §11, `AGENTS.md`, `docs/adr/0048-*`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] Toda métrica visible tiene fila en el diccionario o está marcada como retiro pendiente con su ticket.
  - [ ] Ningún doc contradice al código en cartera, cifra de correos o fórmulas de Pauta (grep).
  - [ ] `docs/manuales/mapa-crm.html` regenerado si cambia overview §4 (regla de AGENTS.md).
  - [ ] [N8].

### 399. MCP: salida con nombres de negocio y descripciones estándar

- **Causa:** cada tool devuelve el objeto interno de la vista (`dinero.ventas`, `embudo.cierres`, `contratadoUsd`) y escribe su
  texto a mano; la IA cita nombres de backend y mezcla "shows" (llamadas) con "Show" (deals).
- **Cubre:** F5.2, F5.3, F5.5. Coordina con el 386 (mismo método para las tools de operación) y con el frente B del 387.
- **Depende:** 397 (nombres), 403 parcial (el registro es la fuente del `outputSchema`; basta con los conceptos que las tools
  exponen).
- **Calientes:** `lib/mcp/herramientas/*.ts`, `lib/mcp/instrucciones.ts`, `docs/mcp.md`, `tests/mcp-contrato.test.ts`,
  `tests/mcp-guardian.test.ts`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] `outputSchema` por tool, con nombre de negocio y descripción por campo, derivado del registro y no escrito a mano.
  - [ ] Las once tools con descripción que empieza por cuándo usarla, `title` legible y anotaciones completas (`docs/mcp.md` §4).
  - [ ] `EXPLAIN` a 10 veces el volumen y test de paridad contra la pantalla por tool.
  - [ ] Segunda medición del descubrimiento (15 a 20 preguntas reales) comparada con la primera (se hace en el 387 frente B).
  - [ ] [N8].

### 400. MCP: rechazos de validación auditados y mes concreto

- **Causa:** el 7-nov una llamada falló porque el modelo mandó `periodo: "octubre"`; el esquema la rechazó antes del handler y
  no quedó en `mcp_llamadas`. Y el periodo no acepta un mes concreto.
- **Cubre:** F5.4.
- **Depende:** ninguno (solo `lib/mcp/`); puede ir en la ola 0.
- **Calientes:** `lib/mcp/` (registro de llamadas, esquema de periodo), `lib/periodo.ts`.
- **Migración:** ninguna prevista. **A verificar:** si `mcp_llamadas` (`lib/db/schema.ts:2807`) necesita una columna para marcar
  el rechazo; si sí, entra a la cola como M8 con su ADR.
- **Done cuando:**
  - [ ] Todo rechazo de validación queda en la bitácora con quién, qué tool y qué campo falló (sin guardar datos personales).
  - [ ] `AAAA-MM` aceptado como periodo, con test en Bogotá y mes de 28, 30 y 31 días.
  - [ ] Test forjado: una llamada con `periodo` inválido deja una fila.
  - [ ] [N8] `docs/mcp.md` actualizado.

### 401. Retiro de lo muerto en la base

- **Causa:** columnas, tablas e índices que el código ya no lee o que nunca se llenaron (N7: reemplazar es borrar).
- **Cubre:** F3-04 (`calls.cohort_id`, `calls_cohorte_closer_idx`), F3-05 segunda mitad (`calls.closer_id` y su fallback en 4
  módulos, tras el 391), F3-06 (`leads.estado`, `leads.cohort_id` y 9 columnas de perfil), F3-13 (`submissions.posicion_en_hoja`,
  `version_puntaje`, `estado_hoja`), F3-14 (`users.calendly_email`, `programs.record_personas_por_dia_habil`), F3-15 (`sync_runs`,
  `change_log.sync_run_id`, `estadoSyncEnum`), F3-16 (`canales`, `areas`, `formatoUtmEnum`), `calls.motivo_perdida`, y los índices
  sobrantes `leads_cohorte_idx` y `leads_programa_estado_idx`.
- **Decisión previa de Mani:** F3-08, `leads.pais` lo lee `lib/meta-capi/enviar.ts:30` y está vacío en 3.760 leads: ¿se llena en la
  ingesta o se quita la lectura? Define si `pais` entra a la lista de columnas muertas.
- **Depende:** 361 (el código deja de leer primero), 391 (para `calls.closer_id`), 389 (la ingesta ya no escribe campos muertos).
- **Calientes:** `lib/db/schema.ts`, `drizzle/`, `lib/queries/fuentes.ts`, `lib/catalogo/canales.ts`, `lib/catalogo/areas.ts`,
  `lib/ingesta/mapeo-webhook.ts`, `lib/sheets/`, `tests/columnas-sin-lector-guardian`.
- **Migración:** M9 a M14, una por grupo para poder revertir (§4). ADR 0126.
- **Done cuando:**
  - [ ] Por cada grupo: el código deja de leer y escribir, se despliega, y solo después va la migración.
  - [ ] El `drizzle-kit generate` de cada grupo leído a mano (los `DROP TABLE ... CASCADE` y los renombres falsos son el riesgo
        conocido, caso 0020).
  - [ ] `change_log` conserva su historia (444 filas de `deal_actividades`, 130 de `canales`).
  - [ ] `columnas-sin-lector-guardian` sin excepciones zombi.
  - [ ] [N8].

### 402. Retención de entregas y notificaciones

- **Causa:** `sobres_crudos` (22 MB, 8.015 filas) solo purga las rechazadas a los 90 días; `notificaciones_calendly` tiene 1.112
  de 1.115 sin leer y sin retención.
- **Cubre:** F3-19. No urge: es crecimiento, no cifra falsa.
- **Depende:** ninguno.
- **Calientes:** `lib/ingesta/`, cron de purga, `lib/calendly/`.
- **Migración:** ninguna prevista (purga por job). ADR 0127 con la política (cuánto se conserva y por qué).
- **Done cuando:**
  - [ ] Política escrita y aplicada por un job con test; el crudo de una entrega procesada con firma válida no se pierde antes
        del plazo (regla de AGENTS.md: nunca perder un envío con firma buena).
  - [ ] [N8].

### 403. Registro tipado completo y diccionario generado

- **Causa:** el ADR 0120 dejó un esqueleto con 5 conceptos y 35 pendientes. Cada hijo migra los suyos; este cierra el resto.
- **Cubre:** H-29, contrato §8 puntos 1 a 4 (registro contra diccionario, un guardián por concepto, dorados ampliados,
  endurecer los guardianes).
- **Depende:** 397 y los hijos que toquen conceptos (389 a 393, 351, 355).
- **Calientes:** `lib/metricas/registro.ts`, `pendientes.ts`, `docs/metricas.md` §3.0 y §3.1, `tests/registro-de-metricas.test.ts`.
- **Migración:** ninguna.
- **Done cuando:**
  - [ ] `PENDIENTES_DE_REGISTRO` vacío y `TOPE_DE_PENDIENTES` en 0; el trinquete se retira o queda en 0.
  - [ ] §3.1 de `docs/metricas.md` sin las columnas que ya genera §3.0.
  - [ ] Números dorados ampliados a gasto y ROAS, semáforo y CSV, sobre base sembrada.
  - [ ] Un guardián por concepto que hoy no lo tiene: show y ocurrió, cita sin resultado, lead y registro, agenda, "sin UTM".
  - [ ] Funciones inexistentes o sin llamador de H-29 (`tasaDelDia`, `hechos/abono.ts`, `hechos-embudo.ts`, `embudoPorCanal`,
        `dealsPerdidosPorMotivo`, `periodoAnterior`, `colorDeCupos`) borradas o con su llamador.
  - [ ] [N8].

## 3. Tickets abiertos que se reubican

| Ticket | Estado real (F0 y tracker del 7-nov) | Qué se hace | Dónde queda |
|---|---|---|---|
| 351 Toda razón con su cobertura | Parcial: cobertura en ROAS y costo por agenda, un convertidor de gasto, backfill del gasto hecho. Faltan 2 casillas: el % de show devuelve el tipo (ahora posible, el 353 está hecho) y ninguna tarjeta recibe un `number` suelto (costo por agenda, Hoy y Comercial) | Se ejecuta tal como está. Es la primera pieza de la ola 1; el guardián `razon-con-cobertura-guardian` tiene 26 razones sin cobertura de excepción y debe bajarlas | Ola 1 |
| 354 Cada hecho con su día | Alcances 1, 2, 4, 5 y 6 hechos y casillas marcadas; sigue `todo` en tracker y archivo | **Alcance 3 sale a 397** (decisión del 7-nov: Envíos y Leads con nombre propio). Con eso, 354 se cierra `done` y el tracker queda igual al archivo (N9). Desbloquea el 355 | Cierre con el 397; la propuesta de cierre es del coordinador |
| 355 Pauta: un cargador y una tabla | Vigente sin empezar; depende de 351 a 354 | Se amplía: crear `lib/queries/hechos/gasto.ts` (falta, contrato §7), unificar las anclas del ROAS (agendas sin ancla de fecha de cita, ventas de cualquier fecha: H-02, H-18), borrar `pauta-interina` y `categoriaDe`. Ancla el recorrido de ROAS a lo que mida el 388 | Ola 1, después de 351 y 388 |
| 358 Formato único y regla del vacío | Vigente con alcance reducido (el Hub lo hizo el 374). `depends: [357]` apunta a un ticket reemplazado: corregir a 374. Espera DA-7 de Gerencia | Sin cambio de alcance; helpers locales de porcentaje (H-23) y `lib/format.ts` | Ola 3, después de 397 |
| 359 La pantalla sin jerga | Vigente reducido (Hub: 374; Comercial: 372). Mismo `depends` roto. Espera DA-6 de Mani | Su guardián de jerga se amplía fuera de las carpetas del Hub | Ola 3, después de 397 |
| 360 Filtros: un nombre por parámetro | Vigente sin empezar para las cinco listas operativas; los filtros del Hub son del 377 | Sin cambio. Tres componentes de fecha por unificar | Ola 3 (independiente, pero decisión 5 lo manda a "forma") |
| 361 Retiro de lo muerto y guardián del diccionario | Parcial: `/ajustes/canales` ya redirige; el guardián del diccionario ya existe (`diccionario-llamadores-guardian`) | Se reduce al **retiro en código** (H-29, `canales-admin`, `proxima-fase`, `perfil-propio`, comentarios de `estados_llegada`); la parte de base pasa al 401 | Ola 4, antes del 401 |
| 375 ROAS que espera sus citas | `todo`, fase 2, trae migración propia | Sin cambio, **depende ahora también del 355 ampliado**; su migración entra a la cola antes que M1 (ya está comprometida; coordinar el número) | Después del 355 |
| 353 La llamada | `done` 7-nov, falta checkpoint verde | Sin cambio; el 390 y el 403 heredan sus pendientes | Cerrado |
| 351 y 354 pendientes del 30-oct (C-02, C-13) | C-02 (cobertura del resultado) es de captura: pasa al 390. C-13 (envíos pagos sin `utm_id`) es de captación: lo mide el 388 y no es de esquema (F3-09) | | 390, 388 |

## 4. Cola de migraciones

**Reglas de la cola (AGENTS.md y `docs/plan-reparto.md` §1):** una migración abierta a la vez; la aplica la sesión principal de
Mani; ningún subagente corre `db:generate` ni `db:migrate`; el SQL de `drizzle-kit generate` se lee antes de aplicar; si la
migración quita columnas, el código sin ellas se despliega primero; un `CHECK` nuevo se crea después de arreglar los datos; un
ensayo contra producción no se deja abierto; antes, `pg_stat_activity` sin transacciones largas. Hay un solo proyecto de
Supabase y es producción: mirar el ref (`hfqmiyiuyqapdsbywrag`) dentro de la connection string. El último archivo hoy es
`0117_mcp-tokens-y-llamadas.sql`; **el número real se toma al generar** (el 375 tiene una migración comprometida y puede haber
otras).

Marcas: **LEER** = leer el SQL de `drizzle-kit generate` línea por línea (siempre; aquí marco las de riesgo especial).
**LOCK** = `SET lock_timeout = '5s';` al inicio (DDL sobre tabla caliente).

| Orden | Migración | Ticket | ADR | LEER | LOCK | Riesgo y nota |
|---|---|---|---|---|---|---|
| M0 | La de ROAS del 375 | 375 | la suya | sí | sí | Ya comprometida; va primero y reserva su número |
| M1 | Relleno de `leads.fecha_primera_aplicacion` donde es nula (784 filas) | 389 | 0121 | sí | no (solo `UPDATE`), pero fila a fila y con conteo antes y después | Escribe producción: ok de Mani. Solo donde es nula, `min(coalesce(fecha_envio, created_at))` de sus envíos |
| M2 | `CHECK` de fecha en leads de formulario | 389 | 0121 | sí | sí | `ADD CONSTRAINT ... NOT VALID` y luego `VALIDATE`; después de M1 |
| M3 | `CHECK` de venta con dueño en `deals` | 391 | 0122 | sí | sí | Después de la fase A (datos); anulada sin dueño sigue permitida |
| M4 | `UNIQUE (id, program_id)` y FK compuestas | 394 | 0123 | **sí, riesgo alto** | sí | `drizzle-kit` suele expresar el cambio de FK con `DROP`/`ADD` en orden dudoso. `CREATE UNIQUE INDEX CONCURRENTLY` no corre dentro de la transacción de una migración: **a verificar** cómo lo aplica este repo (migración aparte o índice normal en tabla pequeña) |
| M5 | `ON DELETE restrict` desde `programs` | 394 | 0123 | sí | sí | Migración separada de M4 para poder revertir |
| M6 | `CHECK` de `moneda` en seis tablas | 395 | 0124 | sí | sí | Después del 388 y de verificar los datos de hoy |
| M7 | `EXCLUDE` de solape de cohortes | 396 | 0125 | sí | sí | **Condicional** a la decisión de Mani; requiere `btree_gist` (**a verificar** en Supabase); corregir antes las dos parejas |
| M8 | Columna de rechazo en `mcp_llamadas` | 400 | propio | sí | sí | **Condicional**, a verificar si hace falta |
| M9 | Retiro `leads`: `estado`, `cohort_id`, 9 columnas de perfil, índices `leads_cohorte_idx` y `leads_programa_estado_idx` | 401 | 0126 | **sí** | sí | El código sin ellas antes; `drizzle` pide columnas por nombre en cada `select()`. Confirmar antes que `leads_programa_email_idx` cubre las lecturas por `program_id` |
| M10 | Retiro `calls`: `cohort_id`, `closer_id`, `motivo_perdida`, índice `calls_cohorte_closer_idx` | 401 | 0126 | sí | sí | Después del 391 |
| M11 | Retiro `submissions`: `posicion_en_hoja`, `version_puntaje`, `estado_hoja` | 401 | 0126 | sí | sí | `estado_hoja` es copia de `calificacion`: primero cambiar los lectores |
| M12 | Retiro `users.calendly_email` y `programs.record_personas_por_dia_habil` | 401 | 0126 | sí | sí | Quitar antes la lectura de `scripts/seed-datos.ts` |
| M13 | Retiro `sync_runs`, `change_log.sync_run_id`, `estadoSyncEnum` | 401 | 0126 | **sí** | sí | Riesgo de `DROP TABLE ... CASCADE` en el SQL generado (caso 0020); la lectura de `lib/queries/fuentes.ts` se quita antes |
| M14 | Retiro `canales`, `areas`, `formatoUtmEnum` | 401 | 0126 | **sí** | sí | `change_log` conserva su historia; quitar molde, scripts de carga y `ajustes/areas` antes |

Los números de ADR (0121 a 0127) son los siguientes libres hoy (el último es el 0120); se re-verifican al escribir cada uno. El
402 lleva ADR sin migración. Cada ADR reescribe en el mismo commit su título y el índice de `docs/adr/README.md` (N8).

**No se abren, con su condición de apertura:**

- Ancla de fecha materializada y sargable, y los índices `(program_id, fecha_agenda)` en `calls`, `(source_id, created_at)` en
  `submissions` y `(a, fecha)` parcial en `deal_etapa_historial`: solo cuando un `EXPLAIN ANALYZE` en una réplica supere un
  presupuesto medido (F3 §7; a 10 veces el volumen ninguna consulta de las cuatro revisadas pasa de decenas de milisegundos).
- F3-09 (`utm_id` crudo no numérico, 301 sin objeto, 1.409 envíos pagos sin `utm_id`) y F3-10 (25 campañas con nombre repetido):
  no son de esquema; el dato crudo no se reescribe (ADR 0004) y el aviso `campana_ambigua` es el diseño.
- F3-18 (444 filas de `change_log` de `deal_actividades` sin fila): es historia; sin FK posible (referencia polimórfica).
- Tablas sin uso pero con función construida (`cuotas_pactadas`, `enlaces_pago`, `recursos`, `miembros_programa_calendly_extra`,
  `deals.acuerdo_pago`, `handoff_en`, `cohorte_destino_*`): se mantienen; vigilar.

## 5. Orden sugerido y olas

Criterio: primero lo que da cifras falsas o incompletas hoy; luego duplicados (latentes); luego nombres; luego limpieza. Dentro de
cada ola, los tickets que comparten archivos calientes van en serie y los demás en paralelo. Cada ola termina en un
checkpoint verde de CI (`docs/plan-reparto.md` §6), y los números dorados no cambian salvo en el ticket que lo declara.

**Ola 0, sin código en conflicto (puede empezar ya).** 388 (lectura), 398 (docs), 400 (solo `lib/mcp/`), decisión de Mani sobre
396 y sobre F3-08.

**Ola 1, cifras falsas o incompletas.**
- En paralelo (archivos distintos): 389 (ingesta y lead), 390 (captura), 391 fase A (datos), 351 (razones; toca `tasas-del-grupo`
  y `cobertura`).
- Después de 351 y 388: 355 (pauta, amplía). Después de 355: 375.
- Migraciones de la ola: M0, M1, M2 (389), M3 (391 A).

**Ola 2, duplicados.**
- En serie (comparten `dashboard.ts` y `metricas-filtros.ts`): 392, luego 393, luego 391 fase B.
- En paralelo con el bloque anterior: 395 (moneda), 396 (si Mani decide).
- 394 al final de la ola, cuando no haya otro cambio de esquema abierto.
- Migraciones: M6, M7 (cond.), M4, M5.

**Ola 3, nombres y forma.**
- 397, luego 399 (necesita el registro), y en paralelo 358, 359, 360 (cada uno con su espera de Gerencia o Mani: DA-7, DA-6).
- 403 al final de la ola.

**Ola 4, limpieza.** 361 (código), luego 401 (base, M9 a M14), 402 (independiente).

```
388 ──► 389 ──┐
        390   ├──► 392 ──► 393 ──► 391B ──► 397 ──► 399 ──► (387 frente B)
391A ─────────┤                              │       403
351 ──► 355 ──► 375                          ├──► 358, 359, 360
395, 396, 394 (ola 2, esquema)               └──► 361 ──► 401 ──► 402
398, 400 (ola 0, libres)
```

## 6. Decisiones y oks que necesito de Mani

1. **F3-11:** ¿se permite el solape de cohortes? (396, M7.)
2. **F3-08:** ¿se llena `leads.pais` en la ingesta o se quita la lectura de CAPI? (401.)
3. **Ok de escritura en producción:** relleno de 784 leads (389), 3 abonos y 3 ventas sin dueño (391 A). Cada escritura con
   `change_log` y conteo antes y después.
4. **354 alcance 3:** contra cuál de las dos cifras (Envíos o Leads) se mide la meta de leads por día. (397.)
5. **F2-04:** ¿la cita suelta sin resultado cuenta como "por marcar"? A verificar primero si el 353 ya lo resolvió. (390.)
6. **393:** qué hace Students con una venta sin valor vendido.
7. **DA-6 y DA-7** (359 y 358): siguen esperando a Mani y a Gerencia.
8. **Proceso:** ¿creo los archivos de ticket 388 a 403 y actualizo `docs/tasks/README.md` en una sesión aparte, con el cierre del
   354 y la corrección de `depends: [357]` a 374 en el 358 y el 359?

## 7. Límites de este plan

- No leí línea por línea el código de `kanban.ts`, `inbox.ts`, `ficha-deal.ts` (F1 tampoco). Los tickets 391 y 392 deben
  empezar releyendo esos archivos.
- Los archivos calientes salen de las referencias `archivo:línea` de F1 y F3 sobre el commit `10467f24`; algunas líneas pudieron
  moverse con el 353 y el registro tipado. Releer antes de repartir una ola.
- El conteo de lecturas de columnas muertas es por `grep` grueso (F3 §4); la lista de `columnas-sin-lector-guardian` es la que
  manda al borrar.
- Nada de esto se probó contra una base sembrada; las casillas "sobre base sembrada" dependen de los casos adversariales que
  F2 §3 dice que producción no tiene (7 de 11).
