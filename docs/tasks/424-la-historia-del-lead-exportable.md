---
id: 424
etapa: pauta
serves: "Dani Rodríguez (Paid Media), audio del 11-nov, «top 1 prioridades»: ver y descargar la traza completa de cada lead (formulario, campaña, agenda, compra, programa) · Mani, 12-nov"
depends: []
status: en main
---

# 424 — La historia del lead se descarga desde la lista que ya abre cada cifra

> ⚠️ **Ticket delicado: es ensamblaje, no construcción (Mani, 12-nov).** El repo ya tiene casi todas las piezas
> después de los refactors de métricas (385, 403) y de UI (419, boceto aprobado). Este ticket **no crea ninguna métrica,
> ningún universo, ningún hecho nuevo, ninguna pantalla nueva ni ninguna forma visual nueva**. Si al implementarlo
> aparece la necesidad de algo de eso, se para y se pregunta a Mani; no se resuelve dentro del ticket. Lo que falta
> por definir en métricas (DM-8, 421, 385) tampoco se decide aquí.

## El pedido

Dani Rodríguez, textual: *«necesito ver la traza… de todos los pasos del formulario, de dónde llegó… van a haber
compradores, entonces la compra, el programa… necesito toda la traza del formulario y de las campañas de publicidad
del lead. Necesito poder visualizar y descargar la información así.»* Mani: la historia del lead de punta a punta,
descargable con filtros de fecha, programa y demás.

## Las piezas que ya existen (medido el 12-nov)

| Lo que pide Dani | Pieza existente | Dónde |
|---|---|---|
| **Qué leads** (fecha, programa, cohorte, canal, campaña, anuncio, paso del embudo, calidad) | La lista detrás de cada cifra: el universo de cada métrica con sus filtros, paginada en el servidor (ADR 0067, C-2) | `lib/queries/metricas-con-filas.ts` (`FiltrosDeMetrica`), `lib/queries/metricas-filtros.ts`, `app/(app)/p/[programa]/hub/lista/page.tsx` |
| **Qué ve cada rol** | Proyección por rol ya decidida: el paid trafficker ve persona y etapa, sin closer, deal ni monto (350, enmienda del 29-oct a DP-12 y ADR 0052) | `proyectarParaPauta` / `proyectarListaSegunRol` (`metricas-con-filas.ts:233`), `veLeadsDePauta` y `veEquipoComercial` en `lib/auth/roles.ts` |
| **Los pasos del formulario** (parciales y completo, respuestas, diferencias entre envíos) | La ficha del lead | `fichaDeLead`, `ordenarEnvios`, `unirParcialesConSuCompleto`, `camposDelEnvio`, `diferenciasEntreEnvios` en `lib/queries/ficha-lead.ts`; `respuestasLegibles` en `lib/queries/ficha-deal.ts:188` |
| **De dónde llegó** (UTM, campaña, conjunto, anuncio, nivel de traza) | Atribución por envío y origen del deal | `emparejar` (`lib/atribucion/emparejar.ts`), `resolverCanal` (`lib/atribucion/canal.ts`), `ficha-origen.tsx` |
| **Agenda, cita y resultado; etapas; abonos y cierre** | La ficha del deal y su log (etapas + bitácora) | `fichaDeDeal` (`lib/queries/ficha-deal.ts:426`), `ficha-historial.tsx`, `ficha-llamadas.tsx`, `lib/queries/saldo.ts` |
| **Descargar** | Molde de CSV ya usado tres veces | `app/(app)/p/[programa]/deals/descargar.csv/route.ts` + `lib/deals/csv-deals.ts`; `hub/pauta-citas.csv` |
| **Cómo se ve** | Norte visual aprobado | `docs/bocetos/una-forma-de-metrica.html`, `docs/diseno-cifra-y-pauta.md` |

**Lo único que falta** es la costura: la lista del Hub no se puede descargar, y la descarga no lleva la historia de
cada lead que ya arman las fichas.

## Alcance

1. **"Descargar" en la lista del Hub que ya existe** (`hub/lista`): un botón con los componentes y tokens de Tinta que
   la pantalla ya usa, sin layout ni cifra nueva, comparado lado a lado con el boceto. Baja **exactamente el universo que
   la pantalla muestra** con los mismos filtros de la URL (todas las páginas), con la proyección por rol de la pantalla
   aplicada **antes** de armar el archivo. Una ruta `.csv` hermana de la lista, con la misma guarda.
