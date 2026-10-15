---
id: 259
etapa: hub
serves: "ADR 0089 puntos 2 y 4 (la segunda excepción a \"nada es público\")"
depends: [258, 265]
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

---

## Enmienda 14-oct (Mani, tras la primera sincronización real del 120)

- **El Hub también dispara la sincronización al abrirse**, además de este endpoint: si la última corrida de
  `pauta_sincronizaciones` tiene más de 1 hora, la página muestra lo último y sincroniza de fondo con `after()` de
  Next (no espera ni carga al navegador). El candado del 120 evita dos corridas a la vez.
- **Corrida liviana durante el día:** solo los insights de hoy, y el árbol solo si tiene más de 24 h. La completa
  (7 días y el árbol) sigue siendo la del cron diario. Medido el 14-oct: la completa tarda 107 s con los tres
  programas; la liviana debería quedar en segundos (nota de cierre con lo medido).
- Done cuando, además: abrir el Hub con la última corrida vieja dispara una sola corrida liviana y la página no la
  espera, con test; con una corrida de hace menos de 1 hora, no dispara nada.

---

## Enmienda 15-oct (Mani, ADR 0089 enmendado): el endpoint responde "qué mandar ahora"

- **Depende además del 265** (la configuración del reporte por programa).
- La respuesta deja de ser "el semáforo de todos los programas": es **la lista de envíos que tocan en este instante**
  según la regla del 265 (programas encendidos con ese horario, en día hábil), cada uno con: el programa, el destino
  (id del grupo), si es de día o de cierre, y **solo las métricas encendidas** para ese programa, con su semáforo
  (258). Sin envíos que toquen: lista vacía, 200.
- Además devuelve **la configuración vigente** (destinos y horarios de cada programa encendido), para que Juanito
  guarde la última buena y pueda avisar si el CRM no responde (ADR 0089 enmendado, punto 4).
- La lista blanca del test de contrato agrega `destino`, `tipo` (día o cierre) y `metricas`; sigue sin nombres,
  correos, teléfonos ni ids de lead.
- Done cuando, además: a una hora sin envíos devuelve lista vacía; una métrica apagada no aparece; un programa
  apagado no aparece; con tests sobre el handler real.
