# 0037 — El Deal y las diez etapas: un objeto, un motor, y `sales` se disuelve

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 20 y 21-sep; insumo §2.4 y §3) ·
**Implementacion:** etapas 1 y 2 del plan v2 · **Aplica:** ADR 0012, ADR 0015, ADR 0024 ·
**Enmienda:** ADR 0021 (el owner se muda a `deals`), ADR 0027 (`sales.call_id` desaparece con
`sales`), ADR 0010 (los registros nativos dejan de reusar `sales`)

## El problema

El modelo de hoy es `persona → llamada → venta → abonos`. Es la forma del **registro** que hace un
closer al colgar, no la forma de la **oportunidad** que trabaja durante dos semanas. Con el modelo
de hoy no hay ninguna fila que conteste *"¿en que va este lead?"*: hay que reconstruirlo mirando
su ultima llamada y adivinando.

De ahi salen tres agujeros concretos:

- **No hay embudo.** El dashboard cuenta eventos (agendas, shows, ventas) pero no puede decir
  cuantos leads estan **hoy** en cada paso, ni cuanto tardan en pasar de uno al siguiente.
- **Nadie es dueno de nada.** `people.responsable_closer_id` existe desde el ticket 026 y esta en
  **0 filas** medido el 21-sep. El responsable es de la persona, no de la oportunidad, asi que
  "esta venta la trabaja Maru" no tiene donde escribirse.
- **`sales` es una tabla de una sola fila por venta que no sabe nada de lo que paso antes.** Y
  **esta vacia**: 0 filas en `production` el 21-sep.

## Decidimos

**1. El Deal es el objeto central del CRM.** Es *la oportunidad de venderle un programa a un Lead*:
tiene owner, etapa, producto, cohorte e historial.

```
deals (lead_id, program_id, cohort_id, owner_user_id?, etapa, producto_id?, motivo_id?,
       submission_origen_id?, onboarded_at?, creado_por, anulado_por?, anulado_en?, anulado_motivo?)
      unico parcial (lead_id, program_id) WHERE etapa NOT IN (completo, perdido)
```

**Maximo un deal abierto por lead y programa**, garantizado por un indice unico parcial —el mismo
molde que `cohorts_una_activa_por_programa_idx`—, **no por el codigo** (ADR 0005). Los cerrados se
quedan: reaplicar despues de un Cierre Perdido **abre un deal nuevo** y la ficha muestra los
anteriores. Asi "volvio a intentarlo en la cohorte siguiente" es un hecho contable y no una
sobreescritura.

**2. Las diez etapas son un `pgEnum`: son TIPOS.**

| # | Etapa | Entra cuando | Quien mueve |
|---|---|---|---|
| 1 | Pendiente Setteo | `estado` = Setteo No Calificado; o deal manual | sistema / closer |
| 2 | En Contacto | el owner registra el primer contacto con fecha | closer |
| 3 | Pendiente Re-agenda | la Call quedo en `no_show` o `cancelada` | sistema |
| 4 | Agendado | `estado` = Con Calendly; o el closer crea una Call con fecha y link | sistema / closer |
| 5 | Atendido | la Call tiene link de Grain | sistema |
| 6 | Compromiso Verbal | producto asignado + fecha prometida; o deal manual | closer |
| 7 | Abonado | primer abono con saldo > 0 | sistema |
| 8 | Completo | saldo = 0 | sistema |
| 9 | Proxima Cohorte | el closer lo marca | closer |
| 10 | Cierre Perdido | motivo obligatorio; alcanzable desde cualquier etapa | closer |

Son tipos y no catalogo porque **el codigo decide segun ellas**: el embudo, la vista de Students
(`etapa in (Abonado, Completo)`), la cartera vencida y los movimientos automaticos preguntan por su
valor. Eso es exactamente la regla del ADR 0012, aplicada en la direccion contraria a la del
ADR 0032: `lead.estado` es texto porque **nadie decide** con el; `deal.etapa` es enum porque
**todo** decide con ella. No se contradicen: contestan la misma pregunta con datos distintos.

