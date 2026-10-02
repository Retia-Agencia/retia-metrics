# 0059 — El deal histórico nace en su etapa, por un template y con su huella

- **Estado:** aceptado · 29-sep-2026 (Alejo, en grill; ok de Mani el mismo día). **El punto 7 lo enmienda el
  [ADR 0071](./0071-como-se-mueve-un-deal-por-las-etapas-de-30x.md) (2-oct):** los cerrados sin monto entran a
  ganado, no a Compromiso Verbal, y se corrigen con el equipo ya en vivo.
- **Relacionadas:** ADR 0004 (se guarda como llegó), ADR 0005 (la garantía vive en un índice), ADR 0027
  (nada de emparejar por heurística), ADR 0029 (un script llama a `lib/`, con su actor), ADR 0030 (el
  closer como texto copiado), ADR 0037 (el deal y el motor), ADR 0038 (anular no es Cierre Perdido), ADR
  0042 (todo movimiento deja rastro), ADR 0056 (el motor decide quién mueve); tickets 077, 078 y 080

## Contexto

La migración de las pestañas de gestión (E7: Setteo, Registro de llamadas, Estudiantes) trae al CRM
lo que pasó **antes** del CRM. Las mutaciones que existen no pueden expresarlo:

- `abrirDeal` solo deja nacer un deal en Pendiente Setteo, En Contacto, Compromiso Verbal o Agendado.
  A Abonado y a Completo se entra por un hecho (un abono), no por un alta.
- `registrarAbono` exige que el actor sea el dueño del deal, y solo Andrea tiene cuenta de closer:
  Maru, Jero, Juanjo, Dana, Sebastian, Michael y juanse no la tienen (medido el 29-sep).
- `agregarLlamada` crea una llamada `agendada` y mueve el deal.
- `deals` no tiene cómo reconocer lo migrado. Un deal en Completo **no ocupa el cupo** del lead (el
  índice es parcial), así que una segunda corrida lo duplicaría **sin un solo error**.
- Ya hay 48 deals vivos en producción, entrados por el webhook desde el 28-sep.

Y la hoja no sabe cuándo pasó cada cosa: los estudiantes de Julio (TI) y Agosto (CA) no traen fecha de
venta, los 10 `Parcial` de Julio no dicen cuánto se cobró, y los `Registro 1-5` no tienen fecha salvo
el primero (y el último en Tactical).

## Decisión

1. **Un deal histórico nace en la etapa que dice la hoja.** Un actor nuevo, `migracion`, puede abrir
   un deal directamente en su etapa (también Abonado, Completo o Compromiso Verbal), con **una** fila de
   historial (`de` nulo) y su rastro. **No se recorre el motor**: la hoja no sabe por qué etapas pasó,
   y un recorrido reproducido con fechas inventadas se vería igual que uno real. El actor `migracion`
   no pasa por `queLeFalta`: lo que la hoja no trae (producto, fecha límite) le falta al deal y la
   Ficha lo dice, como a cualquier otro. Solo el script de migración usa este actor.
2. **Lo migrado lleva huella, y la garantía vive en un índice.** Migración aditiva: `huella_migracion`
   (texto, único parcial `WHERE huella_migracion IS NOT NULL`) en `deals` y en `abonos`; `calls` ya
   tiene `huella_fila`. Formato `sheets:<programa>:<pestaña>:<llave>`. Correr la migración dos veces
   no duplica **porque la base lo rechaza**, no porque un `SELECT` previo lo mire (ADR 0005). La huella
   también le dice a la Ficha que el deal vino de la hoja.
3. **Si el lead ya tiene un deal vivo, gana el vivo.** La migración no lo toca ni le cuelga nada. La
   fila de la hoja no crea otro deal y queda como rareza *"ya tiene deal vivo"*. La excepción sale sola
   del índice: una venta en **Completo** no ocupa el cupo, así que entra como deal cerrado aparte (fue
   otra oportunidad, ya pagada).
4. **Dos pasos: extractor y template, después importador.** El **extractor** lee las hojas y escribe
   un template canónico local, por entidad (deals, actividades, llamadas, abonos, rarezas), revisable a
   mano, **sin tocar la base**. El **importador** es fijo: lee el template y escribe por `lib/`, con
   ensayo (transacción con rollback, como `trasladar`) y `--aplicar`. Un caso raro se corrige en el
   template, no en código. Nunca un `db.insert` crudo (ADR 0029, ticket 078).
5. **El rastro es del script; los hechos, del sistema.** `change_log` lleva el actor de
   `actorDelScript()` (quién corrió la migración). El historial y las actividades van con `user_id`
   nulo (el sistema), y **toda actividad migrada es una `nota`**: un `contacto` exige usuario y no se le
   atribuye a Andrea lo que hizo Jero. El nombre del closer queda como lo escribió la hoja: en el texto
   de la nota, y en `closer_id` de llamadas y abonos (texto copiado, ADR 0030). **Dueño del deal:** solo
   si ese nombre es un usuario del CRM (`mismoCloser`); si no, el deal nace sin dueño (080).
6. **Sin fecha de venta, la fecha es el cierre de ventas de su cohorte, y se marca.** Los abonos de
   Julio (TI) y Agosto (CA) llevan la `fecha_cierre_ventas` de la C1 (CA 11-ago, TI 18-ago): la plata
   cae en la ventana de su cohorte, que es donde pertenece. Cada uno queda como rareza *"fecha
   aproximada"*, para corregirla si alguien tiene el dato.
7. **Lo que no se sabe no se inventa.** Un pago `Parcial` sin monto cobrado, o `Ya pago` en vez de un
   monto, entra como deal en **Compromiso Verbal**, con el precio en el acuerdo y **sin abono**, y queda
   como rareza *"monto cobrado desconocido"*. Una plataforma que no está en el catálogo (Binance,
   `Bootcamp`) o que viene combinada (`hotmart / mercadopago`) deja el abono sin plataforma, marcado como
   rareza. Una rareza **no se anula**: de la hoja sí pasó (ADR 0038).

## Consecuencias

- Una migración aditiva (las dos columnas de huella con sus índices), que genera y aplica Mani. Va junto
  con la tabla de rarezas del 080, que es la lista visible en la app.
- `lib/deals/` gana un escritor para lo histórico (abrir en etapa, abono con fecha, llamada con
  resultado). Es el único que usa el actor `migracion`, y un guardian lo fija, igual que
  `tests/calendly-colgar-guardian.test.ts` fija el origen `calendly`.
- La caja de julio y agosto en el CRM queda aproximada **por día** y exacta **por cohorte**. El
  Dashboard por mes de esas semanas no es comparable con la hoja día a día.
- 🩸 **El template lleva datos personales (correos, nombres): nunca va a git**, vive fuera del repo (o en
  una ruta ignorada). Lo que sí queda en git son las reglas del extractor y sus tests; el *"¿por qué entró
  así?"* de una fila concreta lo responde su huella y su rareza en la base.
