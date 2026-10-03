---
id: 166
etapa: O2
serves: "docs/anotaciones.md A-48; ADR 0034"
depends: [100]
status: done
---

# 166 — Las plataformas de pago de un programa, a la vista

## Por qué existe

Mani (2-oct): *"cuando se registra un abono pide una plataforma, ¿eso es por programa? ¿En dónde?"*. Sí: la tabla
puente `plataformas_programa` (ADR 0034). Hoy se vincula en `/ajustes/catalogos` (solo quien administra) o sola al
crear un enlace de pago en Recursos. Nada en la ficha del programa ni en el abono lo dice, y un programa sin
plataformas vinculadas muestra un selector vacío sin avisar. Para un programa nuevo (Memorable, frente A) es fácil
que pase.

## Alcance

1. En la ficha del programa (tab Programs, ticket 100): bloque **"Plataformas de pago"** con las vinculadas, y
   quien administra (o el closer con membresía, como ya permite `/ajustes/catalogos`, ADR 0034) vincula y
   desvincula ahí mismo. Reusa `vinculosDePlataformas` / el molde, sin segunda copia del `select`.
2. En el pop-up de abono: si el programa no tiene ninguna plataforma vinculada, el selector lo dice ("Este
   programa no tiene plataformas de pago; agrégalas en Programs") en vez de salir vacío. Sigue siendo
   **proyección, no reja**: el abono se registra igual (ADR 0034).

## Archivos

Toca: `app/(app)/p/[programa]/programa/`, `lib/catalogo/plataformas.ts` (solo si falta una función),
`components/deals/ficha/ficha-pago.tsx` (solo el aviso). Ojo: `ficha-pago.tsx` no lo toca el 162 ni el 163.

Tests: `tests/plataformas-programa.test.ts`, `tests/ficha-programa.test.ts`.

## Done cuando

- La ficha de Memorable muestra sus plataformas y se vinculan desde ahí, con `change_log`.
- Un programa sin plataformas avisa en el abono; uno con plataformas las ofrece.
- Vincular, forjado desde un closer sin membresía en ese programa: 403 y la base quieta.

## Cierre 2026-10-02 (rama `t166-plataformas-visibles`, sin migración)

**Estado: `review`**: código, tests del ticket, build y recorrido hechos; pasa a `done` con el checkpoint verde.

**Qué se construyó**

- `fichaDelPrograma` (`lib/queries/ficha-programa.ts`) trae `plataformas` (vinculadas y activas, por
  `plataformasDelPrograma`) y `plataformasDisponibles` (activas del catálogo sin vínculo, por el molde
  `plataformasDePago(db).listar`). Sin segunda copia del `select` sobre `plataformas_programa`.
- Bloque **"Plataformas de pago"** en la ficha del programa (`plataformas-del-programa.tsx`, cliente, en la
  carpeta de la página): lista con quitar y un selector + "Vincular". Lo ve todo el que llega a la ficha (un
  closer sin membresía ya recibe 404); la reja son las acciones de siempre, `asociarProgramaAccion` /
  `desasociarProgramaAccion` (`requireRole` + `exigirAccesoAlPrograma`, `change_log`), que ahora además
  revalidan la ficha del programa y la del deal.
- El pop-up de abono dice "Este programa no tiene plataformas de pago; agrégalas en Programs." en vez de un
  selector vacío. Sigue siendo proyección: el abono se registra igual (ADR 0034).
- `lib/catalogo/plataformas.ts` no cambió: ya tenía todo.

**Verificado:** typecheck, lint, build; tests `ficha-programa`, `plataformas-programa`, `paginas`. Recorrido en
`dev:local` (`closer166.localhost:3166`), con ComunicArte Local sin plataformas: el abono muestra el aviso; el
closer vincula PayPal desde la ficha, queda la fila con su `change_log` y el abono ofrece PayPal; la acción de
vincular, forjada desde un closer sin membresía en Tactical, responde "No puedes gestionar las plataformas de un
programa donde no vendes." y la base sigue igual (0 vínculos en Tactical, 1 fila de `change_log`).

**Detalle para Mani:** los dos avisos (este y el de Próxima cohorte del [165]) dicen "Programs", como el ticket,
pero la pestaña del menú se llama **"Programa"**. Si se prefiere el nombre del menú, es cambiar dos textos.
