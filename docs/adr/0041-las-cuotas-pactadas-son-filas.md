# 0041 — Las cuotas pactadas son filas, no dos campos en el deal

> ⚠️ **Enmendado por el ADR 0053 (24-sep):** en v1 no hay cuotas. Los closers contaron que los acuerdos
> de pago se conversan, no se pactan en cuotas fijas; el deal guarda una nota del acuerdo y una fecha
> límite, y `cuotas_pactadas` se queda quieta. Este ADR sigue siendo la forma correcta **si** algún día
> se cobra cuota por cuota.

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani delego la decision y la confirmo el 21-sep;
**D5** del plan v2) · **Implementacion:** etapa 4 del plan v2 · **Aplica:** ADR 0013, ADR 0024 ·
**Toca:** ADR 0006 (por que esto no es abstraccion especulativa)

## El problema

Un deal casi nunca se paga de una. El insumo §2.4 proponia guardar **`fecha_pago_restante` y
`num_cuotas`** en el deal y calcular `valor_cuota = saldo / num_cuotas`. Mani pregunto cual de las
dos formas es mas sostenible y delego la decision.

**La division asume que las cuotas son iguales.** En el momento en que un plan real no lo sea —un
abono inicial grande y dos cuotas chicas, que es lo normal— ese numero **es falso y no lanza
ningun error**. El closer ve "faltan 2 cuotas de USD 350" cuando lo pactado fue una de 500 y una de
200, y persigue la plata equivocada. Otra vez la familia de bugs de este repo: una cifra creible.

Y hay un segundo agujero, mas practico: con dos campos, la vista de cartera vencida solo puede
preguntar *"¿entro todo el saldo antes de esa fecha?"*. Lo que un closer persiguiendo plata
necesita es *"le falta la cuota 2, vencia el 5 de octubre"*.

## Decidimos

**Tabla `cuotas_pactadas`, desde el arranque.**

```
cuotas_pactadas (deal_id, numero, monto, fecha_pactada, abono_id?)
```

Cada cuota es una fila con **su** monto y **su** fecha. `abono_id` se llena cuando esa cuota se
cumple, y ahi la cartera vencida es una consulta directa: cuotas con `fecha_pactada` pasada y
`abono_id` nulo.

**El deal NO lleva `num_cuotas` por defecto.** Es `count(cuotas_pactadas)`: guardarlo seria una
copia derivada que puede desincronizarse, y este repo ya tiene un ADR entero sobre eso (0024). Si
alguna consulta lo necesita, lo cuenta.

**Lo abonado y el saldo NO cambian de dueno.** Siguen viviendo en `lib/queries/saldo.ts`
(ADR 0024), calculados desde `abonos`. Una cuota es lo **prometido**; un abono es lo **recibido**.
No se confunden ni se derivan uno del otro, igual que caja recaudada y ventas cerradas (ADR 0013).

## Por que esto no es abstraccion especulativa (ADR 0006)

Es la objecion obvia: se esta construyendo una tabla para un caso que todavia no se ha visto en la
base. Tres razones por las que pasa el filtro:

1. **El caso ya esta nombrado como real en el diseno**, no imaginado aqui: el insumo §2.4 dice
   explicitamente *"si hace falta mas de una fecha (cuota 2 el 5-oct, cuota 3 el 5-nov)"*. Y la
   cartera vive hoy repartida en cuatro lugares de las hojas sin dueno.
2. **La alternativa no es mas simple: es mas barata hoy y mas cara despues.** Dos campos + una
   division es menos codigo, pero produce un numero falso en el primer plan desigual, y migrar de
   dos campos a la tabla **con deals vivos** significa inventarse el reparto de los que ya estan.
3. **Hoy la tabla nace con CERO filas que mover.** `abonos` esta en 0 y `sales` en 0 (medido el
   21-sep). El costo de decidir bien es el minimo que va a tener.

El ADR 0006 prohibe instalar un paquete antes del codigo que lo usa y construir configurabilidad
que nadie pidio. No prohibe elegir la forma correcta de un dato que el negocio ya describio.

## Consecuencias

- **A favor:** la cartera vencida responde **por cuota** y no solo por el total. Es la diferencia
  entre una vista que el closer usa y una que mira una vez.
- **A favor:** un plan desigual se representa tal cual se pacto. No hay ningun numero calculado que
  pueda contradecir lo que el lead acordo.
- **En contra:** una pantalla mas para llenar. Mitigacion: el caso comun (dos cuotas iguales) se
  genera con un boton que propone el reparto y **deja editar**, en vez de exigir teclear cada fila.
  Proponer no es asumir.
- **En contra:** aparece un estado nuevo posible: la suma de las cuotas pactadas que **no** cuadra
  con el saldo. No se bloquea (bloquear un cobro real por un dato de configuracion es peor, misma
  logica del ADR 0034), se **muestra**.
- **Ojo:** cuando un abono se anula (ADR 0026), la cuota que lo referenciaba vuelve a estar
  pendiente. El `abono_id` se limpia y la etapa se recalcula por el motor del ADR 0037.

## Alternativas descartadas

**Los dos campos en el deal, y "se escala si el equipo lo pide".** Es lo que proponia el insumo y
es la opcion que este ADR tumba, con el argumento de la cuota desigual. "Se escala si lo piden"
funciona cuando migrar es barato; aqui migrar significa repartir a mano los planes ya pactados.

**Ni cuotas ni fechas: solo el saldo.** Es lo que hay hoy, y es por lo que la cartera vive en
cuatro pestanas de Sheets sin dueno.
