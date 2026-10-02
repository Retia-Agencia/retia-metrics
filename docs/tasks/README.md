# Tracker — Retia CRM

Este es el **único lugar** donde se marca el avance. Cada ticket tiene su archivo con objetivo,
alcance y criterios de "done"; aquí solo va el estado. Al cerrar un ticket: marcar la casilla,
cambiar `status: done` en su archivo y anotar la fecha.

Estados: `todo` · `en curso` · `done` · `bloqueado` · `reemplazado`.
Un ticket está **listo** cuando todos los de su columna "Depende de" están en `done`.

**El orden, los tracks, los hitos y las decisiones abiertas viven en [`docs/plan.md`](../plan.md)**
(§5 el orden, §7 la lista única de decisiones). Qué es el producto: [`docs/overview.md`](../overview.md).
Cómo está hecho: [`docs/structure.md`](../structure.md).

> 🌊 **1-oct (Mani): el trabajo va por olas de tickets listos, no por etapas en serie con dos carriles.** Cada
> uno trabaja con varias sesiones; solo se ordenan las migraciones (una cola), los archivos calientes (un dueño
> por ola) y las decisiones. Push directo a `main` y la suite completa en **checkpoints** (dos al día). Quién
> hace qué en la ola vigente (O1) y la cola de migraciones: [`plan-reparto.md`](../plan-reparto.md) §4; las
> reglas, §1, §5 y §6. Cada sesión escribe su estado en el archivo de su ticket; esta tabla la pone al día
> Mani en cada checkpoint verde.

> 🧭 **27-sep:** Comercial dio luz verde y la documentación se centralizó en `plan.md`, `overview.md`,
> `structure.md`, `operations.md` y los ADR vigentes. Muchos tickets citan documentos que ya no están
> (spec, plan v2, la propuesta del 24-sep, la revisión del 22-sep, el "insumo"): **`docs/plan.md` §8
> dice dónde quedó cada referencia vieja**, y un ADR retirado se resuelve en `docs/adr/README.md`.
> 048, 049, 050, 051 y 053 pasan a `en curso`: tenían código y seguían en `todo`. A1 y A2 se cerraron el
> mismo día: ADR 0054 (el Estado lo pone el formulario) y ADR 0055 (webhook estándar, track propio).
>
> **Historia corta de las épocas:** el MVP (F0 a F4, tickets 001 a 035) se ejecutó del 16 al 20-sep. El
> 21-sep se abrió la época v2, el modelo tipo HubSpot (Lead, Envío, Deal y etapas: tickets 036 a 093),
> con la etapa E1b de atribución tras la reunión con Alejo. El 22-sep la revisión del modelo; el 24-sep la
> dirección de producto (tickets 094 a 102) y la reunión con los closers, tras la cual Mani adoptó la
> tabla de transiciones, el acuerdo de pago como nota (ADR 0053) y el orden P1: E2 → E3 mínimo → E4 →
> E6 mínimo → E1b → E5 → E7. **E2 (043 a 047) se cerró el 27-sep: el motor de etapas existe.** Sigue E3 mínimo (paso 2 del plan): A1 y A2 ya se cerraron (ADR 0054 y 0055), faltan sus tickets. El 094 también se cerró el 27-sep. *(Nota del 27-sep: el orden vigente es el de arriba, por olas.)*

# 🎯 Norte comercial de Gerencia — PRIORIDAD · abierto el 30-sep

Sale de la reunión con Dani y Michael del 30-sep: el pipeline pasa a las etapas, etiquetas y propiedades
del HubSpot de 30X, el dinero cambia (valor vendido escrito por el closer, comisión por porcentaje,
próxima fecha de pago), aparece la meta del mes y el dashboard se vuelve flexible, con número y porcentaje
siempre. **Mani, 30-sep: es la prioridad, antes que cualquier otro frente.** El inventario punto por punto
(GC-01 a GC-53), lo que reabre (R-1 a R-12) y las preguntas (QD, QM) viven en
**[`docs/comercial.md`](../comercial.md)**. Va paso por paso: no se abre uno sin cerrar el anterior. **Excepción desde el 1-oct (Mani):** los pasos 3 a 5 se
parten en **dos lotes** por dependencia (`comercial.md` §8): el lote 1 no depende de Dani y arranca ya; el lote 2
(las etapas y lo que espera otra respuesta) va cuando lleguen. Los lotes se reparten en las olas de `plan-reparto.md` §4.

| ✓ | # | Paso | Depende de | Estado |
|---|---|---|---|---|
| [x] | 1 | El inventario de la reunión contra el repo (`comercial.md`) | · | done · 30-sep · Mani |
| [x] | 2 | Leer el HubSpot de 30X, solo lectura: etapas, etiquetas y propiedades por etapa (cuáles obligatorias), "fecha corte" y "cortesías", y el dashboard "Gestión Comercial" con pantallazos | 1 | done · 1-oct · Mani (pantallazos) y sesión principal · §4 lleno y §9 en `comercial.md`: las 11 etapas, las etiquetas, la ficha del deal, el inventario de 18 gráficas con su mejora y 4 secciones de dashboard. Lo que HubSpot no muestra (reglas de movimiento, obligatorias, fecha corte, cortesías) pasó a QD-8 a QD-12 |
| [ ] | 3 | Preguntas a Dani (QD-1 a QD-12) y a Mani (QM-2 a QM-9); hablar con 2 o 3 closers sobre abonos (GC-17) | 2 | en curso · **QD-1 a QD-12 contestadas por Mani el 1-oct** (`comercial.md` §7.0). QM-10 cerrada (ADR 0070), QM-12 y el manual de gestión comercial (QD-8) cerrados (ADR 0071, 2-oct). QD-2 confirmada el 2-oct (cola del setter = En gestión; cerrados = Ganado según saldo). Quedan QM-11 y GC-17 con los closers |
| [ ] | 4 | Las decisiones en ADR (`/grill-with-docs`): pipeline de 30X, valor vendido y comisión, Atendido sin Grain, rol Customer Success, meta del mes, periodos flexibles | 3 (solo el lote 2) | en curso · **lote 1 hecho el 1-oct** (Mani): ADR 0065 (valor vendido, ticket base de la cohorte, `productos` se retira, comisión % congelada; QM-2 cerrada), 0066 (Atendido sin Grain), 0067 (número y %, periodo A contra B, cifra → resumen → lista). El lote 2 espera a Dani |
| [ ] | 5 | Enmendar los tickets vivos y crear los nuevos (lista en `comercial.md` §8) | 4 | en curso · **lote 1 hecho el 1-oct**: enmendados 017, 044, 058, 060, 062, 072, 074, 089, 095, 128; creados 132 a 141 y, bloqueados, 142 a 148. Falta enmendar los del lote 2 (117, 118, 078, 080, 122, 124, 065, 069, 070, 071, 102) cuando se desbloqueen; el 117 y el 118 además con el **ADR 0069** (la etapa de entrada la decide el CRM con agenda y calidad, regla de 30X) |

