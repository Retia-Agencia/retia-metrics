---
id: 049
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-2 · ADR 0036 (opcion A'), insumo §5.4"
depends: [048]
status: todo
---

# 049 — El Envio: ~10 columnas promovidas y el resto en `jsonb`, sin repetir

## Objetivo

Que cada fila de la hoja produzca un Envio completo: las ~10 promovidas en columnas y **todas las
demas** en `respuestas jsonb`, con el texto del encabezado como llave y **sin repetir las
promovidas adentro**.

## Las promovidas

`lead_id`, `source_id`, `token`, `es_parcial`, `fecha_envio`, `estado_hoja`, los `utm_*` (ver la nota de abajo),
`posicion_en_hoja`. Un campo se promueve **solo si el codigo decide, filtra, indexa o cruza con
el**; lo demas es contenido.

## Alcance

- **Dentro:** la construccion del Envio y su escritura por lotes.
- **Dentro:** el **Token** se rutea y se mapea (hoy no se mapea). Es la llave del envio.
- **Dentro:** se lee **hasta el ultimo encabezado no vacio**: una columna nueva entra sola y los
  envios viejos la tienen en `null`.
- **Dentro:** parcial y completo con el mismo Token **se guardan los dos**; la completa manda para
  el estado, la parcial es el evento "inicio el form". **El CRM recalcula cuando llega la
  hermana**, no decide una sola vez (el script de hoy decide una vez cada 10 minutos).
- **Fuera:** rellenar `submissions` desde `people.raw`. **No aplica** (ADR 0036): `raw` tiene una
  fila por persona y produciria 4.791 envios donde hubo 6.233. Un historial completo y equivocado.
- **Fuera:** los parciales huerfanos (236 en Tactical). Quedan como Leads sin deal, visibles con
  filtro; se atienden despues.

## ⚠️ El centinela, otra vez

`parsearFecha` tiene piso de plausibilidad (ano 2000) porque una hoja mandaba `1/1/0001` como
"vacio", y eso **borraba fechas reales en el dedup**: 839 de 1.034 personas. **Cada campo que se
promueva responde la misma pregunta: ¿cual es el valor que esta fuente escribe cuando no sabe?**
🩸 Y aqui hay uno conocido: **los parciales llevan esa fecha placeholder**, por eso el orden de los
envios se decide por `posicion_en_hoja` y nunca por `fecha_envio`.

## Done cuando

- [ ] Una corrida completa sobre `dev` produce **~6.233 envios** y **4.791 leads**.
- [ ] Ninguna llave del `jsonb` coincide con una columna promovida. Hay un test que lo verifica
      sobre datos reales, no sobre un ejemplo fabricado.
- [ ] Una columna nueva en la hoja aparece en `respuestas` sin tocar codigo.
- [ ] Un parcial y su completa con el mismo Token producen dos envios y un solo lead.

## Kiro

Si, con revision.

---

## ⚠️ Enmienda 2026-09-21 (ADR 0045, enmienda 2): se promueven TRES UTM, no cinco

El estandar de UTM quedo en **`utm_source`, `utm_medium` y `utm_campaign`**. `utm_term` y
`utm_content` **quedaron fuera de alcance, no pendientes**: sus columnas existen en `submissions`,
**vacias y deliberadamente sin leer**, y estan marcadas asi en el comentario del esquema.

**Este ticket promueve tres, y no debe promover los otros dos.** Cablearlos no tapa ningun hueco:
no hay hueco. Si algun dia entran, entran por una decision nueva, no por un arreglo.

🩸 **Y lo que SI tiene que salir bien aca:** un envio **sin UTM** y un envio **con UTM que no casa
con ningun patron** son **dos cosas distintas**, con dueno distinto y arreglo distinto. La ingesta
guarda el crudo tal cual (ADR 0004) y **no rellena un vacio con un centinela**: un `utm_source`
ausente se guarda como `null`, no como `"organico"` ni `"directo"`. Inventarlo convertiria un
problema de captacion en una atribucion falsa.

## Avance 22-sep (status sigue `todo`)

- ✅ **La construcción del Envío, pura** (`lib/ingesta/envio.ts`). Promovidas: token, fecha,
  estado de la hoja y los tres UTM. `utm_term` y `utm_content` **no** se promueven y quedan
  crudos en `respuestas`. **Nada se repite dentro del jsonb**, y hay test.
- Hay test para cada una de estas reglas:
  - un UTM ausente es `null`;
  - parcial y completa con el mismo token son dos envíos;
  - una columna nueva entra sola;
  - se lee hasta el último encabezado no vacío;
  - **dos encabezados iguales no se pisan** (el segundo queda como "X (2)");
  - una columna sin encabezado conserva su dato;
  - una fila sin token se rechaza con motivo, sin inventar una llave.
- 📌 **Decisión tomada en el código, a revisar:** `correo` y `telefono` **no** son promovidas (no
  son columnas de `submissions`), así que su texto crudo se queda en `respuestas`. Es el único
  rastro de qué correo trajo **ese** envío cuando un lead tiene varios.
- ⚠️ **Supuesto a medir contra `dev`:** un envío es parcial si su fecha es nula (vacía o el
  placeholder `1/1/0001`). En Tactical se midió que los 1.152 parciales traen ese placeholder;
  falta confirmar que ninguna fila completa venga sin fecha.
- ⏳ **Falta:** la escritura por lotes, el conteo de ~6.233 envíos sobre datos reales y el test
  de "ninguna llave promovida en el jsonb" **sobre datos reales**. Los tests de hoy usan filas
  fabricadas.

## Avance 23-sep (status sigue `todo`)

- 🩸 **El indice unico impedia la regla del ticket.** `submissions_fuente_token_idx` era
  `(source_id, token)`, asi que la parcial y la completa del mismo token chocaban. La migracion
  **0022** lo cambia a `(source_id, token, es_parcial)`. Ya esta aplicada en `dev`; produccion
  todavia no existe.
- ✅ **Escritura por lotes con upsert** sobre esa llave. Dos versiones de la misma parcial se
  funden en una: gana la de mayor posicion en la hoja. Un reintento actualiza el contenido y
  **no reasigna el lead** de un envio que ya tenia uno.
- ✅ **El resumen del lead se recalcula desde sus envios guardados** (`resumirEnvios`), con las
  reglas del dedup:
  - fechas: se ignoran las nulas;
  - UTM: gana el valor mas reciente no vacio;
  - aplicaciones: se cuentan tokens distintos, asi que parcial y completa son una sola.

  Cuando llega la hermana completa, el lead se corrige solo y queda en `change_log`.
- ⏳ **Falta:**
  - el conteo de envios sobre datos reales;
  - los campos de perfil del lead (nombre, cargo, etc.), que hoy quedan solo en `respuestas`.
