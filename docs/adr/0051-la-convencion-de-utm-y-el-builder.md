# 0051 — La convención de UTM de Retia y el builder de links

**Fecha:** 2026-09-24 · **Estado:** aceptado (Mani) en la estructura; el catálogo inicial de canales
y su área se cierran con Pauta, Media y Alejo · **Implementación:** tickets 101, 084, 085, 086, 092 ·
**Enmienda:** ADR 0044 punto 1 (cómo el link identifica al closer), ADR 0045 enmienda 2 (qué se
captura), ADR 0046 punto 1 (de dónde sale la URL base) · **Referencia:** el UTM builder de 30X
(`campaigns.oracle30x.co/utm-builder`) · **Origen:** `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §3.3 y §3.4

## El problema

Mani: *"lo más importante es definir claramente las convenciones de UTMs que vamos a trabajar en
Retia para que TODO quede estándar y tracked"*, y replicar el builder de 30X dentro del CRM. Tres
puntos del diseño vigente no alcanzaban:

- El link del closer (ADR 0044) ponía el closer en `utm_campaign`, que según el estándar es **la
  campaña**. Con eso el campo deja de significar lo mismo en todos los links, y el nombre escrito
  revive `Maru`/`maru` (ADR 0030). La revisión del 22-sep (P2) ya lo había marcado.
- El estándar de tres campos (ADR 0045, enmienda 2) dejó `utm_content` y `utm_term` **sin capturar**.
  Lo que no se captura hoy no se recupera nunca (revisión del 22-sep, R6).
- `programs.form_url` (ADR 0046) solo cubre el formulario; el builder de 30X también apunta a
  checkouts.

## Decidimos

**1. Cinco parámetros: tres se leen y dos se capturan.**

| Parámetro | Significa | Lo pone | ¿Lo leen los reportes? |
|---|---|---|---|
| `utm_source` | la plataforma o lugar del clic | el **Canal** | sí |
| `utm_medium` | el tipo de tráfico | el **Canal** | sí |
| `utm_campaign` | la campaña | la **Campaña** del catálogo | sí |
| `utm_content` | quién o qué pieza, según el canal: en Pauta el anuncio (`{{ad.id}}` de Meta); en Closer el **código del closer**; en Media la cuenta o creadora | el builder, según el canal | **solo en el canal Closer**, para escribir `traido_por`. En los demás se guarda y no se lee todavía |
| `utm_term` | variante legible libre (`lanzamiento_octubre`, fecha) | opcional | no |

⚠️ `utm_content` cambia de significado según el canal. Es aceptable **solo** porque el canal lo
declara y **un único módulo** lo interpreta (el emparejador, ticket 085). Leerlo sin mirar el canal
es el error medido el 21-sep (anuncio en ComunicArte, conjunto en Tactical).

**2. El Canal es el "Origen" del builder: un par `utm_source + utm_medium` con su Área.** Es catálogo
del molde (ADR 0012). Se llama **Canal** en el modelo porque ya existe una tabla `origenes` (catálogo
del ADR 0015: "agenda del día", "follow-up") con otro significado. El área de un lead **se deriva** del
canal de su envío (ADR 0043 punto 3), así que el mapeo UTM → área que pidió Alejo **es el catálogo de
canales**.

**3. El link del closer:** `utm_source=closer`, `utm_medium=referido`, `utm_campaign=<campaña de
referidos del programa>`, `utm_content=<código opaco del closer>`. El código lo genera el CRM (nunca el
nombre). **Cero cambios en Typeform:** el formulario ya captura `utm_content` como campo oculto.
Enmienda el ADR 0044 punto 1; el resto de ese ADR (FK real, el primero gana, no auto-asigna) sigue.

**4. Reglas de forma, que aplica el builder y nadie recuerda:** minúsculas, `snake_case`, sin tildes ni
espacios, solo `a-z`, `0-9` y `_`. **Ningún link se arma a mano.** Se conserva `facebook` (no `meta`)
para no romper el histórico, que trae `facebook / cpc`; los valores viejos (`instagram rosario /
linktree`) se clasifican hacia atrás, no se reescriben (ADR 0004).

**5. El builder v1 replica el de 30X, adaptado:**

| Sección | En Retia |
|---|---|
| Destino | **catálogo por programa**: la URL del formulario y las URL de checkout. Enmienda el ADR 0046 punto 1: `programs.form_url` pasa a ser uno de los destinos del programa |
| Origen | el **Canal** (fija source y medium, y muestra el área) |
| Campaña | el catálogo de **Campañas** del programa, creado dentro del CRM |
| Opcional | `utm_content` y `utm_term`, con "usar fecha de hoy" |
| URL final | copiar. **El link no se guarda: se calcula** (ADR 0046) |

Fuera de v1: URL libre y el acortador de links con analítica de clics.

**6. Crear una campaña escribe su regla de clasificación en la misma operación** (ADR 0046 punto 3,
intacto): el link y la regla que lo reconoce no pueden discrepar.

**7. Checkouts: destino ya, venta automática después.** El builder genera links a checkouts con UTM.
Que la venta vuelva sola al CRM (webhook de Hotmart, PayPal, MercadoPago) es una integración posterior;
mientras tanto el closer registra el abono.

**8. Las dos cubetas de huérfanos siguen** (ADR 0045): *sin UTM* y *sin clasificar*, siempre visibles,
nunca juntas.

## Lo que queda abierto

- El catálogo inicial de canales y el área de cada uno (Lead magnet, WhatsApp masivo, Juanito).
- Que Pauta adopte el builder y el `{{ad.id}}` en `utm_content`.
- Qué checkouts usa Retia hoy y si mandan webhooks.

## Consecuencias

- `utm_patron` (ADR 0045) se expresa como **Canal** (source + medium) y **Campaña** (campaign). Los
  patrones para valores históricos se conservan como reglas del canal.
- `submissions.utm_content` y `utm_term` dejan de ser "columnas deliberadamente sin leer": se capturan
  siempre, y `utm_content` se lee solo en el canal Closer.
- `AGENTS.md` cambia la regla y el contrato de "qué significa cada campo UTM".

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Solo tres campos, sin capturar los otros dos | Lo que no se captura hoy no se recupera; capturar no obliga a leer |
| Los cinco campos, todos leídos | Reabre la reconciliación entre programas que la enmienda 2 del ADR 0045 cerró |
| Parámetro propio `ref=<código>` para el closer | Semántica más limpia, pero exige un campo oculto nuevo en cada formulario |
| `utm_campaign=<closer>` (ADR 0044 original) | La campaña deja de significar lo mismo en todos los links |
| Llamar "Origen" al catálogo | Choca con la tabla `origenes` que ya existe con otro significado |
