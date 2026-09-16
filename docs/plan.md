# plan — Retia CRM: contrato de extensión, llamadas y ventas, métricas, recursos, Nerd Stats

Deriva de [docs/spec.md](./spec.md). Decisiones que este plan da por sentadas (no se re-discuten
aquí): ADR 0008 a 0011 y ADR 0012 a 0017 (16-sep-2026).

**El estado de cada ticket vive en [docs/tasks/README.md](./tasks/README.md)**, no aquí.

## Orden de construcción (decidido con Mani el 16-sep)

| Fase | Qué entrega | Por qué va en ese lugar |
|---|---|---|
| **F0 · Contrato de extensión** | Cohorte renombrada, programas dinámicos, molde de catálogo, administración de programas, cohortes, closers y fuentes | Todo lo que viene se construye encima. Construir pantallas sobre programas fijos es rehacerlas después |
| **F1 · Llamadas y ventas** | Productos, esquema de registro con abonos, mutaciones, `/mi-dia` | Es lo que reemplaza el grupo de WhatsApp |
| **F2 · Métricas** | Días hábiles y meta dinámica, consultas, dashboard por programa, historial, snapshot | Sin datos de F1 no hay nada que medir |
| **F3 · Recursos** | Recursos y enlaces de pago con vigente | Independiente de F1 y F2; reusa el molde de F0 |
| **F4 · Nerd Stats** | Rol developer y vista de salud | Lo usa el equipo técnico, no la operación |

**Sobre el plazo:** Comunicarte C2 cierra el 22-sep (4 días hábiles desde el 16). F0 y F1
completas no caben ahí. La meta realista es tener F1 usable para el cierre de Tactical C2
(29-sep) y para la cohorte C3 de Comunicarte desde el primer día. Si hay que recortar, se
recorta dentro de F0 (el ticket 016 puede esperar), no se salta la fase.

## Arquitectura: qué se agrega

```mermaid
flowchart TD
    subgraph existe["Ya existe"]
        Auth["lib/auth<br/>roles + guards"]
        DB["lib/db<br/>schema Drizzle"]
        Sync["lib/sheets<br/>sync de leads"]
        Log["change_log + sync_runs"]
    end
    subgraph f0["F0 · Contrato"]
        Cat["lib/catalogo/<br/>molde: zod + CRUD + desactivar + change_log"]
        Prog["/programas/[slug]<br/>nav desde la base"]
        Aj["/ajustes/*<br/>programas, cohortes, usuarios,<br/>fuentes, catálogos"]
    end
    subgraph f1["F1 · Llamadas y ventas"]
        Mut["lib/mutations/registro.ts<br/>llamada + venta + abono"]
        MiDia["/mi-dia"]
        Productos["/productos<br/>gerente y closer"]
    end
    subgraph f2["F2 · Métricas"]
        Hab["lib/dias-habiles.ts<br/>meta dinámica"]
        Q["lib/queries/dashboard.ts"]
        Dash["dashboard en /programas/[slug]"]
    end
    subgraph f3["F3 · Recursos"]
        Rec["/recursos"]
    end
    subgraph f4["F4 · Nerd Stats"]
        Nerd["/nerd-stats (developer)"]
    end
    Cat --> Aj
    Cat --> Productos
    Cat --> Rec
    Aj --> DB
    Cat --> Log
    Prog --> Dash
    MiDia --> Mut --> DB
    Dash --> Q --> DB
    Q --> Hab
    Nerd --> Log
    Sync --> DB
    Mut --> Auth
    Aj --> Auth
```

## El molde (ADR 0012), una sola vez

`lib/catalogo/` expone, por entidad, un esquema zod y cuatro operaciones: `listar(activos?)`,
`crear(session, input)`, `editar(session, id, input)`, `desactivar(session, id)`. Las tres
escrituras registran en `change_log` con `origen = "app"`. Cada pantalla de administración y
cada server action llaman a estas funciones; ninguna habla con Drizzle directo. Así, una entidad
nueva es: tabla + esquema + registro en el molde + pantalla.

## Modelo de datos al final de F3

