---
id: 323
etapa: media
serves: "ADR 0111 punto 1 y 2c"
depends: [322]
status: todo
---

# 323 — La fachada del CRM para n8n y el repunte de los workflows

## Alcance

- Rutas con secreto (comparado en tiempo constante, molde de `/api/semaforo/*`): la configuración de una corrida
  (lo que hoy da `run-plan` del cockpit) y la escritura de candidatos y de propuestas de referentes. Entrada validada
  con zod; respuesta con esquema `.strict()`. Un solo módulo (`lib/media/motor.ts`) habla con n8n.
- El proxy deja pasar esas rutas sin sesión, como las del semáforo.
- Repuntar el motor de reels y el de descubrimiento a la fachada, en n8n, con una corrida de prueba comparada contra
  la última corrida en el cockpit. Desde ese día el cockpit queda de solo lectura.
- Editar los workflows de n8n pide el ok de Mani.

## Done cuando

- Tests de las rutas: sin secreto 401 sin cuerpo; entrada inválida 400; nada personal en la respuesta.
- Una corrida real del motor escribió sus candidatos en el CRM.
