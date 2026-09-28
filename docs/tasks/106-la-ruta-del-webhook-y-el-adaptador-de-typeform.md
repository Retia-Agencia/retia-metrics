---
id: 106
etapa: E3
serves: "ADR 0055 · ADR 0054 (enmienda) · plan §4.3a · hito A"
depends: [105, 051]
status: todo
---

# 106 — La ruta del webhook y el adaptador de Typeform

## Objetivo

Que un envío de Typeform llegue solo al CRM: la ruta verifica, el adaptador traduce y
`ingerirEntradas` escribe. Con esto se cumple la primera mitad del hito A.

## El camino

1. `POST /api/webhooks/formularios/[fuente]`. Si el id no es una fuente webhook activa: 404, sin leer
   el cuerpo (error visible en el log).
2. Firma HMAC-SHA256 sobre el **cuerpo crudo** con el secreto de esa fuente. Si no cuadra: 401.
3. **El adaptador de Typeform** convierte `form_response` en un Envío: respuestas por pregunta, campos
   ocultos (UTM), la variable `estado` (051), el token del envío y si es parcial.
4. `ingerirEntradas` con la regla de deals encendida (052).

## Las reglas

- **Nunca responde con redirección** y la ruta va en la lista pública de `proxy.ts`, o cada envío falla
  sin que nadie lo vea.
- **Un envío que no se puede procesar (firma buena, contenido malo o la ingesta falla): se guarda el
  sobre crudo y se responde 200** (Mani, 27-sep). Así no se pierde el lead y se puede reprocesar.
  Guardarlo es una tabla nueva (migración de la sesión principal) con la fuente, el cuerpo, el error y
  si ya se reprocesó.
- El programa sale de la fuente, **nunca** del payload.
- Idempotente por `(fuente, token, es_parcial)`: el reintento de Typeform no duplica (migración 0022).

## Done cuando

- [ ] Con el payload de ejemplo de Typeform: firma buena crea lead, envío y contactos; firma mala es 401
      y la base no se mueve; el mismo envío dos veces deja una fila.
- [ ] Un payload sin correo queda en la tabla de sobres crudos y la respuesta es 200.
- [ ] Una URL con un id que no es fuente activa es 404.
- [ ] Un envío real de cada Typeform en `dev`, con la variable `estado` y el parcial. El que agenda
      llega con `con_calendly` **y** su link de Calendly en las respuestas (ADR 0054, enmienda); el link
      se guarda en `submissions.respuestas` para el 096.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí el código y los tests, con revisión. La migración de los sobres la escribe y aplica la sesión principal.
