---
id: 104
etapa: E2
serves: "ticket 103 punto 2 · ADR 0056 · ADR 0015"
depends: [103]
status: done
---

# 104 — Qué motivos lleva cada lista: lo que los closers ya usan, estandarizado

> ✅ **Hecho el 27-sep.** Mani decidió cargar la lista ya, sin esperar a los closers: *"traigamos las que usan,
> estandarizadas, agreguemos las necesarias, todas descriptivas para que no haya confusión, y reduzcamos
> si se puede"*. Los closers pueden ajustarla después desde el catálogo, porque son filas editables.

## De dónde sale hoy cada cosa

- **Las cuatro LISTAS** (perdida, reagenda, retroceso, recuperación) salen de la tabla de transiciones:
  son las cuatro flechas que exigen motivo (P, T29, T15 y R en `structure.md` §3.1). Las decidió Mani el
  27-sep (ADR 0056).
- **Los MOTIVOS dentro de cada lista NO tienen fundamento todavía.** Los 8 que hay en `dev` (Dinero,
  Horario, Sin fit, Viaje, Otro programa, Decisión de un tercero, Sin respuesta, Sin motivo) se sembraron
  el 16-sep en el ticket 012 (migración 0004) como lista de arranque, **sin leer las hojas**. El 103 los
  dejó todos como `perdida`. Las otras tres listas están vacías, así que hoy no se puede tomar ninguna de
  esas flechas (T29, T15, R).

## Lo que se leyó (27-sep, solo lectura, las DOS hojas)

Se leyeron todas las pestañas fuente de Tactical Investor y de ComunicArte: `_ListasDropdown`, `Registro
de llamadas`, `📞 Setteo No Calificados`, `🗑️ Descartados`, las de estudiantes, las de cartera y las de
"interesados en la próxima cohorte". Las vistas derivadas y los respaldos no se leyeron
(`structure.md` §10).

**1. Hay una taxonomía escrita por el equipo, y es IDÉNTICA en las dos hojas** (`_ListasDropdown`):

| Categoría | Subcategorías |
|---|---|
| FINANCIERO | FIN-1 Sin dinero ahora · FIN-2 Expectativa de precio diferente |
| FIT/PRODUCTO | FIT-1 Nivel muy avanzado · FIT-2 Necesidad diferente · FIT-3 Horario incompatible |
| FOLLOW UP | FU-1 Compromiso verbal y pago pendiente · FU-2 Depende de tercero · FU-3 Necesita consultar · FU-4 Follow up programado · FU-5 Perdió contacto post-call |
| RECHAZO DIRECTO | RD-1 No le interesa el programa |
| PENDIENTE RE AGENDA | PRA (sin subcategorías) |

