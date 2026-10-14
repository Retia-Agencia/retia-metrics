---
id: 259
etapa: hub
serves: "ADR 0089 puntos 2 y 4 (la segunda excepción a \"nada es público\")"
depends: [258]
status: todo
---

# 259 — El endpoint de máquina del semáforo

## Objetivo

Que Juanito pueda pedirle al CRM, con un secreto, que sincronice el día en curso de Meta y le devuelva el semáforo ya
calculado, sin ver nunca un dato de una persona.

## Alcance

- **Dentro:** una ruta (`app/api/...`, el nombre lo fija el ticket) que acepta un `POST` con el secreto en una cabecera,
  comparado en tiempo constante. Sin secreto o con uno malo: 401 sin cuerpo útil. El secreto vive en Vercel y en el
  `.env` de Juanito (regla de secretos de `AGENTS.md`); nunca en el repo ni en un chat.
- **Dentro:** al llamarla, corre `sincronizarDiaEnCurso()` (245; no le pega a Meta si la última foto es reciente) y
  devuelve el semáforo (258) del momento, en JSON validado con zod: programa, campaña, color, gasto, moneda, agendas,
  costo, umbral, comparación contra ayer a la misma hora, días seguidos en rojo, nota de calidad del dato, la hora de
  la última sincronización y el tipo de corrida (de día o de cierre). **Ningún nombre, correo, teléfono ni id de lead.**
- **Dentro:** un test de contrato que recorre la respuesta y falla si aparece un campo fuera de la lista blanca.
- **Dentro:** `AGENTS.md`: la restricción "nada de la app es público" nombra esta segunda excepción, y una fila nueva
  en Contratos ("Qué sale por el endpoint del semáforo").
- **Dentro:** el cron diario de Vercel que cierra el día (re-lee siete días, 120) se verifica dentro del límite de
  Hobby (R3).
- **Fuera:** el mensaje y los horarios (260).

## Done cuando

- [ ] Sin secreto, 401 y la base no se mueve; con secreto, el semáforo, con test que invoca el handler real.
- [ ] El test de la lista blanca muerde en los dos sentidos (un campo de más lo rompe).
- [ ] Dos llamadas seguidas hacen una sola lectura de Meta, con test.
