---
id: 090
etapa: E5
serves: "plan v2 §12.7 · el dolor declarado de Gerencia"
depends: [085, 088, 089]
status: todo
---

# 090 — Rendimiento por area: la vista de Gerencia

## Objetivo

Contestar el dolor que Alejo declaro: *"rendimiento de las areas · cantidad de leads por area"*.

## 🎯 Y lo que NO es, que es la mitad del ticket

Alejo dijo tambien que lo tedioso de su dia es **"no saber que decisiones tomar"**. El dolor **no es
recolectar el numero ni leerlo: es que el numero no dice que hacer.** Una tabla de "leads por area"
con cuatro cifras correctas le da el mismo problema con mejor tipografia.

Y ya hay precedente medido: en el semaforo de 30X el sistema **detecta perfecto** —umbral, semaforo,
accionable escrito, dueno nombrado— y **nadie atiende los rojos**, hasta 10 dias seguidos con ~$200
diarios quemandose. *Detectar no es actuar.*

**Por eso esta vista es un tablero de ESTADOS CON ACCION, no una tabla de cifras:** que esta fuera de
umbral, desde cuando, de quien es, y que se hace. El numero es el respaldo de la frase, no el producto.
Mismo criterio que `saldoLegible`, que decide **la etiqueta y el valor juntos** porque un saldo
negativo es un sobrepago y no una deuda — una capa mas arriba.

## ⚠️ Lo que bloquea la mitad de arriba

Un estado necesita un **umbral**, y los umbrales **todavia no existen**: Alejo dijo *"cuando el CRM ya
se tenga, se puede definir lo que muestran las metricas"*. Entonces este ticket se construye **con el
slot del umbral vacio**, no se redisena para recibirlo despues.

## Alcance

- **Dentro:** leads, agendas, ventas y tasa de calificacion **por area**, dentro de un programa.
- **Dentro:** CPL, CPI, CAC y ROAS **rebanados dentro de Pauta** (campana, conjunto, anuncio, fecha).
- **Dentro:** el slot del umbral, vacio, con su lugar en la pantalla ya resuelto.
- **Dentro:** las **dos** categorias de huerfano visibles, con conteo y porcentaje: **`sin UTM`** y
  **`(sin clasificar)`**. No se suman en una sola: una la arregla Pauta aguas arriba y la otra se
  arregla con una fila del catalogo.
- **Fuera:** los umbrales. Se piden a Alejo y entran despues.

## 🩸 La regla del cero

**Una division solo se muestra si el numerador Y el denominador existen en esa rebanada.** Media
organica y Comercial tienen inversion **cero**: un "CPL por area" literal les daria **$0** y la tabla
mostraria a las dos ganandole a Pauta por goleada. La conclusion obvia —mover el presupuesto a
organico— seria un artefacto de dividir por un costo que no existe.

Si falta una mitad, la celda dice **"sin pauta"**, no `$0`. Extiende a la rebanada lo que el ticket 067
ya decia de la cohorte: *"un cero parece un dato"*.

## Done cuando

- [ ] Comercial muestra sus leads **y no cero**, que era el bug que origino todo esto.
- [ ] Un area sin inversion dice **"sin pauta"** y **nunca** `$0`, con test.
- [ ] La consulta **no compila** sin programa.
- [ ] El slot del umbral existe y esta vacio, sin romper el layout.

## Kiro

Si, con revision visual obligatoria.
