---
id: 066
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-3 · insumo §8"
depends: [064]
status: todo
---

# 066 — La replica de `🚨 Urgencias`, con desglose por UTM

## Objetivo

Reemplazar la pestana `🚨 Urgencias` de la hoja, que es lo que el equipo mira de verdad: agendas
de ayer, promedio de 7 dias, semaforo, y **desglose por `utm_source / utm_medium`** con su % del
dia y un cubo de "otros".

## Los canales reales (medidos en la hoja)

`facebook / cpc` · `direct / organic` · `instagram rosario / linktree` ·
`instagram milena / linktree` · `instagram rosario / stories` ·
`leadmagnetdiagnostico / pdf` · `(sin atribucion)`

🎯 Los `utm_source` **ya nombran personas** (`instagram rosario`, `instagram milena`). Salen de los
encabezados de `_urg_data` de la hoja de ComunicArte, fila 1. Se quedan como `utm_source`; si
alguna vez se normalizan a un catalogo de origen humano, es otro ticket.

## Alcance

- **Dentro:** la consulta, el semaforo y el desglose, leyendo los UTM de `submissions` (ADR 0036).
- **Dentro:** `(sin atribucion)` es un cubo de primera clase, no un hueco.
- **Fuera:** la pauta y el ROAS (ticket 067).
- **Fuera:** normalizar los UTM.

## Done cuando

- [ ] El desglose reproduce los siete canales reales sobre `dev`.
- [ ] Un lead sin UTM cae en `(sin atribucion)` y se ve.
- [ ] Las cifras cuadran con la pestana de la hoja en un dia elegido a mano, comparado.

## Kiro

Si.
