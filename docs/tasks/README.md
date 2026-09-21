# Tracker — Retia CRM

Este es el **único lugar** donde se marca el avance. Cada ticket tiene su archivo con objetivo,
alcance y criterios de "done"; aquí solo va el estado. Al cerrar un ticket: marcar la casilla,
cambiar `status: done` en su archivo y anotar la fecha.

Estados: `todo` · `en curso` · `done` · `bloqueado` · `reemplazado`.
Un ticket está **listo** cuando todos los de su columna "Depende de" están en `done`.

Orden y porqué: **[docs/plan-crm-v2.md](../plan-crm-v2.md)** para la época viva; [docs/plan.md](../plan.md)
para el MVP ya ejecutado. Alcance: [docs/spec.md](../spec.md).

> ⚠️ **21-sep: se abrió la época siguiente.** El CRM pasa al modelo HubSpot (Lead, Envío,
> Deal, diez etapas). El plan de ejecución, con el estado medido de `production` y el impacto
> sobre los tickets de abajo, está en **[docs/plan-crm-v2.md](../plan-crm-v2.md)**. Léelo antes
> de tomar cualquier ticket: el **034 queda absorbido**, el **021 congelado**, el **007 partido**
> y el **035 se muda a la etapa 4**.
>
> **El trabajo vivo son las etapas E1 a E7 (tickets 036 a 082), abajo.** Las fases F0 a F4 son el
> MVP, ya ejecutado: se conservan como historia y porque tres de sus tickets siguen abiertos
> (007, 021, 035). Decisiones: **ADR 0035 a 0042**, más las enmiendas del 21-sep en los ADR
> 0004, 0007, 0015, 0019, 0021, 0027 y 0032.

# Época v2 — modelo HubSpot (tickets 036 a 082)

Orden y porqué: **[docs/plan-crm-v2.md](../plan-crm-v2.md)**. El diseño del que sale vive fuera del
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
| [~] | 042 | [Migración `0020`: `dev`, y `production` con el ok de Mani](./042-migracion-0020-del-corte.md) (E1-6) | 036-041 | **aplicada en `dev` · 22-sep**; `production` pendiente del ok de Mani |

## E2 · El motor de etapas

El corazón del sistema, y la razón de que vaya **antes** que el sync.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 043 | [Las diez etapas y la tabla de transiciones](./043-enum-de-etapas-y-tabla-de-transiciones.md) (E2-1) | 042 | todo |
| [ ] | 044 | [Requisitos de entrada por etapa](./044-requisitos-de-entrada-por-etapa.md) (E2-2) | 043 | todo |
| [ ] | 045 | [`moverEtapa()` y su historial](./045-mover-etapa-y-su-historial.md) (E2-3) | 043, 044 | todo |
| [ ] | 046 | [Guardián: nadie escribe `deals.etapa` fuera del motor](./046-guardian-del-motor-de-etapas.md) (E2-4) | 045 | todo |
| [ ] | 047 | [Saltos permitidos y retroceso con motivo](./047-saltos-permitidos-y-retroceso.md) (E2-5) | 045 | todo |

## E3 · Sync v2

Aquí es donde `estado` por fin se lee: cierra **F-01**, abierta desde agosto.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 048 | [Una sola función de ingesta](./048-una-sola-funcion-de-ingesta.md) (E3-1) | 042 | todo |
| [ ] | 049 | [El Envío con todas las columnas](./049-el-envio-con-todas-las-columnas.md) (E3-2) | 048 | todo |
| [ ] | 050 | [Identidad del Lead: el teléfono une **y marca**](./050-identidad-del-lead.md) (E3-3) | 048 | todo |
| [ ] | 051 | [`lead.estado` desde el envío completo más reciente](./051-el-estado-del-lead-desde-el-envio.md) (E3-4) | 049, 050 | todo |
| [ ] | 052 | [La regla de creación y movimiento de deals](./052-regla-de-creacion-y-movimiento-de-deals.md) (E3-5) | 051, 045 | todo |
| [ ] | 053 | [Zona horaria por fuente](./053-zona-horaria-por-fuente.md) (E3-6) | 039, 049 | todo |
| [ ] | 054 | [Configurar una fuente sin adivinar](./054-configurar-una-fuente-de-verdad.md) (E3-7) | 039 | todo |
| [ ] | 055 | [Alertas: una fuente se rompe, no se apaga](./055-alertas-y-fuente-rota.md) (E3-8) | 054 | todo |
| [ ] | 056 | [El sync se dispara por capas](./056-disparo-del-sync-por-capas.md) (E3-9) | 048 | todo |