**Lote 1 (no espera a Dani).** Se toman en este orden; implementa Codex, revisa la sesión principal.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 132 | [El valor vendido del deal](./132-valor-vendido-del-deal.md) | · | done · 1-oct · Mani · 0053 en producción; saldo y rejas del pago leen el valor vendido; Compromiso Verbal ya no pide producto. El 134 cambia la entrada a descuento (enmienda del ADR 0065) |
| [x] | 133 | [La comisión por porcentaje congelado](./133-comision-por-porcentaje-congelado.md) | 132 | done · 1-oct · Mani · 0054 en producción; % congelado al entrar a venta, comisión por closer sobre sus mismos cierres. La 0055 ya quitó `comision_por_venta_usd` (en producción). 10,04/6,67 cargados en producción (verificado el 1-oct); el criterio del agregado pasa al 095 |
| [x] | 134 | [El ticket base es de la cohorte y `productos` se retira](./134-ticket-base-de-la-cohorte-y-adios-productos.md) | 132 | done · 1-oct · Mani · 0056 en producción (sin `productos`); descuento contra la cohorte, deals nacen en la activa, cambios de una venta con motivo; 214 deals movidos a la C3 |
| [x] | 135 | [Atendido sin Grain](./135-atendido-sin-grain.md) | · | done · 1-oct · Mani · checkpoint `cp-20261001-1` · T7/T10 a `ambos`: a mano la última llamada vigente con fecha queda en show (fecha_llamada = cita) con rastro; `lib/queries/sin-grain.ts` es la única respuesta (`showsSinGrain` para el 095, `esAtendidaSinGrain` para 128/139); tarjeta "N de M" con su lista y Badge en la ficha. Recorrido en `dev:local` |
| [x] | 136 | [Selector de periodo A contra B, número y %](./136-selector-de-periodo-y-numero-y-porcentaje.md) | · | done · 1-oct · Alejo · selector en el dashboard; 137, 138 y 141 quedan listos |
| [x] | 137 | [Toda cifra abre su lista](./137-toda-cifra-abre-su-lista.md) | 136 | done · 1-oct · Alejo · caja, shows, agendas, cierres y leads; "todos" en la consulta, la pantalla es del 095 |
| [x] | 138 | [Deals creados contra agendas](./138-deals-creados-contra-agendas.md) | 136 | done · 1-oct · Alejo · acumulado por hábil A contra B en el dashboard; `deals_creados` y `agendas_creadas` abren su lista |
| [x] | 139 | [La ficha del deal por bloques](./139-ficha-del-deal-por-bloques.md) | 132, 134 | done · 1-oct · Mani · checkpoint `cp-20261002-1` · enmienda el 074: cabecera con nombre derivado, Origen con los UTM crudos, Perfil, Lead y contactos, Log agrupado por objeto y momento, Facturación. El recorrido dejó A-15 a A-17 (al 075) y A-18 (E9) |
| [x] | 140 | [Crear un deal a mano](./140-crear-un-deal-a-mano.md) | · | done · 2-oct · Alejo (ok de Mani) · "Nuevo deal" en el tablero de Deals: lead del programa o alta manual, `abrirDeal` en En gestión con historial y rastro, dueño = quien lo crea (ADR 0071 punto 6, también si es un gerente: ok de Mani). Lead con deal abierto: el rechazo lo enlaza y la base no se mueve; programa fuera del alcance: 404 sin escribir. `lib/deals/crear-a-mano.ts`, `tests/crear-deal-a-mano.test.ts` (14) |
| [x] | 141 | [Filtros de fecha relativos en las listas](./141-filtros-de-fecha-relativos-en-listas.md) | 136 | done · 1-oct · Alejo · deals por creado, actividad y cierre; leads por creado y último envío; selector del 136 en modo solo A |

**Lote 2 (bloqueado por preguntas).** Orden y carriles: `plan-reparto.md` NC2.

| ✓ | # | Ticket | Bloqueado por | Estado |
|---|---|---|---|---|
| [x] | 142 | [Las etapas de 30X](./142-las-etapas-de-30x.md) | QM-10, QD-8 | done · `cp-20261002-2` · 2-oct (madrugada): las tres tandas en `main` y la **0058 aplicada en producción**. QM-10 en el ADR 0070; manual aprobado y D-1 a D-9 y QM-12 en el ADR 0071 · carril Mani |
| [ ] | 143 | [Etiquetas y propiedades por etapa](./143-etiquetas-y-propiedades-por-etapa.md) | 142, QD-8 | todo · listo desde el 2-oct (142 done; QD-4 y QD-10 contestadas el 1-oct: sin etiquetas, solo Lead Value y Lead Quality; toda obligatoria vacía es alerta roja; cuáles son obligatorias sale del manual, ADR 0071) · carril Mani, dueño de `lib/deals/requisitos.ts` |
| [ ] | 144 | [Próxima fecha de pago y cartera](./144-proxima-fecha-de-pago-y-cartera.md) | 132, QM-3, GC-17 | bloqueado |
| [ ] | 145 | [Rol Customer Success y onboarding](./145-rol-customer-success-y-onboarding.md) | QM-5 | bloqueado |
| [ ] | 146 | [Meta del mes y página de Metas](./146-meta-del-mes-y-pagina-de-metas.md) | 136, QM-6, QM-7 | bloqueado |
| [ ] | 147 | [Alertas por persistencia](./147-alertas-por-persistencia.md) | 136, QM-11 | bloqueado · QD-6 contestada (1-oct): 5 hábiles, configurable; falta la lista de métricas (QM-11) · NC2 carril Alejo |
| [ ] | 148 | [Las secciones del dashboard](./148-las-secciones-del-dashboard.md) | 142, 095, 137 | todo · deps cumplidas el 2-oct; va después del 143 (el 128 ya fijó las alertas) |
| [ ] | 149 | [El manual de uso del CRM, por rol](./149-manual-de-uso-por-rol.md) | 075 | todo · 1-oct (QD-7) · E9, sesión principal |
| [x] | 151 | [Un reenvío sube la etapa de entrada y el CRM avisa los envíos repetidos](./151-el-reenvio-sube-la-etapa-de-entrada.md) | 142, 117 | done · `cp-20261002-3` · 2-oct · carril Mani · ADR 0073: S1 a S3 (solo sistema, solo hacia arriba, con nota), badge "N envíos" en tarjeta y ficha del deal, el parcial absorbido por su completo en la ficha del lead. Typecheck, lint, build y tests del cambio en verde; recorrido hecho (2-oct). |
| [ ] | 152 | [El closer asigna su propia cuenta de Calendly](./152-el-closer-asigna-su-calendly.md) | 096, 031 | en main · 2-oct · espera checkpoint · `puedeTocarMembresia` (dueño o quien administra) en la mutación; `/perfil` con `asignarMiCalendlyAccion`; recorrido en `dev:local` como closer y la acción forjada con un `membresiaId` ajeno: 403, base quieta · ADR 0074: lo propio del closer lo edita el closer; acceso y atribución, quien administra · carril Mani · S |
| [ ] | 153 | [Base local y lista de pruebas de la operación comercial](./153-base-local-y-pruebas-de-la-operacion-comercial.md) | 142, 151, 128, 118 | en curso · 2-oct: seed con las 11 etapas, deals por settear y no históricos (A-19 resuelta); lista de 33 pruebas recorrida entera por la sesión (recorridos 3 y 4, hallazgos A-19 a A-33 en `docs/anotaciones.md`). Falta: que Mani la recorra como closer · carril Mani |
| [ ] | 154 | [Manual de operación comercial (artifact para closers)](./154-manual-de-operacion-comercial.md) | 153, 078 | en curso · 2-oct · borrador en `docs/manuales/operacion-comercial.html` (HTML autocontenido, publicable como artifact desde cualquier cuenta): el flujo del lead al student, Quality y Value según la lógica real de los Typeform, y "lo que le falta al CRM". Se cierra al cerrar 153 y 078, revisando el manual contra lo que quede · carril Mani |
| [x] | 155 | [Los hallazgos de UI de los recorridos 3 y 4](./155-hallazgos-de-los-recorridos-3-y-4.md) | 128, 153 | done · 2-oct · CI verde en `2854fef` · carril Mani · A-20 a A-33 (A-24, A-29, A-31 y A-33 entraron antes por O2-d `37f558c`, se conservó esa versión; A-23 descartada: se confía en el closer; A-30 sigue en el 078); `aceptaAbono` en `lib/deals/etapas.ts`, llamadas cuya hora ya pasó, alerta de atendida sin Grain, log "creado" solo el primer grupo · typecheck, lint y build en verde, tests del cambio al CI (swap); recorrido en `dev:local` · sin migración · S |
| [ ] | 156 | [La operación comercial intuitiva](./156-operacion-comercial-intuitiva.md) | 155 | en main · 2-oct · espera CI, build y recorrido · Codex implementó, revisó la sesión principal (typecheck y lint limpios, tests al CI por swap) · ADR 0075 · A-34 a A-39 (onboarding de closers): Transición por etapa destino, un pop-up para ficha y Kanban, alertas en su recuadro, comprobante sin reja, el closer ve lo suyo · sin migración · carril Mani |
| [ ] | 157 | [El setter entrega el deal al closer por la cita](./157-handoff-del-setter-al-closer.md) | 156 | todo · listo cuando el 156 entre a `main` · ADR 0076 aceptado (2-oct): handoff sin soltar el deal con alerta a 1 hábil, crédito del setter, cuatro caminos de una llamada, una suelta solo la cuelga su host · migración (`setter_user_id`, `handoff_en`) · carril Mani |
| [ ] | 158 | [El reporte del día del closer sale del CRM](./158-el-reporte-del-dia-del-closer.md) | 156, 157 | bloqueado · cómo se registran las objeciones (Mani y Michael) |
| [x] | 6 | Reordenar `plan.md` §5 y `plan-reparto.md`: v1 comercial primero, pauta después | 5 | done · 1-oct · Mani · `plan-reparto.md` §4: etapas **NC1** (lote 1), **NC2** (lote 2, el 078 y el corte) y **NC3** (dashboard comercial = v1 comercial), antes de E7 y E8 |