**3. `moverEtapa()` en `lib/deals/etapas.ts` es el UNICO camino para cambiar `deals.etapa`.**

El modulo contesta dos preguntas y nada mas: *¿este deal puede pasar de A a B?* y *si no puede,
¿que requisito le falta?*. Valida, escribe `deal_etapa_historial` y devuelve el error con el
requisito nombrado. Un guardian recorre el codigo y **falla si aparece un `update(deals).set({etapa})`
fuera del modulo**, igual que los de `vigente`, `rolDeVista` e `identidad de closer`.

🎯 **Por que un modulo y no logica repartida.** Hay **tres** escritores que mueven etapas: el sync
(insumo §3.1), el closer, y el sistema al registrar un abono. Si cada uno implementa el requisito,
**divergen en silencio**. Es literalmente lo que ya paso dos veces en este repo: el saldo escrito
en dos sitios, con la reja y la pantalla dando cifras distintas (ADR 0024), y la vigencia olvidada
en una consulta, que infla una metrica sin lanzar un error (ADR 0026). No repetir esa herida es la
decision de arquitectura mas importante del plan v2.

**4. El historial de etapas es obligatorio.** `deal_etapa_historial (deal_id, de, a, user_id?,
motivo_id?, fecha)`. Sin el no existen "tiempo en etapa" ni "conversion etapa a etapa", y **no se
pueden reconstruir despues**: el dato es el instante del cambio, y ese instante no se guarda en
ninguna otra parte. Se escribe desde el primer dia por la misma razon del ADR 0029.

**5. `sales` se ELIMINA.** Un deal tiene una sola venta, asi que la venta **es** el deal: producto,
cohorte, owner y fechas ya viven ahi. Una segunda venta a la misma persona es **otro deal**. El
ticket lo da el producto (`deal.producto_id → producto.precio_lista`), sin `precio_contrato`:
🩸 las hojas muestran ocho precios por descuentos (697/627/557/397 y 1.500/1.200/1.000/900/800/400)
y **cada precio que el equipo use es un producto del catalogo**, que el equipo crea (ADR 0016).

Costo medido: `sales` tiene **0 filas**. No es una migracion de datos, es un cambio de esquema
sobre una tabla vacia. El costo esta entero en los 27 archivos que la nombran.

**6. Derivados, nunca almacenados:** `abonado = sum(abonos)`, `saldo = precio_lista - abonado`,
`es_student = etapa in (Abonado, Completo)`, `comision = tasa_programa × precio_lista`. Siguen
viviendo en un solo modulo (ADR 0024): `saldo.ts` cambia **de donde lee**, no que significa.

**7. Redundancia declarada, la unica de este ADR:** `deal.etapa` frente a la suma de abonos. La
escribe **solo el sistema** al registrar un abono y **no se edita a mano**. Con eso no pueden
divergir.

## Enmiendas

**Al ADR 0021** (responsable y alta manual). Se conserva **el espiritu completo**: el responsable
es del CRM y no de la hoja, el sync nunca lo pisa, "sin responsable" es valido, y las personas
creadas a mano cuentan en el embudo pero no en el CPL. **Cambia donde vive y de que tipo es:**

- de `people.responsable_closer_id` (texto, ADR 0011) a **`deals.owner_user_id`, FK real a `users`**;
- de *responsable de la persona* a **owner de la oportunidad**. Una persona puede tener dos deals
  cerrados por dos closers distintos, y hoy eso no se puede representar;
- el **reclamo** reemplaza al reparto: los deals nacen sin owner (*Unclaimed*), el closer reclama
  y un gerente reasigna. La rotacion ciega del script desaparece.

ADR 0011 (closerId como texto copiado) **sobrevive solo para lo historico** que entre por la
migracion one-time de la etapa 7, donde la hoja escribio un nombre y no hay usuario al que
apuntar.

