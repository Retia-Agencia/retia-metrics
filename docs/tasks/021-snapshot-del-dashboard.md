---
id: 021
fase: F2
serves: "spec §2 — snapshot descargable"
depends: [005]
status: bloqueado
---

# 021 — Snapshot descargable del dashboard

## Objetivo
Quien lo necesite descarga lo que ve en el dashboard para compartirlo fuera de la app.

## Bloqueado por
**Mani, 16-sep: va de último.** Idea inicial: un formato parecido al reporte diario que el equipo
ya comparte hoy (los reportes de Mike). Se decide al llegar aquí.

Decisión de formato (PDF, PNG o CSV) y de quién puede tomarlo (`docs/spec.md` §7). CSV no
necesita dependencias; PDF/PNG sí (ADR 0006).

## Done cuando
- [ ] Refleja exactamente los números en pantalla, sin recalcular.
- [ ] Lleva fecha, programa y rango en el nombre y en el contenido.
