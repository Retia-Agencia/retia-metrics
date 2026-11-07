# Auditoría 385, F3: modelo de datos, normalización e integridad

> Ticket: `docs/tasks/385-mcp-integridad-de-tools-de-metricas.md`, fase F3. Solo lectura: ninguna migración, ningún
> cambio de código. Las propuestas de esquema están **descritas**, no escritas; cada una pasa por ADR y por la cola de
> migraciones de `AGENTS.md` (leer el SQL de `drizzle-kit generate`, `SET lock_timeout`, código primero, migra la sesión
> principal).

## 0. Método, fuentes y límites

- **Base:** producción (único proyecto, ref `hfqmiyiuyqapdsbywrag`, verificado dentro de la connection string antes de cada
  corrida). Sesión con `default_transaction_read_only = on`; solo `SELECT` y `EXPLAIN` sin `ANALYZE`.
- **Fecha de la foto:** 7-nov-2026. Las estadísticas de uso de índices (`pg_stat_user_indexes`) corren desde
  **2026-08-25** (74 días). Todo conteo sale de un `SELECT` escrito a mano contra las tablas, no de `lib/queries/`.
- **Lo que no hice:** no corrí `EXPLAIN ANALYZE`, no probé a 10× el volumen (los planes de abajo son al volumen de hoy,
  donde el optimizador igual elige índices por tener pocas filas), no leí el texto de los ADR 0005, 0012, 0026, 0030, 0037,
  0038 y 0115 uno por uno: cito las reglas tal como las resumen `AGENTS.md` y los comentarios de `lib/db/schema.ts`.
  Lo que se deduce y no se midió va marcado **(inferido)**.
- **Volumen (filas, 7-nov):** `submissions` 5.749 · `leads` 3.760 · `lead_contactos` 7.506 · `deals` 3.764 ·
  `deal_etapa_historial` 5.797 · `calls` 1.087 · `abonos` 75 · `gasto_pauta` 2.465 · `pauta_objetos` 3.044 ·
  `cohorts` 10 · `users` 27 · `change_log` 59.580 · `sobres_crudos` 8.015 (22 MB, la tabla más pesada).
  Los hechos empiezan el **6-oct** (primer deal) y el gasto el **1-oct**: no hay historia anterior en el CRM.

## 1. Resumen ejecutivo

La base es sana donde importa: **0 huérfanos, 0 duplicados que un índice debería impedir, 0 sobrepagos, 0 ventas sin valor,
0 ventas sin cohorte, `deals.etapa` igual al último movimiento de su historial en los 3.764 deals, y el programa coincide
entre todas las tablas hijas y su padre**. Lo que hay es de otra clase: columnas que dejaron de significar algo, copias
que nadie lee, una fecha ancla que deja fuera al 21 % de los leads, y garantías que viven solo en el código.