```mermaid
erDiagram
    PROGRAMS ||--o{ COHORTS : tiene
    PROGRAMS ||--o{ PRODUCTOS : vende
    PROGRAMS ||--o{ SOURCES : "leads desde"
    PROGRAMS ||--o{ MIEMBROS_PROGRAMA : "closers asignados"
    USERS ||--o{ MIEMBROS_PROGRAMA : "vende en"
    PROGRAMS ||--o{ PEOPLE : agrupa
    PEOPLE ||--o{ CALLS : recibe
    COHORTS ||--o{ CALLS : "cohorte activa"
    CALLS }o--o| MOTIVOS : motivo
    CALLS }o--o| ORIGENES : origen
    PEOPLE ||--o{ SALES : compra
    PRODUCTOS ||--o{ SALES : "se vende como"
    SALES ||--o{ ABONOS : "se paga con"
    PLATAFORMAS_PAGO ||--o{ ABONOS : "entra por"
    PROGRAMS |o--o{ RECURSOS : "de (o global)"
    PROGRAMS ||--o{ ENLACES_PAGO : cobra
    PLATAFORMAS_PAGO ||--o{ ENLACES_PAGO : "generado en"

    PROGRAMS {
        text slug
        text nombre
        text webUrl "NUEVO"
        text calendlyUrl "NUEVO"
        bool activo
    }
    COHORTS {
        text codigo
        int metaCupos
        int metaLeadsDia "NUEVO"
        numeric trmCohorte "RENOMBRADO"
        estadoCohorte estado "RENOMBRADO"
    }
    USERS {
        text closerId
        text calendlyEmail "NUEVO"
        rol rol
    }
    CALLS {
        resultadoLlamada resultado "AMPLIADO"
        timestamp fechaSeguimiento "NUEVO"
        uuid motivoId "NUEVO"
        uuid origenId "NUEVO"
    }
    SALES {
        uuid productoId "NUEVO"
        numeric precioAplicadoUsd "contrato"
    }
    ABONOS {
        uuid saleId "NUEVA TABLA"
        date fecha
        numeric monto
        text moneda
        uuid plataformaId
        text comprobanteUrl
        text closerId
    }
    RECURSOS {
        text categoria
        text url
        bool vigente
    }
    ENLACES_PAGO {
        numeric monto
        text moneda
        text url
        bool vigente
    }
```

## Grafo de tickets

```mermaid
flowchart LR
    T008["008 Cohorte"] --> T010["010 programas dinámicos"]
    T009["009 test de slugs"] --> T010
    T008 --> T011["011 molde + plataformas"]
    T011 --> T012["012 motivos + orígenes"]
    T011 --> T013["013 pantalla catálogos"]
    T010 --> T014["014 programas y cohortes"]
    T011 --> T014
    T011 --> T015["015 usuarios y closers"]
    T014 --> T016["016 fuentes configurables"]
    T011 --> T017["017 productos"]
    T012 --> T018["018 esquema registro + abonos"]
    T017 --> T018
    T018 --> T002["002 cohorteActiva + registrarLlamada"]
    T018 --> T019["019 registrarAbono"]
    T002 --> T003["003 /mi-dia"]
    T019 --> T003
    T015 --> T003
    T015 --> T007["007 onboarding closers reales"]
    T008 --> T020["020 días hábiles + meta dinámica"]
    T018 --> T004["004 consultas dashboard"]
    T020 --> T004
    T004 --> T005["005 dashboard"]
    T010 --> T005
    T005 --> T006["006 historial persona"]
    T005 --> T021["021 snapshot"]
    T011 --> T022["022 recursos + enlaces"]
    T017 --> T022
    T022 --> T023["023 pantalla recursos"]
    T010 --> T024["024 rol developer"]
    T024 --> T025["025 Nerd Stats"]
```

## Contra las restricciones no-negociables de AGENTS.md

- **Rol en servidor:** cada pantalla nueva usa `paginaConRol` y cada escritura `requireRole`. El
  molde recibe la sesión para registrar quién cambió qué, no para decidir permisos.
- **Caja ≠ ventas:** ahora cada una tiene su tabla (ADR 0013).
- **Moneda siempre visible:** los abonos guardan su moneda; la caja se agrupa por moneda y nunca
  se convierte.
- **Ningún dato personal en URLs:** historial por `personId`; programas por slug (no es dato
  personal).
- **Mapeo que no cuadra falla ruidosamente:** el ticket 016 adelanta ese fallo al momento de
  guardar la fuente.
- **Escala:** los catálogos tienen decenas de filas; nada nuevo opera sobre el set completo
  salvo las consultas del dashboard, que agregan en SQL.
