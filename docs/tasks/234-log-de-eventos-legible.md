---
id: 234
etapa: ficha
serves: "Michael, 12-oct: el log de eventos muestra código (ids, ownerNovedadEn, queryChunks) (A-145)"
depends: []
status: done
---

# 234 — Log de eventos en texto para quien no es developer, y sin SQL guardado como valor

## Por qué existe

En la ficha de un deal, "Log de eventos → Ver campos" muestra los nombres de columna y los UUID tal cual
(`ownerUserId: e3f5… → 544a…`, `cohortId`, `leadId`, `submissionOrigenId`…). Para un closer o un gerente eso es ruido.
Y hay un **bug de datos**: `ownerNovedadEn` aparece como `{"decoder":{},"queryChunks":[{"value":["clock_timestamp()"]}],…}`.
`cambiarDuenoDeal` (`lib/deals/cambiar-dueno.ts:18`) escribe ``sql`clock_timestamp()` `` y el rastro
(`lib/crm/rastro.ts`) pasa ese objeto de drizzle a `textoDeBitacora`, que lo serializa como JSON. La bitácora debe
guardar el valor que quedó escrito, no la expresión. Lo mismo puede pasar en `lib/deals/mover-etapa.ts` (`fecha:
sql\`clock_timestamp()\``) si esa escritura va por el rastro.

## Qué se construye

1. **Bitácora honesta:** cuando un valor de la escritura es una expresión SQL, el rastro registra el valor que quedó
   en la fila (lo que devuelve el `returning`), no la expresión. Un guardian o test: ningún `valor_nuevo` de
   `change_log` puede ser un objeto SQL serializado. Las filas ya escritas con `queryChunks` en producción: el ticket
   deja la consulta que las cuenta; arreglarlas o no lo decide Mani (escritura en producción, la sesión principal).
2. **Log legible por rol:** una pregunta nueva en `lib/auth/roles.ts` (p. ej. `veDetalleTecnico`, la cumple solo el
   developer; nunca `rol === "developer"` en la pantalla). Para quien no la cumple:
   - cada campo con etiqueta en español (Etapa, Dueño, Cohorte, Pendiente, Monto…), no el nombre de la columna;
   - los ids se resuelven a nombres (dueño → nombre del usuario, cohorte → su código, etapa → `nombreDeEtapa`);
   - los campos internos (ids de lead, programa, envío de origen, `ownerNovedadEn`, `setterUserId` si no aplica…) no
     se muestran; un evento que solo tocó campos internos no se muestra;
   - "Deal editado · ownerUserId, ownerNovedadEn" pasa a algo como "Cambio de dueño: Maru Marquez → Andrea Machado".
   El developer sigue viendo todo como hoy. La resolución de nombres va en la consulta del servidor
   (`lib/queries/ficha-deal.ts`), no en el cliente.

## Done cuando

- [ ] Test: el rastro de `cambiarDuenoDeal` guarda una fecha ISO en `ownerNovedadEn`, no `queryChunks`.
- [ ] Test de la consulta: para un closer el evento de cambio de dueño trae etiquetas y nombres y no trae ids; para
      el developer trae los campos crudos.
- [ ] `npm run build` limpio (toca un componente cliente).

## Cierre

Filas con `queryChunks` en producción: 574, corregidas el 12-oct con el ok de Mani (ver handoff). Quedan 0.

## Anotaciones

A-145.
