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
| [ ] | 008 | [Renombrar Corte a Cohorte](./008-renombrar-corte-a-cohorte.md) | — | todo · **listo** |
| [ ] | 009 | [Test guardián de slugs](./009-test-guardian-de-slugs.md) | — | todo · **listo** |
| [ ] | 010 | [Programas dinámicos](./010-programas-dinamicos.md) | 008, 009 | todo |
| [ ] | 011 | [Molde de catálogo + plataformas de pago](./011-molde-de-catalogo-y-plataformas.md) | 008 | todo |
| [ ] | 012 | [Catálogos de motivos y orígenes](./012-catalogos-motivos-y-origenes.md) | 011 | todo |
| [ ] | 013 | [Pantalla de catálogos](./013-pantalla-de-catalogos.md) | 011 | todo |
| [ ] | 014 | [Administrar programas y cohortes](./014-administrar-programas-y-cohortes.md) | 010, 011 | todo |
| [ ] | 015 | [Administrar usuarios y closers](./015-administrar-usuarios-y-closers.md) | 011 | todo |
| [ ] | 016 | [Plantilla de lead + fuentes configurables](./016-fuentes-configurables.md) (ADR 0019) | 014 | todo · puede esperar |

## F1 · Llamadas y ventas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [x] | 001 | [plataformaPago como enum](./001-reemplazado-plataforma-pago.md) | — | reemplazado por 011 |
| [ ] | 017 | [Productos por programa](./017-productos-por-programa.md) | 011 | todo |
| [ ] | 018 | [Esquema del registro + abonos](./018-esquema-registro-y-abonos.md) | 012, 017 | todo |
| [ ] | 002 | [cohorteActiva + registrarLlamada](./002-cohorte-activa-y-mutacion-registro.md) | 018 | todo |
| [ ] | 019 | [Registrar abono](./019-registrar-abono.md) | 018 | todo |
| [ ] | 003 | [Pantalla /mi-dia](./003-pantalla-mi-dia-registro.md) | 002, 019, 015 | todo |
| [ ] | 007 | [Alta de los closers reales](./007-onboarding-closer-id.md) | 015 | todo · operación |

## F2 · Métricas

| ✓ | # | Ticket | Depende de | Estado |
|---|---|---|---|---|
| [ ] | 020 | [Días hábiles + meta dinámica](./020-dias-habiles-y-meta-dinamica.md) | 008 | todo |
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

Las de Michael que siguen abiertas se le **enviaron el 16-sep** ([mensaje-michael-2026-09-16.md](../insumos/mensaje-michael-2026-09-16.md)); esperando respuesta.

| Decisión | A quién | Afecta |
|---|---|---|
| Formato del snapshot y quién lo toma | Mani / Michael | 021 |
| ¿Closers pueden crear plataformas y recursos? (hoy: no) | Mani | 013, 023 |
| Qué se reconcilia y qué se descarta del histórico de C2 (importar: **sí**) | Mani | ticket futuro |
| Lead que no está en el sync (WhatsApp directo, masivos) | Michael | 003 |
| Moneda de los abonos por Bancolombia / MercadoPago | Michael | 018, 019 |
| Lista y correos de closers activos | Michael | 007 |
| F-01 · valores reales de la columna `Estado` y su mapeo | Michael | F-01, métricas |

### Resueltas

- 16-sep · **Leads por sync con Sheets: sí** (Michael). ADR 0004 firme; la deuda del sync sigue vigente.
  Las hojas no se estandarizan: cada programa declara su plantilla de lead (ADR 0019, ticket 016).
- 16-sep · **"Todos ven todo": sí** (Mani). ADR 0009 firme.
- 16-sep · **Importar el histórico de C2: sí** (Mani). Falta el detalle de reconciliación.

## Deuda técnica heredada (no bloquea F0-F4)

Detalle en [docs/agents/handoff.md](../agents/handoff.md), sección Roadmap.

- [ ] F-01 · El sync descarta `estado` de la hoja (bloqueado: preguntar a Michael)
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
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON_B64` falta en `.env.local` y en Vercel: sin ella el cron corre
      pero falla al leer las hojas. `npm run cuenta-servicio` con el JSON de Google Cloud.
- [ ] S-10 · Fijar `AUTH_URL=https://retia-metrics-seven.vercel.app` en Production y confirmar ese
      callback en el OAuth de Google.
- [ ] Prueba manual de S-02 (quitar usuario)

## Futuro (validado, fuera del MVP)

Integración con Calendly (usa `users.calendlyEmail`), Kapso, Typeform, Addi; recordatorios de
seguimiento (usa `calls.fechaSeguimiento`); import histórico; mapeo enriquecido de leads; vista
kanban y calendario; "ver como" del developer; subida de archivos (ADR 0017).
