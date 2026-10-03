---
id: 165
etapa: O2
serves: "docs/anotaciones.md A-47, A-49, A-50; ADR 0070"
depends: [142]
status: todo
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
