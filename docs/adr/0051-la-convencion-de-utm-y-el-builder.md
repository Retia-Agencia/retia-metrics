# 0051 — La convención de UTM de Retia, y el CRM como generador de todos los links

**Fecha:** 2026-09-24 · **Reescrito:** 2026-09-27 (consolida el ADR retirado 0046) · **Estado:**
aceptado en la estructura; el catálogo inicial de canales y su área se cierran con Pauta y Alejo ·
**Implementación:** tickets 092, 101, 084, 085, 086 · **Referencia:** el builder de 30X
(`campaigns.oracle30x.co/utm-builder`)

Mani, 24-sep: *"lo más importante es definir claramente las convenciones de UTMs que vamos a trabajar
en Retia para que TODO quede estándar y tracked"*. Los closers lo marcaron como prioridad altísima el
mismo día, y Jero consigue la reunión con Pauta.

## Decidimos

**1. Cinco parámetros: tres se leen y dos se capturan.** Iguales para todos los programas; minúsculas,
`snake_case`, sin tildes ni espacios (`a-z`, `0-9`, `_`).

| Parámetro | Significa | Lo pone | ¿Lo leen los reportes? |
|---|---|---|---|
| `utm_source` | la plataforma o lugar del clic | el **Canal** | sí |
| `utm_medium` | el tipo de tráfico | el **Canal** | sí |
| `utm_campaign` | la campaña | la **Campaña** del catálogo | sí |
| `utm_content` | quién o qué pieza, según el canal: en Pauta el anuncio (`{{ad.id}}` de Meta), en Closer el código del closer, en Media la cuenta o creadora | el builder, según el canal | **solo en el canal Closer**, y solo el emparejador, para escribir `traido_por` (ADR 0044) |
| `utm_term` | variante legible libre (`lanzamiento_octubre`, una fecha) | opcional | no |

⚠️ `utm_content` cambia de significado según el canal. Es aceptable **solo** porque el canal lo
declara y **un único módulo** lo interpreta. Leerlo sin mirar el canal repite el error medido el 21-sep
(anuncio en ComunicArte, conjunto en Tactical). Se conserva `facebook` (no `meta`) para no romper el
histórico; los valores viejos (`instagram rosario / linktree`) se clasifican hacia atrás con reglas del
canal, no se reescriben (ADR 0004).

**2. El Canal es el "Origen" del builder:** un par `utm_source + utm_medium` con su Área (ADR 0043).
Se llama Canal porque ya existe la tabla `origenes`, con otro significado. **El mapeo UTM → área que
pidió Alejo es este catálogo.**

**3. El CRM es el registro y el GENERADOR de los links**, no el administrador de Meta. Cada programa
tiene sus **destinos**: la URL pública de su formulario (`programs.form_url`, que hoy no existe en el
esquema) y las URL de sus checkouts. Un link es destino + canal + campaña + los dos opcionales, y es
**derivado, nunca guardado**: un link guardado y el formulario cambiado son dos verdades. Hay **una sola
función** que arma links, para las campañas y para el link del closer.

**4. 🎯 Crear una campaña escribe su regla de clasificación en la misma operación.** Con macros de Meta
hay dos actos independientes que tienen que coincidir (configurar Meta y escribir el patrón); con el
link generado hay uno solo, y **no pueden discrepar por construcción**. Por eso el estándar deja de
depender de que alguien lo recuerde: el trafficker pega un link que ya trae los UTM correctos. El
incumplimiento pasa de detectable a imposible por el camino normal. Sigue siendo detectable, no
imposible, para lo que el CRM no genera: lo orgánico de Media, el histórico y un link armado a mano.

**5. El builder v1** replica el de 30X: destino (catálogo del programa), origen (el Canal, que fija
source y medium y muestra el área), campaña (catálogo del programa), los dos opcionales con "usar fecha
de hoy", y copiar. Lo usan el gerente y el Paid Trafficker (ADR 0052); el closer tiene "Mi link", ya
prellenado. **Fuera de v1:** URL libre y el acortador con analítica de clics.

**6. Los links de campaña no son recursos.** Un recurso (ADR 0017) es material que un closer le manda
a un lead; un link de campaña es infraestructura de captación que existe para ser rastreada. Dos
dominios, dos pantallas; lo único compartido es el generador.

**7. Checkouts: destino ya, venta automática después.** El builder genera links a checkouts con UTM.
Que la venta vuelva sola al CRM (webhooks de Hotmart, PayPal, MercadoPago) es una integración posterior;
mientras tanto el closer registra el abono.

## Abierto

- El catálogo inicial de canales y el área de cada uno (en `docs/structure.md`, con lo que sigue 🔴).
- Que Pauta adopte el builder y el `{{ad.id}}`; si además se capturan `utm_id` y `fbclid` (R6).
- Qué checkouts usa Retia hoy y si mandan webhooks.
- ⚠️ El árbol de campañas del CRM puede divergir del de Meta y el CRM no lo sabe: solo puede decir
  "esta campaña no trae leads desde tal fecha", que no distingue una campaña pausada de una cara.
