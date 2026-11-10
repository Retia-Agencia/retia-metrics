---
id: 414
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §5 opción B y §6 · pedido de Dani Rodríguez (7-nov): sección diaria · docs/diseno-cifra-y-pauta.md §4.3"
depends: [412, 419]
status: todo
---

# 414 — Tabla de Pauta por día

## Alcance

- Paso `dia` en `cargarPautaSemanal` (`lib/queries/hechos/pauta-semanal.ts`) y en la tabla; interruptor Por semana | Por día en
  la URL (`lib/series-pasos.ts`); el título cambia ("¿Qué día rindió mejor?") y el chip dice "Cambio contra el día anterior".
- La última columna "en curso"; Comercial "Parcial" en ella. CSV por día.
- Columnas razonables con desplazamiento horizontal y la primera columna pegada.
- **Fila propia "Agendas según Meta"** en Tráfico (hoy va dentro del costo según Meta).
- Si Mani ya decidió D-A, D-B y D-E (403 F1), sus arreglos en este mismo archivo van **antes** (I-1, I-2, I-8), cada uno con su
  test en rojo primero.

**Bloqueo para cuadrar con el Excel (no para construir):** DM-8 (Q-2 y Q-3).

**Migración:** Ninguna.

## Done cuando

- [ ] Test de paridad: la suma de los días de una semana = la semana (conteos y dinero; tasas sobre sus partes).
- [ ] Por día con "en curso", "Parcial" y CSV; igual al boceto.
- [ ] Agendas según Meta como fila.