**Al ADR 0027** (una venta sabe de que llamada nacio). `sales.call_id` desaparece **con la tabla**.
La pregunta que ese ADR resolvia —¿que venta nacio de esta llamada?— deja de existir: las calls
cuelgan del deal y el deal **es** la venta, asi que el vinculo es estructural y no una FK que haya
que acordarse de escribir. **Lo que se conserva es la leccion, no el mecanismo:** nada de
emparejar por heuristica (persona + cohorte + cercania de fecha); si dos hechos estan
relacionados, la relacion se escribe.

**Al ADR 0010** (los registros nativos reusan `calls` y `sales`). `calls` se conserva y se le
cambia el padre (`person_id` → `deal_id`); `sales` no. `origen = "app"` sigue teniendo sentido
para distinguir lo nativo de lo migrado.

## Consecuencias

- **A favor:** *"¿en que va este lead?"* es una columna. El Kanban, el embudo por etapa y la
  conversion etapa a etapa dejan de ser imposibles.
- **A favor:** un solo lugar valida los requisitos de entrada, que es la palanca contra el dato
  incompleto (insumo §1.3).
- **En contra:** diez etapas son muchas para quien las llena. 🟡 Falta validarlas con Andrea y
  Maru, **y con `deal_etapa_historial` guardando todo movimiento, la conversion se recalcula
  cuando respondan**: por eso no bloquea construir.
- **En contra:** el `pgEnum` de etapas cuesta una migracion cada vez que se agregue una. Es el
  precio de que el codigo pueda decidir con ellas, y esta asumido en el ADR 0012.
- **Abierto:** si "Setteo No Calificado" es etapa o salida. De eso depende si la conversion da
  0,9% o 2,6%, y lo contestan los closers, no este ADR.

## Alternativas descartadas

**Conservar `sales` y colgarle la etapa.** Deja dos objetos (venta y oportunidad) donde el negocio
ve uno, y obliga a crear la venta antes de que exista, que es justo el problema que el ADR 0027
tuvo que parchear.

**Las etapas como catalogo editable.** Suena mas fiel al ADR 0012, pero el codigo **si** decide
segun la etapa: Students, cartera vencida y los movimientos automaticos preguntan por valores
concretos. Un catalogo editable de cosas con las que el codigo razona es un enum al que le quitaron
la garantia.

**Etapas por programa.** Las dos operaciones son la misma y un embudo comparable entre programas
vale mas que la flexibilidad de tener dos pipelines. Si un programa futuro necesita otro pipeline,
se abre entonces con su ADR.

---

## Enmiendas posteriores (anotadas el 2026-09-24)

- **ADR 0038 (21-sep), la mitad que faltaba escribir aquí:** el índice
  `deals_uno_abierto_por_lead_y_programa_idx` lleva `AND anulado_en IS NULL`. Un deal anulado nunca
  debió existir, así que no ocupa el cupo del lead; sin esa cláusula, quien anula un deal hecho sobre
  el lead equivocado no puede crear el correcto.
- **ADR 0044 (21-sep):** el CPL deja de preguntar por `entrada`; cuenta los leads del área Pauta.
- **ADR 0049 (24-sep):** un Agendado cuyo host de Calendly es un closer registrado en el programa nace
  **con dueño**, sin reclamo. Y una Call puede existir sin deal solo si es una llamada suelta de
  Calendly, pendiente de asignar.
- **🟡 Propuesta del 24-sep (ticket 043):** la tabla de transiciones se completa con los huecos que
  encontró la revisión del 22-sep (D2): 1→4, 3→5, llegada a Próxima Cohorte desde 2, 5 y 6, pago
  completo de una vez (5→8, 6→8), retrocesos explícitos con motivo, Completo terminal, y recuperar un
  perdido solo hacia 2, 4 o 9. Se valida con los closers antes de congelarla.
- **Decisión del 24-sep sobre los deals históricos:** el CRM abre deals solo para leads nuevos desde el
  corte. Los leads viejos de Setteo entran con la migración de la etapa 7, respetando su estado de
  gestión, no como ~2.400 deals iguales en Pendiente Setteo.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".
