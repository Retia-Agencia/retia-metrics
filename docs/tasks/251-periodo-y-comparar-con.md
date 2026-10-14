---
id: 251
etapa: hub
serves: "ADR 0086 punto 4 · docs/hub.md H-2 (Mani: el A contra B no se entiende)"
depends: [250]
status: todo
---

# 251 — Periodo y "Comparar con", sin A ni B en pantalla

## Objetivo

Que quien abre el Hub elija un periodo y, al lado, contra qué compararlo, en palabras, y que cada cifra diga contra qué
se está comparando.

## Alcance

- **Dentro:** `SelectorPeriodo` (`components/selector-periodo.tsx`) se parte en dos controles: **Periodo** (los atajos
  de hoy y un rango) y **Comparar con**: "mismo punto del periodo anterior" (por defecto), "cohorte anterior al mismo
  día hábil", "un rango que elijo" y "no comparar". Ninguna letra A o B en la interfaz.
- **Dentro:** la variación de cada cifra (`Variacion`) lleva el texto de la comparación en el título o el tooltip
  ("contra el mismo punto de septiembre: 12 → 15, +3, +25%").
- **Dentro:** `lib/periodo.ts` no cambia de reglas (ADR 0067 puntos 1 y 3): el "Comparar con" se traduce a las mismas
  llaves de la URL, así que los enlaces guardados siguen sirviendo. Las listas que hoy usan el selector en modo "solo A"
  (141) quedan con el control de Periodo solo.
- **Fuera:** la lógica de días hábiles y de cohortes, que ya existe y tiene tests.

## Done cuando

- [ ] Cada opción de "Comparar con" produce el mismo rango B que hoy produce el selector, con test sobre
  `parsearPeriodoUrl`.
- [ ] Una URL vieja con `a_desde`/`b_desde` abre el Hub con el "Comparar con" correcto marcado.
- [ ] Nadie ve la letra "A" o "B" en el Hub ni en las listas (recorrido, escritorio y 375 px).
- [ ] `npm run test:humo` en verde.
