---
id: 322
etapa: media
serves: "ADR 0111 puntos 2a, 2b, 3 y 5"
depends: [316]
status: todo
---

# 322 — El esquema del cockpit en el CRM y el traslado único

## Alcance

- Inventario (solo lectura) de las tablas vivas del cockpit y su volumen, con el mapa tabla del cockpit → tabla del
  CRM en el vocabulario del CRM. Va en este archivo antes de la migración.
- Migración: referentes y su salud, candidatos, transcripciones de referentes, guiones limpios, colecciones,
  calificaciones y su aprendizaje, cada uno colgado de `creadores`. Sin RLS ni tenencia: la frontera es el programa del
  creador.
- Script de traslado, una vez, con huella para deshacerlo (molde de `migracion:deshacer`), que crea los creadores por
  `lib/catalogo/` con `actorDelScript()`. Corre primero contra la base local; en producción, con el ok de Mani.

## Done cuando

- El traslado contra la base local cuadra en conteos con el cockpit, tabla por tabla, y se deshace limpio.
- El SQL de la migración se leyó antes de aplicarla (AGENTS.md).

## Inventario y mapa (solo lectura del cockpit, 29-oct-2026)

Cockpit: base Supabase propia (ref `zdeqabvcdqhbcnwivwwk`), un solo tenant con datos de Retia (`client_id = retia`, instancia
`reels`). Los tenants `estadox` y `30x` y la instancia `linkedin` no tienen filas de contenido que migrar.

**Dos hallazgos que cambian la lectura del ADR 0111:** (1) el "cliente" del cockpit es la empresa (`retia`), no la persona; el
**creador** del CRM sale de las **voces** (6: Rosario, María José, Milena, Juan Pablo Vieira, Francisco, Nicolás), que son quienes
aparecen en cámara. (2) El "proyecto" del cockpit es una **temática** (28, cada una atada a una voz), no un cliente. Los referentes
cuelgan del creador **por sus temáticas** (246 vínculos, todos los referentes tienen al menos una).

| Cockpit | Filas | CRM | Notas |
|---|---:|---|---|
| `voces` | 6 | `creadores` (por el molde, sin programa) | Slug desde el nombre; si ya existe, se reutiliza |
| `proyectos` | 28 | `tematicas` | `voz_id` → `creador_id`; `plataformas` → `redes`; `n` → `meta_entrega`; `criterios_aprendidos` es el aprendizaje |
| `referentes` + `referentes_proyectos` | 95 + 246 | `referentes` + `referentes_tematicas` | Salud (tasa del gate, de aprobación) se **deriva** al leer de las corridas y lo calificado; no se guarda |
| `referentes_propuestos` + puente | 14 + 28 | `referentes_sugeridos` + `referentes_sugeridos_tematicas` | |
| `candidatos` | 8 | `candidatos` | `run_id` → `corrida_externa` (texto); `agente_id` (agentes: 0 filas) no se traslada |
| `outputs` tipo `guion_reel` | 867 | `calificaciones` | `estado` → `resultado` (`aprobado`/`descartado`); creador y temática salen de `metadata.voz` y `metadata.proyecto` |
| `descartes` | 154 | `descartes` | |
| `tandas` | 89 | `tandas` | `creada_por` no se traslada (sus usuarios no existen en el CRM) |
| `transcripciones` | 1.847 | `transcripciones` | `script` → `guion` |
| `guiones_limpios` | 927 | `guiones_limpios` | `voz_id` → `creador_id` |
| `colecciones` + `colecciones_videos` | 19 + 1.104 | `colecciones` + `colecciones_videos` | El cockpit no ataba una colección a nadie: `creador_id` nace nulo (se asigna en el 325) |
| `videos_meta` | 513 | `videos_referentes` | |
| `grabados` | 652 | `videos_grabados` | |

**No se traslada, a propósito:** `pool_crudo` (35.871 filas) y `processed_items` (3.165), que son memoria del motor de n8n y las
escribe la fachada del 323; `runs` (285), `eventos`, `tarifas`, `ajustes`, `etiquetas_rendimiento`, `agentes*`, `virlo_corridas`
(todas del motor o vacías); los `outputs` de tipo `transcripcion_a_pedido` (duplican `transcripciones`); lo multi-tenant y
LinkedIn (ADR 0111 punto 3).

## Estado de la construcción (29-oct)

Hecho: tablas en `lib/db/schema.ts`, extractor (solo `GET`), importador, deshacer, `tests/traslado-cockpit.test.ts`. Medido con la
extracción real contra PGlite: los 16 conteos cuadran con el cockpit, la segunda corrida no duplica y el deshacer deja todo en cero.

Falta, y es de la sesión principal: **generar y aplicar la migración** (el SQL borrador está en
`tests/fixtures/cockpit-0108-borrador.sql`; ver el aviso dentro del test), y el traslado real (`npm run cockpit:importar -- --aplicar`),
que pide el ok de Mani.