2. **Dos archivos, mismo universo:**
   - **Ancho, una fila por lead:** las columnas que la lista ya muestra (persona según el rol, etapa, fecha, importe
     según el rol) más el origen del primer envío y el del último, que ya calcula la atribución.
   - **Largo, una fila por evento (la traza):** cada envío y sus respuestas, cada cita con su resultado, cada movimiento
     de etapa y cada abono, en orden y con fecha de Bogotá, armados **con las funciones de las fichas**, no con SQL nuevo.
3. **Si una función de ficha solo recibe un id**, se generaliza en su mismo módulo para recibir una lista (por lotes,
   regla de rendimiento de `AGENTS.md`), y la ficha pasa a llamarla con un solo id. **Nunca una segunda copia** de la
   consulta (la regla de "si dos lugares responden la misma pregunta, la respuesta vive en un módulo").
4. **Formato** solo por `lib/format.ts` y textos del vocabulario de `overview.md` §11 (N4, N5): sin `utm_*`, ids ni
   nombres de columnas de la base en las cabeceras visibles.

## Fuera de este ticket, a propósito

- Una métrica, un universo o un filtro nuevo en `metricas-con-filas.ts` o `filtros-de-lista.ts`. Si Dani pide un corte
  que la lista no tiene, se anota como pedido aparte.
- Una pantalla de "historia" nueva o una línea de tiempo nueva en la ficha.
- Cambiar qué ve el paid trafficker (ver D-1).
- Productos y SKUs (376).

## Decisiones

- **D-1. Dani pide «la compra».** Lo vigente le oculta el monto. Recomendación: el archivo respeta la proyección de hoy
  (el evento dice «compró, en Abonado», sin monto); verlo con monto exige el sí de Gerencia y la enmienda del ADR 0052
  en el mismo commit (N8), en otro ticket.
- **D-2. Datos personales en el archivo.** El CSV del 350 es anónimo a propósito. Recomendación: el archivo lleva lo que
  la pantalla ya le muestra a ese rol (nombre para quien lo ve) más el link a la ficha; **nunca correo ni teléfono**.
  Confirmar con Mani.
- **D-3. Si la lista que usa Dani hoy no es la de una cifra concreta** (quiere "todos los leads de la semana"), se usa la
  cifra Registros con sus filtros de origen, que ya existe. Confirmar con Dani que le basta.

### Respuestas (Mani, 12-nov)

- **D-1 → con monto, en este ticket.** El archivo lleva el monto de la compra y de cada abono también para el paid
  trafficker. Sigue sin closer ni deal para quien no cumple `veEquipoComercial`. Se enmienda el ADR 0052 en el mismo
  diff (N8). La pantalla de la lista no cambia: la enmienda es del archivo.
- **D-2 → nombre, correo y teléfono, para todo rol que abre la lista; sin links al CRM.** Mani: *«poco ton de links del
  CRM que nadie va a abrir es solamente fricción»*. Reemplaza la recomendación (nunca correo ni teléfono) y la casilla
  correspondiente del "Done cuando". Misma enmienda del ADR 0052, dentro de este ticket.
- **D-3 → Registros con sus filtros de origen.** Mani le confirma a Dani Rodríguez; la casilla queda abierta hasta su sí.

## Done cuando

- [x] D-1 a D-3 respondidas, con fecha y quién.
- [x] `git diff` sin cambios en el universo ni en los filtros de ninguna métrica (`metricas-con-filas.ts`,
      `metricas-filtros.ts`, `filtros-de-lista.ts`, `lib/metricas/registro.ts`) ni en `docs/metricas.md`, salvo la
      generalización a lista del punto 3, nombrada.
- [x] Test: el ancho tiene tantas filas como la lista de la misma cifra con el mismo filtro (todas las páginas), con
      anulados y otro programa sembrados.
- [x] Test: el archivo trae nombre, correo y teléfono, y monto (D-1, D-2); como paid trafficker nunca closer ni deal
      (forjando la petición). Un programa ajeno da 404.
- [x] ADR 0052 enmendado (título, índice y cuerpo, N8) con el archivo de la historia: contacto y monto sí, closer y deal no.
- [x] Test: la ficha del lead y la del deal siguen dando lo mismo después de generalizar sus funciones.
- [x] `npm run build`; recorrido en `dev:local` con gerente y paid trafficker, claro, oscuro y 375 px, lado a lado con el
      boceto.
- [ ] Dani Rodríguez descargó una semana real y dijo que le sirve.