**2. Casi no se llena.** En `Registro de llamadas`, la categoría está en **62 de 229** llamadas de Tactical
(27%) y en **15 de 285** de ComunicArte (5%). La subcategoría se escribe a mano y diverge ("FU-4: Follow up
programado", "follow up programado", "Follow up programado 16/07/26 9 am"). El resto del "por qué" vive en
texto libre (`Registro 1` a `5`). 🩸 **Una lista opcional con texto libre al lado no se llena**, y por eso
en el CRM el motivo es obligatorio y se elige, no se teclea.

**3. El texto libre repite las mismas razones que la taxonomía** (Registro de llamadas y Setteo de los
dos programas): "precio muy alto, no puede pagar" (FIN-2, la más repetida en el setteo de ComunicArte),
"no tiene el recurso, ni a cuotas" (FIN-1), "otro curso se le cruza" (FIT-3), "ya había hecho el bootcamp"
(FIT-2), "nunca respondió" (FU-5), "no quiere trading, sino que le manejen el portafolio" (FIT-2),
"sigue pensándolo" (FU-3). Aparecen dos razones que la taxonomía no tiene: **no puede operar desde su
país** (un caso, Tactical) y **no se le puede contactar** (número sin WhatsApp). Son pocas: se anotan, no
se agregan sin que los closers lo pidan.

**4. Lo que NO es un motivo de closer:**
- `Descartados · Razón de descarte` (Sin recursos, Duplicado, Respuesta incompleta) es la **calificación
  del formulario** (ADR 0054, T2), no un motivo.
- `Setteo · Estado gestión` (Pendiente, En proceso, Agendado, No interesado, Cerrado) son **etapas**: en el
  CRM son 1, 2, 4 y 10.
- FU-1 es la etapa **Compromiso Verbal** y FU-4 es la etapa **Seguimiento** con fecha (`structure.md` §3.2).
  Dejan de ser motivos porque ya son etapas.

## Las listas cargadas (27-sep, `npm run cargar-motivos`)

Son **13 motivos**, frente a los 14 de la hoja más los 8 de arranque. El criterio: la taxonomía de la hoja,
**en frases completas que se entienden sin conocer el código**, una sola lista para los dos programas y
sin fechas dentro del motivo. Se juntó lo que en la práctica no se distingue y se agregó solo lo que el
modelo nuevo necesita.

| Lista (flecha) | Motivo | De la hoja |
|---|---|---|
| perdida (P) | Sin dinero para invertir ahora | FIN-1 |
| perdida | El precio supera lo que esperaba pagar | FIN-2 |
| perdida | El programa no se ajusta a su nivel o necesidad | FIT-1 + FIT-2 (se juntaron: los dos dicen "no es para él") |
| perdida | El horario del programa no le funciona | FIT-3 |
| perdida | No le interesa el programa | RD-1 |
| perdida | Dejó de responder | FU-5 |
| reagenda (T29) | Faltó tiempo para terminar la llamada | nuevo (la hoja solo tenía "PRA"; sale del texto libre) |
| reagenda | Tiene que estar quien toma la decisión | nuevo (del texto libre) |
| retroceso (T15) | Depende de otra persona para decidir | FU-2 |
| retroceso | Necesita más tiempo para pensarlo | FU-3 |
| retroceso | No pagó en la fecha límite acordada | FU-1 + `Cartera` (medible con el ADR 0053) |
| recuperacion (R) | Volvió a mostrar interés | nuevo (la hoja no tenía el concepto) |
| recuperacion | Ya tiene cómo pagar | nuevo |

**Lo que salió, y por qué:**
- Las 8 semillas de arranque se borraron; ninguna tenía uso.
- "Sin motivo" se quitó: un motivo obligatorio con la opción "sin motivo" equivale a un motivo opcional.
- "Viaje" se quitó porque es Próxima Cohorte, y "Decisión de un tercero" quedó como retroceso.
- FU-1 y FU-4 no se cargaron como motivos porque ya son etapas.
- Tampoco se agregaron "No puede operar desde su país" ni "No se le puede contactar": cada uno salió en
  un solo caso.

**Mapa para la migración (079, 080):**
- FIN-1, FIN-2, FIT-3, RD-1 y FU-5 van a su motivo de pérdida.
- FIT-1 y FIT-2 van a "no se ajusta".
- FU-2 y FU-3 van a su motivo de retroceso.
- FU-1 va a la etapa Compromiso Verbal y FU-4 a la etapa Seguimiento.
- PRA va a la etapa Re-agenda, sin motivo (lo histórico no lo tiene).

## Para validar con los closers cuando se pueda (no bloquea)

1. ¿Esta es su lista (la de `_ListasDropdown`)? ¿Hay alguna razón que usen y no esté?
2. "Necesidad diferente": ¿junta "no le sirve el programa" con "busca otro producto", o hay que separarlos?
3. Reagenda: ¿qué es lo que realmente obliga a una segunda llamada?
4. Recuperar: ¿pasa? ¿Por qué vuelve la gente?
5. ¿Agregamos "No puede operar desde su país" (Tactical) y "No se le puede contactar"?

## Done

- [x] Listas cargadas en `dev` por el molde (`scripts/cargar-motivos.ts`), con `change_log` a nombre de Mani.
      La segunda corrida no cambió nada: el script es idempotente.
- [x] Ninguna lista quedó vacía: T29, T15 y R ya se pueden tomar.
- [x] Arreglado de paso: `motivos` no declaraba quién lo referencia, así que borrar un motivo usado
      reventaba con la FK en vez de desactivarlo (test en `tests/catalogo.test.ts`).
- [ ] Correr `npm run cargar-motivos` en producción cuando exista: la migración 0004 siembra las 8 viejas.