## E4 · Calls, dinero y Students

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 057 | [Las Calls cuelgan del deal](./057-calls-colgadas-del-deal.md) (E4-1) | 052 | todo |
| [ ] | 058 | [Pegar el Grain = la llamada sucedió](./058-grain-significa-que-la-llamada-sucedio.md) (E4-2) | 057 | todo |
| [ ] | 059 | [`no_show` y `cancelada` van a Re-agenda](./059-no-show-y-cancelada-van-a-reagenda.md) (E4-3) | 057 | todo |
| [ ] | 060 | [Abonos sobre el deal](./060-abonos-sobre-el-deal.md) (E4-4) | 057, 045 | todo |
| [ ] | 061 | [Cuotas pactadas y cartera vencida](./061-cuotas-pactadas-y-cartera-vencida.md) (E4-5) | 060 | todo |
| [ ] | 062 | [La comisión se calcula, nunca se guarda](./062-comision-calculada.md) (E4-6) | 060 | todo |
| [ ] | 063 | [`onboarded_at` y cambio de cohorte](./063-onboarded-at-y-cambio-de-cohorte.md) (E4-7) | 060 | todo |
| [ ] | 035 | [Comprobante: link **o** foto](./035-comprobante-link-o-foto.md) (E4-8) | 060 | todo · **aterriza aquí**, colgando de `abonos.deal_id`. Siguen debiéndose los dos análisis |

## E5 · Lectura y reporting

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 064 | [Dashboard sobre deals](./064-dashboard-sobre-deals.md) (E5-1) | 060 | todo |
| [ ] | 065 | [Conversión etapa a etapa y tiempo en etapa](./065-funnel-por-etapa.md) (E5-2) | 064 | todo |
| [ ] | 066 | [Réplica de `🚨 Urgencias` con desglose UTM](./066-replica-de-urgencias.md) (E5-3) | 064 | todo |
| [ ] | 067 | [ROAS por cohorte y captura de pauta](./067-roas-por-cohorte-y-captura-de-pauta.md) (E5-4) | 064 | todo |
| [ ] | 068 | [`nerd-stats` reescrito](./068-nerd-stats-reescrito.md) (E5-5) | 064 | todo |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) (E5-6) | 064, 065, 066, 067 | **congelado hasta aquí** · se descongela con el dashboard nuevo, no antes |

## E6 · UI

⚠️ **Antes de abrir esta etapa hay que decidir la garantía** (ticket 075): o entran tests de
componente, o la garantía sigue siendo el recorrido visual a mano **haciendo clic en todo lo que
se abre**. Este repo no tiene tests de componentes y el 20-sep dos bugs pasaron con 669 en verde.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 069 | [Kanban por programa](./069-kanban-por-programa.md) (E6-1) | 065 | todo |
| [ ] | 070 | [Pendiente Setteo y Unclaimed](./070-pendiente-setteo-y-unclaimed.md) (E6-2) | 069 | todo |
| [ ] | 071 | [Mis deals · mis Calls de hoy · cartera vencida](./071-mi-dia-del-closer.md) (E6-3) | 069, 061 | todo |
| [ ] | 072 | [Base de Leads con filtros](./072-base-de-leads-con-filtros.md) (E6-4) | 069 | todo |
| [ ] | 073 | [Ficha del Lead, con el diff entre envíos](./073-ficha-del-lead.md) (E6-5) | 072 | todo |
| [ ] | 074 | [Ficha del Deal](./074-ficha-del-deal.md) (E6-6) | 073 | todo |
| [ ] | 075 | [Revisión profunda de TODA la UI](./075-revision-profunda-de-la-ui.md) (E6-8) | 069-074 | todo |
| [ ] | 076 | [Bitácora en Nerd Stats](./076-bitacora-en-nerd-stats.md) (E6-7) | 068, 041 | todo · es la **pantalla** de un rastro que se escribe desde E1 |

