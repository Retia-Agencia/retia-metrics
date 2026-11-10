# 0063 — Las métricas y los objetivos de Pauta: qué cuenta, sobre qué ingreso y contra qué meta

- **Estado:** aceptado · 29-sep-2026 (Mani), todos los puntos (el 5 y el 6 aprobados esa noche). **Enmendado el
  10-nov-2026 (Mani, audit del Hub 403 F1, D-B):** en toda la pestaña Pauta el ROAS es el de la cohorte de registro (abajo).
- **Relacionadas:** ADR 0013 (caja y ventas), 0022 (ventana de la cohorte), 0023 (la meta no se reparte
  entre closers), 0024 (una definición por pregunta), 0043 y 0048 (frontera y agregado), 0045 (regla del
  cero), 0060 (pauta cuenta envíos, venta cuenta deals); tickets 067, 088, 090, 122, 123, 124;
  `docs/analytics.md` DP-5 a DP-7, DP-11, DP-16, DP-23 y DP-24.

## Contexto

Pauta mide costos por etapa (llamada, llamada calificada, show, venta), ROAS por cohorte y el cumplimiento
diario de la meta repartida por canal, con umbrales de "meta" y "aceptable" (costo por agenda: meta
60.000 COP, aceptable 80.000; agendas de paid por día: meta 15, aceptable 10). Ninguna de esas cifras tenía
una definición escrita en el CRM, y el ticket 090 había dejado el hueco del umbral vacío porque no había
umbrales.

## Decisión

1. **Un registro es un token, no una fila.** El parcial y la completa del mismo envío cuentan una vez; si
   no, quien agenda contaría dos veces y el costo por lead saldría barato sin error.
2. **Llamada calificada = llamada que ocurrió de un lead cuyo `lead_value` está en el conjunto
   "calificado" de su programa** (`programs.valores_calificados`, por defecto MUY ALTO y ALTO VALOR). No es
   `tag_lead_quality`: ese valor es `High` exactamente cuando la persona agendó por el formulario, así que
   compararía el umbral consigo mismo. El embudo además se parte por `lead_value` para ver si el scoring
   acierta.
3. **ROAS y ad profit se calculan sobre ventas contratadas** (el precio de los deals que entraron a
   Abonado o Completo), que es el "ROAS sobre contrato" de Pauta. La caja se muestra aparte y nunca se
   deriva de las ventas (ADR 0013). Como el gasto está en COP y el ticket en USD, **el cruce usa la TRM de la
   cohorte y la pantalla la dice al lado** ("a TRM 4.000 de C3"): convertir con la tasa a la vista no es
   convertir en silencio. Los costos por etapa se muestran en la moneda de la cuenta.
4. **La meta de la cohorte se reparte por área en cupos enteros** (paid, orgánico, referidos), declarados
   por el gerente; el % se deriva. La suma no pasa la meta de la cohorte, lo no repartido se ve "sin
   asignar", y una venta sin atribución cuenta para la meta total y para ningún área. **No choca con el ADR
   0023:** aquello prohíbe repartir la meta entre personas; esto la reparte por canal de adquisición, y lo
   declara el negocio como dato.
5. ✅ **Los objetivos son datos de la cohorte:** una tabla `objetivos` (cohorte, área opcional, métrica,
   meta, aceptable, moneda). La **métrica es un tipo** (el código decide con ella: si menor es mejor, cómo se
   compara); **los valores son filas**. Los cupos por área del punto 4 son filas de esta tabla, con la
   métrica "cupos". Una cohorte nueva puede copiar los de la anterior.
6. ✅ **El semáforo:** mejor o igual que la meta, `exito` ("en ruta"); entre aceptable y meta, `alerta`;
   peor que aceptable, `peligro` ("atrasado"). En costos, menor es mejor. Los cupos se comparan contra lo
   esperado a la fecha (meta × día hábil de la ventana ÷ días hábiles totales), no contra la meta final.
7. **Comparativos:** cada KPI contra el periodo anterior del mismo largo y contra la cohorte anterior en
   el mismo día hábil de su ventana. Es la misma consulta con otro rango (089), no una métrica aparte.
8. **Las fórmulas viven en un módulo cada una** y las importan la pantalla, el PDF (021) y cualquier otra
   consulta (ADR 0024). Su tabla completa está en `docs/analytics.md` §6. Sin gasto en una rebanada, la
   celda dice "sin pauta", nunca $0 (ADR 0045).

## Consecuencias

- El cumplimiento, el ritmo, la proyección, los costos y el ROAS se calculan; nada de eso se guarda.
- Lo que falta para "agendas requeridas" (qué conversión agenda→venta, qué ventana de ritmo y cuántos días
  antes del cierre dejan de contar agendas) lo contesta Pauta (`plan.md` §7, D). Hasta entonces la pantalla
  dice qué supuesto usa.
- Las cortesías, si existen, necesitan una marca en el producto para quedar fuera de ventas y de la meta.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Que el closer marque si la llamada fue calificada | Suma un clic al cierre de llamada, el dolor N2 de los closers; Mani prefirió el scoring |
| ROAS sobre caja | Castiga a la pauta mientras los estudiantes terminan de pagar; se muestra la caja aparte |
| Pedir la cuenta de Meta en USD | Suele exigir abrir otra cuenta publicitaria |
| Reparto por porcentaje | Esconde un redondeo (60% de 70 es 42) |
| Umbrales en el código | Cambian por cohorte y por programa (ADR 0012) |

> ⚠️ **1-oct: abierto.** La migración 0057 quita `cohorts.trm_cohorte` (Mani). De dónde sale la TRM del ROAS es
> la decisión A12 de `docs/plan.md` §7, y se toma antes de E7. Hasta entonces, lo que este documento dice de la
> "TRM de la cohorte" describe la intención, no una columna que exista.

## Enmienda 10-nov-2026 (Mani, audit del Hub 403 F1, D-B): un solo ROAS, el de la cohorte de registro

La tabla semanal de Pauta (412) calculaba el ROAS con las ventas por **fecha de venta** de la semana, mientras la tabla por
campaña, el MCP (`pauta_roas`) y el ROAS proyectado (ADR 0126) lo calculan por cohorte de registro. Dos respuestas con el mismo
rótulo, hasta 3× de diferencia (`docs/audit-hub-2026-11-10.md` §2, I-2), y contra lo pedido por Gerencia el 3-nov ("por el día
en que se creó el envío"). Se decide:

1. **ROAS = vendido de las personas cuyo envío cae en la semana (la cohorte de registro, ticket 355) ÷ gasto de la semana.** La
   tabla semanal agrupa por semana del **envío**, no de la venta. Lleva la cobertura y la marca de agendas pendientes de la
   cohorte (N3); una cohorte que todavía no ha comprado dice "parcial", no un 0,00× sin aviso.
2. **El Profit usa la misma ancla** (vendido de la cohorte menos gasto), para no tener dos anclas en una tabla.
3. Quien quiera "vendido de la semana ÷ gasto de la semana" pide **otra cifra con otro nombre**: «Retorno de caja de la semana»,
   con su ficha en `docs/metricas.md`. No se construye hasta que alguien la pida; mientras tanto no existe en pantalla.
4. El umbral `roas` de `objetivos` colorea el ROAS de cohorte, y su `lector` deja de ser `null` (N7).
