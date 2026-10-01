# 0039 — Un programa, una fuente de leads activa

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (la fuente es el formulario desde el webhook, T1 del
22-sep) · **Estado:** aceptado; cómo se registra una fuente webhook está abierto (`docs/plan.md` §7, A2)

## El problema

`sources` mezclaba cuatro clases de cosas: los formularios de leads, las pestañas de estudiantes, de
registro de llamadas y de pauta. Era "pestaña de una hoja que el CRM lee", no "de dónde llegan los
leads de un programa". Mani, 21-sep:

> *"Borrar todas. Porque eso era solo para la migración inicial ya que todo se manejaba manual en
> Sheets. Pero cuando el CRM se vuelva el centro, las llamadas, etc. solo van a vivir aquí. Lo único
> que va a entrar de afuera son Leads crudos que llenan un forms de un programa."*

## Decidimos

**1. `sources` significa una sola cosa: la entrada de leads crudos de un programa.** Las 7 filas que
eran de otras pestañas se borraron en la migración 0020, con su columna `destino`. Sus coordenadas
(archivo y pestaña) quedaron en el mapa de las hojas de `docs/structure.md`, que es donde las necesita
la migración de la etapa 7.

> **30-sep: el punto 2 lo enmienda el [ADR 0064](./0064-un-programa-puede-tener-varios-formularios-activos.md):** un programa puede tener varios formularios activos a la vez (migrar de Typeform a Dapta sin perder envíos). El índice se quita con el ticket 131; hasta entonces sigue vigente.

**2. Una sola fuente ACTIVA por programa**, garantizada por el índice parcial
`sources_una_activa_por_programa_idx` (`WHERE activo`). Parcial y no único a secas porque una fuente
se reemplaza alguna vez (de Typeform a otro formulario) y el registro de la anterior no se destruye:
los envíos que llegaron por ella siguen apuntándole. Así quedó `Forms viejo` de ComunicArte: inactiva,
con 55 personas que solo existen ahí y que la etapa 7 recupera con sus envíos. `activarFuente`
traduce el choque del índice a un 409 que dice la regla.

**3. Con el webhook, la fuente es el formulario.** El programa de un envío sale de la fuente
registrada, **nunca de un campo del formulario**, y una fuente desconocida es un error visible, no un
lead en cualquier programa. Hoy `sources` guarda las coordenadas de la hoja (`sheet_id`, pestaña,
zona horaria), que sirven para el traslado único. 🔴 Qué más guarda una fuente webhook (identificador
del formulario, proveedor, secreto) lo decide el contrato del webhook.

**4. La pauta no es una fuente: se captura en el CRM.** Ningún formulario sabe cuánto costó una
campaña. El gasto (`ad_spend`) cuelga de la campaña, por fecha (ADR 0045), y lo carga el gerente o el
paid trafficker desde la app, con su moneda al lado (la pauta va en COP y el ticket en USD).

| | De dónde sale | Dónde vive |
|---|---|---|
| El origen de un lead (UTM) | entra solo con el envío | `submissions.utm_*` (ADR 0036) |
| El costo de una campaña | no lo sabe ningún formulario | se captura en el CRM (`ad_spend`) |

## Consecuencia

El ROAS depende de que alguien **cargue** la inversión. Es frágil en un lugar visible: una cohorte sin
pauta cargada se ve vacía ("sin pauta"), y eso se nota; una pestaña desactualizada no.
