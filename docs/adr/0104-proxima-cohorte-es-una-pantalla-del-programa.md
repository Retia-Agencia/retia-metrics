# 0104: Próxima cohorte es una pantalla del programa, y el deal se muda cuando su cohorte se activa

- **Estado:** aceptado, 22-oct-2026 (Mani). Se construye con el ticket 297.
- **Enmienda:** ticket 231 (Próxima cohorte ya no muda el deal en el acto) y ticket 293 (la bandeja "Esperando corte"
  de Programa se retira; su lugar es esta pantalla). **Confirma:** ADR 0070 (Próxima Cohorte es un pendiente, no una
  etapa), ADR 0103 (el Kanban no gana etapas), ADR 0077 (cada dato en la pantalla de su objeto).
- **Fuentes:** conversación con Mani del 22-oct, después del 296.

## Contexto

1. El Kanban filtra por cohorte y abre en la activa (`lib/queries/kanban.ts`). Una columna "Próxima Cohorte" solo
   mostraría los deals de la cohorte elegida: cuando C3 se cierra y se activa C4, los de C3 que esperaban se pierden
   de vista. Con el 231 pasa ya hoy: un deal mudado en el acto a una C4 futura sale del tablero de la activa.
2. Los deals que esperan otra cohorte vienen de cualquier cohorte (también de una ya cerrada) y alguien tiene que
   procesarlos: decir a qué cohorte van y verlos llegar cuando esa cohorte abre. Hoy eso vive repartido entre Anotar,
   la bandeja de Programa (solo administradores) y el grupo de Mi espacio.
3. "Corte" y "cohorte" son la misma cosa en la operación. El CRM dice cohorte.

## Decisión

1. **Una pantalla "Próxima cohorte" por programa**, en la navegación junto a Deals, para gerente y closer (mismo
   alcance que Deals). El programa es frontera; **la cohorte no filtra**: entran todos los deals vigentes del programa
   con el pendiente Próxima Cohorte, vengan de la cohorte que vengan.
2. **Es una pantalla de cards, no un Kanban.** Pantalla fija: el encabezado y las vistas no se mueven; el scroll es
   sobre las cards. Cada card dice de qué cohorte viene, en qué etapa está, a qué cohorte quiere entrar (la asignada o
   el texto que escribió el closer), el dueño y desde cuándo espera, y abre la ficha del deal.
3. **Dos vistas**, en la URL:

   | Vista | Qué muestra | Qué hay que hacer |
   |---|---|---|
   | Sin cohorte asignada | el tag con texto libre y sin `cohorte_destino_id` | asignarles una cohorte creada |
   | Con cohorte asignada | el tag con `cohorte_destino_id` de una cohorte que todavía no es la activa | nada: esperan |

   La primera es la que se procesa; la segunda dice cuántos llegan a cada cohorte cuando se active.
4. **Anotar › Próxima cohorte siempre pone el tag y no muda el deal.** Si la cohorte ya existe (futura), guarda
   `cohorte_destino_id`; si no, el texto libre obligatorio (293). Nunca cambia `cohort_id` en el acto (enmienda del 231).
5. **Asignar cohorte desde la pantalla** (uno o en lote; el dueño del deal o quien administra, como el D-2 del 293)
   escribe `cohorte_destino_id` con una cohorte del programa que no esté cerrada. Si la elegida es la activa, el deal se
   muda en ese momento; si es futura, pasa a "Con cohorte asignada" y espera.
6. **El deal se muda cuando su cohorte destino se activa.** `activarCohorte` muda, en la misma transacción que cambia el
   estado, todos los deals vigentes del programa con el tag y ese destino, por `cambiarCohorteDelDeal` (la única
   escritura de "cambiar la cohorte de un deal"). Nadie tiene que acordarse: la mudanza la dispara la activación.
7. **La etapa no cambia al mudarse.** Queda una nota del sistema por deal con la cohorte de origen, la de destino y la
   etapa en que estaba ("Próxima cohorte: C3 → C4. Estaba en Atendido."), y el rastro en `change_log`. El tag, el
   destino y el texto se limpian.
8. **Mientras espera, el deal cuenta en su cohorte de origen** (`cohort_id` no cambia). Sacarlo subiría la conversión de
   esa cohorte sin una venta más: el deal entró a su embudo y no compró ahí. Al mudarse cuenta en la nueva.
9. **El Kanban no muestra los deals con este tag** y dice cuántos hay, con el enlace a la pantalla. Un deal está en un
   solo lugar de trabajo.
10. **Todo lo que la interfaz y los docs decían "corte" dice "cohorte".** "Esperando corte" pasa a ser "Sin cohorte
    asignada". Las notas del sistema ya escritas en producción no se reescriben (son historial); lo que las lea acepta
    las dos formas. El CHECK `deals_esperando_corte_con_texto` conserva su nombre: renombrarlo pide una migración sobre
    una tabla caliente y no cambia nada.

## Consecuencias

- Se retiran la bandeja de Programa (293) y el salto inmediato del 231. Quedan una pantalla y una regla de mudanza.
- La suma de las columnas del Kanban baja en los deals con el tag; la pantalla los cuenta aparte. No es una cifra de
  métricas: las métricas siguen por cohorte (punto 8).
- Un deal sale del tag como cualquier pendiente (ADR 0070 punto 7): un cambio de etapa, otro pendiente o Cierre perdido.
- Activar una cohorte con N deals esperando escribe N mudanzas en una transacción. A la escala de hoy (decenas) cabe sin
  lotes especiales.