## E7 · Migración one-time

Va de último, con el scaffold completo. Absorbe el "histórico de C2" de la spec §7 con más alcance.

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 077 | [Barrer las pestañas de gestión](./077-barrer-las-pestanas-de-gestion.md) (E7-1) | 075 | todo |
| [ ] | 078 | [Pasa por la MISMA ingesta, nunca inserts crudos](./078-la-migracion-pasa-por-la-misma-ingesta.md) (E7-2) | 077 | todo |
| [ ] | 079 | [Recuperar las 55 de `Forms viejo`](./079-recuperar-las-55-de-forms-viejo.md) (E7-3) | 078 | todo |
| [ ] | 080 | [Los casos raros de la migración](./080-los-casos-raros-de-la-migracion.md) (E7-4) | 078 | todo |
| [ ] | 081 | [COP → USD a la tasa del día](./081-cop-a-usd-en-la-migracion.md) (E7-5) | 078 | todo |
| [ ] | 082 | [Apagar las pestañas de gestión](./082-apagar-las-pestanas-de-gestion.md) (E7-6) | 079, 080, 081 | todo · lo hace Mani |

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
| [ ] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | **en curso · PARTIDO el 21-sep** por el plan v2: el criterio 1 (cargar a Andrea) sigue vivo e independiente; el criterio 2 (`registrarLlamada` con cuenta real) queda **obsoleto**, esa mutacion se reescribe en la etapa 4. Nota previa: · 18-sep: en `production` ya están el gerente, Maru (`closer_id: Maru`, 2 programas) y los 2 productos. Falta el correo de Andrea (su `closer_id` ya se sabe: `Andrea`) y **probar `registrarLlamada` con una cuenta real de closer**, que es el otro criterio |
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
| [x] | 034 | [Categorías de lead dinámicas](./034-categorias-de-lead-dinamicas.md) (ADR 0032) | 016 | **reemplazado · 21-sep** · absorbido por [plan-crm-v2](../plan-crm-v2.md): su alcance ES el insumo §2.2. El backfill desde `people.raw` ya NO aplica (el primer sync v2 reconstruye los envios desde la hoja) y `estado` enum→texto pasa al corte de la etapa 1. Nota previa: el más grande que queda · cierra F-01 y F-06 · Mani lo quiere en sesión propia · necesita migración |

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

## Decisiones pendientes (bloquean o condicionan tickets)

Michael respondió el 16-sep ([mensaje-michael-2026-09-16.md](../insumos/mensaje-michael-2026-09-16.md), con su respuesta al final).

| Decisión | A quién | Afecta |
|---|---|---|
| Qué se reconcilia y qué se descarta del histórico de C2 (importar: **sí**) | Mani | ticket futuro |
| Confirmar el mapeo de `Estado` al enum (propuesta en F-01) | Mani | F-01 |

### Resueltas

- 19-sep · **El snapshot en PDF lo toman los dos roles** (Mani). El 021 **deja de estar bloqueado**;
  sigue siendo el último de la fila. Razón: si un closer ya ve la caja y el comparativo en pantalla
  (ADR 0009), impedirle bajar lo que tiene enfrente no protege nada, y el PDF recibe el mismo
  objeto que pintó la pantalla (ADR 0024).
- 19-sep · **Los closers pueden agregar recursos y crear plataformas de pago** (Mani). Se aplica el
  molde del ADR 0016 (productos): administra cualquiera, el closer solo en programas con membresía
  activa. **Dos asimetrías declaradas:** un closer NO crea un recurso global (`program_id` nulo), y
  una plataforma de pago no tiene programa, así que ahí no hay nada que acote el alcance.
  Desbloquea los tickets 013 y 023, que quedan con una enmienda pendiente cada uno.