⏸️ **Mientras tanto: el `--aplicar` del 078 espera** a que se cierren las etapas (paso 4) y QD-2. Meter
ahora los deals viejos en las once etapas obliga a migrarlos dos veces. El 117 sigue: corrige el bug de
Tactical y su columna de etapa se traduce junto con `deals.etapa`.

# 🌊 Ola O1 (desde el 1-oct) y el reparto anterior

Lo nuevo de la ola O1 que no tenía ticket:

| ✓ | # | Tarea | Depende de | Estado |
|---|---|---|---|---|
| [x] | 150 | [Tests rápidos: la base migrada una vez por corrida](./150-tests-rapidos-base-migrada-una-vez.md) | · | done · 1-oct · Mani · checkpoint `cp-20261002-1` · vitest en el CI 372 s → 274 s; migración rota revienta la corrida una vez; `npm run test:cambios` |
| [x] | 0057 | Aplicar la migración 0057 (quita `cohorts.trm_cohorte`) en producción | · | done · 1-oct · Mani · aplicada con producción sirviendo `77665a1` (código sin la columna); 58 migraciones. El ROAS sin TRM queda abierto para E7 (`plan.md` §7) |

## Reparto para dos (28-sep a 1-oct, reemplazado por las olas)

El orden por etapas y carriles vive en [`docs/plan-reparto.md`](../plan-reparto.md). Las correcciones
de su §3 se aplicaron el 28-sep con el ok de Mani (069, 070, 074, 077, 079, 086 cambian de
dependencias; 048, 049 y 064 llevan su enmienda).

## Etapa E0 del reparto · Terreno para dos — **en curso · 28-sep**

| ✓ | # | Tarea | Depende de | Estado |
|---|---|---|---|---|
| [x] | · | §3 aplicado en tickets y tracker; `plan.md` §2 y `AGENTS.md` al día | · | done · 28-sep · Mani |
| [x] | 112 | [CI en cada push a `main` (sin protección)](./112-ci-y-main-protegido.md) | · | done · 28-sep: workflow y plantilla de PR; el CI midió el lock roto en Linux y se resincronizó. **Sin protección de `main` ni PR obligatorio** (Mani: velocidad); el CI es alarma, no reja |
| [x] | 113 | [Base local para desarrollar pantallas](./113-base-local-para-pantallas.md) | · | done · 28-sep: `npm run db:local` (Docker, 38 migraciones, seed por `lib/`) y `npm run dev:local`, probado de punta a punta. Falta un modo de login local (Auth.js solo tiene Google) · sembrar contra Postgres real destapó el `Date` en `moverEtapa` (arreglado) |
| [x] | · | Plantilla de PR con el checklist de contratos de `AGENTS.md` | · | done · 1-oct · Alejo: `.github/pull_request_template.md` (la del 112) al día con la tabla de Contratos del 1-oct: alcance, agregado entre programas, ADR 0067, closers, centinelas, ingesta, atribución, errores, plantillas `sql` y migraciones |
| [x] | 105 | Cerrar: forjar la acción desde una sesión de closer | · | done · 28-sep: Mani lo forjó desde la vista closer; ni crear ni rotar |
| [x] | · | Ops: quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel; cargar a Andrea (007) | · | done · 28-sep · Vercel limpio (prod y preview); Andrea dada de alta por Mani en `/ajustes/usuarios` |
| [x] | · | Agendar a Michael; después closers, Gerencia y Pauta (reparto §7) | · | done · 28-sep · Michael y el dueño del deal respondidos por Mani; precio 797; Pauta, Alejo Carvajal y Michael el 29-sep 8pm |
| [x] | 057 | 057, 058 y 059 del carril de Mani en E1, adelantados y en `main` | · | done · 28-sep · migración 0036 aplicada con el ok de Mani (sin la tabla del 110, que lleva la 0037) |

# Pauta y analítica (tickets 116 a 126) — abierto el 29-sep

Sale de la reunión con Pauta del 29-sep. El mapeo requisito por requisito, las decisiones (DP-1 a DP-25) y
las fórmulas viven en **[`docs/analytics.md`](../analytics.md)**; las decisiones de arquitectura, en los
ADR **0061** (estados de llegada por tabla), **0062** (el anuncio es la llave de la pauta) y **0063**
(métricas y objetivos). Mani: *"lo antes posible, sin fechas"*. Etapa y carril de cada uno:
[`plan-reparto.md`](../plan-reparto.md) §4.

🩸 El 29-sep el Typeform de Tactical dejó de mandar `estado` y ningún envío abrió deal durante horas. Parche
aplicado en el Typeform ese día (`docs/analytics.md` §2.4); el 117 lo vuelve innecesario.

| ✓ | # | Tarea | Depende de | Estado |
|---|---|---|---|---|
| [x] | 116 | [Las UTM completas en el envío: `utm_id`, `utm_content`, `utm_term`](./116-las-utm-completas-en-el-envio.md) | — | done · 30-sep · Alejo · 0048 en producción; las seis UTM en sus columnas (el tracker se marcó al cierre de la sesión de Mani) |
| [ ] | 117 | [Los estados de llegada por tabla, y los parciales por el webhook](./117-los-estados-de-llegada-por-tabla-y-los-parciales.md) | 115 | en curso · Alejo · 2-oct: fase 2 cerrada (0059 aplicada en producción, `estados_llegada` ya no existe) y reproceso de los 23 de Tactical hecho (19 deals nuevos, ningún lead sin deal). **Lo único que falta:** anotar el primer parcial real de Typeform (O-7). No es código |
| [x] | 118 | ["Se perdió en el Calendly": urgente arriba del Inbox](./118-se-perdio-en-el-calendly.md) | 117 | done · `cp-20261002-4` · 2-oct · Mani · "se perdió en el Calendly" arriba del Inbox (D-7 del ADR 0071) |
| [ ] | 119 | [La conexión con Meta: token por portafolio y cuentas por programa](./119-la-conexion-con-meta.md) | — | todo · carril Alejo · migración · espera el token de Anderson |
| [ ] | 120 | [La pauta de Meta: árbol y gasto por anuncio y día](./120-la-pauta-de-meta-por-anuncio-y-dia.md) | 119 | todo · carril Alejo · migración (retira `ad_spend`) |
| [x] | 121 | [El área declarada por el closer al cerrar](./121-el-area-declarada-por-el-closer.md) | 083 | done · 30-sep · Mani · 0049 en producción; requisito `area_declarada` al entrar a 6, 7 u 8 (históricos exentos), selector en Kanban/Ficha/abono, `ventasSinUtmPorAreaDeclarada` sobre `vendidosEn`; recorrido visual hecho |
| [ ] | 122 | [Los objetivos de la cohorte y el reparto de cupos por área](./122-los-objetivos-de-la-cohorte.md) | 083 | todo · carril Mani · migración |
| [ ] | 123 | [El embudo de Pauta y los costos por etapa](./123-el-embudo-de-pauta-y-los-costos-por-etapa.md) | 085, 089, 115, 120 | todo · carril Mani |
| [ ] | 124 | [El cumplimiento de la cohorte por área](./124-el-cumplimiento-de-la-cohorte-por-area.md) | 122, 123 | todo · carril Mani · espera PQ3 de Pauta |
| [ ] | 125 | [La tab Campañas: el árbol de Meta con su embudo](./125-la-tab-campanas-con-el-arbol-de-meta.md) | 120, 123 | todo · carril Mani |
| [ ] | 126 | [El embudo del formulario](./126-el-embudo-del-formulario.md) | — | en curso · Alejo · 1-oct: parte A hecha (por canal, tarjeta en el dashboard); falta la B (Insights por pregunta: token en la fuente = migración, ok de Mani) |
| [x] | 127 | [Deshacer la migración de un programa por su huella](./127-deshacer-la-migracion-por-huella.md) | 078 | done · 30-sep · Alejo (`87625fe`) · `npm run migracion:deshacer -- --programa <slug> [--aplicar]`: la reversa nivel 3 del corte (`operations.md` §12.3), probada en PGlite y en la base local; se niega sin borrar si alguien trabajó encima |

