# 0056 — El motor decide quién mueve, con qué motivo y con qué datos

**Fecha:** 2026-09-27 · **Estado:** aceptado (Mani, 27-sep) · **Implementación:** ticket 103 (hecho, migración
0026) y ticket 104 (el contenido de las listas, bloqueado por los closers) · **Toca:** ADR 0037 (el motor),
ADR 0015 (los motivos como catálogo), ADR 0053 (la fecha límite)

## El problema

El motor de etapas del 045 (`lib/deals/mover-etapa.ts`) validaba la flecha y su requisito, pero dejaba
cuatro preguntas afuera o mal contestadas. Ninguna de ellas lanzaba un error: todas daban cifras creíbles
y equivocadas.

1. **Próxima Cohorte mudaba el deal de cohorte** (`cohort_id` pasaba a la futura), así que la conversión
   de la cohorte de origen perdía ese deal.
2. **Había una sola lista de motivos,** y "por qué perdemos" se mezclaba con "por qué hizo falta otra llamada".
3. **"Quién puede mover qué deal"** quedaba en manos de la pantalla: una segunda puerta que alguien olvida.
4. **El requisito se escribía en una operación y el movimiento en otra:** si la segunda fallaba, quedaba
   la fecha puesta y el deal sin mover.

## Decidimos

1. **Próxima Cohorte guarda las dos cohortes:** `cohort_id` es la de origen y no se toca;
   `cohorte_destino_id` es a la que va. La destino tiene que ser del mismo programa y distinta de la de origen.
2. **Cuatro listas de motivos, por tipo:** `motivos.tipo` es un `pgEnum` (`perdida`, `reagenda`,
   `retroceso`, `recuperacion`). Es un tipo porque el motor decide con él (ADR 0012); los motivos en sí
   siguen siendo filas editables. La flecha dice qué lista acepta, como dato en `lib/deals/etapas.ts`:
   P acepta `perdida`, T29 `reagenda`, T15 `retroceso` y R `recuperacion`. A1 y A2 (anular un abono)
   no piden motivo del catálogo: su razón es el motivo en texto de la anulación del abono (ADR 0026,
   obligatorio; Mani, 28-sep). Un motivo de otra lista cuenta como "sin motivo".
3. **Mueven el dueño del deal y quien administra** (`esAdministrador`), y lo revisa el motor. Un closer
   no mueve un deal sin dueño hasta reclamarlo; un administrador sí puede.
4. **El requisito se llena en el mismo movimiento, como en HubSpot.** `moverEtapa` recibe los datos que
   pide la flecha (producto, fecha límite, acuerdo de pago, cohorte destino, fecha de seguimiento), los
   escribe con rastro (`editarConRastro`) y mueve el deal, todo en una transacción. Si el movimiento se
   rechaza, no queda nada escrito. **Lo que prueba que algo pasó nunca entra por ahí:** llamadas,
   contactos y abonos se leen de la base.
5. **La llamada que cuenta es la más reciente.** Con "un deal, muchas llamadas" (ADR 0037), el `show` de
   una llamada vieja no lleva a Atendido.
6. **Al perder, el motivo se escribe también en `deals.motivo_id`,** no solo en el historial.

## Consecuencias

- **El contenido de las listas** salió de la taxonomía que el equipo ya usa en las hojas, estandarizada y
  reducida a 13 motivos (ticket 104, cargado en `dev` el 27-sep con `npm run cargar-motivos`). Toda base
  nueva lo corre después de las migraciones, porque la 0004 siembra las 8 semillas viejas.
- **La pantalla del catálogo de motivos** tiene que dejar elegir la lista (hoy crea con `perdida` por defecto).
- **Quien llame al motor** (el 052, el 060 y la UI) pasa el `Actor` con su rol de vista (ADR 0028).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mudar `cohort_id` a la cohorte futura | La cohorte de origen pierde el deal en su conversión |
| Una sola lista de motivos | El reporte de pérdida se mezcla con los de re-agenda |
| Dejar los permisos a la pantalla | Una segunda puerta que el próximo llamador olvida |
| Mirar todas las llamadas para "sucedió" | Una llamada vieja habilita Atendido en la segunda |