- 18-sep · **La comparacion de `closerId` ignora mayusculas y espacios; el almacenamiento no**
  (Mani; ADR 0030, ticket 033). La ortografia de la hoja es suya (ADR 0004), asi que no se
  reescribe: lo que cambia es que preguntar "¿son el mismo closer?" deje de mirar las mayusculas, y
  esa pregunta vive en un modulo con un indice unico detras.
- 18-sep · **El closerId propio solo lo edita quien administra** (Mani; ticket 031, opción 1). Un
  closer lo ve en lectura. La opción "cualquiera, pero solo si está vacío" se descartó porque el
  momento de riesgo es el PRIMER valor, no el cambio: una cuenta nueva con el campo vacío es
  exactamente la situación de quien quisiera heredar las 317 llamadas de otra closer.
- 18-sep · **Una fila de catálogo se crea por el molde, también desde un script** (Mani; ADR 0029).
  La línea no es "script o pantalla", es **si la base ya está viva**. `cargar-enlaces-pago` pasa a
  `crearEnlacePago` y el actor lo da `SCRIPT_ACTOR_EMAIL`. Excepciones nombradas: sembrar una base
  vacía y el acceso de emergencia. Salió de que los 5 enlaces de PayPal entraron a `production`
  con `change_log` en 0.
- 18-sep · **El snapshot del dashboard se baja en PDF** (Mani; ticket 021). Es el único formato que
  obliga a dependencia nueva, así que la instalación va DENTRO del ticket (ADR 0006), y el PDF
  recibe el mismo objeto que pintó la pantalla en vez de recalcular (ADR 0024). Sigue de último.
- 17-sep · **La ventana de venta es dato por cohorte** (Mani, `/grill-with-docs`; ADR 0022, ticket
  027). `cohorts` suma `fechaInicioVentas`; el cierre se respeta como esta guardado y el de
  Comunicarte C2 se corrige a 21-sep. Ni el inicio se deduce del cierre de la cohorte anterior ni
  el cierre del inicio de clases: el reporte de Mike desmiente las dos reglas.
- 16-sep · **Responsable y alta manual viven en el CRM** (Mani, `/grill-with-docs`; ADR 0021, ticket 026).
  ADR 0004 cubre solo lo que captura el formulario. Closer toma personas libres, gerente reasigna;
  "sin responsable" es válido; las personas manuales cuentan en el embudo pero no en el CPL.
- 16-sep · **Leads por sync con Sheets: sí** (Michael). ADR 0004 firme; la deuda del sync sigue vigente.
  Las hojas no se estandarizan: cada programa declara su plantilla de lead (ADR 0019, ticket 016).
- 16-sep · **"Todos ven todo": sí** (Mani). ADR 0009 firme.
- 16-sep · **Closers activos: Andrea y Maru** (Michael; Jerónimo aparece como responsable de leads, sin confirmar).
- 16-sep · **Abonos siempre en USD** (Michael). La columna `moneda` se mantiene y vale `USD`. Un
  pago en COP lo convierte el closer al registrarlo (Mani).
- 16-sep · **Usuarios reales (closers y managers) se cargan desde la UI al salir a producción**
  (Mani). No hace falta la lista ahora; el 015 debe permitir crear ambos roles.
- 16-sep · **`Estado` es la clasificación del lead** (Michael): decide a qué pestaña derivada se copia la fila.
- 16-sep · **Importar el histórico de C2: sí** (Mani). Falta el detalle de reconciliación.

## Incidente del 16-sep (noche): `.env.local` apunta a `production`

`DATABASE_URL` y `DB_PROD` de `.env.local` son la misma URL: la rama `production`
(`br-withered-mud-b4cvvg80`). Todo lo local (`npm run dev`, `seed:datos`, `db:migrate`) escribe en
`production`, y la rama `dev` (`br-withered-sun-b439zjof`) quedó sin verificar. Las migraciones
0004-0007 se aplicaron **directo a `production`** con ok de Mani (sin paso por `dev`). Detalle en
el ADR 0018 y en el handoff.

