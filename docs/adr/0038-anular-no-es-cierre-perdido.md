# 0038 — Anular no es Cierre Perdido

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 21-sep; decision **D3** del plan v2) ·
**Implementacion:** etapa 1 del plan v2 · **Amplia:** ADR 0026 (la anulacion llega a `deals`) ·
**Aplica:** ADR 0027, ADR 0037

## El problema

Lo pregunto Mani el 21-sep: si un deal se puede marcar Cierre Perdido, **¿para que existe ademas
anular?** Con diez etapas y una de ellas terminal-negativa, parece que sobra una.

No sobra: son dos hechos distintos, y confundirlos rompe la metrica que el CRM existe para
producir.

| | **Cierre Perdido** | **Anulado** |
|---|---|---|
| Que es | un resultado del negocio: el lead dijo que no | una correccion de tecleo: el registro nunca debio existir |
| ¿Cuenta en el embudo? | **si**, es un deal perdido | **no**, en ninguna metrica |
| Motivo | obligatorio, de negocio (precio, horario, sin fit) | obligatorio, de correccion |
| Se recupera | si, a cualquier etapa con motivo | no aplica: se corrige y ya |

🩸 **Si los fundimos, un error de dedo se convierte en una venta perdida y la tasa de conversion
miente.** Un closer que crea un deal duplicado y lo "cierra perdido" para limpiarlo esta metiendo
un no del cliente que nunca ocurrio. Es exactamente la clase de bug del que este repo ya sangro
tres veces: **una cifra creible, equivocada, que no lanza ningun error** (el centinela del ano 1,
la subconsulta correlacionada, `Mani` vs `mani`).

El ADR 0026 existe justo para separar *"esto paso y salio mal"* de *"esto nunca paso"*. Lo unico
que faltaba era extenderlo al objeto nuevo.

## Decidimos

**1. Se conservan las dos, y son ortogonales.** Cierre Perdido es la etapa 10. Anulado es una
**marca**, no una etapa numero 11.

**2. `deals` lleva `anulado_por`, `anulado_en`, `anulado_motivo`**, igual que hoy `calls`, `sales`
y `abonos` (ADR 0026). **Un deal en CUALQUIER etapa puede resultar un error** —sobre todo los
manuales (ADR 0021)—, asi que la marca no puede vivir dentro del eje de las etapas: si fuera la
etapa 11, anular un deal borraria el dato de en que etapa estaba cuando se descubrio el error.

**3. `vigente()` de `lib/queries/vigente.ts` se extiende a `deals`, y su guardian con el.** Toda
lectura de `deals` en `lib/`, `app/`, `components/` o `scripts/` decide explicitamente: `vigente(deals)`
o `incluyendoAnulados(deals)`. Las metricas no cambian de forma, porque ya saben ignorar lo anulado.

⚠️ **El riesgo no es escribir la anulacion: es olvidar una consulta.** Un deal anulado que se cuela
en un conteo infla una cifra que se ve perfectamente creible. Por eso el guardian no es opcional y
se **muerde en los dos sentidos** antes de darlo por bueno: caza una consulta sin predicado **y**
no marca la solucion (ADR 0026 punto 3; el guardian del molde de catalogo paso en verde con un
`DELETE` clandestino inyectado y por eso esta regla esta escrita).

**4. Nunca se borra.** Un deal anulado se queda en la base con quien, cuando y por que. Es la misma
regla del ADR 0026 y de F-06: el CRM no borra, cambia de estado.

**5. La anulacion se propaga hacia abajo, no hacia arriba.** Anular un deal anula sus calls y
abonos por arrastre (ADR 0026 punto 2 aplicado al padre nuevo). Anular un abono **no** anula el
deal: un pago mal tecleado es un pago mal tecleado, y el deal sigue siendo una oportunidad real.
⚠️ Lo que si tiene que pasar al anular un abono es que la **etapa se recalcule** por el motor del
ADR 0037: si el deal estaba en Completo porque ese abono dejaba el saldo en 0, deja de estarlo. Un
Student que no pago es la cifra inflada de esta familia.

## Consecuencias

- **A favor:** la tasa de conversion cuenta noes reales. "Perdimos 40 deals este mes" significa
  cuarenta personas que dijeron que no.
- **A favor:** el closer tiene un remedio barato para un error de dedo y no necesita inventarse un
  motivo de negocio para limpiarlo. **Un remedio caro se usa mal.**
- **En contra:** dos conceptos que hay que explicar en el onboarding de un closer, y que a primera
  vista se parecen. La pantalla tiene que hacer la diferencia obvia: "me equivoque al registrar"
  frente a "el lead dijo que no", nunca "anular" y "perder" a secas.
- **En contra:** un closer puede usar la anulacion para esconder un no. Es riesgo de proceso, no de
  esquema, y el rastro lo hace visible: quien anulo, cuando y por que queda escrito (ADR 0042),
  y un gerente puede mirar quien anula mucho.
- **Ojo con la etapa 7.** La migracion one-time trae registros historicos incompletos. Un registro
  que no se entiende **no se anula**: anular significa "esto nunca paso", y de la hoja si paso. Lo
  que no se pueda clasificar queda visible con su rareza, no marcado como inexistente.

## Alternativas descartadas

**Fundir las dos en Cierre Perdido con un motivo "error de registro".** Es la propuesta que Mani
puso sobre la mesa y la que este ADR rechaza. Pone la correccion **dentro** del embudo: el deal
sigue contando como cerrado-perdido en toda consulta que no filtre por ese motivo, y basta que una
consulta lo olvide para que la tasa mienta. Es el mismo error que el ADR 0026 previno en `calls`.

**Un `deleted_at` generico en vez de la terna `anulado_*`.** Pierde el **motivo** y el **quien**,
que son la mitad del valor. Y el repo ya tiene la terna en tres tablas: una cuarta forma de decir
lo mismo es la divergencia que el invariante 1 del plan prohibe.
