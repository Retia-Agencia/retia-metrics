---
id: 248
etapa: hub
serves: "ADR 0087 punto 6 · ADR 0086 punto 2 (pestaña Origen) · docs/hub.md H-3 (Mani: ver cómo el CRM tiene en cuenta cada UTM)"
depends: [246, 250, 262]
status: en main
---

# 248 — Hub › Origen: cómo cuenta cada UTM

## Objetivo

Que cualquiera que entre al Hub vea, sin preguntarle a nadie, qué UTM llegaron, cómo los clasificó el CRM y por qué,
y que un par nuevo se note sin tener que mantener nada.

## Alcance

- **Dentro:** la pestaña Origen del Hub, por programa y en "todos" (solo conteos, ADR 0048): por cada par
  `utm_source` / `utm_medium` del rango, su conteo de envíos y de agendas, el área, el canal y la cuenta, **la regla
  que lo decidió** en palabras ("medio pago: cpc"), el nivel de la traza más común y una marca **nuevo** si se vio
  por primera vez en los últimos siete días.
- **Dentro:** Sin UTM y las macros sin expandir, siempre visibles con su conteo y su porcentaje; cada cifra abre su
  lista de envíos (ADR 0067).
- **Dentro:** **las plantillas en uso por cuenta**, leídas de los `url_tags` de los anuncios activos que guarda el
  120: cuántos anuncios activos usan la vieja (`facebook / cpc` con `ad_id`), la de Pauta (`paid_social` con
  `utm_id`) u otra, y cuántos no mandan id de anuncio. Es la vista de la migración de plantillas, sin declarar nada
  por programa (Mani, 14-oct).
- **Dentro:** el nivel de la traza de los envíos de Paid del rango (N3, N2, N1), para ver si el `ad_id` está
  llegando.
- **Dentro:** se mudan aquí desde la pestaña Pauta interina: origen del lead por canal, registros contra agendas por
  canal y el embudo del formulario (y por pregunta).
- **Dentro:** `/ajustes/canales` se retira y redirige a esta pestaña; Ajustes pierde la entrada.
- **Fuera:** costos (123), el árbol de campañas (125).

## Done cuando

- [ ] `instagram francisco / storiesfijadas` aparece como Orgánico · Instagram · Francisco con su regla, y con la marca
  nuevo mientras tenga menos de siete días.
- [ ] La suma de los envíos por par da el total de envíos del rango, con test.
- [ ] Un paid trafficker ve la pestaña de sus programas; un closer que forja la ruta recibe 404.
- [ ] Recorrido con clic en todo lo que se abre, escritorio y 375 px, consola limpia.

## Notas

La parte de plantillas en uso y la del nivel de la traza leen lo que traen el 120 y el 247. Si este ticket llega
antes, esas dos secciones se dejan para después del 120 y la vista sale con lo demás.


## Enmienda 20-oct (ADR 0099)

Hub › Origen muestra, por fuente, la alarma de la traza del 290 (envíos pagos sin id del anuncio y con id desconocido), leída de la misma función; no cuenta por su cuenta.

## En main (24-oct)

Codex + central, `5cb2c5f8` y `20c89906`. `origenDelPrograma` (`lib/queries/origen.ts`) arma una fila por
`(utm_source, utm_medium, regla)`: la regla en palabras sale de `textoDeRegla` sobre el resultado de `resolverCanal`,
nunca de un segundo clasificador. Tres defectos cazados en la revisión, cada uno con su test en `tests/origen.test.ts`:

- **"nuevo" por tupla:** se calculaba por la tupla UTM completa (con el id del anuncio), así que `facebook / cpc` salía
  nuevo con cada anuncio. Ahora es el primer día del **par**, en una consulta aparte.
- **La regla la decidía el orden de la consulta:** un par con tuplas de reglas distintas tomaba la primera. Ahora cada
  regla es su fila, con orden determinista (probado insertando al revés).
- **Agendas duplicadas y perdidas:** cada fila del par repetía las agendas del par, y una agenda cuyo envío era anterior
  al rango no tenía fila. Ahora se agrupan por tupla, se resuelven con la misma traza y una agenda sin envío en el rango
  abre su fila con 0 envíos.

`/ajustes/canales` redirige a Hub › Origen; la tabla `canales` y su código quedan (se borran en otro ticket). Era el
único ajuste del paid trafficker, así que su entrada de Ajustes sale del menú. **Deuda:** la lista `envios` de esta
pestaña y la lista `registros` del 299 son dos predicados para la misma pregunta: ticket 309.

Falta: recorrido con clic en todo, escritorio y 375 px, y `npm run test:humo`; la prueba de que un closer que forja la
ruta recibe 404 queda cubierta por la guarda de la página, sin test propio.

## Enmienda 30-oct (auditoría de métricas)

Lo que queda de Origen lo cierran otros tickets, para no mezclarlo aquí: la jerga visible (`ad_id`, `utm_id={{ad.id}}`,
"ADR 0099", U-01) y las tres tarjetas de diagnóstico (U-02) van al 359; `/ajustes/areas`, `canales-admin.tsx` y las
tablas `areas`/`canales` (R-10) van al 361; las tres definiciones de "Sin UTM" (C-14) van al 354.
