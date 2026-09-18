# Tracker — Retia CRM

Este es el **único lugar** donde se marca el avance. Cada ticket tiene su archivo con objetivo,
alcance y criterios de "done"; aquí solo va el estado. Al cerrar un ticket: marcar la casilla,
cambiar `status: done` en su archivo y anotar la fecha.

Estados: `todo` · `en curso` · `done` · `bloqueado` · `reemplazado`.
Un ticket está **listo** cuando todos los de su columna "Depende de" están en `done`.

Orden y porqué: [docs/plan.md](../plan.md). Alcance: [docs/spec.md](../spec.md).

## F0 · Contrato de extensión

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 008 | [Renombrar Corte a Cohorte](./008-renombrar-corte-a-cohorte.md) | — | done · 16-sep (migración 0002 en `production`) |
| [x] | 009 | [Test guardián de slugs](./009-test-guardian-de-slugs.md) | — | done · 16-sep (`it.fails` hasta 010) |
| [x] | 010 | [Programas dinámicos](./010-programas-dinamicos.md) | 008, 009 | done · 16-sep (prueba manual en base real pendiente) |
| [x] | 011 | [Molde de catálogo + plataformas de pago](./011-molde-de-catalogo-y-plataformas.md) | 008 | done · 16-sep (migración 0003 en `production`; ADR 0020) |
| [x] | 012 | [Catálogos de motivos y orígenes](./012-catalogos-motivos-y-origenes.md) | 011 | done · 16-sep (migración 0004 en `production`) |
| [x] | 013 | [Pantalla de catálogos](./013-pantalla-de-catalogos.md) | 011 | done · 16-sep (id no-uuid ya da 400) |
| [x] | 014 | [Administrar programas y cohortes](./014-administrar-programas-y-cohortes.md) | 010, 011 | done · 16-sep (migración 0006 en `production`) |
| [x] | 015 | [Administrar usuarios y closers](./015-administrar-usuarios-y-closers.md) | 011 | done · 16-sep (migración 0005 en `production`; login real pendiente) |
| [ ] | 016 | [Plantilla de lead + fuentes configurables](./016-fuentes-configurables.md) (ADR 0019) | 014 | todo · **listo** · puede esperar |
| [ ] | 030 | [Borrar del catálogo lo que nunca se usó](./030-borrar-del-catalogo.md) (ADR 0026) | 011 | todo · **listo** · enmienda acotada al ADR 0012 |

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
| [ ] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | **en curso** · 18-sep: en `production` ya están el gerente, Maru (`closer_id: Maru`, 2 programas) y los 2 productos. Falta el correo de Andrea (su `closer_id` ya se sabe: `Andrea`) y **probar `registrarLlamada` con una cuenta real de closer**, que es el otro criterio |
| [x] | 029 | [Anular un registro](./029-anular-registros.md) (ADR 0026, ADR 0027) | 003, 019 | done · 18-sep (migraciones 0013 y 0014 en `dev` y `production`; desplegado; recorrido visual hecho, 3 hallazgos arreglados) |

## F2 · Métricas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 020 | [Días hábiles + meta dinámica](./020-dias-habiles-y-meta-dinamica.md) | 008 | done · 16-sep |
| [x] | 027 | [Ventana de venta de la cohorte](./027-ventana-de-venta-de-la-cohorte.md) (ADR 0022) | 014 | done · 17-sep (migración 0009 en `dev` y `production`) |
| [x] | 004 | [Consultas del dashboard](./004-consultas-dashboard.md) | 018, 020, 027 | done · 17-sep (sesión paralela B) |
| [x] | 005 | [Dashboard en /programas/[slug]](./005-dashboard-real-programas.md) | 004, 010 | done · 17-sep (filtro por closer dentro de las consultas del 004; sin migración) |
| [x] | 006 | [Historial de una persona](./006-historial-persona.md) | 005 | done · 17-sep (`/personas/[id]` de solo lectura; se entra desde el buscador de `/mi-dia`; sin migración) |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) | 005 | bloqueado · **formato decidido 18-sep: PDF** (Mani). Sigue de último; falta decidir quién puede tomarlo y mirar el reporte diario de Mike antes de codear |

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
| [x] | 033 | [`Mani` y `mani` no pueden ser dos closers](./033-identidad-del-closer-sin-mayusculas.md) (ADR 0030) | 028 | done · 18-sep · salio del primer recorrido en `production`. `lib/closers/identidad.ts` + indice unico sobre la forma normalizada (migracion **0015**, aplicada en `dev` y `production`) + guardian. 570 tests |

