---
id: 302
etapa: envios-falsos
serves: "ADR 0105 punto 5 y consecuencias · ADR 0026"
depends: [301]
status: todo
---

# 302 — Vigencia de leads: un lead anulado sale de Personas y de toda métrica de leads

## Por qué

Anular el deal del troll no basta: su lead seguía sumando en los leads por día y en las listas (ADR 0105, opciones
descartadas). Medido el 23-oct: **58 lecturas de `leads` en 37 archivos**. Muchas llegan por un deal que ya filtra
`vigente(deals)`, pero el guardián lee cadena por cadena y cada una decide igual.

## Alcance

1. `leads` entra a `TABLAS_ANULABLES` y se decide cada lectura:
   - métricas y listas (leads por día, Leads, búsqueda, Inbox, kanban, cartera, estudiantes): `vigente(leads)`;
   - ingesta, identidad, dedup y `otrosProgramasDelCorreo`: `incluyendoAnulados(leads)`. El índice
     `(program_id, email_normalizado)` sigue siendo único, con anulados incluidos;
   - ficha del lead: `incluyendoAnulados`, con el lead marcado como anulado y por qué.
2. **El reincidente vuelve a contar:** cuando entra un envío nuevo, no anulado, a un lead anulado, la ingesta limpia la
   anulación del lead en la misma transacción, con rastro (`editarConRastro`, motivo del sistema). Lo decidió el ADR
   0105: el deal nuevo lo marca Sospechoso la regla del reincidente (303), no la ingesta.

## Fuera

- Escribir la anulación de un lead (307).

## Done cuando

- [ ] El guardián falla si una lectura de `leads` no decide, mordido en los dos sentidos.
- [ ] Un lead anulado no cuenta en los leads por día ni aparece en Leads ni en la búsqueda (tests), y su ficha abre.
- [ ] Un envío nuevo sobre un lead anulado lo vuelve vigente y deja su fila en `change_log` (test por la ruta real).
- [ ] typecheck, lint, los tests tocados y los guardianes; `tests/paginas.test.ts` si cambia una página.