| ID | Severidad | Hallazgo (conteo de producción) | Decisión propuesta |
|---|---|---|---|
| F3-01 | **Alta** | 784 leads (21 %) sin `fecha_primera_aplicacion`: solo tienen parciales de Typeform y el parcial no trae `fecha_envio`. `fechaAnclaLead()` no usa fallback, así que **salen de "leads del rango"**. Entre los 802 leads con fecha nula (784 de formulario y 18 de alta manual) hay 16 deals en venta vigente. Otro lector (`lib/queries/leads.ts:138`) sí hace `coalesce(..., created_at)`: dos anclas para el mismo concepto | Corregir: escribir la fecha al ingerir (N6); migración de relleno descrita en §6.1 |
| F3-02 | **Alta** | 730 citas ya pasadas, vigentes, siguen con `resultado = 'agendada'` (610 de octubre, 110 de noviembre; en octubre solo 158 de 784 tienen resultado). La columna es `NOT NULL DEFAULT 'agendada'`: "agendada" y "no sé qué pasó" son el mismo valor | Corregir en lectura (derivar "sin resultado" = agendada con `fecha_agenda` pasada) y exigirlo en captura; sin migración de datos |
| F3-03 | Media | Las garantías de programa en tablas hijas (`lead_contactos`, `deals`, `calls`, `abonos`) **viven solo en el código**: hoy 0 filas divergen, pero ninguna FK compuesta lo impide | Corregir: FK compuestas `(x_id, program_id)`; §6.2 |
| F3-04 | Media | `calls.cohort_id` vacío en 451 de 1.054 llamadas con deal (43 %), **0 lectores**; su índice `calls_cohorte_closer_idx` tiene 0 usos | Eliminar columna e índice (la cohorte de un hecho es la de su deal, `metricas-filtros.ts:279`) |
| F3-05 | Media | `calls.closer_id` (texto): **0 filas pobladas**, pero 11 lecturas en 4 módulos con fallback `claveCloserSql(fk, texto)`. `abonos.closer_id` (texto): 67 de 75 pobladas y **3 sin usuario que las resuelva** (closers fantasma en el comparativo) | Corregir los 3 abonos (con el ok de Mani), luego eliminar `calls.closer_id` y su fallback |
| F3-06 | Media | `leads`: `estado` 100 % `cola_setteo` (0 lectores), `cohort_id` 100 % nulo (0 lectores), `cargo`, `empresa`, `ciudad`, `pais`, `ingreso_declarado`, `urgencia`, `por_que_aplico`, `motivo_descarte`, `raw`: 0 filas pobladas. `traido_por_user_id`: 0 pobladas (aún no se usan enlaces de closer) | Eliminar las muertas (`estado`, `cohort_id` y 9 columnas); mantener `traido_por_user_id` |
| F3-07 | Media | 3 ventas vigentes sin dueño (`owner_user_id` nulo, deals migrados de Comunicarte C3): la comisión no se puede atribuir | Corregir los datos y luego un `CHECK` (§6.4) |
| F3-08 | Media | `leads.pais` lo lee `lib/meta-capi/enviar.ts:30` y está **vacío en 3.760 leads**: el evento Purchase a Meta nunca lleva país | Decidir: llenar `pais` en la ingesta o quitar la lectura (no es de esta auditoría arreglarlo) |
| F3-09 | Media | `utm_id`: 116 envíos con valor no numérico (`97760_v0_s00_e0_tv*`), 301 de 3.370 `utm_id` numéricos (8,9 %) no existen en `pauta_objetos` (95 en oct, 206 en nov) y 1.409 envíos pagos sin `utm_id` (1.329 en octubre, 19 en noviembre) | Mantener el dato crudo (ADR 0004); la cobertura la reporta F2. No es esquema |
| F3-10 | Media | 25 nombres de campaña repetidos dentro de un programa (`pauta_objetos`, nivel campaña) | Mantener: el aviso `campana_ambigua` es el diseño; Meta no impide el nombre repetido |
| F3-11 | Media | 2 solapes de ventana entre cohortes del mismo programa (Tactical C2/C3 el 28-29 sep; Comunicate con Confianza C1/C2 del 16 al 20 nov) y sin restricción que lo impida | Decidir con Mani si el solape es válido; si no, `EXCLUDE USING gist` (§6.5) |
| F3-12 | Media | Moneda en texto libre sin `CHECK` en `abonos`, `gasto_pauta`, `cuentas_publicitarias`, `eventos_meta`, `enlaces_pago`, `cuotas_pactadas`. Comunicarte tiene gasto en **COP (890 filas) y USD (126, desde el 23-oct)** en el mismo programa | `CHECK moneda IN ('USD','COP')` donde aplique; F2 verifica que ningún total sume monedas |
| F3-13 | Baja | `submissions`: `posicion_en_hoja` y `version_puntaje` 0 pobladas; `estado_hoja` es copia exacta de `calificacion` (3.011 de 3.011 iguales) | Eliminar `version_puntaje` y `posicion_en_hoja` (con su código); consolidar `estado_hoja` |
| F3-14 | Baja | `users.calendly_email` 0 pobladas y 0 lectores; `programs.record_personas_por_dia_habil` solo lo lee `scripts/seed-datos.ts` | Eliminar |
| F3-15 | Baja | `sync_runs` 0 filas (retirado el 28-sep), `change_log.sync_run_id` 0 pobladas, `estadoSyncEnum` sin lectores; 16 lecturas en `lib/queries/fuentes.ts` | Eliminar tabla, FK, enum y la lectura |
| F3-16 | Baja | `canales` (26 filas) y `areas` (3): la pantalla es un redirect (`app/(app)/ajustes/canales/page.tsx:8`) y la regla vive en `resolverCanal`; siguen con molde, scripts de carga y `change_log` (130 + 3 filas). `gasto_pauta.area` y `objetivos.area` usan texto con `CHECK`, no la FK | Eliminar con ADR (N7); el historial de `change_log` queda |
| F3-17 | Baja | `ON DELETE CASCADE` desde `programs` hacia `leads`, `deals`, `calls`, `abonos`, `cohorts`, `sources`: contradice "no se borra lo que ya se usó" (ADR 0026) que el resto del esquema respeta con `restrict` | Cambiar a `restrict` (§6.3) |
| F3-18 | Baja | `change_log`: 444 filas de `deal_actividades` hablan de filas que ya no existen. Causa (inferida): el único `DELETE` de esa tabla es `lib/migracion/deshacer.ts:146`. Más 63 filas de `estados_llegada` y 1 de `meta_conexiones` (tablas retiradas) | Mantener; es historia. Sin FK posible (referencia polimórfica) |
| F3-19 | Baja | `notificaciones_calendly`: 1.112 de 1.115 sin leer y sin retención; `sobres_crudos` 22 MB sin purga (solo las entregas rechazadas se purgan a los 90 días) | Definir retención antes de que crezca |

Lo que **no** es un problema aunque lo parezca (verificado): `num_aplicaciones` coincide con `count(distinct (source, token))`
en 3.742 de 3.742 leads; las fechas y el nombre del resumen del lead coinciden con sus envíos en el 100 %; el historial
de etapas no tiene cadenas rotas ni empates; los 2 abonos anulados sin motivo son legales desde el ADR 0117.

## 2. Forma normal y denormalizaciones

### 2.1 Denormalizaciones existentes, con las tres preguntas

| Copia | ¿Qué se rompe si se quita? | ¿Qué garantiza que no diverge? | ¿Test? | Medido hoy | Decisión |
|---|---|---|---|---|---|
| `lead_contactos.program_id` (de `leads`) | El índice único `(program_id, tipo, valor)` necesita la columna, no un join (`schema.ts:675`) | Un solo escritor (`ingerirEntradas`); **la base no lo impide** | Índice probado en `tests/modelo-crm-indices.test.ts`; **no encontré test de paridad copia contra fuente** | 0 de 7.506 divergen | Mantener y blindar con FK compuesta (§6.2) |
| `leads` resumen: fechas, `num_aplicaciones`, nombre, teléfono, calidad, valor, puntaje, calificación (de `submissions`) | Personas buscaría por envíos, y las tasas por persona exigirían agrupar siempre | Se **recalcula** al ingerir (`ingerir.ts:642`), nunca se teclea | `tests/ingesta-escritura.test.ts:106-154` cubre fechas y conteo | fechas 0 de 3.742 difieren; nombre 0; calidad, valor, puntaje 0; **calificación 14 difieren (inferido: mi desempate no replica el de la ingesta, revisar)** | Mantener; añadir test de paridad sobre calificación |
| `deals.etapa` y `deals.pendiente` junto a `deal_etapa_historial` | Todo el embudo y Students decidirían leyendo el último movimiento de una tabla de 5.797 filas | Único escritor `moverEtapa()`; sin trigger ni `CHECK` | `tests/mover-con-hecho.test.ts`, `tests/deshacer.test.ts` escriben ambas; **no vi un test que compare las dos sobre un conjunto** | 0 de 3.764 divergen en etapa y en pendiente; cadena `de`/`a` rota en 0 de 5.797 | Mantener; test de paridad (N2) |
| `deals.program_id` (de `leads`), `calls.program_id` (de `deals`), `abonos.program_id` (de `deals`) | El programa es frontera: cada lectura haría un join para acotar | Escritores en `lib/deals/` y `lib/calendly/`; **la base no lo impide** | Sin test de paridad hallado | 0 de 3.764, 0 de 1.054, 0 de 75 divergen | Mantener y blindar (§6.2) |
| `deals.cohort_id` y `calls.cohort_id` y `leads.cohort_id` | `deals.cohort_id` es la fuente de cohorte (`metricas-filtros.ts:279`) | Las dos últimas **no divergen: están vacías o sin lectores** | Ninguno | `calls`: 449 llamadas con deal con cohorte no la tienen; `leads`: 3.754 de 3.754 nulas | `deals`: mantener. `calls` y `leads`: eliminar |
| `calls.closer_id`, `abonos.closer_id` (texto, ADR 0030) frente a `closer_user_id` y `registrado_por_user_id` (FK) | Sin el texto, la historia importada de Sheets pierde quién cobró | Identidad por `lib/closers/identidad.ts`; unicidad en `users` por índice | `tests/closer-identidad.test.ts` | `calls.closer_id`: 0 pobladas. `abonos`: 41 con texto y FK a la vez, **0 discrepan**; 26 solo texto (historia), 3 sin usuario resoluble | `calls`: eliminar. `abonos`: mantener hasta corregir los 3 |
| Nombres de campaña y anuncio como texto en `submissions` (`utm_campaign`, `utm_content`, `utm_term`, `utm_id`) | Sería reescribir lo que la fuente mandó (ADR 0004) | El crudo **no** se normaliza a propósito; el emparejador lo resuelve en lectura | `tests/atribucion-emparejador.test.ts` | 301 `utm_id` sin objeto, 25 campañas con nombre repetido | Mantener (justificada) |
| `leads.estado_hoja` frente a `calificacion` en `submissions` | Nada: son el mismo dato dos veces | Ninguna | Ninguno | 3.011 de 3.011 iguales | Eliminar una |
| `lead_contactos` frente a `leads.email_normalizado` y `leads.telefono` | El correo del lead es la llave del dedup (ADR 0005) | Escritor único | `ingesta-escritura.test.ts` | 18 leads de alta manual no tienen contacto de correo; 16 tienen teléfono en `leads` y no en `lead_contactos` | Corregir el alta manual para escribir el contacto |

