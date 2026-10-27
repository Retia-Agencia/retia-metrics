# Media: subproyecto de centralización de la operación de contenido

> **Prioridad alta (Mani, 26-oct-2026).** Retia quiere centralizar toda su operación: el CRM hoy es solo
> comercial y debe integrar también media, pauta y creación de contenido. Este subproyecto nace de la
> sesión "Creación Media Ops Machine" (20-oct-2026) y todavía **no es un plan aprobado**: las decisiones
> abiertas están en [`extraccion.md`](./extraccion.md) §8 y se cierran con gerencia antes de abrir tickets.

## La idea en una línea

Retia ya tiene las dos mitades del loop y no se hablan: el CRM sabe qué se vende y qué UTM trajo cada lead;
el cockpit (`../pipeline-creacion-contenido`) sabe qué contenido se buscó y se grabó. El subproyecto las
conecta: lo que vende en las llamadas alimenta las historias, y cada historia se mide por los leads que trae.

## Qué hay aquí (leer en este orden)

| Capa | Archivo | Para qué |
|---|---|---|
| **Visión (vigente)** | [`propuesta.md`](./propuesta.md) | El norte: los dos componentes, la escalera de conversión, el pipeline de media, cómo cabe en el CRM, la crítica y lo que falta saber. No es el plan de implementación (sale en otra sesión con grill). **Manda sobre la extracción donde chocan**. Publicada: [Media en el CRM: la visión](https://claude.ai/artifact/25FBDYzAhL345FbBQVsUL3) |
| Resumen para gerencia | [`gerencia/deck/`](./gerencia/deck/) | El deck de 13 slides (fuente de la página publicada), con la narración y las referencias en las notas del presentador de cada slide |
| Extracción | [`extraccion.md`](./extraccion.md) | Todo lo que se dijo y lo que se pidió, depurado: dolores, árbol, procesos y reglas, los 18 pedidos a Manu (M1 a M18), lo que ya existe, la propuesta, las 16 capacidades, el roadmap, las 15 decisiones y las referencias (§9) |
| Crudo | [`crudo/`](./crudo/) | Las tres grabaciones de la sesión: F1 y F2 de Wispr, F3 de Grain |

**Versiones publicadas (privadas; se comparten desde el menú Share):**

- Deck: [Media Ops para gerencia](https://claude.ai/artifact/9ieUYcs5pmH9FpvqSeBazP)
- Documento detallado para el daily: [Media Ops: centralización de la operación de contenido](https://claude.ai/artifact/YAFyMJVmocGkebZnXwsN4K).
  Es una versión resumida de `extraccion.md`, por eso no se copia aquí: si cambian, manda `extraccion.md`.

## Estado de los crudos

| Código | Archivo | Estado |
|---|---|---|
| F1 | [`crudo/2026-10-20-media-ops-machine-wispr.md`](./crudo/2026-10-20-media-ops-machine-wispr.md) | ✅ Completo: notas, resumen y el export de Wispr con marcas de tiempo |
| F2 | [`crudo/2026-10-20-story-production-wispr.md`](./crudo/2026-10-20-story-production-wispr.md) | ✅ Completo: notas, resumen y transcript (sin marcas de tiempo; se corta en el break) |
| F3 | [`crudo/2026-10-20-calendario-reels-grain.md`](./crudo/2026-10-20-calendario-reels-grain.md) | ✅ Completo, copia exacta del export (el export mismo termina a mitad de frase) |
| F4 | [`crudo/2026-10-26-daily-tech-wispr.md`](./crudo/2026-10-26-daily-tech-wispr.md) | 🟡 Resumen de Wispr; el transcript completo está en el link del original |

## Cómo se trabaja este subproyecto

- **El crudo no se edita.** Es la fuente para aclarar cualquier cosa; la extracción cita F1, F2 y F3.
- **La extracción manda.** Un cambio de alcance, una decisión cerrada o una regla nueva se escribe en
  `extraccion.md` en el mismo commit, y el deck y el documento publicado se regeneran desde ahí.
- **Las decisiones cerradas que toquen un área decidida van con ADR** (`docs/adr/`), como en el resto del repo.
  La primera que lo necesita es la convención de UTM de stories (D4).
- **Del roadmap salen tickets** en `docs/tasks/`, igual que en el resto del repo, cuando las decisiones de la fase 0 estén cerradas.
