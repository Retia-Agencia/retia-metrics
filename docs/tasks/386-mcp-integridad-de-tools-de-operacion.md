---
id: 386
etapa: mcp
serves: "ADR 0119 · ADR 0042 (rastro) · ADR 0038 (anular) · ADR 0037 (deal) · ADR 0117 (deshacer)"
depends: [348, 384]
status: todo
---

# 386 — Integridad de las tools de operación del MCP, por rol y por requerimiento

> **Distinción (Mani, 6-nov):** montar el MCP (348, 383, 384) no es definir sus tools. Este ticket verifica que las tools
> de **operación** (leads, deals, bandeja, y después las escrituras del 384) sean consistentes y escalables.

## Qué se verifica

1. **Una lista de tools por rol, derivada de un requerimiento.** Para cada rol (closer, gerente, paid trafficker,
   customer success, developer) se escribe qué necesita hacer y qué tool lo cubre; sin tool huérfana ni requerimiento sin
   tool. La capacidad de cada tool sale de `lib/auth/roles.ts`, nunca de un rol escrito a mano.
2. **Los movimientos y actividades son consistentes.** Toda escritura pasa por la misma función que la pantalla
   (`moverEtapa`, `registrarAbono`, etc.), deja rastro en `change_log` (`crearConRastro`/`editarConRastro`), respeta la
   vigencia (anulados) y el programa como frontera. Se prueba forjando la petición, como pide AGENTS.md.
3. **Escalabilidad.** Paginación en servidor, topes, y que agregar un rol, un programa o una etapa no obligue a tocar las
   tools (todo derivado de tipos con chequeo de exhaustividad).
4. **Sin duplicación con la app.** Auditoría de literales repetidos entre `app/` y `lib/mcp/` (regla de AGENTS.md
   "Una herramienta del MCP no copia a su pantalla").

## Done cuando

- [ ] Matriz rol × requerimiento × tool, revisada con Mani.
- [ ] Tests forjados por rol y por escritura en verde; ninguna escritura sin rastro.
- [ ] Tracker y `status:` iguales (N9).