- [x] Mani pegó en `DATABASE_URL` la URL de la rama `dev` (verificado con `neon.branch_id`: `br-withered-sun-b439zjof`).
- [x] `dev` y `production` al día: 13 migraciones cada una (18-sep) y `seed:datos` (2 programas, 4 cohortes, 3 productos, 10 fuentes).
- [ ] Sembrar productos en `production` (pedir ok; va con el 007, ver handoff).

## Deuda técnica heredada (no bloquea F0-F4)

Detalle en [docs/agents/handoff.md](../agents/handoff.md), sección Roadmap.

- [ ] F-01 · El sync descarta `estado` de la hoja. **Dirección CAMBIADA el 19-sep (Mani), ya no
      es el mapeo a enum que se había propuesto:** `estado` es la columna que CATEGORIZA los leads y
      se mantiene tal cual viene. El sistema **lee qué valores existen hoy en esa columna y agrupa
      por ellos**, sin lista fija en el código, y ofrece **combinar** dos valores cuando son la
      misma categoría escrita distinto (el problema del ADR 0030, pero resuelto a mano por un
      humano en vez de por normalización, porque aquí las variantes no son de mayúsculas).
      ⚠️ **Implicación que hay que resolver antes de codear: hoy `people.estado` es un `pgEnum`**
      (`descartado · cola_setteo · invitado · show · cierre · perdido`), o sea un TIPO en el código.
      La decisión de Mani lo convierte en una INSTANCIA, que es justo lo que manda el ADR 0012.
      Eso pide migración (enum → texto + catálogo de categorías) y su propio ADR.
      Valores reales observados el 16-sep, para dimensionar:
      Comunicarte `New form`: `🗑️ Descartado` 928 · `📞 Setteo No Calificado` 786 · `📅 Con Calendly` 286.
      Tactical: `🗑️ Descartado` 2.031 · `📞 Setteo No Calificado` 1.447 · `📅 Con Calendly (Juanito)` 316 ·
      `Cerrado` 1 · vacío 1. Ojo: `New form` devolvió exactamente 2.000 filas; verificar que no sean
      filas vacías con fórmula.
- [x] F-03 · Dos sync simultáneos se pisan → **hecho 19-sep** (ADR 0031, migraciones 0016 y 0017).
      El diseño de septiembre se implementó tal cual: `sync_runs.program_id` + índice único parcial
      `WHERE estado = 'corriendo'`, el INSERT de la corrida ES el candado (23505 → `SyncEnCursoError`,
      409), y un reaper cierra como `error` las corridas colgadas más de 10 min (= 2x el
      `maxDuration` de las rutas) antes de intentar. El reaper y el insert van **fuera** del try
      grande: adentro, un sync rechazado habría marcado como error la corrida viva de otro.
      Mordido contra Neon de verdad, no solo contra PGlite.
- [x] F-04 · Updates del sync fila por fila → **hecho 19-sep.** Los UPDATE pasan por
      `ejecutarJuntas` en lotes de `TAMANO_DE_LOTE` (200), o sea **una petición HTTP por lote** en
      vez de una por persona; en PGlite cae a una transacción. No se usó `UPDATE ... FROM (VALUES
      ...)` a propósito: habría necesitado una plantilla `sql` con una tabla adentro, que es justo
      el footgun de las columnas sin calificar. Cada lote queda atómico, que es mejor que antes.
      **Verificado contra Neon, no solo contra PGlite:** se ensuciaron 250 nombres en `dev` y el
      sync reparó 247 en 6,3 s (los 3 restantes son personas `entrada: crm`, que no están en la
      hoja — el sync hace bien en no tocarlas).
