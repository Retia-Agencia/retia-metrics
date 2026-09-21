---
id: 082
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-6 · insumo §9, ADR 0004 (enmendado)"
depends: [079, 080, 081]
status: todo
---

# 082 — Apagar las pestanas de gestion de la hoja

## Objetivo

Cerrar la epoca: cuando el CRM tiene todo, el equipo deja de trabajar en Sheets. **Es el ultimo
paso de todo el plan v2.**

Despues de esto, lo unico que entra de afuera son **leads crudos** (ADR 0004 enmendado, ADR 0039).

## Alcance

- **Dentro:** dejar las pestanas de gestion (`Setteo`, `Registro de llamadas`, `Estudiantes`) en
  **solo lectura**, con un aviso arriba que diga donde vive ahora la operacion.
- **Dentro:** **NO se borran.** Son el respaldo de la migracion y el unico sitio donde se puede
  comprobar que lo migrado cuadra. Una pestana borrada no se recupera.
- **Dentro:** la pestana de leads crudos sigue **viva y escribiendose**: es la fuente (ADR 0004).
- **Fuera:** apagar el Apps Script que calcula el `Estado`. **Sigue haciendo falta** hasta que
  Dapta entregue el estado ya lleno (insumo §5.7). ⚠️ Apagarlo por error deja de calificar los
  leads nuevos y el CRM deja de crear deals, **sin ningun error**.

## El orden, y por que

Se apaga **despues** de que la migracion este verificada en `production` y de que el equipo lleve
unos dias operando en el CRM. Apagar antes deja al equipo sin las dos herramientas a la vez.

## Done cuando

- [ ] Las pestanas de gestion estan en solo lectura, con su aviso.
- [ ] Ninguna pestana borrada.
- [ ] El Apps Script del `Estado` sigue corriendo y se comprueba que si.
- [ ] El equipo confirma que lleva dias operando solo en el CRM.

## Kiro

No. Es tocar la hoja de produccion del equipo: lo hace Mani.
