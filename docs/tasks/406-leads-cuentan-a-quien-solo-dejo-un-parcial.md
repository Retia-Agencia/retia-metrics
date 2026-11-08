---
id: 406
etapa: hub
serves: "Auditoría 385 F2B-02 · decisión de Mani 8-nov"
depends: [389]
status: en main
---

# 406 — Leads: quien solo dejó un parcial cuenta como lead

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md). Reglas: ADR 0115.

## Por qué

F2B-02 (`docs/auditoria-datos-2026-11/f2b-paridad.md`): 807 personas que solo dejaron un formulario parcial quedan fuera de "Leads" en el Hub (el Hub las cuenta como deals y no como leads) pero están en la lista Leads. Confianza octubre: 428 contra 664. Decisión de Mani (8-nov): **deben contar como Leads**.

## Alcance

**Cubre:** que el concepto "lead" (N1, un módulo, `docs/metricas.md` §0) cuente a la persona con solo un parcial, en SQL y en su gemela TS, y que cifra, lista y MCP coincidan. Medir el efecto antes y después por programa (el 389 ya movió el Hub +55 % en Confianza octubre) y dejarlo escrito. Revisa también la razón que usa Leads como denominador, y confirma contra "Leads" (no "Envíos") la meta de leads por día (354 alcance 3, por confirmar con Mani).

**Fuera:** renombrar (lo hace el 397).

**Migración:** ninguna.

## Done cuando

- [x] Una definición de lead que incluye al solo-parcial; las 807 de hoy cuentan y la cifra del Hub, la lista Leads y el MCP dan lo mismo.
- [x] Antes/después por programa documentado; números dorados de F0 que cambien, declarados en este ticket.
- [x] Test de paridad con el caso que las haría divergir (persona con un solo envío parcial).
- [x] Regla N8: fila de `docs/metricas.md`, `overview.md` §11 y ADR si corresponde, en el mismo commit.

## Resultado (8-nov)

El 389 ya había dejado la definición correcta: `filtroLeads` cuenta por `leads.fecha_primera_aplicacion` sin mirar si hay un envío completo, y M1 rellenó los 784 nulos. No hizo falta cambiar código de consulta. Medido en producción (solo lectura, octubre, Hub contra lista Leads): Comunicarte 1.096 / 1.108, Confianza 664 / 664, Jurídico 106 / 106, Tactical 930 / 932; la diferencia (12 y 2) son altas manuales, que la lista muestra por diseño y el Hub no. Solo-parcial dentro de la cifra del Hub: 169, 236, 55 y 166. Los 428 de Confianza eran el valor previo al relleno. Se agregó el test de paridad (persona con un solo parcial: cifra = lista = 2) y se aclaró `metricas.md` §Leads y `overview.md` §11. Números dorados: sin cambios en este ticket.
**Pendiente de Mani:** la meta de leads por día (354 alcance 3) sigue sin decidirse; `meta_leads_dia` está nulo en las 10 cohortes, así que hoy no cambia ninguna cifra.