### 2.2 1FN, 2FN y 3FN por tabla de hechos

| Tabla | 1FN | 2FN / 3FN | Veredicto |
|---|---|---|---|
| `submissions` | `respuestas jsonb`: todo lo no promovido, con el encabezado como llave (ADR 0036). Es la excepción declarada a 1FN y se justifica: las preguntas cambian por formulario | `source_id` determina `program_id` (vía `sources`): no se copia, bien. `lead_quality`/`lead_value` dependen del envío, bien | Aceptable. Riesgo: lo que se promueve a columna (`utm_*`, `nombre`) y lo que queda en `respuestas` lo decide el adaptador |
| `leads` | `raw jsonb` sin uso | Los 8 campos de perfil (`cargo`..`por_que_aplico`) dependen del envío, no de la persona: están vacíos porque viven en `submissions.respuestas`. `calificacion`, `lead_quality`, `lead_value`, `puntaje` dependen del envío ganador: son el resumen declarado | Tabla más ancha de lo que usa: 11 columnas muertas (F3-06) |
| `lead_contactos` | Arreglo de contactos ya normalizado a filas: bien | `program_id` dependencia transitiva vía `lead_id` (denormalización declarada) | Correcta, con la salvedad de §6.2 |
| `deals` | Sin repetidos | `cohorte_destino_id` + `cohorte_destino_texto` son dos columnas para una misma idea con un `CHECK` que las ata; `valor_vendido_usd` y `comision_porcentaje` son valores **congelados** a propósito (no derivados) | Aceptable; 4 columnas sin uso en producción (§4) |
| `deal_etapa_historial` | `de`, `a`, `pendiente_de`, `pendiente_a`: pares antes/después, no grupo repetido | `user_id`, `motivo_id`, `reversion_id` son del movimiento, bien | Correcta |
| `calls` | `raw jsonb` solo en las de Calendly (1.007 de 1.078) y 1 lector (`inbox.ts`) | `closer_id` (texto) y `closer_user_id` (FK) duplican la identidad; `cohort_id` es transitiva vía `deal_id`; `calendly_host_email` depende de la cita | Tres columnas redundantes (F3-04, F3-05) |
| `abonos` | Sin repetidos | `program_id` transitiva vía `deal_id`; `comprobante_url` y `comprobante_archivo_id` son dos formas del mismo comprobante (65 de 75 sin ninguno) | Aceptable |
| `gasto_pauta` | Una fila por anuncio y día | `program_id` transitiva vía `pauta_objeto_id` → cuenta; `moneda` transitiva vía cuenta (**0 de 2.465 difieren**). Todas las filas son nivel anuncio y de origen `meta_api` | Correcta; `area` y `origen = 'manual'` sin filas |
| `pauta_objetos` | El árbol campaña, conjunto, anuncio por `padre_id_meta` (texto, no FK) | `program_id` transitiva vía `cuenta_id` (0 divergen); `padre_id_meta` no tiene FK ni índice | Aceptable: Meta puede entregar el hijo antes que el padre, por eso es texto |
| `cohorts` | Sin repetidos | Cada columna depende de la llave | Correcta |
| `users` / `miembros_programa` | `miembros_programa` ya es la tabla puente; `users.closer_id` es un alias de identidad | `calendly_email` vive por membresía y también (muerto) en `users` | `users.calendly_email` redundante |
| `change_log` | `valor_anterior` y `valor_nuevo` como texto serializado (`textoDeBitacora`) | `tabla`+`registro_id` son referencia polimórfica por diseño | Correcta para una bitácora |

## 3. Registro por tabla de hechos

Formato: **Garantías de la base** (unicidad, `CHECK`, FK con su `ON DELETE`, índices parciales, `NOT NULL`) · **Producción**
(conteos) · **Muertos** · **Índices**. Entre paréntesis, la fuente.

