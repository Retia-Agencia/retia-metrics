---
id: 084
etapa: E1b
serves: "plan v2 §12.10.2 y §12.15 · ADR 0045 (enmendado el 21-sep)"
depends: [083]
status: todo
---

# 084 — `campanas` y `utm_patron`: el esquema de la atribucion

## Objetivo

Que el costo de la pauta y el origen de un lead **se puedan cortar con la misma llave**. Hoy no se
puede: el lead trae `submissions.utm_*` y `ad_spend` tiene `campana` en **texto libre**, y unirlos
seria comparar cadenas entre dos sistemas que no se hablan (ADR 0045, el problema).

## El esquema

```
campanas   (id, program_id NOT NULL, nombre, plataforma, cohort_id?, activo)
ad_spend   (campana_id, fecha, inversion, moneda, ...)       ← cambia de grano
utm_patron (id, program_id?, utm_source?, utm_medium?, utm_campaign?,
            campana_id? XOR user_id? XOR area_id?,  prioridad, activo)
```

⚠️ **Tres campos de patron, no cinco** (ADR 0045, enmienda 2 del 21-sep). `utm_term` y `utm_content`
no se usan, asi que **no hay `pgEnum nivel_utm`**: con un solo nivel no hay nada que declarar.

## Alcance

- **Dentro:** las dos tablas y **una sola migracion**, leida linea por linea antes de
  aplicarla (regla de `AGENTS.md`, medida en la 0020).
- **Dentro:** el `CHECK` que garantiza **exactamente un destino** por patron.
- **Dentro:** el **indice unico** sobre la combinacion de campos del patron dentro del programa, que
  es lo que hace imposible el empate del ticket 085 (ADR 0005: la reja vive en la base).
- **Dentro:** `ad_spend` pasa a grano **campana + fecha**; `ad_spend_huella_idx` deja de ser la llave
  (enmienda al ADR 0039 punto 4).
- **Fuera:** el emparejador (ticket 085) y las pantallas (ticket 090).

## Las reglas que no se rompen

- **El area NO se guarda en el patron cuando se puede derivar.** El patron apunta a una campana, a un
  usuario o a un area, **nunca a dos**. Guardar el area ademas permitiria escribir la contradiccion
  *"patron de area Media apuntando a una campana de Pauta"*.
- **`submissions.utm_*` NO se reescribe.** Es texto copiado de la fuente (ADR 0004). El estandar de
  nombres rige hacia adelante y el historico se clasifica con reglas del catalogo de Canales (ADR
  0051; el `nivel` se elimino el 21-sep), no reinterpretando el crudo.
- **`submissions.utm_term` y `submissions.utm_content` se quedan vacias y SIN LEER.** No se borran
  —costaria una migracion sobre una tabla ya en `production`— y **se marcan en el comentario del
  esquema como deliberadamente no leidas**, para que nadie las cablee creyendo que tapa un hueco.
- `campanas.program_id` es `NOT NULL`; `utm_patron.program_id` es **nullable** (`null` = aplica a
  todos).

## Done cuando

- [ ] La migracion se leyo entera antes de aplicarse y se aplico en `dev`.
- [ ] Un patron con dos destinos **lo rechaza el `CHECK`**, con test.
- [ ] Dos patrones identicos en el mismo programa **los rechaza el indice unico**, con test.
- [ ] Un patron sin `program_id` casa envios de los dos programas; uno con `program_id` solo del suyo.
- [ ] `npm test`, `typecheck` y `lint` limpios.

## Kiro

Parcial: las tablas y los tests si, con revision. **La migracion la genera y aplica la sesion
principal, nunca un subagente** (`AGENTS.md`).

---

## Enmienda 2026-09-24 (ADR 0051)

- El patrón se expresa en dos catálogos: **Canal** (`utm_source` + `utm_medium` → área, ticket 101) y
  **Campaña** (`utm_campaign`). Una campaña cuelga de un canal y de un programa.
- `submissions.utm_term` y `utm_content` **dejan de ser "deliberadamente sin leer"**: se capturan
  siempre, y `utm_content` se lee solo en el canal Closer (para `traido_por`).
- Pendiente de la revisión del 22-sep (P2), sigue vigente: el índice único necesita
  `NULLS NOT DISTINCT` **y** detección del empate en tiempo de ejecución.