Enmendados el 29-sep por la reunión (bloque al final de cada archivo): 021, 051, 052, 062, 065, 067, 070,
071, 072, 077, 078, 083, 084, 085, 087, 088, 089, 090, 092, 093, 095, 100, 101, 102, 115. El 093 pasa a ser
la **vista interina de Pauta**, lo primero que se puede entregar.

# Época v2 — modelo HubSpot (tickets 036 a 082)

Orden y porqué: **[docs/plan.md](../plan.md)** (el plan v2 se fundió ahí el 27-sep). El diseño del que sale vive fuera del
repo y **manda sobre el plan en todo lo que sea diseño**:
`mani_vault/02 Projects/retia/notebook/crm-retia-modelo-hubspot-scaffold.md`.

**Regla que rige todas las etapas:** una etapa no se cierra sin `npm test`, `npm run typecheck` y
`npm run lint` limpios. **Las migraciones las genera y aplica la sesión principal, nunca un
subagente** (AGENTS.md).

## E0 · Enmiendas y ADRs — **done · 21-sep**

Sin una línea de código. Deja el terreno para que la etapa 1 sea un corte y no una serie de
remiendos.

| ✓ | Tarea | Estado |
|---|---|---|
| [x] | E0-1 · ADR **0035 a 0042** | done · 21-sep |
| [x] | E0-2 · `docs/spec.md` enmendada (insumo §11) | done · 21-sep · kanban entra, `onboarded_at` entra, comisión entra, cédula no, Calendly con PAT por programa, el histórico de C2 crece a migración one-time |
| [x] | E0-3 · Enmienda anotada en los ADR 0004, 0007, 0015, 0019, 0021, 0027, 0032 | done · 21-sep |
| [x] | E0-4 · Ticket 034 reescrito (absorbido) y 021 congelado | done · 21-sep |
| [x] | E0-5 · `docs/agents/context.md` con el vocabulario nuevo | done · 21-sep |
| [x] | E0-6 · Tickets 036 a 082 creados y registrados aquí | done · 21-sep |

🎯 **Decisión de Mani del 21-sep que cerró E1-4:** `sources` pasa a significar **solo** el intake
de leads crudos. Las **7** filas con `destino != people` se borran (eran insumo de la migración
inicial) y la pauta deja de entrar por Sheets: **el costo de una campaña se captura en el CRM**
(ADR 0039, tickets 039 y 067). El plan v2 §10 decía 5 filas; medido son 7.

## E1 · El esquema, de un solo corte

**Una rama y UNA migración (`0020`) para los siete.** Ninguno se fusiona a `main` por separado.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 036 | [`people` → `leads`, `estado` a texto, responsable fuera](./036-renombrar-people-a-leads.md) (E1-1) | — | done · 22-sep |
| [x] | 037 | [Las seis tablas del modelo nuevo](./037-las-tablas-del-modelo-nuevo.md) (E1-2) | 036 | done · 22-sep |
| [x] | 038 | [`calls` y `abonos` cuelgan del deal; `sales` se elimina](./038-calls-y-abonos-cuelgan-del-deal.md) (E1-3) | 037 | done · 22-sep |
| [x] | 039 | [Una sola fuente de leads por programa](./039-una-sola-fuente-de-leads-por-programa.md) (E1-4) | 036 | done · 22-sep |
| [x] | 040 | [`vigente()` cubre `deals`](./040-vigente-cubre-deals.md) (E1-5) | 037 | done · 22-sep |
| [x] | 041 | [`change_log` en las tablas operativas](./041-change-log-en-las-tablas-operativas.md) (E1-7) | 037, 038 | done · 22-sep |
| [x] | 042 | [Migración `0020`: `dev` y `production`](./042-migracion-0020-del-corte.md) (E1-6) | 036-041 | done · 22-sep · **aplicada en las dos ramas** |

## E1b · El esquema del origen y la atribución — **abierto el 21-sep**

Sale de la reunión con **Alejo Carvajal** y de las decisiones de Mani del 21-sep.
Decisiones: **ADR 0043, 0044 y 0045**. Argumento y medición: [plan v2 §12](../plan.md).

🩸 **Por qué existe:** el número que pidió Gerencia —*"cantidad de leads por área"*— hoy mostraría
**Comercial en cero**, porque un lead que trae un closer no deja rastro en ningún UTM. Y el costo de
la pauta y el origen de un lead **no se pueden cortar con la misma llave**, porque `ad_spend` guarda
la campaña en texto libre. Ninguna de las dos cosas lanza un error.

**Una rama y UNA migración para 083, 084, 092, 101 y 102.** *(1-oct: superado. 083 y 101 se hicieron; 084 se reemplazó; el 092 entra a la cola de la ola O1 con el ADR 0068 y el 102 lleva su propia migración.)* Ya no es la `0021`: ese número lo tomó
la de RLS del 23-sep (ADR 0047), así que es **la siguiente libre**. Léela línea por línea antes de aplicarla.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 083 | [El catálogo de áreas](./083-catalogo-de-areas.md) | 042 | done · 30-sep · 0045 en producción; Paid, Orgánico y Referidos sembradas por el molde; adelantado de E6 con ok de Mani |
| [x] | 084 | [`campanas` y `utm_patron`](./084-campanas-y-el-patron-utm.md) | 083 | reemplazado · 30-sep (Mani) · DP-25: sin patrones; la campaña de paid sale del árbol de Meta (120) y la de orgánico del texto crudo (085). 085 y 092 pasan a depender de 101; 067, de 120 |
| [x] | 085 | [El emparejador determinista y su guardián](./085-el-emparejador-determinista.md) | 101 | done · 30-sep · Mani · `lib/atribucion/emparejar.ts` (canal, campaña, anuncio por `utm_id`, contenido por formato, macros aparte, nivel N3-N0) y `utm-del-envio.ts`; el árbol de Meta entra como dato (lo conecta el 120); guardián en `tests/atribucion-emparejador.test.ts`. Sin migración |
| [ ] | 092 | [La URL del formulario y el generador de links](./092-url-del-formulario-y-generador-de-links.md) | 101 | todo · 🩸 **destapa que `programs` no tiene la URL del formulario**, sin la cual el 086 tampoco se puede calcular. Encogió el 21-sep: **sin árbol**. **24-sep: es el builder v1** (destinos con checkouts, canal, campaña, dos opcionales; ADR 0051) · **1-oct: ADR 0068**, el link sale de la fuente principal (`sources.url_publica`); sube a la cola de migraciones de la ola O1 |
| [x] | 101 | [El catálogo de Canales (el "Origen" del builder)](./101-catalogo-de-canales.md) | 083 | done · 30-sep · Mani · 0047 en producción; catálogo global con comodín de source, formato de content/term por canal, `/ajustes/canales` con envíos por canal y pares sin canal; 26 canales sembrados, 5.140 envíos clasificados y solo 5 de prueba sin canal |
| [ ] | 102 | [El rol Paid Trafficker y `manejaPauta`](./102-rol-paid-trafficker.md) | 094 | todo · 24-sep, ADR 0052 · migración de la sesión principal |

## E2 · El motor de etapas