### 3.1 `submissions` (5.749)
- **Garantías:** único `(source_id, token, es_parcial)`; `source_id` `restrict`; `lead_id` `restrict` y **nulable a propósito** (1 parcial sin lead). `fecha_envio` nulable. Sin `CHECK` sobre `utm_*` ni sobre `es_parcial` con `fecha_envio`.
- **Producción:** casi todos los envíos son de octubre y noviembre (por `created_at`; 5.432 Typeform, 317 Form30x, 0 Dapta, y un puñado de junio, agosto y septiembre). **2.615 parciales (45 %) tienen `fecha_envio` nula**, todas de Typeform; las 3.000 completas siempre traen fecha. Centinelas: solo macros sin expandir (`{{campaign.name}}` 32, `{{ad.id}}` 4, `{{site_source_name}}` 4), ya contadas aparte por diseño. 0 fechas anteriores al año 2000, 0 futuras. `utm_medium` en 15 valores crudos (`cpc` 3.009, `paid_social` 1.769, `linktree` 367...); `utm_source` sin variantes de mayúsculas.
- **Muertos:** `posicion_en_hoja` 0 pobladas (22 referencias de código, restos de Sheets), `version_puntaje` 0 (4 refs, todas en `ingerir.ts`), `estado_hoja` copia de `calificacion`.
- **Índices:** `submissions_lead_idx` (1,17 M usos), `submissions_fuente_token_idx` (194 K). **Ningún índice sobre la fecha** (`fecha_envio`/`created_at`) ni sobre `utm_id`: las consultas de origen filtran por programa vía `sources` y luego filtran la fecha en memoria (plan X4 de §7). Al volumen de hoy es barato.

### 3.2 `leads` (3.760)
- **Garantías:** único `(program_id, email_normalizado)`; `program_id` `cascade` (F3-17); `traido_por_user_id` `restrict`; `cohort_id` `set null`. `estado` `NOT NULL DEFAULT 'cola_setteo'`.
- **Producción:** 0 correos mal normalizados (regex de forma y minúsculas), 0 teléfonos duplicados dentro de un programa, 0 fechas imposibles. **784 con `fecha_primera_aplicacion` nula** (F3-01): por programa y mes, Comunicarte 180+83, Confianza 232+68, Tactical 162+77, Second Brain 0 (inferido: Form30x trae fecha también en el parcial). 18 leads de alta manual (`entrada = 'crm'`), 0 con envío. `lead_quality`: High 1.449, Low 2.179, Medium 68, nulo 64. `calificacion`: `setteo_no_calificado` 1.539, `con_calendly` 990, nulo 1.231. 1 nombre nulo.
- **Muertos:** ver F3-06. `estado` y `leads_programa_estado_idx` solo sirven hoy como índice de `program_id` (3.295 usos, todos por `program_id`).
- **Texto que decide:** `lead_quality = 'High'` decide la etapa de entrada (ADR 0069). Es texto de Typeform comparado con un literal. Si el formulario cambia la etiqueta, todo cae a Registrado sin error (la alarma "sin calidad" cubre solo el nulo). Mantener texto (ADR 0004), pero la comparación vive en un solo lugar (`etapa-de-entrada.ts`).

### 3.3 `lead_contactos` (7.506)
- **Garantías:** único `(program_id, tipo, valor)`; `lead_id` `cascade`; `submission_id` `restrict`; `es_principal` sin índice único (**0 leads con dos principales hoy**, pero nada lo impide).
- **Producción:** 0 divergencias de programa contra el lead y 0 contra el envío; todos los correos en minúsculas y todos los teléfonos en dígitos, ninguno con menos de 7. 3.742 principales de correo y 3.727 de teléfono; 9 correos sin confirmar. 18 leads (alta manual) **sin ningún contacto de correo**; 16 con teléfono en `leads` sin fila de teléfono.
- **Índices:** `lead_contactos_valor_idx` 88 K usos, `lead_contactos_lead_idx` 136 K.

### 3.4 `deals` (3.764; 3.754 vigentes)
- **Garantías:** único parcial "un abierto por lead y programa" (0 violaciones; 3.754 leads con exactamente 1 deal vigente, 10 anulados); `CHECK` de valor no negativo, de porcentaje, de anulación completa y de "esperando corte"; `huella_migracion` único; FK a `leads`, `cohorts`, `users` todas `restrict`. `program_id` `cascade`.
- **Producción:** etapas: registrado 1.768, potencial 906, agendado 863, calificado 70, atendido 54, ganado_completo 39, ganado_parcial 28, cierre_perdido 19, compromiso_verbal 15, en_gestion 2, **contactado 0**. Ventas vigentes (parcial + completo) **67**: 0 sin valor, 0 con valor 0 sin cortesía, 0 con valor fuera de venta, 0 sin cohorte, 0 sin porcentaje de comisión; valor ≤ precio de la cohorte en todas (7 con descuento, 60 iguales). Perdidos sin motivo: 0. **Sin dueño: 301 vigentes** (potencial 122, registrado 109, calificado 66, ganado_completo 3); el estado "Unclaimed" es legítimo salvo las 3 ventas. 0 dueños inactivos, 0 dueños sin membresía en el programa. 1.585 con setter.
- **Anulados:** 10 deals, todos con quién, cuándo y motivo. 0 abonos vigentes colgados de un deal anulado.
- **Sin uso en producción (funciones existentes pero 0 filas):** `acuerdo_pago` 0, `cohorte_destino_id` 0, `cohorte_destino_texto` 0, `handoff_en` 0. `onboarded_at` 15, `fecha_limite_pago` 41, `fecha_seguimiento` 17. `pendiente`: reagenda 109, seguimiento 15, proxima_cohorte 0. `submission_origen_id` nulo en 18 (las altas manuales).
- **Cohorte de la venta:** 26 deals migrados desde Sheets (todos en C3 de Comunicarte y Tactical, 26 ventas); el resto nace desde el 6-oct. Las cohortes cerradas (C1 y C2) tienen **0 deals**: la historia anterior no está en el CRM.
- **Índices:** `deals_programa_etapa_idx` 78 K usos, `deals_owner_idx` 7 K, `deals_cohorte_idx` 1,2 K. `deals_uno_abierto...` lo exige la unicidad.

