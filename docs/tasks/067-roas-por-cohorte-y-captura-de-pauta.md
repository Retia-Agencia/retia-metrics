---
id: 067
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-4 · ADR 0039 punto 4, insumo §8 · ENMENDADO por ADR 0045"
depends: [064, 120]
status: todo
---

# 067 — ROAS por cohorte, y la pauta se captura en el CRM

## Objetivo

Devolverle al equipo el ROAS, que hoy se calcula a mano en la hoja y dejo de calcularse.

**Compradores por canal en tres cubos como minimo:** Meta Ads · organico (Instagram + el
"automatizado" de Juanito) · sin UTM.

## La asimetria que ordena este ticket (Mani, 21-sep)

> *"el CRM si va a tener las metricas por UTMs ya que todo lead entra con su origen, pero el costo
> de una campana y demas para calcular el CPI, CAC, ROAS si toca indicarlo manualmente o traerlo
> de los Paid Traffickers; las pautas deben poderse asignar un costo."*

| | De donde sale |
|---|---|
| **El origen** de un lead (UTM) | entra solo con el envio (`submissions.utm_*`) |
| **El costo** de una campana | **no lo sabe ningun formulario**: se captura en el CRM |

## Alcance

- **Dentro:** `ad_spend` **deja de ser fuente de Sheets** (ADR 0039) y pasa a capturarse desde la
  app: programa, cohorte, campana, fecha, **inversion**. Por el molde de `lib/catalogo/`: un solo
  esquema zod, guarda por rol, y cada cambio a `change_log` (ADR 0012, ADR 0029).
- **Dentro:** decidir aqui, con la pantalla delante, **si la carga es por campana/dia o un total
  por cohorte**, y re-pensar el indice `ad_spend_huella_idx`, que existia para deduplicar filas de
  una hoja y ya no tiene sentido como llave.
- **Dentro:** 🩸 la inversion es en **COP** y el ticket en **USD**. **Nunca convertir en
  silencio**: la moneda va al lado del numero (regla dura).
- **Dentro:** una cohorte sin pauta cargada **se ve vacia**, no se rellena con ceros: un cero
  parece un dato.
- **Fuera:** traer la inversion por API de Meta. Si llega, entra por la misma funcion de captura.

## 🟡 Lo que falta preguntarle a Michael

Por que se dejo de calcular el ROAS, y **como marca Juanito su rastro en el UTM**. No bloquea
construir la captura; si condiciona como se agrupa el cubo "organico".

## Done cuando

- [ ] Un gerente carga la inversion de una cohorte desde la app, con rastro.
- [ ] El ROAS sale en los tres cubos sobre `dev`.
- [ ] Ninguna cifra en COP aparece sin decir COP.
- [ ] Una cohorte sin pauta cargada lo dice.

## Kiro

Si, con revision.

---

## ⚠️ Enmienda 2026-09-21 (ADR 0045): el grano ya NO se decide aqui

Este ticket decia *"decidir aqui, con la pantalla delante, si la carga es por campana/dia o un total
por cohorte, y re-pensar el indice `ad_spend_huella_idx`"*. **Esa decision ya se tomo**, porque de
ella dependia poder cruzar costo con leads:

- **El grano es `campana + fecha`**, y `ad_spend` **cuelga de `campanas`** (ticket 084).
- `ad_spend_huella_idx` **deja de ser la llave**: existia para deduplicar filas de una hoja.
- Los tres cubos (Meta / organico / sin UTM) **dejan de calcularse a mano**: salen del emparejador
  del ticket 085, que ya sabe que patron pertenece a que campana y a que area.
- 🩸 **Una division solo se muestra si numerador y denominador existen en esa rebanada.** La frase
  que este ticket ya tenia —*"un cero parece un dato"*— se extiende de la cohorte a la rebanada.

**Lo que sigue vivo de este ticket:** la pantalla de captura del costo, la moneda al lado del numero
(COP vs USD, nunca convertir en silencio), y las preguntas a Michael.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **La fuente principal del gasto es la API de Meta** (119, 120, ADR 0062), por anuncio y por día, en `gasto_pauta` (reemplaza `ad_spend`). La captura manual de este ticket queda para otras plataformas, si existen (PQ1), por la misma función que escribe el gasto.
- **ROAS sobre ventas contratadas, con la TRM de la cohorte a la vista** (ADR 0063); ad profit = contratado − gasto ÷ TRM. Los "tres cubos" son las áreas (paid, orgánico, referidos) más las dos cubetas de huérfanos.
- Números de referencia de Pauta: ROAS del corte de julio 1,97, "0,30 sobre contrato" (PQ4).

> ⚠️ **1-oct: abierto.** La migración 0057 quita `cohorts.trm_cohorte` (Mani). De dónde sale la TRM del ROAS es
> la decisión A12 de `docs/plan.md` §7, y se toma antes de E7. Hasta entonces, lo que este documento dice de la
> "TRM de la cohorte" describe la intención, no una columna que exista.