El corazón del sistema, y la razón de que vaya **antes** que el sync.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 043 | [Las once etapas y la tabla de transiciones](./043-enum-de-etapas-y-tabla-de-transiciones.md) (E2-1) | 042 | done · 27-sep · `lib/deals/etapas.ts`, migración 0024 (Seguimiento; aplicada en `dev`) |
| [x] | 044 | [Requisitos de entrada por etapa](./044-requisitos-de-entrada-por-etapa.md) (E2-2) | 043 | done · 27-sep · `lib/deals/requisitos.ts`, por flecha y no por etapa |
| [x] | 045 | [`moverEtapa()` y su historial](./045-mover-etapa-y-su-historial.md) (E2-3) | 043, 044 | done · 27-sep · `lib/deals/mover-etapa.ts`, migración 0025 (aplicada en `dev`) |
| [x] | 046 | [Guardián: nadie escribe `deals.etapa` fuera del motor](./046-guardian-del-motor-de-etapas.md) (E2-4) | 045 | done · 27-sep · `tests/motor-etapas-guardian.test.ts` + reja en `lib/crm/rastro.ts` |
| [x] | 047 | [Saltos permitidos y retroceso con motivo](./047-saltos-permitidos-y-retroceso.md) (E2-5) | 045 | done · 27-sep · `abrirDeal()`: dónde nace un deal |
| [x] | 103 | [El motor con las decisiones de Mani del 27-sep](./103-motor-de-etapas-decisiones-de-mani.md) | 045, 046, 047 | done · 27-sep · cohorte destino aparte, motivos por tipo, solo dueño y administradores mueven (el admin también los sin dueño), la llamada que cuenta es la más reciente, motivo al perder, datos en el mismo movimiento · migración 0026 en `dev` |
| [x] | 104 | [Las cuatro listas de motivos, desde lo que ya usan](./104-las-cuatro-listas-de-motivos.md) | 103 | done · 27-sep · 13 motivos estandarizados desde `_ListasDropdown`, cargados en `dev` con `npm run cargar-motivos`; falta correrlo en producción cuando exista |

## E3 · Sync v2

Aquí es donde `estado` por fin se lee: cierra **F-01**, abierta desde agosto.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 048 | [Una sola función de ingesta](./048-una-sola-funcion-de-ingesta.md) (E3-1) | 042 | done · 28-sep · cierra con el traslado (111): `ingerirEntradas` la llaman el webhook y el traslado |
| [x] | 049 | [El Envío con todas las columnas](./049-el-envio-con-todas-las-columnas.md) (E3-2) | 048 | done · 28-sep · cierra con el traslado (111); migración 0022 ya en producción |
| [x] | 050 | [Identidad del Lead: el teléfono une **y marca**](./050-identidad-del-lead.md) (E3-3) | 048 | done · 28-sep · `resolverIdentidad` en `ingerirEntradas`; el traslado midió 69 uniones por teléfono y 2 teléfonos de otro lead (para el gerente, etapa 6) |
| [x] | 051 | [El Estado del lead es el que manda el formulario](./051-el-estado-del-lead-desde-el-envio.md) (E3-4) | 049, 050 | done · 27-sep noche · `lib/ingesta/estado.ts` traduce, no califica; T2 desconectado; migración 0027 en `dev` |
| [x] | 052 | [La regla de creación y movimiento de deals](./052-regla-de-creacion-y-movimiento-de-deals.md) (E3-5) | 051, 045 | done · 28-sep: la cita se lee en Calendly antes de la transacción (`lib/calendly/resolver-cita.ts`); cita vigente → Agendado con su llamada (`calendly:<uuid>`); cancelada, no encontrada o error → Pendiente Setteo con nota del sistema en el deal (migración **0032**). Falta el envío real, que es del 106 |
| [x] | 053 | [Zona horaria por fuente](./053-zona-horaria-por-fuente.md) (E3-6) | 039, 049 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 054 | [Configurar una fuente sin adivinar](./054-configurar-una-fuente-de-verdad.md) (E3-7) | 039 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 055 | [Alertas: una fuente se rompe, no se apaga](./055-alertas-y-fuente-rota.md) (E3-8) | 054 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 056 | [El sync se dispara por capas](./056-disparo-del-sync-por-capas.md) (E3-9) | 048 | reemplazado · 28-sep · el sync de Sheets se descarta (Mani); lo retira el 108 |
| [x] | 105 | [La fuente webhook: un formulario es una fila](./105-la-fuente-webhook.md) | 048 | done · 28-sep: la forja desde una sesión de closer la hizo Mani |
| [x] | 106 | [La ruta del webhook y el adaptador de Typeform](./106-la-ruta-del-webhook-y-el-adaptador-de-typeform.md) | 105, 051 | done · 28-sep: envíos reales de los dos programas en producción. Cierre en el ADR **0058**: caja negra (migración **0034**), nombre del lead (**0033**), un solo mapeo webhook/hoja, variables genéricas, `xxxxx` = sin UTM, re-agenda crea su llamada, matriz de casos (`tests/webhook-matriz.test.ts`). Fuera: el parcial real (el equipo decide el Partial Submit Point) |
| [x] | 107 | [Una fuente que dejó de recibir se ve en la app](./107-aviso-de-fuente-sin-envios.md) | 106 | done · 28-sep · `lib/queries/salud-fuentes.ts` (calculado, nada guardado); marca por fuente y umbrales editables en `/ajustes/fuentes`; migración **0035** aplicada en producción |
| [x] | 110 | [La salud del CRM: cada entrega de webhook, a la vista](./110-la-salud-del-crm.md) | 106 | done · 28-sep · código, tests y `/ajustes/salud` en `main`; migración 0037 en producción; conciliación en 0 tras el traslado (ComunicArte 2.739/2.739, Tactical 3.304/3.304). El pulido de la pantalla va al 075 |
| [x] | 111 | [Traslado de leads y envíos desde Sheets](./111-traslado-desde-sheets.md) | 106, 048 | done · 28-sep · `npm run trasladar -- --aplicar` corrió en producción con el ok de Mani: 2.465 leads de ComunicArte (con los 65 de Forms viejo, el 079) y 2.877 de Tactical; segundo ensayo = 0 nuevos. La ingesta escribe el resumen por lotes (ensayo de 12+ min a 2 min) |
| [x] | 108 | [Retirar el sync de Sheets](./108-retirar-el-sync-de-sheets.md) | 106 | done · 28-sep · cron, ruta manual, botón, `lib/sheets/sync.ts`, `plan-sync.ts`, `origen.ts`, scripts y sus tests fuera; `sync_runs` queda como historial. Falta quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel (`GOOGLE_SERVICE_ACCOUNT_JSON_B64` se queda: probar una fuente de hoja la usa) |
| [x] | 109 | [El programa lleva su formulario y su token de Calendly](./109-formulario-y-token-de-calendly-del-programa.md) | 105 | done · 28-sep: migración **0030**; Forms Link y Calendly Token obligatorios en `/ajustes/programas` (un programa no se activa sin los dos); la lectura de la cita (hoy `citaDeCalendly`) probada contra Calendly real; migración **0031**: nace inactivo y un CHECK exige los dos; Mani cargó los dos tokens y se borraron de `.env.local` |
| [ ] | 086 | [Origen humano del lead y el enlace de captación](./086-origen-humano-y-enlace-de-captacion.md) | 085, 092 | todo · ⏳ **el dato lo escribe la ingesta; después no se puede reconstruir** |
| [x] | 087 | [🩸 El CPL deja de preguntar por `entrada`](./087-el-cpl-deja-de-preguntar-por-entrada.md) | 085, 086 | done · 30-sep · Mani · no había CPL en el código ni gasto: la regla queda en el ADR 0044 punto 5 (enmendado), el área la da `emparejar` y el denominador por token lo construye el 123. `leads.entrada` solo dice por dónde entró |