### 3.5 `deal_etapa_historial` (5.797)
- **Garantías:** `deal_id` `restrict`; sin `CHECK` (por ejemplo `de <> a` cuando no hay cambio de pendiente) ni índice sobre `(a, fecha)`.
- **Producción:** 0 deals sin historial; 0 deals cuya etapa o pendiente difiera del último movimiento; 0 cadenas rotas (`de` distinto de la `a` anterior); 0 empates de `fecha` dentro de un deal; 143 filas con `de = a` (son cambios de pendiente, legales por ADR 0070); toda venta tiene su movimiento a Ganado.
- **Índices:** `deal_etapa_historial_deal_idx` 1,53 M usos. `ventasConDiaEn` filtra por `a` y por la fecha de venta **sin índice propio**: hoy lee el historial de cada deal del programa (plan X2).

### 3.6 `calls` (1.087)
- **Garantías:** único `(program_id, huella_fila)` (las 9 llamadas `crm` no tienen huella, el índice las ignora por ser nulas); `CHECK` "una llamada nativa siempre tiene deal"; `CHECK` de anulación completa; `deal_id` `restrict`, `cohort_id` `set null`, `program_id` `cascade`.
- **Producción:** origen `calendly` 1.078 (33 sueltas sin deal, la bandeja de Inbox), `crm` 9; el origen por defecto `sheets` no tiene ninguna fila. 37 anuladas, todas con motivo. Resultados: **agendada 822** (todas con `fecha_llamada` nula), show 107, no_show 66, cancelada 64, reagendada 22, cerrada 6, **compromiso_pago 0, perdida 0**. 19 llamadas cuyo `closer_user_id` difiere del dueño del deal (esperable: setter contra host). 15 con `email_lead` que no es un correo del lead (esperable: el invitado de Calendly usa otro).
- **Muertos:** `closer_id` 0 pobladas; `cohort_id` sin lectores; `motivo_perdida` 0 pobladas (10 refs, todas históricas); valores de enum `compromiso_pago` y `perdida` sin filas.
- **Índices:** `calls_deal_idx` 155 K, `calls_huella_idx` 39 K (la usan como índice de `program_id`), `calls_closer_user_idx` 4,6 K, **`calls_cohorte_closer_idx` 0**. Ninguno sobre `fecha_agenda`: el embudo lo filtra con `(fecha_agenda AT TIME ZONE ...)::date`, expresión que ningún índice de columna simple puede servir.

### 3.7 `abonos` (75; 73 vigentes)
- **Garantías:** `CHECK` de anulación; único de comprobante y de huella; `deal_id` `restrict`. **Sin `CHECK` de monto positivo ni de moneda.** `program_id` `cascade`.
- **Producción:** 0 montos no positivos, 0 en moneda distinta de USD, 0 abonos en deals que no son venta, 0 sobrepagos (39 completos pagados exactos; 28 parciales con saldo), 0 sin deal. 26 de origen `sheets`, todos sin `registrado_por_user_id` (historia, ADR 0059); 17 fechados más de un día antes de que existiera su deal (todos `sheets`, por la migración). 1 abono con fecha futura, anulado. 2 anulados sin motivo (legal). 27 sin plataforma. 0 con `concepto = 'adicional'`, 0 con enlace de pago.
- **Índices:** `abonos_programa_fecha_idx` 3,8 K, `abonos_deal_idx` 9,7 K, `abonos_comprobante_archivo_idx` 0 (único, necesario).

### 3.8 `gasto_pauta` (2.465), `pauta_objetos` (3.044), `cuentas_publicitarias` (6), `fotos_pauta` (1.154)
- **Garantías:** `CHECK` de destino único (objeto XOR área), de área válida, de origen; único `(objeto, fecha)` para `meta_api`; árbol con `CHECK` de padre por nivel; `id_meta` único. `fotos_pauta`: `CHECK gasto >= 0`.
- **Producción:** 0 huérfanos de padre, 0 incoherencias de nivel (anuncio cuelga de conjunto: 1.995, conjunto de campaña: 617), 0 divergencias de programa o de moneda contra la cuenta, 0 duplicados lógicos, 0 gastos negativos (74 en cero), 0 filas de gasto sin TRM (26 tasas sin solape). Todo el gasto es de nivel **anuncio**, origen `meta_api`, desde el 1-oct (Confianza desde el 6-oct): el gasto empieza después que parte de las ventas migradas (el aviso de cobertura es de F2). `agendas_meta` nulo en 1.973 y `registros_meta` nulo en 2.074 de 2.465. 1.788 de 1.995 anuncios nunca gastaron (el árbol trae todos los anuncios). 19 campañas con `proposito` clasificado de 432.
- **Muertos:** `gasto_pauta.area` y `origen = 'manual'` 0 filas (4 lecturas en `lib/pauta/cobertura-de-gasto.ts`, `roas-de-pauta.ts`, `semaforo/costo-por-agenda.ts`, que sí preguntan por el área manual).
- **Índices:** `gasto_pauta_programa_fecha_idx` 6,3 K, `pauta_objetos_programa_nivel_idx` 3 K, `fotos_pauta_programa_fecha_idx` 6 K, `fotos_pauta_tomada_idx` 1,2 K, `fotos_pauta_campana_tomada_idx` 0 (único, necesario). Sin índice en `pauta_objetos.padre_id_meta` (0 consultas lo necesitaron aún).

### 3.9 `cohorts` (10), `programs` (5), `objetivos` (3), `umbrales_alerta` (2)
- **Garantías:** una activa por programa (índice parcial), `(program_id, codigo)` único, 3 `CHECK` de coherencia de fechas, `objetivos` con 5 `CHECK` y `nullsNotDistinct`. `programs`: `CHECK` de comisión 0 a 100, días positivos.
- **Producción:** 4 activas (una por programa activo), 1 futura sin fechas (por diseño), 3 cerradas. **2 solapes de ventana** (F3-11). 3 cohortes sin `fecha_inicio_ventas` (2 cerradas históricas y 1 futura, permitido por `CHECK`). Dos cohortes con inicio de clases antes del cierre de ventas (Comunicarte C3, Confianza C1; permitido por ADR 0022). Programas: 4 activos y `memorable` inactivo con 1 fuente activa y sin cohortes. Comisión cargada en 4 de 5.
- **Muertos:** `programs.record_personas_por_dia_habil` (solo el seed), `programs.ticket_usd` solo prellena la cohorte (declarado en el comentario, 38 referencias son del formulario).

