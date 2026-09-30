# 0062 — El anuncio es la llave de la pauta: UTM de Meta con macros, gasto por su API y origen declarado aparte

- **Estado:** aceptado · 29-sep-2026 (Mani), todos los puntos (el 6 aprobado esa noche).
- **Enmienda:** ADR 0045 punto 2 (conjunto y anuncio fuera), ADR 0051 puntos 1, 3, 4 y 5 (el CRM genera
  todos los links) y ADR 0052 puntos 2 y 4 (el trafficker carga el gasto y no ve caja).
- **Relacionadas:** ADR 0004, 0012, 0043, 0044, 0045, 0057 (secreto en la base), 0060 (el origen es del
  envío); tickets 084, 085, 092, 101, 102, 115, 116, 119, 120, 121, 125; `docs/analytics.md` DP-1 a DP-4,
  DP-12, DP-21, DP-22 y DP-25.

## Contexto

En la reunión del 29-sep Pauta dijo que saber **qué creativo vende es vital**, que el UTM es *"la verdad
absoluta"*, que ellos arman los UTM en Meta con macros (*"Meta pone el resto automático"*) y que el
comercial debe registrar el origen de cada venta, solo como respaldo cuando no hay UTM. El 21-sep el
anuncio había quedado fuera (ADR 0045) porque el estándar eran tres UTM y el gasto se iba a cargar a mano
por campaña.

Medido el 29-sep: Pauta de Retia manda `facebook / cpc / {{campaign.name}}` con el conjunto en
`utm_content` y el anuncio en `utm_term`, sin id; los dos campos llegan pero viven en `respuestas`; 20
envíos traen la macro sin expandir.

## Decisión

1. **La pauta de Meta define sus UTM con macros, y el CRM los recibe como llegan.** La plantilla (Mani,
   29-sep): `utm_source={{site_source_name}}` · `utm_medium=paid_social` · `utm_campaign={{campaign.name}}`
   · `utm_content={{ad.name}}` · `utm_term={{placement}}` · `utm_id={{ad.id}}`. El builder del CRM (092)
   queda para lo que Meta no genera: el orgánico y el link del closer.
2. **La llave es `utm_id`, el id del anuncio.** No cambia cuando renombran y es único; desde él la API de
   Meta da el conjunto y la campaña. `submissions` gana `utm_id`, y `utm_content` y `utm_term` pasan a sus
   columnas (se rellenan desde `respuestas`, misma fila). Qué significa cada uno lo declara el **canal**
   (`paid_social`: content = anuncio, term = placement; el `facebook / cpc` histórico: content = conjunto,
   term = anuncio) y lo interpreta un solo módulo, el emparejador (regla del ADR 0051 que se mantiene).
3. **El gasto de Meta entra por su API**, por anuncio y por día, y se guarda en un solo lugar
   (`gasto_pauta`) por una sola función, que también usa la captura manual de otras plataformas. El árbol
   campaña → conjunto → anuncio se refleja desde Meta; el CRM lee Meta, no la administra. Se re-leen los
   últimos días porque Meta ajusta el gasto hacia atrás, idempotente por (anuncio, día).
4. **El token es por portafolio y vive en la base**, con las reglas del ADR 0057: lo escribe una función,
   se muestra una vez, nunca vuelve en una lectura ni pasa por `change_log`. Es la **cuarta excepción
   nombrada** a "secretos solo en `.env.local` y Vercel". Cada programa apunta a sus cuentas publicitarias,
   con la moneda y la zona horaria que dice Meta.
5. **El origen declarado por el closer es un dato aparte y nunca se mezcla con el UTM.** Al llevar un deal
   a Compromiso Verbal, Abonado o Completo, el motor exige el **área** declarada (una de las del catálogo):
   *"¿cómo nos conociste?"*, un clic. Las métricas de atribución salen del UTM; lo declarado solo aparece
   como la burbuja "sin UTM · según el comercial". Los deals históricos quedan sin él (ADR 0059), salvo que
   la hoja traiga la columna al corte.
6. ✅ **`campanas` y `utm_patron` se reducen** (Mani, 29-sep): la campaña de paid sale
   del árbol de Meta, por `utm_id` o, para lo histórico sin id, por el nombre exacto y único en las cuentas
   del programa (un nombre ambiguo queda en nivel canal, visible); la de orgánico se agrupa por el texto
   crudo de `utm_campaign`. El canal es único por par (índice) y el id de Meta es único, así que el empate
   que el ADR 0045 temía no puede ocurrir y la decisión P2 queda sin objeto.
7. **Una macro sin expandir es un centinela** (`AGENTS.md`): se guarda como llegó, el emparejador la trata
   como ausente en ese nivel y se cuenta aparte, con los sin UTM.
8. **El paid trafficker ve el Dashboard de sus programas menos el comparativo entre closers y la comisión**
   (ROAS y ad profit necesitan los ingresos). Sigue sin ver deals, llamadas ni abonos sueltos.

## Consecuencias

- Lo que entra antes de que existan el campo oculto `utm_id` en Typeform y la plantilla en Meta queda en
  nivel campaña o canal para siempre. Por eso esos dos pasos van primero, sin esperar código.
- La "calidad de la traza" (N3 anuncio, N2 campaña, N1 canal, N0 sin UTM) se puede medir por venta.
- `ad_spend` (vacía, de la época de Sheets) la reemplaza `gasto_pauta`.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Cruzar el gasto por el nombre del anuncio | Los nombres cambian y se repiten ("- Copia"); el id no |
| Que el CRM genere los links de Meta (ADR 0051 tal cual) | Pauta pierde las macros por anuncio y el link vuelve a depender de que alguien lo pegue bien |
| Cargar el gasto a mano | Es el trabajo manual que la reunión pidió quitar, y sin grano de anuncio no hay ROAS por creativo |
| Sumar lo declarado por el closer a las cubetas del UTM | Pauta: *"casi siempre van a decir que es pauta"*; mezclado, el % de paid se infla sin error |
| Token en variables de Vercel | Un portafolio nuevo pediría tocar Vercel y redesplegar (ADR 0012, criterio 4) |