## E4 · Calls, dinero y Students

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 057 | [Las Calls cuelgan del deal](./057-calls-colgadas-del-deal.md) (E4-1) | 052 | done · 28-sep · `agregarLlamada` y `completarAgendada` en `lib/deals/llamadas.ts`; migración 0036 |
| [x] | 058 | [Pegar el Grain = la llamada sucedió](./058-grain-significa-que-la-llamada-sucedio.md) (E4-2) | 057 | done · 28-sep · `pegarGrain`: show, fecha si faltaba y Atendido (T10/T7), en una transacción |
| [x] | 059 | [`no_show` y `cancelada` van a Re-agenda](./059-no-show-y-cancelada-van-a-reagenda.md) (E4-3) | 057 | done · 28-sep · `marcarFallida`: Re-agenda desde Agendado (T8) y desde Atendido con motivo (T29) |
| [x] | 060 | [Abonos sobre el deal](./060-abonos-sobre-el-deal.md) (E4-4) | 057, 045 | done · 28-sep · `lib/deals/abonos.ts` (`registrarAbono`, `anularAbono`) + `tests/abonos-del-deal.test.ts` y `tests/saldo-centralizado.test.ts` recreado. Sin migración. Falta la pantalla para registrar/anular (074) y el comprobante con foto (035) |
| [x] | 061 | [Acuerdo de pago y cartera vencida](./061-cuotas-pactadas-y-cartera-vencida.md) (E4-5) | 060 | done · 28-sep · `lib/deals/pago.ts` (`editarAcuerdoDePago`, `fechaLimiteMaxima`) y `lib/queries/cartera.ts` (`carteraVencida`); sin migración (las columnas ya venían de la 0025). Falta la pantalla (074) y la cartera en el día del closer (071) |
| [x] | 062 | [La comisión se calcula, nunca se guarda](./062-comision-calculada.md) (E4-6) | 060 | done · 29-sep (Alejo) · monto fijo por venta en `programs.comision_por_venta_usd` (0044), `lib/queries/comision.ts`, columna en el comparativo; montos 80 y 100 cargados; corrige el doble conteo de cierres entre periodos |
| [x] | 063 | [`onboarded_at` y cambio de cohorte](./063-onboarded-at-y-cambio-de-cohorte.md) (E4-7) | 060 | done · 28-sep · `lib/deals/estudiante.ts` (`marcarOnboarded`, `cambiarCohorte`), `lib/queries/estudiantes.ts` (Students es una consulta) y la cohorte activa se asigna sola en el primer abono. Sin migración. Falta la pantalla (074) |
| [ ] | 035 | [Comprobante: link **o** foto](./035-comprobante-link-o-foto.md) (E4-8) | 060 | todo · **aterriza aquí**, colgando de `abonos.deal_id`. Siguen debiéndose los dos análisis. 22-sep: la foto va a Supabase Storage (ADR 0047) |
| [x] | 096 | [Calendly: cada llamada a su deal; si hay duda, suelta](./096-calendly-cuelga-llamadas-de-deals.md) | 057, 045 | done · 29-sep · código completo y live; webhook verificado en los dos programas; 0038 y 0039 aplicadas; Maru creada y cuentas vinculadas en producción desde `/ajustes/usuarios` (ComunicArte: `soymarumarquez@gmail.com`; Tactical: `equipo@ttrading.co`) |

## E5 · Lectura y reporting

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 064 | [Dashboard sobre deals](./064-dashboard-sobre-deals.md) (E5-1) | 060 | done · sesión 47 · cierres desde deal_etapa_historial, dueño por ownerUserId, show centralizado |
| [ ] | 065 | [Conversión etapa a etapa y tiempo en etapa](./065-funnel-por-etapa.md) (E5-2) | 064 | todo |
| [x] | 066 | [Réplica de `🚨 Urgencias` con desglose UTM](./066-replica-de-urgencias.md) (E5-3) | 064 | done · `cp-20261002-4` · 2-oct · Alejo · Urgencias con desglose por canal y las dos cubetas |
| [ ] | 067 | [ROAS por cohorte y captura de pauta](./067-roas-por-cohorte-y-captura-de-pauta.md) (E5-4) | 064, 120 | todo |
| [x] | 068 | [`nerd-stats` reescrito](./068-nerd-stats-reescrito.md) (E5-5) | 064 | done · `cp-20261002-4` · 2-oct · Alejo · Nerd Stats sobre el modelo nuevo, sin cron |
| [x] | 093 | [Filtros por UTM con lo que YA hay](./093-filtros-utm-con-lo-que-ya-hay.md) | — | done · 29-sep · vista interina de Pauta en el dashboard: registros, agendas por el origen del deal, sin UTM (Tactical 25,3%) y macros aparte; drill-down canal → campaña → content/term |
| [x] | 088 | [Registros vs agendas por canal](./088-registros-vs-agendas-por-canal.md) | 049, 052, 085 | done · 1-oct · Alejo · reagrupa la serie de Pauta (093) por canal, con área y tasa; tarjeta en el dashboard |
| [x] | 089 | [Series con dimensiones, no escalares](./089-series-con-dimensiones.md) | 064, 085 | done · 30-sep · Mani · `lib/queries/serie.ts` (tipo con `programId` obligatorio, `periodoAnterior`) y `hechosDelEmbudo` en `lib/queries/hechos-embudo.ts` (día × área × canal × dueño × cohorte; primer llamador real de `emparejar`); filtro `?area=` en el dashboard; `dashboard.ts` no se reescribió |
| [ ] | 090 | [Rendimiento por área](./090-rendimiento-por-area.md) | 085, 088, 089 | todo · la vista de **Gerencia**. Estados con acción, no una tabla |
| [x] | 095 | [La tab Dashboard: un programa o "todos" solo con lo sumable](./095-dashboard-con-selector-y-todos-los-programas.md) | 064, 089, 094, 136, 137 | done · 1-oct · Mani · checkpoint `cp-20261001-1` · `sumarConteos` y `sumarDinero`: "todos" solo suma conteos y caja por moneda; tasas, metas y comisión por programa. Lo del paid trafficker queda para el 102 |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) (E5-6) | 064, 065, 066, 067 | **congelado hasta aquí** · se descongela con el dashboard nuevo, no antes |

## E6 · UI