## Decisiones pendientes (bloquean o condicionan tickets)

Michael respondió el 16-sep ([mensaje-michael-2026-09-16.md](../insumos/mensaje-michael-2026-09-16.md), con su respuesta al final).

| Decisión | A quién | Afecta |
|---|---|---|
| ~~Formato del snapshot~~ **cerrado 18-sep: PDF**. Queda abierto solo QUIÉN puede tomarlo | Mani | 021 |
| ¿Closers pueden crear plataformas y recursos? (hoy: no) | Mani | 013, 023 |
| Qué se reconcilia y qué se descarta del histórico de C2 (importar: **sí**) | Mani | ticket futuro |
| Confirmar el mapeo de `Estado` al enum (propuesta en F-01) | Mani | F-01 |

### Resueltas

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

- [ ] F-01 · El sync descarta `estado` de la hoja. **Desbloqueado 16-sep.** Valores reales:
      Comunicarte `New form`: `🗑️ Descartado` 928 · `📞 Setteo No Calificado` 786 · `📅 Con Calendly` 286
      (`Forms viejo` no tiene la columna). Tactical: `🗑️ Descartado` 2.031 · `📞 Setteo No Calificado`
      1.447 · `📅 Con Calendly (Juanito)` 316 · `Cerrado` 1 · vacío 1. Mapeo propuesto (sin confirmar):
      Descartado → `descartado`, Setteo No Calificado → `cola_setteo`, Con Calendly → `invitado`,
      Cerrado → `cierre`. Se compara sin emoji ni sufijo entre paréntesis. Ojo: `New form` devuelve
      exactamente 2.000 filas (eran 1.320 el 19-ago); verificar que no sean filas vacías con fórmula.
- [ ] F-03 · Dos sync simultáneos se pisan (falta candado por programa). **Diagnóstico 16-sep:**
      `pg_advisory_lock` no sirve con `drizzle-orm/neon-http` (cada consulta es su propia sesión).
      Diseño: columna `sync_runs.program_id` + índice único parcial `WHERE estado = 'corriendo'`;
      el insert de la corrida es el candado (violación única → 409). Antes de insertar, marcar
      como `error` las corridas `corriendo` de más de 10 min (función caída). Comparte migración
      con F-07. Requiere migración: se prueba en la rama `dev` (ADR 0018).
- [ ] F-04 · Updates del sync fila por fila
- [ ] F-05 · Fechas viejas en la zona del servidor
- [ ] F-06 · Persona que desaparece de la hoja
- [ ] F-07 · Corrida de sync atribuida a la primera fuente
- [x] B-01 · `lib/sheets/sync.ts` sin tests → decisión extraída a `lib/sheets/plan-sync.ts`, 6 tests (16-sep)
- [ ] S-06 + B-06 · Retención de PII y `people.raw` sin techo
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
- [ ] Probar `/api/cron/sync` de punta a punta en producción.
- [ ] Prueba manual de S-02 (quitar usuario)

## Futuro (validado, fuera del MVP)

Integración con Calendly (usa `users.calendlyEmail`), Kapso, Typeform, Addi; recordatorios de
seguimiento (usa `calls.fechaSeguimiento`); import histórico; mapeo enriquecido de leads; vista
kanban y calendario; subida de archivos (ADR 0017).

("Ver como" del developer salió de aquí el 18-sep: es el ticket 028.)
