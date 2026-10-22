---
id: 297
etapa: deals
serves: "Mani, 22-oct: los deals que esperan otra cohorte se procesan en un solo lugar y se mudan solos cuando su cohorte se activa (ADR 0104)"
depends: [293, 296]
status: en main
---

# 297 — La pantalla Próxima cohorte, y la mudanza al activar la cohorte

## Por qué

ADR 0104 (Mani, 22-oct). Una columna del Kanban solo vería la cohorte elegida; los deals que esperan otra cohorte
vienen de cualquiera y hay que procesarlos en un lugar. Enmienda el 231 (ya no se muda en el acto) y retira la bandeja
de Programa del 293.

## Qué

**Sin migración.** Todo cabe en `pendiente = 'proxima_cohorte'`, `cohorte_destino_id` y `cohorte_destino_texto`, y el
CHECK `deals_esperando_corte_con_texto` sigue valiendo (con destino, el texto es opcional).

1. **Anotar › Próxima cohorte** (`lib/deals/anotar.ts`, `components/deals/dialogo-anotar.tsx`): con cohorte futura
   elegida pone el tag con `cohorte_destino_id` y **no** cambia `cohort_id`; sin cohorte, el texto obligatorio de hoy.
   Nota del sistema y `editarConRastro` en los dos caminos. Textos: "La cohorte todavía no existe", "¿A qué cohorte
   quiere entrar?".
2. **Consulta** `lib/queries/proxima-cohorte.ts` (reemplaza `deals-esperando-corte.ts`): deals vigentes del programa con
   el tag, **sin filtro de cohorte**, con cohorte de origen (código), etapa, destino (código o texto), dueño y desde
   cuándo espera. Parámetro `vista` (`sin_asignar` | `asignada`, zod, `sin_asignar` por defecto). "Desde cuándo" sale de
   la nota del sistema y acepta las dos formas (`'Esperando corte: %'` de producción y la nueva).
3. **Asignar cohorte** `lib/deals/asignar-proxima-cohorte.ts` (reemplaza `pasar-esperando-corte.ts`): uno o en lote, en
   una transacción. Lo puede el dueño del deal o quien cumple `esAdministrador`; un deal de otro programa o sin el tag se
   rechaza. Destino: cohorte del programa no cerrada. Si es la activa, muda ya (punto 4); si es futura, solo escribe
   `cohorte_destino_id`.
4. **Mudanza** `mudarDealsDeProximaCohorte(tx, cohorte, actorId)`: para cada deal con el tag y ese destino, llama a
   `cambiarCohorteDelDeal` (`lib/deals/cambiar-cohorte.ts`), conserva la etapa, limpia tag, destino y texto, y deja la
   nota "Próxima cohorte: C3 → C4. Estaba en Atendido." La usan el punto 3 y `activarCohorte`
   (`lib/catalogo/cohortes.ts`), que pasa a `db.transaction`: estado y mudanzas en la misma transacción.
5. **Pantalla** `app/(app)/p/[programa]/proxima-cohorte/page.tsx`, ítem "Próxima cohorte" en `lib/nav.ts` después de
   Deals (gerente y closer; guarda y alcance como Deals). `PantallaFija` + `ZonaConScroll`: encabezado y selector de
   vista fijos, scroll sobre las cards. Card: viene de, etapa (con `TONO_DE_ETAPA`), quiere entrar a, dueño, desde
   cuándo; abre la ficha. En "Sin cohorte asignada", selección múltiple y "Asignar cohorte". Tinta: `<Badge variant>`,
   `cifra`, nada a mano.
6. **Kanban** (`lib/queries/kanban.ts`): los deals con el tag no van a ninguna columna; el tablero muestra "N en Próxima
   cohorte" con enlace a la pantalla.
7. **Se retira** la bandeja de `components/cohortes-admin.tsx` y su acción en `acciones-programa.ts`. El grupo de Mi
   espacio (`lib/mi-espacio/notificaciones.ts`) enlaza a la pantalla.
8. **"Corte" → "cohorte"** en `ficha-cabecera.tsx`, `tarjeta-deal.tsx`, `dialogo-anotar.tsx` y lo que quede en UI.

## Done cuando

- [x] Test: Anotar con cohorte futura pone el tag y `cohorte_destino_id`, no cambia `cohort_id` (enmienda los tests del
      231); sin cohorte, el camino del 293 sigue igual.
- [x] Test: la consulta trae deals con el tag de dos cohortes distintas (una cerrada), separa las dos vistas, excluye
      otro programa y anulados, y lee las dos formas de la nota.
- [x] Test: asignar en lote a una futura solo escribe el destino; a la activa, muda; deal ajeno o sin tag, rechazo sin
      escribir nada; un closer que no es dueño, 403.
- [x] Test: `activarCohorte` muda los deals con ese destino en la misma transacción, conserva la etapa, limpia tag y
      texto, deja nota con origen, destino y etapa, y `change_log`; los de otro destino no se tocan.
- [x] Test: las métricas cuentan el deal en su cohorte de origen mientras espera y en la nueva después.
- [x] Test: el Kanban no trae los deals con el tag y devuelve su conteo.
- [x] `npm run build` y recorrido en `dev:local`: closer anota "2027" y "C4"; las cards salen en su vista; gerente asigna
      en lote, cierra C3 y activa C4, y los asignados aparecen en el Kanban de C4 en su etapa con la nota. Clic en todo
      lo que se abre, consola limpia, celular incluido.
- [x] `docs/structure.md` §3 (pendientes y PC) y `docs/overview.md` §11 (vocabulario) actualizados.

## Cierre (22-oct)

En main en `243944a2`. Implementó Codex; la sesión central revisó e hizo el recorrido en `dev:local`.
- El recorrido destapó el mismo bug del 293: marcar una card tumbaba la pantalla (`e.currentTarget` dentro del updater).
- Los botones que son links necesitaban `nativeButton={false}` (aviso de Base UI en consola).
- La ficha decía "Se retoma cuando se defina el inicio de ventas"; ahora dice que pasa a la cohorte en su misma etapa al activarse.
- Activar una cohorte sigue exigiendo sus tres fechas (regla de antes): una cohorte "por definir" no se activa hasta llenarlas.
- Abierto: "Asignar cohorte" también ofrece la cohorte activa en la que el deal ya está; elegirla quita el tag y lo deja ahí.
- Falta el checkpoint verde con la suite completa.
