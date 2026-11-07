---
id: 387
etapa: mcp
serves: "ADR 0119 · docs/mcp.md §7 y §8 · pedido de Mani del 7-nov: ver y administrar el MCP sin abrir el código, y gráficas dentro del chat"
depends: [348, 385]
status: idea
---

# 387 — El MCP del CRM: administración visual, evaluación de descubrimiento y visualizaciones en el chat

> **Para una sesión sin contexto.** Lee `docs/mcp.md` entero (arquitectura, contrato y deuda) y el ADR 0119. Hoy el MCP
> **se configura solo con código**: qué herramientas existen (`lib/mcp/herramientas/index.ts`), quién las ve
> (`lib/auth/roles.ts`) y el tope por minuto (`TOPE_POR_MINUTO` en `lib/mcp/bitacora.ts`). La única pantalla es Mi espacio ›
> Conexiones de IA, y solo emite y revoca tokens del developer. Este ticket es **idea**: no se construye hasta que Mani lo
> apruebe y el 385 haya dejado la salida limpia.

## Tres frentes, independientes entre sí

### A. Administración visual (developer; lo que hoy solo se ve en la base)

- **Actividad:** una vista de solo lectura sobre `mcp_llamadas` por token, persona y herramienta: llamadas, errores,
  denegadas, topes y latencia (p50 y p95). Sin argumentos (la bitácora no los guarda). Es lo que permitió el 7-nov ver
  que la espera de ~40 s no era del servidor (96 ms y 890 ms); hoy eso se averigua con SQL a mano.
- **Quién ve qué:** la matriz herramienta × rol **generada del registro `HERRAMIENTAS` y de `puede`**, no escrita a mano,
  para que no se desincronice con `docs/mcp.md` §3. Solo lectura: cambiar un permiso sigue siendo `lib/auth/roles.ts`
  (ADR 0077: un catálogo editable existe solo si el código decide con su valor; aquí el código decide).
- **Tokens de todos (cuando el 383 abra los roles):** listar y revocar los de cualquier persona desde Ajustes ›
  Usuarios, con rastro en `change_log`.
- **No se hace:** editar descripciones de herramientas desde una pantalla. La descripción es parte del contrato y se
  revisa en un commit con sus tests.

### B. Evaluación de descubrimiento (que el modelo escoja bien y rápido)

El método de Anthropic ("Writing effective tools for agents"): tareas realistas con resultado verificable, métricas de
exactitud, número de llamadas, tokens y errores, y un conjunto reservado para no sobreajustar. Aquí: 15 a 20 preguntas
reales de gerencia, closers y pauta ("¿cuántas ventas tuvo Tactical en octubre?", "¿qué deals vencen hoy?"), cada una
con la herramienta esperada y la cifra esperada contra el Hub. Se corre contra el servidor local y se guarda el
resultado en `docs/mcp.md`. Mide antes y después de cada cambio de descripciones (385/386) para saber si mejoró.

### C. Visualizaciones dentro del chat (MCP Apps, SEP-1865)

La herramienta apunta a un recurso `ui://` con HTML (`text/html;profile=mcp-app`) que el cliente muestra en un iframe
con sandbox. Opcional y negociado por cliente: Claude Code no lo muestra; claude.ai y ChatGPT sí lo anuncian (verificar
la versión de cada cliente antes de construir). Alcance mínimo propuesto: una gráfica de serie (ventas y caja por día)
y la tarjeta de cobertura, con los colores de Tinta y las series de `lib/series-pasos.ts`; el HTML se genera en el
servidor desde el mismo objeto estructurado de la herramienta, sin definir ninguna métrica nueva. **Antes de construir:**
cifras sin ambigüedad (385) y esquema de salida propio.

## Por qué está en `idea`

Una gráfica sobre una cifra ambigua la hace parecer más correcta, no lo es (hallazgo del 7-nov: 17 ventas y 11 deals
vendidos en la misma respuesta). El orden es 385 (cifras y esquema), luego B (medir), luego A y C.

## Done cuando (cuando se apruebe)

- [ ] A: la vista de actividad y la matriz existen, con guarda de rol en el servidor, solo para quien administra, y su
      test de rol forjado.
- [ ] B: las preguntas de evaluación están en el repo con su resultado esperado y hay una corrida antes y otra después.
- [ ] C: un cliente que anuncia MCP Apps muestra la gráfica; uno que no, recibe el mismo dato en texto.
- [ ] Tracker y `status:` iguales (N9).
