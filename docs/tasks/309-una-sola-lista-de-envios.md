---
id: 309
etapa: hub
serves: "AGENTS.md: si dos lugares responden la misma pregunta, la respuesta vive en un módulo · C-2 (docs/hub.md §8)"
depends: [248, 299]
status: done
---

# 309 — Una sola lista de envíos detrás de las cifras del Hub

## Por qué

El 24-oct quedaron en `main` dos listas que responden la misma pregunta, "¿cuáles son los envíos completos de este
programa en el rango?":

- **`registros`**, del 299 (Hub › Hoy, "Leads de hoy"): pasa por el molde general de `lib/queries/metricas-con-filas.ts`
  (`case "registros"`), con el predicado `filtroRegistros` de `lib/queries/metricas-filtros.ts` y la fecha
  `fechaAnclaEnvio()`.
- **`envios`**, del 248 (Hub › Origen): una rama aparte en `app/(app)/p/[programa]/hub/lista/page.tsx` que llama a
  `listaDeEnvios` (`metricas-con-filas.ts`) sobre `listar` de `lib/queries/hechos/envio.ts`, con el predicado
  `alcance` de ese archivo y la fecha de `dimensionesDeFecha(submissions.fechaEnvio)`; filtra por `utm_source`,
  `utm_medium` y `categoria` (sin UTM, macro).

Hoy dan lo mismo (completos, del programa, por día del envío en Bogotá), pero son **dos predicados**: si alguien cambia
uno (por ejemplo, que un envío marcado Sospechoso deje de contar, 304), el otro sigue contando, y la cifra de Hoy y la
de Origen se separan sin un error. Tampoco tienen la misma guarda: la rama de `envios` deja entrar a quien ve el
tablero (`veTableroDelPrograma`, incluye al paid trafficker) y la de `registros` solo a quien administra.

## Objetivo

Una sola métrica de lista de envíos, con un solo predicado, que sirva a Hoy y a Origen.

## Alcance

- **Dentro:** el predicado de "envío completo del programa en el rango" vive en un solo lugar, el hecho de envío
  (`lib/queries/hechos/envio.ts`, capa de hechos del 262), y `filtroRegistros` lo importa o desaparece.
- **Dentro:** una sola métrica en `Metrica` y en el esquema de la página de listas. Los filtros de Origen (`source`,
  `medium`, `categoria`) se vuelven filtros de esa métrica dentro del molde general, y la rama aparte de la página se
  borra. "Leads de hoy" y cada cifra de Origen abren la misma lista con distintos filtros.
- **Dentro:** decidir la guarda: la lista de envíos no tiene nombres ni correos (id del envío, UTM, fecha), así que
  propuesta: `veTableroDelPrograma`, para que el paid trafficker abra las cifras de Origen. Si la lista llega a mostrar
  la persona o el deal, vuelve a `esAdministrador`.
- **Dentro:** un test que compare las dos entradas (Hoy y Origen sin filtros) contra el mismo conteo, y uno que muerda:
  cambiar el predicado del hecho cambia las dos.
- **Fuera:** cambiar qué cuenta como registro (eso lo deciden 301 a 304).

## Done cuando

- [x] `rg "filtroRegistros|listaDeEnvios"` deja un solo camino, y la página de listas no tiene una rama propia para envíos.
- [x] "Leads de hoy" (Hoy) y el total de envíos de Origen dan el mismo número que su lista, con test.
- [x] Un paid trafficker abre la lista de envíos de su programa; un closer que forja la URL recibe 404.
- [x] `docs/metricas.md` §1.1 nombra la única función.

## Enmienda 24-oct (Mani): la lista dice quién es la persona

Recorriendo Hoy y Origen, Mani: el id del envío "no me sirve de nada"; las listas tienen que decir a qué registro se
refieren. Decidido el 24-oct:

- **Columna Persona** en la lista unificada: el nombre del lead del envío, enlazado a su deal (`/p/[programa]/deals/[id]`,
  con `enlaceConVuelta`) o, sin deal, al lead. Sale del molde general (`camposDe` en `lib/queries/metricas-con-filas.ts`),
  así que la ganan también las demás listas del Hub (Leads de hoy, Atendidos sin grain...). El id del envío sale de la
  pantalla.
- **Solo la ve quien administra** (`esAdministrador`: gerente y developer). Se proyecta en el servidor, como `sinListas`
  del 102: para el paid trafficker la columna sale nula y no se pinta, y la lista sigue abriéndole las cifras de Origen
  con la guarda `veTableroDelPrograma` de arriba. Esconderla en el cliente no vale: el nombre no puede viajar.
- **Done cuando, además:** forjando la petición como paid trafficker, la respuesta no trae ningún nombre (test sobre la
  función que proyecta, no sobre la pantalla); como gerente, cada fila con lead trae su nombre y su enlace.
