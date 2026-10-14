---
id: 237
etapa: llamadas
serves: "Michael, 13-oct: pegar el Grain y completar lo que levanta alertas en un deal ya ganado (A-147); Nicolás, 13-oct: reagenda duplicada (A-148)"
depends: []
status: done
---

# 237 — Completar requisitos en Ganado completo, y una cita = una llamada

## Por qué existe

- **A-147.** Un deal en Ganado completo rechazaba pegar el Grain o marcar el resultado de una llamada que ya pasó
  ("El deal está cerrado: no se le agregan llamadas nuevas", 409): la reja que impide CREAR llamadas sobre un deal
  cerrado también impedía COMPLETAR las que ya tiene, y la alerta de Grain quedaba sin forma de apagarse.
- **A-148.** Andrey Siabato (Comunícate con Confianza, deal de Nicolás): Nicolás reagendó en el CRM (9:42) y luego
  la misma cita se reagendó en Calendly (9:54). El webhook revivió la llamada vieja con la fecha nueva y quedaron
  dos llamadas agendadas para el 16-oct 17:00.

## Qué se construye

- `lib/deals/llamadas.ts`: `dealCompletableDelActor` / `llamadaVigenteDeDealCompletable`, mismas rejas que el deal
  abierto pero aceptan Ganado completo (Cierre perdido sigue rechazado). La usan `pegarGrain`, `marcarShow` y
  `marcarFallida`. Crear o reagendar llamadas sigue exigiendo deal abierto.
- Sobre Ganado completo esas acciones no mueven etapa ni pendiente y dejan una nota firmada por el actor
  (`dejarNotaDelActor` en `lib/deals/nota-del-sistema.ts`). `pegarComprobante` deja la misma nota.
- Ficha: `puedeCompletar` separado de `puedeRegistrar`; el Grain y el resultado salen en un deal Completo, el botón
  de reagendar no.
- `lib/calendly/eventos-de-cita.ts` `reagendar`: si la llamada vieja ya está `reagendada` por el CRM, Calendly
  adopta la sucesora del CRM (origen `crm`, agendada, sin huella, creada desde la marca de reagenda) en vez de
  revivir la vieja.

## Done cuando

- Tests en `tests/grain-y-reagenda.test.ts`, `tests/abonos-del-deal.test.ts` y `tests/calendly-webhook-ruta.test.ts`.
- Typecheck, lint y build limpios.

## Deuda conocida

- La sucesora se encuentra leyendo `change_log` (cuándo se marcó la reagenda). Si se vuelve frágil, guardar en la
  llamada cuál la reemplazó (columna, migración).
- La alerta "llamada sin resultado" del Inbox sigue sin salir para deals en Ganado completo (fuera de alcance).