### 3.10 `users` (27), `miembros_programa` (23), `usuarios_programas_alcance` (26)
- **Garantías:** `email` único; `closer_id` único normalizado; setter por defecto a lo sumo uno por programa; correo de Calendly único por programa.
- **Producción:** 0 correos sin normalizar, 0 `closer_id` con espacios, 0 closers activos sin membresía. 4 usuarios con `closer_id`, uno sin ningún uso (ni llamada ni abono). Roles: gerente 7 (2 con `opera_como_closer`), closer 6, developer 3, paid_trafficker 4, customer_success 5, media 2. 22 membresías activas, 8 con cuenta de Calendly.
- **Muerto:** `users.calendly_email` (0 filas, 0 lectores; el comentario del esquema ya dice "queda sin lector").

### 3.11 `change_log` (59.580), `reversiones` (2)
- **Garantías:** `tabla` y `campo` son texto sin FK (referencia polimórfica por diseño); `registro_id` nulable (**0 nulos en producción**); `user_id` `set null`.
- **Producción:** 0 filas que digan "[object Object]" (el bug de `String(valor)` del 28-sep no reaparece). 0 huérfanos para `deals`, `calls`, `abonos`, `leads`, `cohorts`, `programs`, `users`, `sources`; **444 huérfanos de `deal_actividades`** (F3-18). Origen: `app` 50.798 (44.662 sin usuario), `sync` 8.764 (todas sin usuario: la ingesta; la etiqueta quedó de cuando existía el sync), `whatsapp` 18, `upload` 0. Cobertura de tablas: 30 tablas distintas desde el 28-sep; **no hay filas de `submissions`, `sobres_crudos` ni `entregas_webhook`** por decisión documentada (`schema.ts:1351`).
- **Índices:** `change_log_registro_idx` 1,8 K, `change_log_detectado_idx` 3,5 K. La tabla pesa 14 MB (60 K filas).

## 4. Tablas, columnas e índices muertos (con conteo de lecturas)

"Lecturas" = referencias en `lib/`, `app/`, `components/` y `scripts/`, sin `schema.ts` ni tests, por `grep` del identificador. Conteo grueso: una referencia puede ser una escritura o un comentario; donde importó lo abrí a mano.

| Objeto | Filas hoy | Lecturas | Qué es en realidad | Decisión |
|---|---|---|---|---|
| Tabla `canales` | 26 | 77 refs en 25 archivos, pero lecturas de tabla solo en `lib/catalogo/canales.ts` y `areas.ts` (el molde) y `scripts/` de carga; la pantalla redirige | Catálogo sin lector de negocio desde el ADR 0087 (14-oct) | Eliminar con ADR; conservar su historia en `change_log` |
| Tabla `areas` | 3 | 33 refs en 10 archivos (molde, `ajustes/areas`, seeds) | Solo la usa `canales.area_id` | Eliminar junto con `canales` |
| `formatoUtmEnum` | n/a | 1 columna (`canales.formato`) | Sin lector | Eliminar con `canales` |
| Tabla `sync_runs` | 0 | 16 refs en 1 archivo (`lib/queries/fuentes.ts`) | Historial del sync retirado el 28-sep | Eliminar; quitar `change_log.sync_run_id` y `estadoSyncEnum` |
| Tabla `estados_llegada` | no existe | 5 refs, todas comentarios | Ya eliminada (migración 0059) | Nada que hacer; limpiar los comentarios |
| Tablas `cuotas_pactadas`, `enlaces_pago`, `recursos` | 0, 0, 0 | 3, 38, 109 refs | Funciones construidas sin uso en producción | Mantener hasta decidir con Mani; vigilar |
| Tabla `miembros_programa_calendly_extra` | 0 | 25 refs en 3 archivos | Función nueva (6-nov) sin uso aún | Mantener |
| Tabla `rarezas_migracion` | 1 | 20 refs en 3 archivos (`lib/migracion/`) | Herramienta de migración; 6.958 lecturas secuenciales desde agosto | Mantener; retirar al cerrar la migración E7 |
| 16 tablas del cockpit de media (`calificaciones`, `candidatos`, `colecciones`, `colecciones_videos`, `descartes`, `guiones_limpios`, `referentes*`, `tandas`, `tematicas`, `transcripciones`, `traslado_cockpit`, `videos_grabados`, `videos_referentes`) | 0 (`piezas` 4, `creadores` 2, `tipos_pieza` 1) | con lectores en `lib/media/`, `lib/migracion/cockpit/` | Subproyecto `docs/media/` (prioridad alta) aún sin datos | Mantener; no es de métricas |
| `leads.estado`, `leads.cohort_id` | 3.760 constantes / nulas | 0 | Ver F3-06 | Eliminar (con `leads_programa_estado_idx` y `leads_cohorte_idx`: este con 7 usos) |
| `leads.cargo`, `empresa`, `ciudad`, `pais`, `ingreso_declarado`, `urgencia`, `por_que_aplico`, `motivo_descarte`, `raw` | 0 pobladas | 10 a 14 refs en `mapeo-webhook.ts`, `sheets/dedup.ts`, `sheets/mapeo.ts`, `ficha-lead.tsx`, `meta-capi` | El adaptador nunca las llena; solo `pais` tiene un lector real (CAPI) | Eliminar, decidiendo antes F3-08 |
| `calls.cohort_id`, `calls_cohorte_closer_idx` | 451 nulas / 0 usos | 0 lectores | Ver F3-04 | Eliminar |
| `calls.closer_id` | 0 pobladas | 11 refs en `dashboard.ts`, `metricas-con-filas.ts`, `metricas-filtros.ts`, `tasas-del-grupo.ts` | Rama muerta del fallback | Eliminar tras F3-05 |
| `calls.motivo_perdida` | 0 | 10 refs | Texto histórico de Sheets | Eliminar |
| `submissions.posicion_en_hoja`, `version_puntaje` | 0 | 22 y 4 refs | Restos de Sheets | Eliminar con su código |
| `users.calendly_email` | 0 | 0 | Superada por `miembros_programa.calendly_email` | Eliminar |
| `programs.record_personas_por_dia_habil` | 2 de 5 | 2 refs (solo `scripts/seed-datos.ts`) | Sin lector | Eliminar |
| `deals.acuerdo_pago`, `handoff_en`, `cohorte_destino_*` | 0 | 29, 14 y 101 refs | Funciones con código y sin uso real | Mantener; revisar con negocio |
| Valores de enum sin filas: `etapa_deal.contactado`, `resultado_llamada.compromiso_pago` y `.perdida`, `origen_cambio.upload`, `tipo_fuente.upload`, `tipo_actividad.intento`, `tipo_motivo.recuperacion` | 0 | el código decide con ellos | Son tipos (ADR 0012): lo correcto es que el código los conozca aunque aún no haya filas | Mantener (justificado). `intento` es historia declarada |
| `sources`: `sheet_id`, `tab`, `rango`, `tz_fechas`, `ultima_sync`, `mapeo_columnas` | 3 fuentes `google_sheet` inactivas, 0 envíos | lectura de hoja para el traslado | Resto del sync de Sheets | Mantener mientras exista el traslado; marcar para N7 |

