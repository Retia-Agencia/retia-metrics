# 0140 — El ciclo de un deal lo define su SKU; gerencia marca SKUs predeterminados que todo deal nuevo recibe

- **Estado:** aceptada · 20-nov-2026 (Mani, después del audit `docs/norte-del-sku.html`).
- **Resuelve:** D-0, D-2 y D-3 del Norte del SKU, en la variante "más barata" que el Norte deja como alternativa
  (pertenencia por SKU ya; la ventana de fechas se queda para ritmo y proyección).
- **Enmienda:** ADR 0139 punto 3 y ADR 0137 punto 12 en lo que toca a cómo nace el ciclo de un deal abierto: ya no sale
  de la fecha del día (`cohorteActiva`) sino de sus líneas.
- **Confirma:** ADR 0139 (el SKU es lo único que se administra; la ventana y las metas siguen en el ciclo), D7 del 376
  (una línea sin abonos es **propuesta** y no cuenta), D10 (permisos del closer sobre líneas), restricción `centinelas`.

## Contexto

Hoy un deal que nace toma el ciclo de la fecha del día: `abrirDeal` llama a `cohorteActiva`
(`lib/deals/mover-etapa.ts:654`), y el tablero de Deals filtra por defecto por esa misma cohorte activa
(`lib/queries/kanban.ts:303`, `components/deals/filtro-kanban.tsx:124`). Nadie eligió ese ciclo. Los closers lo dijeron
el 20-nov: "ya estamos vendiendo corte 2; me llegó un deal y apareció en la corte 2 pero no estoy seguro". Una fecha mal
escrita reubica deals en silencio (Norte, H0).

Mani, 20-nov: que todo lo maneje gerencia desde la app, sin que él mantenga fechas en código; que exista un interruptor
"SKU predeterminado" para que los deals nuevos nazcan con SKU y no sea todo manual; que se pueda activar, desactivar y
cambiar; varios predeterminados, sin bloqueo, "como el de si cuenta para los cupos".

## Decisión

1. **`skus.predeterminado`** (booleano, apagado por defecto), al lado de `cuenta_como_cupo`. Lo prende y apaga
   `esAdministrador` desde la tabla de SKUs de la vista del programa, por el molde con `change_log`. **Sin límite**: cero,
   uno o varios por programa. Un SKU desactivado no se asigna aunque siga marcado.
2. **Al nacer, un deal recibe una línea propuesta por cada SKU activo y predeterminado de su programa**, en la misma
   transacción de `abrirDeal`, escrita por `lib/deals/lineas.ts` (único escritor). Aplica a todo nacimiento: webhook,
   Calendly, a mano, importador y pasarela. La pasarela que trae su propio SKU asigna ese y no los predeterminados.
3. **Cero predeterminados no es un error**: el deal nace sin líneas y queda **"Sin SKU"**, visible y contado en el
   tablero. Nunca se inventa un ciclo por fecha.
4. **El ciclo del deal sale de sus líneas** con la regla del D12 del 376 (vendida vigente más antigua con cupo; si no,
   propuesta más antigua con cupo; si no, nulo). Empate entre líneas nacidas juntas: el ciclo de menor N y luego el código
   del SKU, para que sea determinista.
5. **El closer cambia el SKU** desde la ficha del deal (ticket 460): agrega, quita una línea sin abonos, y con abonos solo
   anula (D10). El ciclo se recalcula en la misma transacción.
6. **El tablero de Deals deja de filtrar por "cohorte activa".** Sin filtro de ciclo por defecto. Los filtros salen de
   los SKUs que existen en el programa: **Nombre del SKU** (agrupa por `skus.slug`), **SKU** y **Ciclo**, más la opción
   "Sin SKU". Las opciones se leen de la base, nunca de una lista en código.
7. **La ventana de fechas se queda** en el ciclo para «¿Vamos a llegar?», proyección, ritmo, meta de leads del día,
   semáforo y alertas (ADR 0139, tabla de descartados). Ya no decide a qué ciclo pertenece un deal.
8. **Los flujos del closer que hoy leen `cohorteActiva` pasan a leer las líneas del deal**: abrir deal, filtro del
   tablero, ficha del deal (`ficha-acciones.tsx`, `ficha/cargar-datos.ts`), cambiar cohorte de estudiante
   (`lib/deals/estudiante.ts`), registrar pago y valor vendido (`lib/deals/pago.ts`, `lib/deals/valor-vendido.ts`).
   Los del Hub y Juanito que preguntan "¿qué ciclo vende hoy?" siguen por fechas hasta un segundo corte.

## Descartado

| Alternativa | Por qué no |
|---|---|
| Un solo predeterminado por programa (índice único) | Mani, 20-nov: "no debe haber bloqueante, solo es un interruptor" |
| Ciclo del deal por fecha del día (lo de hoy) | Es lo que confunde a los closers y reubica deals en silencio (Norte, H0) |
| Prohibir crear el deal si no hay predeterminado | Pararía el webhook de leads; un deal "Sin SKU" visible es mejor que un lead perdido |
| Quitar ya la ventana de fechas | Rompe «¿Vamos a llegar?», proyección y semáforo que Daniel Tovar usa (ADR 0139) |

## Consecuencias

- Con dos predeterminados, el deal tiene dos líneas propuestas. No inflan nada: una propuesta no suma a Vendido, Ventas,
  cupos ni comisión hasta su primer abono (D7). El formulario de abono pide qué línea se paga (460), así que **el 460 va a
  producción antes o junto con el 464**.
- Los deals abiertos que ya existen no se tocan: conservan la línea del backfill del corte 1.
- Gerencia controla en qué ciclo nacen los deals cambiando un interruptor, sin código ni fechas.
- Plan de ejecución: ticket 464 en `docs/tasks/376-productos-y-skus.md`.
