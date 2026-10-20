---
id: 248
etapa: hub
serves: "ADR 0087 punto 6 · ADR 0086 punto 2 (pestaña Origen) · docs/hub.md H-3 (Mani: ver cómo el CRM tiene en cuenta cada UTM)"
depends: [246, 250, 262]
status: todo
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