**Índices con 0 usos desde el 25-ago, entre los que importan para métricas:** `calls_cohorte_closer_idx`,
`reversiones_deal_idx` (2 filas; la tabla es nueva), `rarezas_migracion_programa_idx`, `piezas_programa_idx`. Los únicos con 0
usos (`abonos_comprobante_archivo_idx`, `sources_una_principal...`, `miembros_programa_setter_idx`, `fotos_pauta_campana_tomada_idx`,
`canales_par_idx`...) existen para **impedir** algo, no para leer: se mantienen. Los índices de las 16 tablas del cockpit
no cuentan (están vacías).

## 5. Texto que debería ser FK o enum, y enums que el código no usa

| Columna | Hoy | Veredicto |
|---|---|---|
| `abonos.moneda`, `gasto_pauta.moneda`, `cuentas_publicitarias.moneda`, `eventos_meta.moneda`, `enlaces_pago.moneda`, `cuotas_pactadas.moneda` | texto libre; solo `objetivos.moneda` tiene `CHECK` | F3-12: `CHECK` por tabla (o un enum `moneda`). El código ya decide con la moneda (nunca suma dos) |
| `calls.origen`, `abonos.origen`, `sobres_crudos.origen` | texto; `sobres_crudos` tiene `CHECK` | `calls.origen` tiene default `sheets` sin una fila: cambiar el default y añadir `CHECK` (`crm`, `calendly`, `sheets`) |
| `pauta_objetos.estado` | texto de Meta (`ACTIVE`, `CAMPAIGN_PAUSED`...) | Aceptable: solo se muestra, y es vocabulario ajeno |
| `deal_actividades.canal` | texto (`WhatsApp`, `Llamada`, nulo); el comentario del esquema deja la decisión "abierta" desde la etapa 4 | 13 contactos: decidir enum o catálogo o quitarla. Baja |
| `leads.lead_quality`, `lead_value`, `calificacion` | texto con 3, 5 y 2 valores más nulo | Mantener texto (ADR 0004); documentar `'High'` como constante de frontera |
| `deals.etapa`, `pendiente`, `calls.resultado`, `tipo_actividad`, `tipo_motivo`, `origen_cambio`, `estado_fuente`, `proveedor_formulario`, `metrica_*` | enums | Correctos: el código decide con cada uno (ADR 0012) |
| `users.closer_id`, `calls.closer_id`, `abonos.closer_id` | texto de identidad (ADR 0030) | La FK ya existe en `calls` y `abonos`; el texto solo sobrevive por la historia (F3-05) |
| `submissions.utm_*` | texto crudo | Correcto por ADR 0004 |

## 6. Propuestas de migración (descritas, no escritas)

Orden sugerido: datos primero, restricciones después, eliminaciones al final (el código deja de leer antes de que la
columna se vaya, porque drizzle pide las columnas por nombre).

### 6.1 Fecha de primera aplicación (F3-01)
Escribir `fecha_envio` del parcial al ingerir (`created_at` del sobre si el proveedor no la trae) o fijar el ancla con
`coalesce(fecha_primera_aplicacion, created_at)` en un solo lugar (`fechaAnclaLead`) y quitar el fallback suelto de
`leads.ts:138`. Relleno: `UPDATE leads SET fecha_primera_aplicacion = min(coalesce(fecha_envio, created_at))` de sus envíos
**solo donde es nula** (784 filas), con el ok de Mani. Después `NOT NULL` en `leads.fecha_primera_aplicacion` para los de
`entrada = 'formulario'` (`CHECK`). Impacto a medir en F2 antes de rellenar: cuánto sube "leads del rango" por programa.

### 6.2 Programa blindado por la base (F3-03)
Añadir `UNIQUE (id, program_id)` en `leads`, `deals` y `cohorts`, y reemplazar las FK simples por compuestas
`FOREIGN KEY (lead_id, program_id) REFERENCES leads (id, program_id)` en `lead_contactos`, `deals`;
`(deal_id, program_id)` en `calls`, `abonos`, `eventos_meta`; `(cohort_id, program_id)` en `deals`.
Hoy cumplen las 8 (conteos en §3), así que la migración no necesita limpiar nada. Con `lock_timeout` y con índices creados
antes (`CREATE UNIQUE INDEX CONCURRENTLY`). Es la forma de cumplir "una vista que cruce programas tiene que ser imposible de
construir" en el dato, no solo en el tipo de la consulta.

### 6.3 `ON DELETE` coherente (F3-17)
`programs` hacia `leads`, `deals`, `calls`, `abonos`, `cohorts`, `sources`: de `cascade` a `restrict`. Hoy los hijos de
esos hijos ya son `restrict`, así que un `DELETE` de programa fallaría a medias; mejor que falle de entrada con un mensaje
claro. Mantener `cascade` solo donde la fila es un atributo del padre (`objetivos` y `cohorts`, `lead_contactos` y `leads`,
`miembros_programa`).

### 6.4 Venta con dueño (F3-07)
Después de asignar dueño a las 3 ventas migradas de Comunicarte C3 (decisión de negocio, escritura con ok de Mani):
`CHECK (etapa NOT IN ('ganado_parcial','ganado_completo') OR owner_user_id IS NOT NULL OR anulado_en IS NOT NULL)`.

