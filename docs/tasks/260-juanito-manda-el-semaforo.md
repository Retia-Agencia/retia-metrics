---
id: 260
etapa: hub
serves: "ADR 0089 punto 3 · docs/hub.md O4"
depends: [259]
status: todo
repo: "Juanito (~/Desktop/mani/work/30X/repos/Juanito), no este"
---

# 260 — Juanito manda el semáforo por WhatsApp

## Objetivo

Que el semáforo de pauta de Retia llegue por WhatsApp en horario hábil y con un resumen al cierre, con el formato de
30X, sin que nadie lo arme.

## Alcance

- **Se implementa en el repo de Juanito**, siguiendo su `CLAUDE.md`: un job nuevo en `src/scheduler/` que se
  autodesactiva si le falta el secreto o el destino; toda llamada saliente con `fetchConDeadline`; todo envío por la
  cola anti-ban (`src/whatsapp/send-queue.js`); el despliegue por su workflow.
- **Dentro:** en los horarios que se decidan (HQ-3; 30X: 7, 9, 11, 13 y 15 h, y el resumen de las 18 h), llama al
  endpoint del 259 y arma el mensaje: encabezado con la hora y el conteo por color, una línea por programa con el
  número y su umbral, y el detalle por campaña de lo rojo y lo amarillo, con la trayectoria del día, los días seguidos
  y la nota de calidad del dato. Si el endpoint falla, lo dice en el mensaje en vez de callarse.
- **Dentro:** el resumen de las 18 h trae el color de cierre y el enlace al Hub (Hoy y Pauta).
- **Dentro:** el destino y quién lo recibe son configuración (HQ-2), no código.
- **Fuera:** responder un rojo desde WhatsApp (radar, ADR 0090 punto 5).

## Done cuando

- [ ] Con el endpoint en modo de prueba, el mensaje sale a un destino de prueba con el formato acordado (captura en el
  ticket).
- [ ] Un endpoint caído produce un mensaje que lo dice, con test en el repo de Juanito.
- [ ] Una semana corriendo sin que nadie lo arme (nota de cierre con lo que llegó).

## Notas

El estado vive aquí (el tracker del CRM); el código y sus tests, en Juanito. Riesgo aceptado: Baileys no es oficial
(ADR 0089, consecuencias).
