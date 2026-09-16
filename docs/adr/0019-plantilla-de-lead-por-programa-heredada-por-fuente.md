# 0019 — Plantilla de lead por programa, heredada y ajustable por fuente

**Fecha:** 2026-09-16 · **Estado:** aceptado (decision de Mani; se construye en el ticket 016)

Michael confirmo el 16-sep que los leads se sincronizan desde Sheets (ADR 0004 firme). Cada
programa tiene su propia hoja, y no es realista exigir que todas tengan las mismas columnas: un
programa nuevo trae su formulario con sus preguntas, y ComunicArte ya tiene dos formularios con
redaccion distinta (`New form` y `Forms viejo`). Estandarizar las hojas a mano no escala.

Hoy cada fuente guarda su mapeo en `sources.mapeoColumnas` y, si esta vacio, usa
`MAPEO_FORMULARIO` del codigo. Las columnas se buscan por texto del encabezado, no por posicion.

**Decidimos una "plantilla de lead" en tres niveles, resuelta campo por campo:**

1. `sources.mapeoColumnas`: ajustes de esa hoja (solo los campos que cambian).
2. La plantilla del programa (columna nueva, p. ej. `programs.plantilla_lead`): el mapeo que
   heredan todas sus fuentes.
3. `MAPEO_FORMULARIO`: el ultimo recurso, en el codigo.

**Los campos son fijos en el codigo** (nombre, correo, WhatsApp, cargo, ingreso, urgencia, por que
aplico, UTM, fecha, estado). La plantilla solo dice en que columna esta cada uno; no crea campos
nuevos. Toda columna que no mapea queda completa en `people.raw` y se ve en el historial de la
persona.

- Sigue el ADR 0012: la plantilla es una instancia (vive en la base, se edita desde la app); los
  campos son tipos (el codigo calcula metricas con ellos).
- Un programa nuevo con varias hojas se configura una vez, no una vez por hoja.
- Se descarto "campos propios por programa" (esquema dinamico): mas codigo, y hoy ninguna
  metrica los necesita. Si aparece uno que si importa, se promueve a campo fijo con su ADR.

## Consecuencias

- Migracion: plantilla en `programs` (va a la rama `dev` primero, ADR 0018).
- `resolverColumnas` recibe el mapeo ya combinado; los obligatorios siguen en el codigo y un
  faltante sigue lanzando `MapeoInvalidoError`.
- La pantalla de fuentes (ticket 016) muestra de donde salio cada columna (fuente, programa o
  defecto) y el boton "Probar" valida con el mapeo combinado.
- No hace falta estandarizar las hojas de ComunicArte y Tactical Investor.
- `people.raw` crece con las columnas extra: refuerza S-06 + B-06 (retencion y techo de `raw`).
