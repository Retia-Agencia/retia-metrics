---
id: 165
etapa: O2
serves: "docs/anotaciones.md A-47, A-49, A-50; ADR 0070"
depends: [142]
status: review
---

# 165 — Crear la siguiente cohorte, y que Próxima cohorte respete la fecha

## Por qué existe

Próxima cohorte es un **pendiente** del deal, no una etapa (ADR 0070): el deal se queda en su etapa con la marca y
una cohorte destino (`deals.cohorte_destino_id`), y al retomarse se muda a ella. Tres cosas fallan:

1. **A-47:** el destino tiene que existir, y crear una cohorte exige que quien administra teclee el código en
   `/ajustes/programas/<slug>`. Mani (2-oct): botón **"Crear C{n+1}"** del administrador.
2. **A-49 (hallazgo del audit):** la ficha promete *"se retoma cuando se registre un contacto desde el {inicio de
   ventas}"*, pero `lib/deals/actividades.ts` (rama `pendiente === "proxima_cohorte"`) lo retoma con **cualquier**
   contacto, sin mirar la fecha, y `moverEtapa` muda el deal a una cohorte que aún no empieza.
3. **A-50 (hallazgo del audit):** `opcionesDeFicha` (`lib/queries/ficha-deal.ts`) ofrece toda cohorte no cerrada,
   incluida la actual; el closer llena el pop-up y el servidor la rechaza al final.

## Alcance

1. **"Crear C{n+1}"** en la administración de cohortes del programa: el CRM calcula el código desde los códigos del
   programa (`/^C(\d+)$/`, el mayor + 1; si no hay ninguno, `C1`), crea la fila en estado `futuro` por el molde
   (`lib/catalogo/cohortes.ts`, con `change_log`) y quien administra completa ventana, meta y ticket. Dos clics a
   la vez: el índice único `(program_id, codigo)` rechaza el segundo y la app lo dice claro (ya traduce el 23505).
   Solo `esAdministrador` (ADR 0016 sigue: un closer no crea cohortes).
2. **El selector de cohorte destino** ofrece solo cohortes `futuro` del programa, distintas de la del deal. Si no
   hay ninguna: el closer ve "No hay próxima cohorte creada; pídele a quien administra que la cree" y quien
   administra ve el botón del punto 1 ahí mismo (P-1).
3. **Retomar respeta la fecha:** un contacto retoma Próxima cohorte solo si la cohorte destino ya empezó ventas
   (`inicio_ventas <= hoy` en Bogotá, `hoyEnBogota()`); antes de eso el contacto se registra y el pendiente sigue.
   El texto de la ficha y la regla dicen lo mismo. Decidir en el ticket si la cohorte destino sin `inicio_ventas`
   se retoma con cualquier contacto (recomendación: sí, como hoy, porque no hay fecha que esperar).

## Archivos

Toca: `lib/catalogo/cohortes.ts`, `components/cohortes-admin.tsx`, `lib/queries/ficha-deal.ts` (`opcionesDeFicha`),
`lib/deals/actividades.ts`. **No toca** `dialogo-mover.tsx` (el selector ya pinta lo que le den) ni el motor.

Tests: `tests/esquema-cohorte.test.ts`, `tests/cohortes-errores-driver.test.ts`, `tests/actividades-del-deal.test.ts`,
`tests/ficha-deal-lectura.test.ts`.

## Done cuando

- Con C1 a C3 existentes, el botón crea C4 en `futuro` con su fila de `change_log`; con ninguna, crea C1.
- El selector de Próxima cohorte no ofrece la cohorte actual ni las activas o cerradas.
- Un contacto antes del inicio de ventas de la destino no retoma; uno después, sí, y el deal queda en la destino.
- La acción de crear, forjada desde una sesión de closer: 403 y la base quieta.

## Cierre 2026-10-02 (rama `t165-siguiente-cohorte`, sin migración)

**Estado: `review`**: código, tests del ticket, build y recorrido hechos; pasa a `done` con el checkpoint verde.

**Decisiones (Mani, 2-oct)**

- **"Crear C{n+1}" prellena el formulario, no inserta.** `cohorts` exige meta, precio, inicio de clases y cierre
  de ventas (NOT NULL) y el ticket va sin migración: insertar con valores copiados serían centinelas que mienten
  en las metas. El botón (antes "Nueva cohorte") dice "Crear C{n+1}" y abre el alta con el código y `futuro`
  puestos; quien administra completa y guarda por `crearCohorteAccion` (molde, `change_log` por campo). El código
  lo calcula `siguienteCodigoDeCohorte` en `lib/catalogo/codigo-de-cohorte.ts`, módulo puro aparte porque lo
  importa un componente cliente (importar `lib/catalogo/cohortes.ts` mete la base al navegador).
- **Destino sin `inicio_ventas`: no se retoma** (contra la recomendación del ticket). La regla de la fecha ya vive
  en el motor (`queLeFaltaTransicion`, RET) y es una sola; cambiarla es del dueño del motor. El contacto se
  registra y el pendiente sigue hasta que alguien fije el inicio.
- **Lista aparte para Próxima cohorte.** `opciones.cohortes` sigue igual porque la usan "Cambiar cohorte" y el
  kanban, que sí deben ofrecer la activa. `opcionesDeFicha` suma `cohortesDestino` (`futuro`, sin la del deal;
  nuevo 4.º parámetro `cohorteActualId`) y `opcionesDeTablero` la suma para el kanban (ahí sin excluir la del
  deal: si coincide, la rechaza `moverEtapa`). `responder-pregunta` pasa `cohortesDestino` al diálogo (1 línea,
  archivo de S1) y `dialogo-mover` dice "No hay próxima cohorte creada. Pídele a quien administra que la cree
  en Programs." si la lista está vacía (mismo texto para todos los roles).

**Retomar respeta la fecha:** `registrarActividad` corre el RET en un savepoint y, si el motor lo rechaza solo
por `contacto`, se queda con el contacto y el pendiente; cualquier otro rechazo se propaga. Antes, el rechazo
tumbaba la transacción entera y el contacto no se guardaba.

**Verificado:** typecheck, lint, build; tests `actividades-del-deal`, `codigo-de-cohorte`, `ficha-deal-lectura`,
`esquema-cohorte`, `cohortes-errores-driver`, `alcance-deals`, `kanban`. Recorrido en `dev:local`
(`app165.localhost:3165`): con C1 activa el botón dice "Crear C2", C2 se crea en `futuro` con sus 9 filas de
`change_log`; el selector de Próxima cohorte de un deal en C1 ofrece solo C2; `crearCohorteAccion` forjada desde
la sesión de un closer responde "Esta vista es solo para: gerente." y la base sigue con C1 y C2.

**Lo que queda fuera (para quien lo tome):**

- Un contacto sin canal no cuenta como "contacto registrado" para el motor (`esContactoRegistrado`), así que no
  retoma. Los tests lo cubren con canal; si la ficha permite un contacto sin canal, no retomará.
- Al retomar, `moverEtapa` muda `cohort_id` a la destino pero **no limpia `cohorte_destino_id`**: la cabecera de
  la ficha seguiría diciendo "Cambia a cohorte C2" con el deal ya en C2. Es del motor (S3).
- Idea de Mani (2-oct): un "Mi espacio" por rol con avisos de operación ("Cohorte creada: configura sus datos").
  Va al [164] o a un ticket nuevo.