⚠️ **Antes de abrir esta etapa hay que decidir la garantía** (ticket 075): o entran tests de
componente, o la garantía sigue siendo el recorrido visual a mano **haciendo clic en todo lo que
se abre**. Este repo no tiene tests de componentes y el 20-sep dos bugs pasaron con 669 en verde.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 094 | [Un closer ve solo sus programas](./094-alcance-del-closer-por-membresia.md) | — | done · 27-sep · `lib/auth/alcance.ts`; dashboard, sidebar, buscador y ficha por id lo usan; ajeno = 404 |
| [x] | 097 | [Navegación por objetos y selector de programa](./097-navegacion-por-objetos-y-selector-de-programa.md) | 094 | done · 29-sep (Alejo): tabs por objeto en `/p/<programa>/<tab>` y selector de programa (`39bf931`, `d953769`); celular revisado en producción (cajón, selector y menú encima, sin scroll horizontal a 390 px) |
| [x] | 069 | [Kanban por programa](./069-kanban-por-programa.md) (E6-1) | 057, 097 | done · 29-sep · `/p/<programa>/deals`: tablero con arrastre nativo y menú "Mover a…", todo por `moverEtapa` desde una server action con el actor de la sesión; filtros por URL; `ETAPAS_EN_ORDEN` en `lib/deals/etapas.ts`. Login local para `dev:local`. Recorrido contra la base local con consola abierta (escritorio y 390 px emulados). Falta: probarlo en un celular de verdad y la vista tabla |
| [x] | 070 | [Pendiente Setteo y Unclaimed](./070-pendiente-setteo-y-unclaimed.md) (E6-2) | 069 | done · 29-sep · `/p/<programa>/inbox`: Agendados sin dueño (por antigüedad) y Pendiente Setteo (score de Typeform desc, sin score al final, luego recencia), con el origen por UTM. `reclamarDeal` (fila bloqueada: el segundo reclamo es 409) y reasignar por `editarDeal`. El score entra por la llave `puntaje` del mapeo de la fuente (sin defecto). Implementó Kiro; revisión, recorrido local y reclamo forjado por la sesión principal. Score, calidad y valor configurados el 29-sep en las dos fuentes (`puntaje`, `leadQuality`, `leadValue`); 0041 aplicada en producción; fix del resumen del lead (`decideValores`). Leads previos recalculados. Falta: verificar con un envío nuevo; "quién lo trajo" (llega con el 086) |
| [x] | 071 | [El Inbox (antes Mis deals)](./071-mi-dia-del-closer.md) (E6-3) | 069, 061, 070, 096, 097 | done · 29-sep · código en `main`; recorrido visual funcional a 390 px realizado con consola y estados/interacciones revisados |
| [x] | 072 | [Base de Leads con filtros](./072-base-de-leads-con-filtros.md) (E6-4) | 069 | done · 1-oct · Alejo · tab Leads, filtros y separar/confirmar; recorrido en escritorio contra la base local sin errores de consola. El de 390 px se descartó (Alejo, 1-oct: ya no interesa) |
| [x] | 098 | [La tab Calls](./098-tab-calls.md) | 057, 096, 097 | done · 29-sep · ruta `/p/<programa>/calls`, filtros, llamadas sueltas, Grain y resultados; recorrido visual funcional a 390 px realizado con consola |
| [x] | 099 | [La tab Students por cohorte](./099-tab-students-por-cohorte.md) | 060, 061, 097 | done · 30-sep · Alejo · recorrido visual hecho (claro/oscuro, 390 px, consola); un deal en Completo ya no muestra fecha límite |
| [x] | 100 | [La tab Programs](./100-tab-programs-ficha-del-programa.md) | 097, 101 | done · `cp-20261002-2` · 2-oct (Alejo) · ficha del programa: destinos, Calendly, comisión, cohortes, fuentes y equipo; recorrido visual hecho |
| [x] | 073 | [Ficha del Lead, con el diff entre envíos](./073-ficha-del-lead.md) (E6-5) | 072 | done · `cp-20261002-2` · 2-oct (Alejo; recorrido de la sesión principal, con dos arreglos de pantalla) |
| [x] | 074 | [Ficha del Deal](./074-ficha-del-deal.md) (E6-6) | 069, 060 | done · 29-sep · `/p/<programa>/deals/<id>`: cabecera, llamadas, pago y abonos, actividades e historial en una pantalla; `editarDeal`, `anularDeal` (rechaza con abonos vigentes y anula en cascada sus llamadas), `registrarActividad`; `puedeTrabajarDeal` (`lib/deals/permiso.ts`) y `duenosPosibles` (`lib/deals/duenos.ts`) en un solo lugar. Recorrido contra la base local (escritorio y 390 px) y permiso mordido forjando la acción. 1.415 tests. Falta: celular de verdad y ver el prellenado de Compromiso Verbal con un deal Atendido |
| [ ] | 075 | [Revisión profunda de TODA la UI](./075-revision-profunda-de-la-ui.md) (E6-8) | 069-074 | todo |
| [x] | 128 | [Las alertas del Deal: qué urge y qué le falta para avanzar](./128-alertas-del-deal.md) | 074, 071, 135 | done · `cp-20261002-4` · 2-oct · Mani · alertas en la ficha del deal (rojo del Inbox, amarillo de `queLeFalta`, aviso en En gestión); el indicador del Kanban queda opcional en el ticket |
| [x] | 129 | [Motivos de pérdida y Origen del lead salen vacíos en el Dashboard](./129-dashboard-motivos-y-origen-vacios.md) | — | done · `cp-20261002-4` · 2-oct · Mani · motivos por `deals.motivo_id`; Origen del lead por canal desde `hechosDelEmbudo` (envíos, agendas, shows, ventas; sin UTM y sin clasificar aparte) |
| [x] | 130 | [El adaptador de Dapta Forms](./130-el-adaptador-de-dapta.md) | 117 | done · 1-oct (Mani) · seis envíos reales en ComunicArte revisados en la base; 🩸 las UTM de Dapta se perdían (`utm.utm_source`), arregladas y verificadas en producción; contrato de proveedores con cuerpos reales |
| [x] | 131 | [Varios formularios activos por programa](./131-varios-formularios-activos-por-programa.md) | — | done · 30-sep · 0050 aplicada · el link de captación sigue en `programs.form_url` (A11) |
| [x] | 114 | [Auditoría de cálculos y reglas fijas](./114-auditoria-de-calculos-fijos.md) | · | done · 30-sep · A1-A3 arreglados; B5 (0046, `sources.calificacion` fuera) y C6 (solo USD) hechos; B4 pasa al 117 |
| [x] | 115 | [El origen es del envío; el deal recuerda el envío que lo abrió](./115-el-origen-es-del-envio.md) | · | done · 29-sep · el deal guarda el envío que lo abrió; relleno 69/69; migración 0043 quita `leads.utm_*` (con `lock_timeout`) |
| [x] | 076 | [Bitácora en Nerd Stats](./076-bitacora-en-nerd-stats.md) (E6-7) | 068, 041 | done · `cp-20261002-4` · 2-oct · Alejo · bitácora en Nerd Stats (change_log y movimientos de etapa) |
| [x] | 091 | [`otrosProgramasDelCorreo`: visibilidad cruzada](./091-otros-programas-del-correo.md) | 073 | done · `cp-20261002-2` · 2-oct (Alejo) · el aviso en la ficha del lead; una consulta, ninguna métrica la usa |

## E7 · Migración one-time

Va de último, con el scaffold completo. Absorbe el "histórico de C2" de la spec §7 con más alcance.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 077 | [Barrer las pestañas de gestión](./077-barrer-las-pestanas-de-gestion.md) (E7-1) | 111 | done · 29-sep · Alejo · las ocho pestañas leídas (encabezados reales) y su mapeo escrito en el ticket; el extractor del 078 lo implementa y ninguna fila se descarta en silencio (deal, llamada, sin deal por alcance o rareza) |
| [ ] | 078 | [Pasa por la MISMA ingesta, nunca inserts crudos](./078-la-migracion-pasa-por-la-misma-ingesta.md) (E7-2) | 077 | en curso · ⏭️ **2-oct (Mani): va al final de la ola O2, después de 152, 153 y 143.** Plan de cierre, decisiones y orden por programa (CA y luego TI, con barrido de hoy y tabla aprobada por Mani antes del código) en su archivo, sección "Plan de cierre" · antes: en `main` el 29-sep, ensayo contra producción el 30-sep con las etapas viejas |
| [x] | 079 | [Recuperar las 55 de `Forms viejo`](./079-recuperar-las-55-de-forms-viejo.md) (E7-3) | 111 | done · 29-sep · cerrado por el traslado (111), que lo tenía en su alcance: `Forms viejo` entró en la misma corrida (ComunicArte 2.465 leads, conciliación 2.739/2.739) |
| [x] | 080 | [Los casos raros de la migración](./080-los-casos-raros-de-la-migracion.md) (E7-4) | 078 | done · 30-sep · Alejo · decisiones escritas, `/ajustes/migracion` recorrida; en CA la Categoría vive en `Registro 2` (`d01c461`): **regenerar el template de CA antes de aplicar el 078** |
| [x] | 081 | [COP → USD a la tasa del día](./081-cop-a-usd-en-la-migracion.md) (E7-5) | 078 | descartado · 28-sep (Mani): *"solo usamos USD aquí"*. No hay conversión ni tasa ni marca de abono convertido; un monto que aparezca en COP al barrer se lista como rareza (080) y no se convierte |
| [ ] | 082 | [Apagar las pestañas de gestión](./082-apagar-las-pestanas-de-gestion.md) (E7-6) | 079, 080 | todo · lo hace Mani |

---

# Época MVP (tickets 001 a 035) — ejecutada

Se conserva como historia. **Tres siguen abiertos:** 007 (partido), 021 (congelado hasta E5) y
035 (se muda a E4).

## F0 · Contrato de extensión

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 008 | [Renombrar Corte a Cohorte](./008-renombrar-corte-a-cohorte.md) | — | done · 16-sep (migración 0002 en `production`) |
| [x] | 009 | [Test guardián de slugs](./009-test-guardian-de-slugs.md) | — | done · 16-sep (`it.fails` hasta 010) |
| [x] | 010 | [Programas dinámicos](./010-programas-dinamicos.md) | 008, 009 | done · 16-sep (prueba manual en base real pendiente) |
| [x] | 011 | [Molde de catálogo + plataformas de pago](./011-molde-de-catalogo-y-plataformas.md) | 008 | done · 16-sep (migración 0003 en `production`; ADR 0020) |
| [x] | 012 | [Catálogos de motivos y orígenes](./012-catalogos-motivos-y-origenes.md) | 011 | done · 16-sep (migración 0004 en `production`) |
| [x] | 013 | [Pantalla de catálogos](./013-pantalla-de-catalogos.md) | 011 | done · 16-sep · **enmienda cerrada el 20-sep** (ADR 0034: plataformas por programa, selectores acotados, `/ajustes` por rol) |
| [x] | 014 | [Administrar programas y cohortes](./014-administrar-programas-y-cohortes.md) | 010, 011 | done · 16-sep (migración 0006 en `production`) |
| [x] | 015 | [Administrar usuarios y closers](./015-administrar-usuarios-y-closers.md) | 011 | done · 16-sep (migración 0005 en `production`; login real pendiente) |
| [x] | 016 | [Plantilla de lead + fuentes configurables](./016-fuentes-configurables.md) (ADR 0019) | 014 | done · 19-sep (migración 0018 en `dev` y `production`; `/ajustes/fuentes` deja de ser solo lectura; mapeo combinado campo por campo; una fuente ACTIVA siempre cuadra) |
| [x] | 030 | [Borrar del catálogo lo que nunca se usó](./030-borrar-del-catalogo.md) (ADR 0026) | 011 | done · 20-sep · los SEIS catálogos borran desde la app · falta el recorrido visual |

