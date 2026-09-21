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

`lead_id`, `source_id`, `token`, `es_parcial`, `fecha_envio`, `estado_hoja`, los cinco `utm_*`,
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
