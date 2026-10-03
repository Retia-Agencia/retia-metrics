---
id: 166
etapa: O2
serves: "docs/anotaciones.md A-48; ADR 0034"
depends: [100]
status: todo
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
