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

---

## Enmienda 15-oct (Mani, ADR 0089 enmendado): Juanito solo pregunta y manda

- **Los horarios y el destino ya no son configuración de Juanito**: los decide el CRM (265). El job llama al endpoint
  en cada hora en punto de días hábiles (horario fijo amplio, p. ej. 6 a 19 h) y manda lo que la respuesta diga, a su
  destino. En el `.env` quedan solo la URL del endpoint y el secreto (el job se autodesactiva sin ellos).
- **Guarda la última configuración buena** que trae la respuesta (destinos y horarios). Si el endpoint falla en una
  hora en la que esa configuración tenía envíos, avisa a esos destinos que no hay datos; si nunca recibió una, solo
  lo registra.
- El mensaje arma **solo las métricas que vengan** en la respuesta (las encendidas en el CRM), con el formato de 30X.
- Done cuando, además: con una respuesta de dos programas manda dos mensajes a sus dos destinos; con lista vacía no
  manda nada; con el endpoint caído avisa a los destinos guardados; con tests en el repo de Juanito.
