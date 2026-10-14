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

- [ ] Se sabe la causa raíz, escrita aquí, con la evidencia.
- [ ] `/nerd-stats` y `/nerd-stats/bitacora` cargan en producción como developer.
- [ ] Si la causa es el pooler: el arreglo vive en `lib/db` (una sola vez) y hay un test o una prueba contra Postgres
      real que lo cubre; se revisan las demás pantallas con `Promise.all`.
- [ ] La tarjeta de corridas del sync se quita (y `ultimasCorridasDeSync` si no la usa nadie más).

## Tickets relacionados

025 (creó Nerd Stats) · 068 (la reescribió sobre el modelo nuevo) · 076 (bitácora) · 108 (retiró el sync) · 175
(limpieza de orígenes) · 202 y 207 (filtros de la bitácora) · 234 (log de eventos legible).

## Anotaciones

A-150.
