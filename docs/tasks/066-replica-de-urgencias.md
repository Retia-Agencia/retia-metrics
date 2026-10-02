---
id: 066
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-3 · insumo §8"
depends: [064]
status: done
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

---

## Corrección 2026-09-24: son DOS cubetas, no una

El cubo único `(sin atribucion)` de arriba contradice el ADR 0045 y el ticket 085. Se muestran
**dos**, siempre, con conteo y porcentaje: **sin UTM** (llegó sin origen) y **(sin clasificar)** (trae
UTM pero no casa con ningún canal ni campaña). Los canales se leen del catálogo de Canales (ticket
101), y los valores históricos como `instagram rosario / linktree` se clasifican con sus reglas.

---

## Cierre 2026-10-02 (sesión O1-g, rama `o1g-lecturas`)

**Hecho.** Falta el recorrido visual, que hace la sesión principal.

- **Consulta:** `lib/queries/urgencias.ts` (`urgenciasDelPrograma(db, programId, hoy)`). No define agenda
  ni registro: reagrupa la serie de `pautaInterina` (093) con `agruparPorCanal` (088), que clasifica con
  `resolverCanal` y el catálogo de Canales (101). Urgencias, Pauta y "registros contra agendas" no pueden
  dar cifras distintas para el mismo día.
- **Los días:** el día observado es el **hábil anterior** a hoy en Bogotá (un lunes mira el viernes; los
  festivos cuentan como hábiles). El promedio es el de los **7 hábiles previos**, sin el día observado y
  sin fines de semana: una agenda creada un sábado no entra ni al día ni al promedio.
- **Las cubetas:** las dos de la corrección del 24-sep, **sin UTM** y **sin clasificar**, salen siempre con
  conteo y % del día, aunque estén en cero. Sale también **sin envío de origen** (una agenda cuyo deal no
  nació de un envío): sin ella el % del día no sumaría 100. Una macro sin expandir cuenta como ausente
  (`resolverCanal`). Los valores históricos como `instagram rosario / linktree` se clasifican con su fila en
  el catálogo (probado).
- **Semáforo:** `semaforoDelDia`, puro: el día ≥ promedio es `exito` ("En ruta"); ≥ 75% del promedio,
  `alerta` ("Atento"); debajo, `peligro` ("Atrasado"); sin promedio, ninguno ("no hay contra qué
  comparar"). Sigue la forma de DP-24 con el promedio como meta.
- **Pantalla:** `TarjetaUrgencias` (`components/urgencias.tsx`) en su propia ruta,
  `/p/[programa]/urgencias`, con la guarda y el alcance del dashboard (gerente y closer en sus programas,
  404 fuera). **No toqué el dashboard** (archivo caliente): `docs/structure.md` §8 pone a Urgencias dentro
  de él, y la tarjeta está hecha para montarse ahí con una línea. **La ruta no está en la barra**: no la
  agregué a `TABS_DE_PROGRAMA` porque Urgencias no es un objeto (ADR 0050).
- **Tests:** `tests/urgencias.test.ts` (10: días, ventana, semáforo en los dos sentidos, las cubetas en
  cero, el canal histórico, anuladas y otro programa fuera) y la guarda en `tests/paginas.test.ts`.

**Para Mani:**

1. 🟡 El umbral del semáforo (75% del promedio) es propuesta: la hoja no documenta su corte y no hay
   objetivos (122) para estas agendas. Vive en una constante (`UMBRAL_ACEPTABLE`).
2. 🟡 ¿"Ayer" es el día hábil anterior o el de calendario? Elegí el hábil (regla de Retia). Si la hoja
   usa el de calendario, un lunes mostraría el domingo.
3. Dónde se monta: dentro del dashboard (lo dice structure §8; lo hace quien tenga el archivo caliente) o
   como tab. Hoy solo se llega por URL.
4. **No verificado:** "las cifras cuadran con la pestaña en un día elegido a mano" y "reproduce los siete
   canales sobre `dev`" piden datos reales (`dev` ya no existe; producción y la hoja no se tocan desde esta
   sesión). Queda para el recorrido: elegir un día, mirar la pestaña y `/p/<programa>/urgencias`. Ojo:
   antes del corte las agendas reales viven en la hoja, no en `calls`, así que la comparación solo cuadra
   para días con agendas en el CRM.
