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

**Va en dos fases** (Mani, 15-oct). La firma y los parciales no se pueden saber sin una entrega real, y una entrega
real no se manda a un receptor de terceros (el form está publicado: los leads reales también llegarían ahí).

- **Fase A, mínima, para la prueba:** la migración (punto 1) y el proveedor (punto 2) con una verificación que
  acepta el HMAC en **hex o en base64** y anota en el sobre cuál cuadró. El adaptador puede fallar: la ruta ya guarda
  el cuerpo crudo en `sobres_crudos` apenas la firma cuadra y responde 200 (ADR 0058). Se monta la fuente, Mani
  configura el webhook en *Connect* del form y manda **un envío parcial y uno completo con datos falsos**. Con eso
  se fijan la codificación y si los parciales disparan el webhook.
- **Fase B, completa:** la verificación queda con la codificación medida (la otra se quita), el adaptador
  (punto 3) y los parciales (punto 4), contra los cuerpos reales guardados en la fase A.

1. **Migración aditiva:** `ALTER TYPE proveedor_formulario ADD VALUE 'form30x'` (la genera y aplica la sesión
   principal, con el ok de Mani; `lock_timeout` al principio).
2. **`PROVEEDORES.form30x`** en `lib/ingesta/proveedores.ts`: `headerFirma: "x-form30x-signature"`,
   `correoPorDefecto: true`, verificación HMAC-SHA256 en tiempo constante con prefijo `sha256=`.
3. **`lib/ingesta/adaptador-form30x.ts`:** `payloadForm30xSchema` (zod) y `entradaDesdeForm30x`:
   - el correo de la respuesta `type: "email"`, el nombre y el WhatsApp por el mapeo de la fuente;
   - toda respuesta entra a `respuestas` por su `question`, las de opción con su `label` (nunca el id);
   - `hidden` completo como UTMs y campos ocultos (los macros sin expandir cuentan como ausentes, ADR 0087);
   - `lead_quality` y `lead_value` desde `tags` (ADR 0092 punto 3); `tag_lead_quality` se ignora. Medido con el paso 8
     (15-oct): `tags` trae dos elementos sueltos, `High`/`Low` y uno de `MUY ALTO VALOR`, `ALTO VALOR`, `VALOR MEDIO`,
     `BAJO VALOR` (ej. `["High", "MUY ALTO VALOR"]`); no hay etiqueta compuesta que partir;
   - agendó = la respuesta `calendly` con `scheduled: true`; el uuid del invitado sale de `value.invitee` para el 052;
   - el token de idempotencia es `responseId`.
4. **Parciales:** se prueban con un envío parcial real a la fuente montada (Mani, 15-oct). Si llega, se adapta con
   `es_parcial` según lo que traiga el cuerpo; si no llega, no se inventa.

## Fuera de alcance

Crear el programa, la fuente o el secreto (los pone un administrador en la tab Programa) y editar el form.

## Done cuando

- `tests/contrato-proveedores.test.ts` pasa con un cuerpo de Form30x **real** (el envío del 4-oct con agenda, leído
  por `GET /forms/:id/responses` y con los datos personales cambiados), y muerde en los dos sentidos con la firma.
- La codificación de la firma (hex o base64) está fijada con una entrega real guardada en `sobres_crudos`, no
  supuesta.
- Un envío real por camino (descalificado, sin agenda, con agenda, con UTM) revisado en la base: etapa de entrada,
  calidad, valor, UTMs y la llamada de Calendly colgada.