- [x] F-05 · Fechas viejas en la zona del servidor → **VERIFICADA MUERTA el 19-sep, sin escribir
      una línea de código.** Se re-parseó con el parser de hoy (que ya escribe `-05:00` explícito)
      el `raw.fechaAplicacion` de las **3.369** personas de `production` con UNA sola aplicación y
      se comparó contra `fecha_primera_aplicacion`: **3.369 coinciden exacto al milisegundo, 0
      difieren, 0 dan null**. Como lo guardado es lo que produce el parser correcto, lo guardado es
      correcto. Se auto-reparó sola cuando las fechas entraron en `CAMPOS_COMPARABLES` el 18-sep.
      **Alcance honesto de la medición:** cubre las de una aplicación; en las de varias,
      `fecha_primera_aplicacion` es el mínimo entre filas y `raw` guarda solo una, así que no son
      comparables por este camino — pero es el mismo parser, y el plan de sync del 18-sep no
      reportó ninguna fila a actualizar por fecha sobre las 4.599.
- [ ] F-06 · Persona que desaparece de la hoja → **DESBLOQUEADA 19-sep (Mani): nunca se borra.**
      Un lead solo cambia de estado; jamás se borra una fila de `people`. Eso deja de depender de
      la respuesta de Michael («¿las filas se borran o se mueven de pestaña?»): pase lo que pase en
      la hoja, el CRM no borra. Lo que queda por construir es la DETECCIÓN — que el sync note que
      una persona dejó de venir en la hoja y lo deje visible — no el borrado.
- [x] F-07 · Corrida de sync atribuida a la primera fuente → **hecho 19-sep** (ADR 0031, misma
      migración que F-03). Era el mismo bug que F-03: la corrida colgaba de `fuentes[0]`, así que en
      un programa con dos formularios activos quedaba bajo uno de ellos habiendo leído los dos — y
      como esa consulta no lleva `ORDER BY`, **cuál de los dos era no determinista** (verificado en
      los datos de `production`: 1 corrida bajo un formulario, 2 bajo el otro).
      Ahora la corrida es del programa y `sync_runs.fuentes_leidas` guarda **todas** las fuentes con
      sus conteos; las corridas anteriores muestran `—`, no un nombre inventado.
- [x] B-01 · `lib/sheets/sync.ts` sin tests → decisión extraída a `lib/sheets/plan-sync.ts`, 6 tests (16-sep)
- [x] S-06 + B-06 · Retención de PII y `people.raw` sin techo → **decidido 19-sep (Mani): se
      guarda TODO para siempre.** No se borra ni el lead ni `raw`. La deuda deja de ser de política
      y se convierte en una de **escalabilidad**, que Mani pidió atacar en sesión propia. Cifras
      medidas ese día en `production`: base completa **15 MB**, `people` 5.104 kB / 4.688 filas,
      `people.raw` 2.520 kB (**551 bytes por persona**, la mitad de la tabla), `change_log` 600 kB.
- [x] S-14 · Producción y preview comparten base → resuelto 16-sep (ADR 0018): local y Preview en
      la rama `dev`, Production en `production`. Queda verificar el valor de Production (ver ADR).
- [x] `CRON_SECRET` en `.env.local` y en Vercel Production (16-sep, `npm run cron-secret`).
      Aplica en el próximo deploy de producción.
- [x] `GOOGLE_SERVICE_ACCOUNT_JSON_B64` en `.env.local` y en Vercel Production (16-sep, proyecto
      `retia-growth`; las dos hojas compartidas y verificadas con `npm run descubrir`).
- [x] S-10 · `AUTH_URL` en Vercel Production (16-sep). Callback confirmado en el cliente OAuth
      nuevo del proyecto `retia-growth`, que reemplaza al que vivia en el proyecto personal de Mani.
- [ ] Probar el login con una cuenta real (local y producción) y borrar el cliente web viejo de
      `google-workspace-mcp`.
