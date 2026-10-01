---
id: 126
etapa: E7
serves: "docs/analytics.md PT-08, PT-47"
depends: []
status: todo
---

# 126 — El embudo del formulario

## Objetivo

Lo que pidió Pauta: *"qué porcentaje inicia, pasa datos de contacto a la siguiente etapa"*, para mejorar el
formulario.

## Lo medido el 29-sep

El endpoint `insights/{form}/summary` de Typeform da, por pregunta, vistas y abandonos (Tactical: 7.977
vieron la primera pregunta y 3.342 se fueron ahí; 823 vieron el Calendly y 358 se fueron). Es **agregado y
sin canal**. Por canal, el CRM tiene lo suyo desde el primer parcial: dejó datos, completó, llegó al
Calendly, agendó.

## Alcance

- **Dentro:** leer el Insights de cada formulario al abrir la sección (con caché corta), sin guardarlo, y
  pintar el embudo por pregunta con la hora de la lectura.
- **Dentro:** el embudo por canal desde los envíos del CRM (registro = token, 123).
- **Dentro, por decidir antes de construir (🟡):** dónde vive el token de la API de Typeform en
  producción. Propuesta: con la fuente, con las reglas del secreto del webhook (ADR 0055, 0057). Hoy solo
  existe el token de desarrollo en `.env.local`.
- **Dentro:** verificar si el Insights acepta un rango de fechas; si no, la pantalla dice "histórico
  acumulado".
- **Fuera:** editar el formulario.

## Done cuando

- [ ] El embudo por pregunta cuadra con el panel de Typeform el día de la prueba.
- [ ] El embudo por canal no cuenta dos veces un parcial y su completa.

## Kiro

Sí, con revisión.


---

## Decisión de Mani, 29-sep

- ✅ El token de la API de Typeform vive en la base, en la fuente, con las reglas del secreto del webhook (lo escribe una función, se muestra una vez, nunca vuelve en una lectura ni en `change_log`). Se carga en producción. Es otra excepción nombrada de `AGENTS.md`.

---

## Parte A construida (1-oct, sesión 67, Alejo): el embudo por canal

Alejo eligió partir el ticket: la parte A no lleva token ni migración; la B (Insights por pregunta, token en la
fuente) espera el ok de Mani para la migración y QM-8.

- `embudoDelFormulario` en `lib/queries/embudo-formulario.ts`, la única definición de los cuatro pasos. Unidad: el
  registro (fuente, token), un parcial y su completa son uno. Por el día de Bogotá del PRIMER envío; un token que
  empezó en el rango cuenta entero aunque complete después. Canal por `emparejar` sobre el envío completo (o el
  primer parcial); "sin UTM" y "sin clasificar" siempre como filas aparte.
- **Agendó** = el hecho del código (`ESTADO_CON_CALENDLY`). **Llegó al Calendly** = agendó o `lead_quality` High,
  NO la variable `estado` (`con_calendly_sin_agenda`): el ADR 0069 la retira, y medido el 1-oct en producción todo
  `con_calendly_sin_agenda` llega High. Lo anterior a que el formulario mandara la calidad (~29-sep) solo "llegó" si
  agendó; la pantalla dice cuántos son (`sinCalidad`). `analytics.md` §6 actualizado.
- Tarjeta "Embudo del formulario" en el dashboard (`components/embudo-formulario.tsx`), con el período A, número y %
  sobre "dejó datos" (ADR 0067). No aplica el filtro de closer. Visto en la base local: 126 registros, 50 agendaron,
  igual que los envíos `con_calendly`; consola limpia, sin desborde.
- Tests: `tests/embudo-formulario.test.ts` (8, mordidos: quitar la regla High o leer el canal del primer parcial los
  rompe); `paginas.test.ts` mockea la consulta nueva.

**Falta (parte B):** columna del token de Typeform en `sources` (decisión de Mani del 29-sep: reglas del secreto),
el cliente del Insights con caché corta, y verificar si acepta rango de fechas.
