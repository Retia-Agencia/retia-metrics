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
| [x] | 008 | [Renombrar Corte a Cohorte](./008-renombrar-corte-a-cohorte.md) | — | done · 16-sep (migración 0002 sin aplicar) |
| [x] | 009 | [Test guardián de slugs](./009-test-guardian-de-slugs.md) | — | done · 16-sep (`it.fails` hasta 010) |
| [x] | 010 | [Programas dinámicos](./010-programas-dinamicos.md) | 008, 009 | done · 16-sep (prueba manual en base real pendiente) |
| [x] | 011 | [Molde de catálogo + plataformas de pago](./011-molde-de-catalogo-y-plataformas.md) | 008 | done · 16-sep (migración 0003 sin aplicar; ADR 0020) |
| [ ] | 012 | [Catálogos de motivos y orígenes](./012-catalogos-motivos-y-origenes.md) | 011 | todo · **listo** |
| [ ] | 013 | [Pantalla de catálogos](./013-pantalla-de-catalogos.md) | 011 | todo · **listo** |
| [ ] | 014 | [Administrar programas y cohortes](./014-administrar-programas-y-cohortes.md) | 010, 011 | todo · **listo** |
| [ ] | 015 | [Administrar usuarios y closers](./015-administrar-usuarios-y-closers.md) | 011 | todo · **listo** |
| [ ] | 016 | [Plantilla de lead + fuentes configurables](./016-fuentes-configurables.md) (ADR 0019) | 014 | todo · puede esperar |

## F1 · Llamadas y ventas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 001 | [plataformaPago como enum](./001-reemplazado-plataforma-pago.md) | — | reemplazado por 011 |
| [ ] | 017 | [Productos por programa](./017-productos-por-programa.md) | 011 | todo · **listo** |
| [ ] | 018 | [Esquema del registro + abonos](./018-esquema-registro-y-abonos.md) | 012, 017 | todo |
| [ ] | 002 | [cohorteActiva + registrarLlamada](./002-cohorte-activa-y-mutacion-registro.md) | 018 | todo |
| [ ] | 019 | [Registrar abono](./019-registrar-abono.md) | 018 | todo |
| [ ] | 026 | [Responsable + alta manual](./026-responsable-y-alta-manual.md) (ADR 0021) | 015 | todo |
| [ ] | 003 | [Pantalla /mi-dia](./003-pantalla-mi-dia-registro.md) | 002, 019, 015, 026 | todo |
| [ ] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | todo · operación |

## F2 · Métricas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 020 | [Días hábiles + meta dinámica](./020-dias-habiles-y-meta-dinamica.md) | 008 | todo · **listo** |
| [ ] | 004 | [Consultas del dashboard](./004-consultas-dashboard.md) | 018, 020 | todo |
| [ ] | 005 | [Dashboard en /programas/[slug]](./005-dashboard-real-programas.md) | 004, 010 | todo |
| [ ] | 006 | [Historial de una persona](./006-historial-persona.md) | 005 | todo |
| [ ] | 021 | [Snapshot del dashboard](./021-snapshot-del-dashboard.md) | 005 + decisión | bloqueado |

## F3 · Recursos

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 022 | [Recursos + enlaces de pago](./022-recursos-y-enlaces-de-pago.md) | 011, 017 | todo |
| [ ] | 023 | [Pantalla de Recursos](./023-pantalla-de-recursos.md) | 022 | todo |

## F4 · Nerd Stats

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 024 | [Rol developer](./024-rol-developer.md) | 010 | todo |
| [ ] | 025 | [Nerd Stats](./025-nerd-stats.md) | 024 | todo |

## Decisiones pendientes (bloquean o condicionan tickets)

Michael respondió el 16-sep ([mensaje-michael-2026-09-16.md](../insumos/mensaje-michael-2026-09-16.md), con su respuesta al final).

| Decisión | A quién | Afecta |
|---|---|---|
| Formato del snapshot y quién lo toma. **Va de último** (Mani, 16-sep); idea: parecido al reporte diario actual | Mani | 021 |
| ¿Closers pueden crear plataformas y recursos? (hoy: no) | Mani | 013, 023 |
| Qué se reconcilia y qué se descarta del histórico de C2 (importar: **sí**) | Mani | ticket futuro |
| Confirmar el mapeo de `Estado` al enum (propuesta en F-01) | Mani | F-01 |

### Resueltas

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
kanban y calendario; "ver como" del developer; subida de archivos (ADR 0017).