### 6.5 Cohortes sin solape (F3-11)
Si Mani confirma que no se permite: `EXCLUDE USING gist (program_id WITH =, daterange(fecha_inicio_ventas, fecha_cierre_ventas, '[]') WITH &&) WHERE (fecha_inicio_ventas IS NOT NULL AND fecha_cierre_ventas IS NOT NULL)` (requiere `btree_gist`) y corregir antes las dos parejas. Si el solape es un caso válido de transición, documentarlo en el ADR 0022 y en el diccionario: qué cohorte toma una venta de un día compartido.

### 6.6 Eliminaciones (F3-04, 06, 13, 14, 15, 16)
Un ADR de "retiro de lo muerto" (N7) con la lista de §4, el código que deja de leer primero y las migraciones al final, una por
tabla para poder revertir. Conservar `change_log` tal como está.

### 6.7 Monedas (F3-12)
`CHECK (moneda IN ('USD'))` en `abonos`, `eventos_meta`, `enlaces_pago`, `cuotas_pactadas` (hoy 100 % USD y el esquema zod
ya lo exige); `CHECK (moneda IN ('COP','USD'))` en `gasto_pauta` y `cuentas_publicitarias`. Antes, verificar con F2 que ninguna
suma agrupa Comunicarte COP con Comunicarte USD.

## 7. Índices de las consultas de métricas

Estadísticas de uso (desde 25-ago) de los que sirven métricas: `deal_etapa_historial_deal_idx` 1,53 M · `submissions_lead_idx`
1,17 M · `lead_contactos_lead_idx` 136 K · `calls_deal_idx` 155 K · `deals_programa_etapa_idx` 78 K · `lead_contactos_valor_idx` 89 K ·
`gasto_pauta_programa_fecha_idx` 6,3 K · `abonos_programa_fecha_idx` 3,8 K.

`EXPLAIN` sin `ANALYZE` (programa inexistente, al volumen de hoy):

| Consulta | Plan | Lectura |
|---|---|---|
| Leads del rango (`filtroLeads`) | `Index Scan leads_programa_estado_idx` + filtro de la expresión de fecha | Solo el programa se sirve de índice; la fecha se filtra fila a fila. Sin índice de fecha posible mientras la condición use `(col AT TIME ZONE ...)::date` |
| Ventas por rango (`ventasConDiaEn`) | `Index Scan deals_programa_etapa_idx` + `deal_etapa_historial_deal_idx` con filtro de `a` | Lee el historial de cada deal del programa; con 5,8 K filas es trivial |
| Llamadas por rango | `Index Scan calls_huella_idx` (por `program_id`) + filtro de fecha | Usa el índice único como índice de programa; no hay uno propio de `(program_id, fecha_agenda)` |
| Envíos por rango y origen | `Seq Scan sources` + `Bitmap Heap Scan submissions` por `source_id` + filtro de fecha | Lee todos los envíos de la fuente y filtra la fecha en memoria |

**Veredicto (inferido):** a 10× el volumen (57 K envíos, 38 K leads, 11 K llamadas, 58 K movimientos) ninguna de las cuatro
pasa de decenas de milisegundos con estos planes, así que **no propongo índices nuevos hoy**. Lo que sí propongo es
cambiar las **anclas de fecha** a una columna `date` materializada y sargable en el momento en que alguna de estas
consultas supere un presupuesto medido (`EXPLAIN ANALYZE` en una réplica, no en producción), no antes: es la forma de
cumplir C-2 sin crear índices que nadie ha pedido. Los candidatos, por si una medición los pide: `(program_id, fecha_agenda)`
en `calls`, `(source_id, created_at)` en `submissions`, `(a, fecha)` parcial a las etapas vendidas en `deal_etapa_historial`.
**Sobran:** `calls_cohorte_closer_idx` (0 usos, columna muerta), `leads_cohorte_idx` (7 usos, columna muerta) y
`leads_programa_estado_idx`, que hoy solo hace de índice de `program_id` y se puede reemplazar por uno directo al quitar `estado`.

## 8. Qué verificar con Mani o con F2 antes de actuar

1. F3-01: impacto de los 784 leads en "leads del rango" y en las tasas por lead. Es el insumo de F2.
2. F3-02: la cobertura del resultado (20,2 % en octubre: 158 de 784 citas con resultado) es de captura; confirma el 20 % que cita el ticket.
3. F3-11: ¿se permite el solape de cohortes?
4. F3-08: ¿se llena `leads.pais` en la ingesta o se quita la lectura de CAPI?
5. F3-05 y F3-07: tocan datos de producción (3 abonos, 3 ventas sin dueño); escribir exige el ok de Mani.
6. La calificación del resumen difiere en 14 leads de mi reconstrucción: confirmar el criterio de desempate de `ingerir.ts` antes de llamarlo defecto.

## 9. Consultas de apoyo (reproducibles)

Todas `SELECT` sobre producción, con `SET default_transaction_read_only = on`. Las más citadas:

```sql
-- F3-01: leads sin fecha y de ellos cuántos tienen venta vigente
select count(*) filter (where fecha_primera_aplicacion is null) from leads;           -- 802 (784 formulario + 18 crm)
select count(*) from leads l where fecha_primera_aplicacion is null
  and exists (select 1 from submissions s where s.lead_id=l.id)
  and not exists (select 1 from submissions s where s.lead_id=l.id and not es_parcial); -- 784
-- F3-02: citas pasadas sin resultado
select count(*) from calls where resultado='agendada' and anulado_en is null and fecha_agenda < now(); -- 730
-- F3-04: cohorte de la llamada contra la de su deal
select count(*) filter (where c.cohort_id is null and d.cohort_id is not null)
from calls c join deals d on d.id=c.deal_id;                                            -- 449
-- Paridad de etapa contra historial
with u as (select distinct on (deal_id) deal_id, a from deal_etapa_historial order by deal_id, fecha desc, id)
select count(*) filter (where u.a<>d.etapa) from deals d join u on u.deal_id=d.id;      -- 0
-- Programa de las hijas contra el padre (8 variantes, todas 0)
select count(*) from lead_contactos c join leads l on l.id=c.lead_id where c.program_id<>l.program_id;
```
