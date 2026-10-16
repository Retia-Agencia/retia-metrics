---
id: 271
etapa: entrada
serves: "AI Second Brain Jurídico (EstadoX) recibe sus leads en el CRM desde Form30x (ADR 0092)"
depends: [130, 117]
status: todo · migración
---

# 271 — El adaptador de Form30x

## Por qué

El formulario de AI Second Brain Jurídico vive en Form30x, que no es un proveedor registrado. Sin él no se puede crear
la fuente webhook del programa. Contexto, estado del setup y convenciones en `docs/operations.md` §2.2; decisión en
el ADR 0092.

## Qué

1. **Migración aditiva:** `ALTER TYPE proveedor_formulario ADD VALUE 'form30x'` (la genera y aplica la sesión
   principal, con el ok de Mani; `lock_timeout` al principio).
2. **`PROVEEDORES.form30x`** en `lib/ingesta/proveedores.ts`: `headerFirma: "x-form30x-signature"`,
   `correoPorDefecto: true`, verificación HMAC-SHA256 en tiempo constante con prefijo `sha256=`.
3. **`lib/ingesta/adaptador-form30x.ts`:** `payloadForm30xSchema` (zod) y `entradaDesdeForm30x`:
   - el correo de la respuesta `type: "email"`, el nombre y el WhatsApp por el mapeo de la fuente;
   - toda respuesta entra a `respuestas` por su `question`, las de opción con su `label` (nunca el id);
   - `hidden` completo como UTMs y campos ocultos (los macros sin expandir cuentan como ausentes, ADR 0087);
   - `lead_quality` y `lead_value` desde `tags` (ADR 0092 punto 3); `tag_lead_quality` se ignora;
   - agendó = la respuesta `calendly` con `scheduled: true`; el uuid del invitado sale de `value.invitee` para el 052;
   - el token de idempotencia es `responseId`.
4. **Parciales:** si Form30x confirma un evento de parcial, se adapta con `es_parcial`; si no, no se inventa.

## Fuera de alcance

Crear el programa, la fuente o el secreto (los pone un administrador en la tab Programa) y editar el form.

## Done cuando

- `tests/contrato-proveedores.test.ts` pasa con un cuerpo de Form30x **real** (el envío del 4-oct con agenda, leído
  por `GET /forms/:id/responses` y con los datos personales cambiados), y muerde en los dos sentidos con la firma.
- La codificación de la firma (hex o base64) está fijada con una entrega real guardada en `sobres_crudos`, no
  supuesta.
- Un envío real por camino (descalificado, sin agenda, con agenda, con UTM) revisado en la base: etapa de entrada,
  calidad, valor, UTMs y la llamada de Calendly colgada.
