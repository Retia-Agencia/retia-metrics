---
id: 025
fase: F4
serves: "spec §1 pilar 4"
depends: [024]
status: done
---

# 025 — Nerd Stats

## Objetivo
Un developer ve la salud de la herramienta sin abrir la base.

## Alcance
- Dentro: `/nerd-stats` con `paginaConRol("developer")`:
  - últimas corridas de sync por fuente (duración, filas, personas nuevas, errores de `sync_runs`);
  - últimos cambios de configuración (`change_log` con `origen="app"`, quién y cuándo);
  - conteos por programa (personas, llamadas, ventas, abonos) y por origen (`sheets`/`app`);
  - commit y fecha del despliegue (`VERCEL_GIT_COMMIT_SHA`), y si `CRON_SECRET` está configurado
    (solo sí/no, nunca el valor);
  - usuarios activos por rol.
- Fuera: métricas de rendimiento de Vercel, logs de requests, "ver como".

## Done cuando
- [x] Ninguna cifra expone datos personales (solo conteos y metadatos).
      Garantizado en la CONSULTA, no al pintar: `ultimosCambiosDesdeLaApp` no proyecta
      `etiqueta` ni los valores, que es donde `lib/mutations/personas.ts` escribe el nombre
      y el correo de un lead. `tests/nerd-stats.test.ts` siembra una fila de bitacora con
      datos de lead y verifica que no aparezcan en la fila entera serializada, no columna
      por columna: una columna nueva con datos personales tambien hace fallar el test.
- [x] Carga en menos de 1 segundo con los datos actuales.
      Medido contra `production` (4.497 personas): las cinco lecturas en paralelo tardan
      **356 ms**, contra **347 ms** que cuesta un `select 1` vacio desde la misma maquina.
      El trabajo de base son ~9 ms; el resto es latencia de red, y en Vercel la funcion
      corre en la region de la base. **Salvedad:** el primer golpe despues de que el
      compute de Neon se duerme tarda ~1,4 s, y eso es Neon despertando, no la pagina.

## Cierre (17-sep)

**Lo que se construyo:** `/nerd-stats`, renderizada entera en el servidor (es solo lectura;
no hay componente cliente ni JS que enviar). Seis bloques: despliegue (entorno, commit,
`CRON_SECRET` como si/no y nunca su valor), usuarios activos por rol, registros por origen,
conteos por programa, ultimas corridas de sync y ultimos cambios desde la app.

**Es la primera ruta exclusiva del developer**, y no costo nada hacerla exclusiva:
`paginaConRol("developer")` cierra a gerente y closer por la misma funcion central que abre
todo lo demas al developer (ADR 0025). El test la mira por el lado restrictivo, que hasta
ahora no se habia probado: gerente y closer, disjuntos entre si, quedan los DOS afuera.

**Dos cosas que no estaban en el alcance y aparecieron:**

1. **"Ultimas corridas de sync" ya existia** dentro de `estadoDeFuentes` (`/ajustes/fuentes`).
   Dos pantallas, una pregunta: se saco a `ultimasCorridasDeSync` en `lib/queries/fuentes.ts`
   y las dos la importan (ADR 0024). Lo mismo con `haceCuanto`, que vivia suelto dentro de la
   pagina de fuentes y ahora esta en `lib/format.ts`.
2. **Un fallo silencioso de drizzle.** La primera version de `conteosPorPrograma` usaba
   subconsultas correlacionadas escritas con la plantilla `sql`. Drizzle renderiza las
   columnas SIN calificar, asi que `${programs.id}` salia como `"id"` a secas y dentro del
   subselect resolvia a la columna de la tabla interna: la comparacion siempre daba falso y
   **todos los conteos devolvian 0 sin lanzar ningun error**. Lo destapo el test, que ya
   estaba escrito. Reescrita con cinco consultas agrupadas unidas en memoria. La trampa quedo
   anotada en `AGENTS.md`, porque ningun linter la ve.
