---
id: 231
etapa: corte
serves: "Mani, 12-oct: Próxima cohorte mueve el deal ya, para no dejar deals muertos"
depends: [227]
status: todo
---

# 231 — Próxima cohorte cambia la cohorte del deal en el acto

## Por qué existe

Hoy "Próxima cohorte" deja el pendiente `proxima_cohorte` con `cohorte_destino_id` y el deal sigue en la cohorte
vieja hasta que alguien lo toque después del inicio de ventas de la destino (RET y `mudaDeCohorte` en
`lib/deals/mover-etapa.ts`). Un deal que nadie toca se queda muerto en la cohorte vieja. Mani (12-oct) decide:
**elegir Próxima cohorte cambia la cohorte del deal ya.** Enmienda lo decidido en el 227 (Próxima cohorte "espera").

## Qué se construye

- La acción "Próxima cohorte" (Anotar / Transición) sigue mostrando solo cohortes `futuro` del programa y, al
  confirmar, escribe `deals.cohort_id = destino` en una transacción con rastro (`editarConRastro`), reusando la
  escritura de `cambiarCohorte` (`lib/deals/estudiante.ts`) para que llamadas y demás que copian la cohorte queden
  igual que en un cambio normal. Una sola respuesta a "cambiar la cohorte de un deal", no dos.
- La etapa no cambia. No queda pendiente `proxima_cohorte` ni `cohorte_destino_id` escritos por esta acción.
- Nota del sistema en el log del deal y aviso en pantalla (molde del 220): "Cohorte cambiada: C3 → C4. El deal ya
  cuenta en C4."
- Se retiran RET y la mudanza diferida (`mudaDeCohorte`) del motor, con sus tests y la tabla de `docs/structure.md`
  §3 (PC y RET) actualizada. El valor del enum `proxima_cohorte` y la columna `cohorte_destino_id` se quedan hasta
  una migración aparte (no se quitan aquí).
- Deals que hoy tienen el pendiente `proxima_cohorte`: el ticket deja un script que los muda a su
  `cohorte_destino_id` por la misma función, en seco primero; se corre en producción solo con el ok de Mani (la
  sesión principal lo corre, no el agente).

## Done cuando

- [ ] Test: elegir Próxima cohorte cambia `cohort_id` en la misma transacción, deja `change_log` y nota del sistema,
      no deja pendiente, y una cohorte no futura o de otro programa se rechaza.
- [ ] Test: las métricas de la cohorte vieja dejan de contar el deal y la nueva lo cuenta.
- [ ] Recorrido en base local: el aviso dice de qué cohorte a cuál pasó.
