# 0040 — El sync se dispara por capas: la hoja avisa, la app despierta, el cron es la red

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 21-sep; decision **D4** del plan v2) ·
**Implementacion:** etapa 3 del plan v2 · **Enmienda:** ADR 0007 (no lo reemplaza: lo rodea) ·
**Aplica:** ADR 0031 (el candado ya existe y ninguna capa necesita nada nuevo)

## El problema

El ADR 0007 decidio en septiembre que el cron corre **una vez al dia** porque *"el plan Hobby de
Vercel no permite crons mas frecuentes"*, y dejo el boton "Sincronizar ahora" como valvula. La
consecuencia que ese ADR registro con honestidad: *"el dashboard no es tiempo real, es una foto
diaria"*.

El modelo v2 no sobrevive a una foto diaria. Un lead que agenda a las 9am aparece en el CRM **al
dia siguiente**, o sea que el Kanban, el reclamo de Unclaimed y la Call creada por el sync llegan
tarde a la unica hora en que sirven. El insumo §5.5 pedia 15 minutos.

**Medido el 21-sep por la API de Vercel:** team `agencia-dani`, plan **`hobby`**, `vercel.json` con
un cron diario (`0 12 * * *`). 🎯 **Los 15 minutos no existen sin pagar Pro.** Eso contesta la
pregunta abierta §12.1 del insumo con un dato y no con una opinion, y cambia el papel de las otras
capas: dejan de ser refuerzo y **pasan a ser el mecanismo**.

## Decidimos

Cuatro capas, todas sobre **la misma funcion HTTP** (`/api/cron/sync`, protegida con `CRON_SECRET`).
"El cron" nunca fue mas que un reloj que la llama; agregar relojes no toca el motor.

| Capa | Que es | Papel |
|---|---|---|
| **Aviso de la hoja** | trigger `onChange` de Apps Script que hace `POST /api/cron/sync` con el secreto cuando cae una fila | **el mecanismo principal**. Casi tiempo real, $0 |
| **Sync perezoso** | al abrir la app, si el ultimo sync tiene mas de 15 min, se dispara en segundo plano | cubre al equipo que entra a trabajar |
| **Boton manual** | ya existe | se conserva tal cual |
| **Cron diario de Vercel** | lo unico que Hobby permite | **red de seguridad**, se conserva tal cual |
| **Webhook propio del CRM** | los forms (Dapta) escriben directo; **la misma funcion de ingesta** | la meta. La etapa 3 deja el enganche |

**Por que Apps Script puede hacer esto.** Apps Script **si** puede llamar hacia afuera
(`UrlFetchApp`); lo que no puede es recibir una peticion firmada. El aviso va en la direccion que
funciona: la hoja empuja, el CRM no consulta.

**Por que ninguna capa necesita codigo nuevo en el motor.** El candado del **ADR 0031** ya lo
resuelve: el INSERT de la corrida **es** el candado, contra un indice unico parcial
`WHERE estado = 'corriendo'`. Dos disparos simultaneos no se pisan, el segundo recibe **409**, y
eso **no es un fallo**: el cron lo cuenta como `omitidos`. Multiplicar los relojes era seguro
justamente porque esa decision ya estaba tomada.

⚠️ **El secreto viaja en el Apps Script de la hoja.** Quien pueda editar la hoja puede leerlo. Se
guarda en las **Script Properties** del proyecto de Apps Script, no en el cuerpo del script, y
sigue rotandose con `npm run cron-secret`. El dano de que se filtre esta acotado: lo unico que
habilita es **disparar un sync**, que es idempotente y no expone ningun dato del negocio.

## Enmienda al ADR 0007

**Lo que se conserva:** el cron diario de Vercel, tal cual, con su `schedule` en `vercel.json`. Y
la razon original: en Hobby no hay otra cosa.

**Lo que cambia:** deja de ser **la** forma de sincronizar y pasa a ser **la ultima**. La frase
*"el dashboard no es tiempo real, es una foto diaria mas lo que el gerente refresque a mano"* se
sustituye por: **el dashboard se refresca cuando la hoja cambia**, y el cron existe para el caso en
que el aviso no llegue (trigger borrado, cuota de Apps Script, la hoja editada sin disparar
`onChange`).

**Lo que NO cambia y hay que decir en voz alta:** una alerta que asuma frescura de minutos sigue
sin poder asumirla como garantia. El aviso de la hoja es *best effort*; la garantia dura sigue
siendo diaria. Cualquier funcion que dependa de frescura tiene que degradar bien, no romperse.

**Como se revierte a lo de antes:** quitar el trigger de la hoja. Nada en el codigo esta atado a la
frecuencia; el sync es idempotente y correrlo mas seguido no rompe nada (eso ya lo decia el 0007 y
sigue siendo cierto).

## Consecuencias

- **A favor:** casi tiempo real por $0, sin subir de plan. Si algun dia se paga Pro, el cron de 15
  minutos entra como **una capa mas** y no obliga a rediseñar nada.
- **A favor:** la ingesta por webhook (Dapta) no es un camino nuevo: es la misma funcion con otra
  puerta. Ese es el invariante 2 del plan v2.
- **En contra:** aparece una pieza de codigo **fuera del repo** —el Apps Script vive en la hoja— y
  nadie la versiona. Se documenta en `docs/estructura-bbdd.md` con el script completo, y la alerta
  de "tres fallos seguidos" (insumo §5.6) es lo que revela que dejo de dispararse.
- **En contra:** mas disparos = mas corridas. A 4.791 leads el sync completo tarda ~3,2 s medidos
  en produccion el 20-sep, asi que el costo es despreciable **a esta escala**. Si el volumen se
  multiplica por diez, la capa a revisar primero es el sync perezoso, que es la que puede disparar
  por cada usuario que abre la app.
