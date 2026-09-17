# 0022 — La ventana de venta es dato de cada cohorte, no una regla del codigo

**Fecha:** 2026-09-17 · **Estado:** aceptado (Mani, en `/grill-with-docs`)

Todo el pilar de metas del dashboard (dias habiles de la cohorte, "dia 23 de 27", meta dinamica)
depende de saber entre que dos fechas vende una cohorte. `cohorts` guardaba el cierre
(`fechaCierreVentas`) pero no el inicio, y el glosario decia que el inicio se deduce: "la
siguiente cohorte arranca al dia siguiente, sin pausa".

Los reportes diarios de Retia del 1 al 15 de septiembre desmienten las dos cosas. Contando solo
sabados y domingos como no habiles (regla de Retia):

| Ventana | Habiles | El 15-sep es dia | Coincide con el reporte |
|---|---|---|---|
| Comunicarte C2, reporte: 14-ago a 21-sep | 27 | 23 | si ("23 de 27") |
| Comunicarte C2, deduciendo del C1: 12-ago a 22-sep | 30 | 25 | no |
| Comunicarte C2, con el cierre sembrado: 14-ago a 22-sep | 28 | 23 | no |
| Tactical C2, reporte y semilla: 19-ago a 29-sep | 30 | 20 | si ("20 de 30") |

Dos hallazgos:

- **El inicio no se deduce.** Comunicarte C1 arranco clases el 11-ago, asi que "el dia siguiente"
  seria el 12-ago, pero el reporte cuenta desde el 14-ago. Nada en la base explica esos dos dias.
- **El cierre no sigue una regla unica.** En Tactical la ventana termina el mismo dia que arrancan
  clases (29-sep). En Comunicarte termina la vispera (21-sep, clases el 22). La misma regla no
  puede producir las dos.

**Decidimos que la ventana de venta es un par de fechas que el negocio declara por cohorte** (ADR
0012: lo que el codigo no puede decidir vive como fila editable, no como literal ni como
calculo):

- **`cohorts.fechaInicioVentas` es una columna nueva**, editable en `/ajustes/programas/[slug]`
  junto a las otras dos fechas de la cohorte.
- **`fechaCierreVentas` se respeta tal como esta guardado**, sin ninguna regla que lo ate al
  inicio de clases. Se corrige el valor de Comunicarte C2 a 2026-09-21, que es el que usa el
  reporte. El comentario del esquema que decia "cada cohorte se vende hasta el mismo dia en que
  arranca clases, inclusive" se borra: Comunicarte lo desmiente.
- **La ventana es inclusiva en los dos extremos**, que es como ya cuenta `lib/dias-habiles.ts`.
- **La columna admite vacio, pero una cohorte no puede estar `activo` sin ella.** La garantia vive
  en la base como un `CHECK`, al lado del indice unico parcial de "una sola cohorte activa por
  programa" (ADR 0005). Asi las dos C1 cerradas, cuyo inicio real nadie sabe, quedan sin dato
  inventado, y la cohorte que esta vendiendo siempre puede calcular sus dias habiles.

Se descartaron tres alternativas. **Deducir el inicio del cierre de la cohorte anterior** no
necesitaba migracion, pero daria 30 habiles donde el reporte dice 27, y el primer C1 de cada
programa no tiene anterior. **Deducirlo del primer lead de la cohorte** movia el inicio (y con el
la meta dinamica) cada vez que entra o se borra un lead, sin que nadie lo decida. **Calcular el
cierre como la vispera de clases** cuadraba con Comunicarte y rompia Tactical.

## Consecuencias

- Migracion: `cohorts` suma `fecha_inicio_ventas` (date, nullable) y el `CHECK`
  `estado <> 'activo' OR fecha_inicio_ventas IS NOT NULL`. Misma migracion: corregir el cierre de
  Comunicarte C2 y sembrar el inicio de las dos C2 (14-ago y 19-ago).
- El esquema zod de la cohorte y el formulario de `/ajustes/programas/[slug]` suman el campo.
  Activar una cohorte sin inicio de ventas da 400 con un mensaje claro, no un 500.
- El ticket 004 toma los dias habiles de la cohorte de estas dos fechas y nunca de un calculo.
- Una cohorte cerrada sin inicio de ventas no puede mostrar dias habiles ni meta dinamica: el
  dashboard lo dice, no lo inventa.
- El glosario cambia: "Cohorte" deja de definirse por el inicio de clases y aparece "Ventana de
  venta".