- [x] Sembrar programas, cohortes y fuentes en `production` (16-sep).
- [x] **`/api/cron/sync` probado de punta a punta en produccion el 20-sep.**
      Disparado contra `https://retia-metrics-seven.vercel.app`: sin el secreto da **401**; con el
      secreto, `{"ok":true,"programas":2,"sincronizados":2,"fallidos":0,"omitidos":0}` en **3,18s**.
      En la base: tactical-investor 3.950 filas / 2 nuevas / 1,13s, comunicarte 2.305 filas / 24
      nuevas / 1 actualizada / 1,40s. Personas 4.765 → 4.791. **0 corridas colgadas en
      `corriendo`.**
      🎯 **Y la corrida de Comunicarte guardo LAS DOS fuentes con sus conteos** (`Formulario
      anterior` 67 + `Formulario actual` 2.238): es el arreglo de F-07 (ADR 0031) visto en
      produccion, no en un test. Antes esa corrida habria quedado etiquetada con uno de los dos
      formularios, elegido de forma no determinista.
      ⚠️ **Y algo que ya era cierto y nadie habia mirado:** el cron **ya venia corriendo solo y
      bien** todos los dias a las 07:52 de Bogota (18, 19 y 20-sep, los seis `ok`). La deuda decia
      "falta probarlo" cuando lo unico que faltaba era **abrir la tabla y ver**.
- [x] **S-02 (quitar usuario) — probado el 20-sep, en sus DOS mitades.**
      **La operativa, contra la rama `dev`:** se creo un usuario desechable, `npm run usuarios`
      lo mostro `activo`, `npm run usuarios -- quitar` lo dejo `INACTIVO` **sin borrar la fila**, y
      el conteo de administradores bajo de 2 a 1. (La fila desechable quedo inactiva en `dev`; se
      borra de verdad cuando aterrice el ticket 030, que es justo la funcion para eso.)
      **La de codigo:** el callback `jwt` estaba escrito como funcion anonima dentro de
      `NextAuth({...})`, y por eso el handoff lo daba por "no testeable" desde el 6-sep. Se movio
      **sin cambiar una regla** a `lib/auth/revalidacion.ts` (`revalidarToken` y
      `puedeIniciarSesion`) y ahora tiene `tests/revalidacion-sesion.test.ts`, 11 tests,
      **mordido quitando el arreglo para verlo caerse**. 🎯 Lo unico que volvia intocable esa
      garantia era donde estaba escrita, no su dificultad.
      ⚠️ **Lo que sigue sin cubrir un test, dicho de frente:** que Auth.js LLAME al callback en
      cada emision. Es conducta documentada de la estrategia `jwt` y solo lo comprueba un
      recorrido real con sesion abierta.

## Ideas de Mani sin decidir (20-sep)

No son deuda ni tickets: son direcciones que Mani dejo anotadas para no perderlas. **Ninguna se
implementa sin decidirla primero.**

- 🔵 **Cambiar la FUENTE de la que se traen los leads** (Mani, 20-sep, textual: *"creo que quiero
  cambiar la fuente de la cual se traen los leads, puede ser mas facil solo traer de la pagina a
  la cual llegan los leads crudos y todo lo demas se maneja desde el CRM"*).
  **Toca el ADR 0004 de frente**, que es la decision mas vieja y mas cara del proyecto: hoy Sheets
  es la fuente de verdad de los leads y el sync lee TODAS las fuentes de un programa y deduplica
  sobre el conjunto (ADR 0031). Traer solo la pestana de leads crudos significa que las pestanas
  derivadas dejan de leerse, que es justo lo que `docs/estructura-bbdd.md` dice que **romperia el
  dedup** si se hiciera al reves.
  **Lo que hay que medir antes de decidir**, no opinar: que pestana recibe hoy los leads crudos de
  cada programa, si esa pestana sola cubre a las 4.688 personas o si hay gente que solo existe en
  una derivada, y que pasa con las personas `entrada: crm` que no estan en ninguna hoja. Mientras
  tanto el sync se queda como esta.
  Se cruza con el ticket 034: si el CRM pasa a manejar "todo lo demas", `etapa` es del CRM y eso
  ya quedo decidido alli.

- 🔵 **Plataformas de pago con programa** (Mani, 20-sep). Ver la enmienda del ticket 013.

## Futuro (validado, fuera del MVP)

Integración con Calendly (usa `users.calendlyEmail`), Kapso, Typeform, Addi; recordatorios de
seguimiento (usa `calls.fechaSeguimiento`); import histórico; mapeo enriquecido de leads; vista
kanban y calendario; subida de archivos (ADR 0017).

("Ver como" del developer salió de aquí el 18-sep: es el ticket 028.)
