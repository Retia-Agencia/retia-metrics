---
id: 416
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (inversión por cuenta, Milena y Rosario) y §6 · docs/diseno-cifra-y-pauta.md §3, §4.3 y §5.1 · Q-8"
depends: [412]
status: en curso
---

# 416 — Pauta por cuenta

## Alcance

- Dimensión `cuenta` en `lib/queries/hechos/dimensiones.ts` para el gasto (vía `pauta_objetos.cuentaId`).
- Interruptor **Total | Por cuenta** en la tabla: subfilas por cuenta bajo Inversión, Agendas según Meta y Costo por agenda según
  Meta; "Cuenta" en Ver por de "¿Qué trae ventas?"; "Cuenta de Meta" en el filtro Ver solo.
- Nunca suma programas. Si Paid Media responde Q-8 con "columnas fijas", ajustar la presentación, no la consulta.

**Migración:** Ninguna.

## Done cuando

- [x] La suma de las cuentas = el total del programa (test). `tests/pauta-por-cuenta.test.ts`: Inversión y Agendas según
  Meta por semana y por día, «Ver por Cuenta» en inversión, agendadas y ventas, y la dimensión del hecho de gasto.
- [ ] Las tres superficies (tabla, Ver por, Ver solo) usan la misma consulta. **Tabla y Ver por, hechos**; la cuenta de un
  gasto se resuelve en un solo lugar (`cuentaDelGasto` en `lib/queries/hechos/gasto.ts`) y un test compara la inversión de
  cada cuenta entre las dos. **Ver solo › Cuenta de Meta, falta**: el control «Ver solo» todavía no existe (es del 420). La
  dimensión `cuenta_meta` del hecho de gasto ya agrupa y filtra; lo que falta para cortar TODA la pantalla por cuenta es la
  cuenta en los hechos de envío, agenda, cita y venta (vía anuncio → cuenta), marcada `aun` en la matriz de dimensiones.

## Avance

### 13-nov · tabla y «Ver por Cuenta» (carril P)

- **Una sola respuesta a "¿de qué cuenta es este gasto?"**: `cuentaDelGasto` (`pauta_objetos.cuenta_id` del objeto del gasto)
  en `lib/queries/hechos/gasto.ts`. El gasto cargado a mano no tiene cuenta y sale aparte como **«Sin cuenta de Meta»**, para
  que las cuentas sumen el total. La dimensión se llama `cuenta_meta`, no `cuenta`: en envío, agenda, cita y venta `cuenta` ya
  es la cuenta del UTM («Instagram · Rosario», ADR 0087). **Aviso al carril D**: falta el término «Cuenta de Meta» en
  `overview.md` §11; se agregó `cuenta_meta` a la línea de dimensiones del Gasto en `docs/metricas.md`.
- **Tabla**: interruptor **Total | Por cuenta** (`?por_cuenta=1`). Subfilas sangradas bajo Inversión, Agendas según Meta y Costo
  por agenda según Meta, de más a menos inversión. La inversión sale de las mismas filas de gasto que la celda; las agendas y el
  costo, del desglose por cuenta de `costoPorAgendaDeVentana` (`porCuenta`). Si la celda de la fila no se calcula, la de la cuenta
  tampoco. La explicación de una subfila dice "en la cuenta X" y lleva el filtro «Cuenta de Meta». El CSV trae las subfilas.
- **«¿Qué trae ventas?»**: «Ver por» = Cuenta | Canal | Campaña | Anuncio. Nivel `cuenta_meta` en el ROAS de pauta (también en el
  MCP, que expone `NIVELES_PAUTA`), con su lista: los envíos de las campañas de esa cuenta.
- **Bug arreglado de paso**: un renglón con inversión en pesos y sin TRM del día (USD en 0) se escondía en «¿Qué trae ventas?»;
  pasaba también con campañas. Ahora cuenta como visible con gasto en cualquiera de las dos monedas (test).
- **Medido en producción (solo lectura)**: Comunicarte tiene cuatro cuentas de Meta (Rosario Gomez ADS, Cuenta Publicitaria
  Milena Morales, Milena | Retia y Rosario | Retia, estas dos en USD); Tactical y Comunícate con Confianza, una cada una. Q-8 decide si
  se agrupan por persona (Milena, Rosario) como en el Excel.
- **Verificado**: typecheck, eslint, 22 archivos de tests (216), `npm run build`, recorrido en `dev:local` como gerente con dos
  cuentas sembradas en Docker (oscuro escritorio, claro 375 px sin desborde de página, explicación de una subfila, consola limpia;
  la tabla y Ver por dan la misma inversión por cuenta). **No verificado**: suite completa (CI), `test:humo`, lado a lado con el
  boceto.
- **Base local**: la 0133 no migraba en Docker por dos objetivos de inversión sin moneda cargados a mano antes de la migración;
  se borraron (solo Docker).
