---
id: 243
etapa: plataforma
serves: "Mani, 14-oct: /nerd-stats responde como 404 en producción (A-150)"
depends: []
status: todo
---

# 243 — `/nerd-stats` revienta en producción

## Por qué existe

Mani (developer) abre `/nerd-stats` en producción y la página no carga (la ve como 404). No es un 404 de ruta: la
página existe (`app/(app)/nerd-stats/page.tsx`, guarda `paginaDeAccesoTotal`, que a quien no es developer lo
**redirige**, no le da 404). Es un error del servidor al renderizar.

## Lo medido (14-oct, solo lectura)

- **Log de Vercel, 14-oct 00:20:** `GET /nerd-stats` → error en `ultimasCorridasDeSync` (`lib/queries/fuentes.ts:25`):
  `invalid input syntax for type bigint: "f"` (22P02) sobre `limit $1`, con `params: [8]` del lado de la app. Es
  decir: a Postgres le llegó `"f"` (un booleano `false`) donde la app mandó el `8`.
- **La consulta sola funciona:** corrida 3 veces desde un script contra producción por el mismo pooler → ok, 0 filas
  (`sync_runs` está vacía).
- **La página lanza seis consultas a la vez** (`Promise.all` en `page.tsx:42`). Reproducirlas juntas desde un script
  local se quedó colgado más de 7 minutos y se canceló: no se sabe aún si es una consulta lenta o un artefacto del
  script. Hay que medir cada una por separado (`conteosPorPrograma`, `fuentesConSalud`, `conteosPorOrigen`,
  `ultimosCambiosDesdeLaApp`, `usuariosActivosPorRol`).
- En 7 días de logs de error solo aparece esta ruta con este error (la retención del plan Hobby es corta: no prueba
  que no pase en otras).

## Hipótesis, por orden

1. **Parámetros cruzados entre consultas concurrentes en el pooler** (Supavisor en modo transaction, puerto 6543,
   `prepare: false`, ADR 0047): el `false` de otra consulta del mismo `Promise.all` termina como `$1` de esta. Si es
   eso, **no es un bug de Nerd Stats sino de la conexión**, y cualquier pantalla con `Promise.all` puede fallar de
   forma intermitente. Es lo primero que hay que confirmar o descartar (reproducir con las seis juntas, mirar la
   configuración de `lib/db`).
2. Una de las seis consultas es lenta o pesada y la función se corta; el error de tipos sería un síntoma secundario.

## Además, por el ADR 0077 (lo que no se usa se quita)

La tarjeta "Últimas corridas del sync" lee `sync_runs`, que nadie escribe desde que el sync se retiró (ticket 108) y
está vacía en producción. Quitarla es correcto pase lo que pase con la causa; **pero quitarla no cierra el ticket**
si la causa es la hipótesis 1, porque el bug seguiría vivo en otras pantallas.

## Done cuando

- [x] Se sabe la causa raíz, escrita aquí, con la evidencia (ver Avance, 14-nov).
- [ ] `/nerd-stats` y `/nerd-stats/bitacora` cargan en producción como developer.
- [ ] Si la causa es el pooler: el arreglo vive en `lib/db` (una sola vez) y hay un test o una prueba contra Postgres
      real que lo cubre; se revisan las demás pantallas con `Promise.all`.
- [x] La tarjeta de corridas del sync se quita (y `ultimasCorridasDeSync` si no la usa nadie más). Hecho por el 401 M13 (`5e368505`, 9-nov).

## Tickets relacionados

025 (creó Nerd Stats) · 068 (la reescribió sobre el modelo nuevo) · 076 (bitácora) · 108 (retiró el sync) · 175
(limpieza de orígenes) · 202 y 207 (filtros de la bitácora) · 234 (log de eventos legible).

## Anotaciones

A-150.

## Avance

### 14-nov: SÍ falla, y la causa es la conexión (hipótesis 1 confirmada)

Primera lectura de los logs (7 días) dio `/nerd-stats` en 200 todo el día y ningún `22P02`; se concluyó que ya no fallaba.
**Era falso:** Mani la abrió a las 21:04 y se quedó cargando; abierta desde el navegador del agente, **504
`FUNCTION_INVOCATION_TIMEOUT` a los 300 s**. `/nerd-stats/bitacora` entrando directo cargó (72.818 escrituras).
Lección: "200 en los logs de hoy" no prueba nada en un fallo intermitente; el 504 por tiempo no deja mensaje de error.

**Lo medido** (solo lectura contra producción, scripts desechables ya borrados):

| Prueba | Resultado |
|---|---|
| Cada consulta de la página, una por una, por el pooler (6543) | Todas terminan; la más lenta `saludDeFuentes`, 6 a 8 s |
| Las cinco juntas (`Promise.all` de la página), por el pooler | Ronda 1 ok; luego **cuelgue** (5 de 5 corridas) y una vez **`22P02 invalid input syntax for type uuid: "calendly"`**: el parámetro de otra consulta como `$1` (el mismo síntoma del 14-oct) |
| Lo mismo con `max_pipeline: 1` | Cuelga igual: el pipelining no es la causa |
| **Una sola conexión, consultas en serie** (`max: 1`), por el pooler | **Cuelga en la ronda 1**: no es la concurrencia de la página |
| Las cinco juntas por la conexión en modo sesión (5432, `DATABASE_URL_DIRECTA`) | 5 de 5 ok; y **dos páginas a la vez, 6 rondas: 0 fallos** |
| `pg_stat_activity` durante el cuelgue | Dos backends `active` en `ClientRead` 45 s: Postgres esperando el resto de un mensaje del cliente que nunca llega |

**Causa raíz.** Con `prepare: false`, `postgres-js` (3.x) manda toda consulta CON parámetros en dos idas
(`node_modules/postgres/cjs/src/connection.js:238`: `describeFirst = parameters.length && !q.prepared`): primero
`Parse + Describe + Flush`, y cuando Postgres devuelve los tipos (`:633`), `Bind + Execute`. El pooler de Supabase en modo
*transaction* (Supavisor, 6543) puede entregar la conexión del cliente a otro backend entre las dos idas: el `Bind` cae
sobre la sentencia sin nombre de otra consulta (**parámetros cruzados**, el `"f"` del 14-oct y el `"calendly"` de hoy) y el
primer backend queda esperando para siempre (**cuelgue → 504 a los 300 s**). Por qué Supavisor suelta la conexión entre las
dos idas es inferencia sobre lo medido (no hay `Sync` hasta la segunda ida), *sin fuente verificada* en su documentación.

**Alcance: no es de Nerd Stats.** Afecta a toda consulta con parámetros de toda pantalla y ruta, más mientras más consultas
haga. Explica los 504 de 7 días en `/p/[programa]/programa`, `/api/salud/alertas` y `/api/salud/cierre` (las tres llaman
`saludDeFuentes`, la que más consultas lanza). El 500 diario de `/api/cron/calendly` (`ownerUserId`) es otro bug.

### Pendiente

El arreglo pide una decisión de Mani porque enmienda el ADR 0047 (la app entra hoy por el pooler en modo transaction).
Mani se inclina por el driver `pg` (14-nov) y lo manda a una sesión propia de estudio, junto con la optimización de
consultas y navegación y el contrato de rendimiento: **todo el detalle, el arnés que lo reproduce y cómo retomar viven en
`docs/estudio-rendimiento-y-conexion.md`** (§0). Este ticket se cierra cuando ese arreglo esté en producción y
`/nerd-stats` cargue varias veces seguidas.