## F1 · Llamadas y ventas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 001 | [plataformaPago como enum](./001-reemplazado-plataforma-pago.md) | — | reemplazado por 011 |
| [x] | 017 | [Productos por programa](./017-productos-por-programa.md) | 011 | done · 16-sep (migración 0007 en `dev` y `production`; productos sin sembrar en `production`) |
| [x] | 018 | [Esquema del registro + abonos](./018-esquema-registro-y-abonos.md) | 012, 017 | done · 17-sep (migración 0008 en `dev` y `production`) |
| [x] | 002 | [cohorteActiva + registrarLlamada](./002-cohorte-activa-y-mutacion-registro.md) | 018 | done · 17-sep (sesión paralela A) |
| [x] | 019 | [Registrar abono](./019-registrar-abono.md) | 018 | done · 17-sep (`registrarAbono` + `saldoDeVenta`, sin migración) |
| [x] | 026 | [Responsable + alta manual](./026-responsable-y-alta-manual.md) (ADR 0021) | 015 | done · 17-sep (sesión paralela C; migración 0010 en `dev` y `production`) |
| [x] | 003 | [Pantalla /mi-dia](./003-pantalla-mi-dia-registro.md) | 002, 019, 015, 026 | done · 17-sep (buscador, registro y abonos sobre las mutaciones de 002/019/026; sin migración) |
| [x] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | done · 2-oct · Mani · Maru, Andrea y Jero con cuenta en producción. El criterio 2 (`registrarLlamada`) quedó obsoleto el 21-sep. Los closers nuevos se dan de alta en `/ajustes/usuarios` con `closer_id`, membresías y correo de Calendly |
| [x] | 029 | [Anular un registro](./029-anular-registros.md) (ADR 0026, ADR 0027) | 003, 019 | done · 18-sep (migraciones 0013 y 0014 en `dev` y `production`; desplegado; recorrido visual hecho, 3 hallazgos arreglados) |

## F2 · Métricas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 020 | [Días hábiles + meta dinámica](./020-dias-habiles-y-meta-dinamica.md) | 008 | done · 16-sep |
| [x] | 027 | [Ventana de venta de la cohorte](./027-ventana-de-venta-de-la-cohorte.md) (ADR 0022) | 014 | done · 17-sep (migración 0009 en `dev` y `production`) |
| [x] | 004 | [Consultas del dashboard](./004-consultas-dashboard.md) | 018, 020, 027 | done · 17-sep (sesión paralela B) |
| [x] | 005 | [Dashboard en /programas/[slug]](./005-dashboard-real-programas.md) | 004, 010 | done · 17-sep (filtro por closer dentro de las consultas del 004; sin migración) |
| [x] | 006 | [Historial de una persona](./006-historial-persona.md) | 005 | done · 17-sep (`/personas/[id]` de solo lectura; se entra desde el buscador de `/mi-dia`; sin migración) |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) | 005 | **CONGELADO hasta la etapa 5** del plan v2 (21-sep): el dashboard que fotografiaria esta por ganar funnel por etapa, Urgencias y ROAS; hacerlo antes es hacerlo dos veces. Nota previa: desbloqueado 19-sep: formato PDF y lo toman los dos roles. Sigue de último |
| [ ] | 035 | [Comprobante: link **o** foto subida](./035-comprobante-link-o-foto.md) | 019 | todo · **se muda a la etapa 4** del plan v2 (21-sep): colgara de `abonos.deal_id`. Siguen debiendose los dos analisis. Nota previa: nuevo 20-sep (Mani) · enmienda PARCIAL al ADR 0017: los recursos siguen siendo links · pide analisis de crecimiento y de control de acceso antes de codear |
| [x] | 034 | [Categorías de lead dinámicas](./034-categorias-de-lead-dinamicas.md) (ADR 0032) | 016 | **reemplazado · 21-sep** · absorbido por [plan-crm-v2](../plan.md): su alcance ES el insumo §2.2. El backfill desde `people.raw` ya NO aplica (el primer sync v2 reconstruye los envios desde la hoja) y `estado` enum→texto pasa al corte de la etapa 1. Nota previa: el más grande que queda · cierra F-01 y F-06 · Mani lo quiere en sesión propia · necesita migración |

## F3 · Recursos

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 022 | [Recursos + enlaces de pago](./022-recursos-y-enlaces-de-pago.md) | 011, 017 | done · 17-sep (migración 0011 en `dev` y `production`; enlaces reales sin cargar) |
| [x] | 023 | [Pantalla de Recursos](./023-pantalla-de-recursos.md) | 022 | done · 17-sep (`/recursos`; `/documentos` redirige; sin migración; falta revisión visual en celular) |

## F4 · Nerd Stats

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 024 | [Rol developer](./024-rol-developer.md) | 010 | done · 17-sep (ADR 0025; migración 0012 en `dev` y `production`; stash de Kiro rescatado y cerrado) |
| [x] | 025 | [Nerd Stats](./025-nerd-stats.md) | 024 | done · 17-sep (`/nerd-stats`, primera ruta exclusiva de developer; sin migración) |
| [x] | 028 | ["Ver como" del developer](./028-ver-como-del-developer.md) (ADR 0028) | 024 | done · 18-sep · `rolDeVista` + cookie + selector + guardián sobre `app/` y `lib/`. 543 tests. **Sin migración.** La primera entrega dejó 3 sitios pasando el rol crudo que el guardián no veía: ver la nota del ticket |
| [x] | 031 | [Perfil propio: el closerId sin pasar por /ajustes/usuarios](./031-perfil-propio.md) | 028 | done · 18-sep · decisión cerrada (**opción 1**: solo `esAdministrador` edita; un closer lo ve en lectura). `/perfil` nuevo, mutación por el molde, el id sale SIEMPRE de la sesión. 556 tests. ✅ **recorrido en navegador hecho**: el menú abre sin tumbar el layout, escritura real con su fila en `change_log`, y la server action **invocada a mano saltándose la UI** devuelve 403 en vista `closer` |
| [x] | 032 | [La vista `todo` es MENOS capaz que la vista `closer`](./032-el-developer-no-puede-crear-persona.md) | 028 | done · 18-sep · `trabajaLeads` en vez del literal, guardián ampliado a cualquier `.rol` y a `scripts/`, y un test que fija **vista `todo` ⊇ vista `closer`**. 545 tests |
| [x] | 033 | [`Mani` y `mani` no pueden ser dos closers](./033-identidad-del-closer-sin-mayusculas.md) (ADR 0030) | 028 | done · 18-sep · salio del primer recorrido REAL en `production` (criterios 1, 5 y 6 ejercidos; sus datos de prueba ya borrados). `lib/closers/identidad.ts` + indice unico sobre la forma normalizada (migracion **0015**, aplicada en `dev` y `production`) + guardian. 570 tests |

## Lo que antes vivía aquí

Las secciones narrativas de este archivo se movieron el 27-sep a su lugar:

| Antes aquí | Ahora en |
|---|---|
| Decisiones pendientes | `docs/plan.md` §7 (la lista única) |
| Decisiones resueltas | el ADR de cada una; las que no tienen ADR, en `docs/overview.md` |
| Incidente del 16-sep, deuda técnica heredada | `docs/operations.md` §9 y §10 |
| Ideas sin decidir y futuro | resueltas, o en `docs/overview.md` §8 (fuera de v1) |

El texto anterior: `git show da68cdf:docs/tasks/README.md`.
