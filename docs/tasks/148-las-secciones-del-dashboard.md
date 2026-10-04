---
id: 148
etapa: NC2
serves: "comercial.md §9.7, §9.8 · enmienda el 095"
depends: [142, 095, 137]
status: en curso
sesion: M1 (ola O5, 4-oct)
---

# 148 — Las secciones del dashboard: Pulso, Operación comercial y Dinero

**Bloqueado por:** el 142 (el embudo se cuenta por etapa; contarlo con las etapas viejas sería rehacerlo).

## Objetivo

Armar el dashboard en las secciones de `comercial.md` §9.8, con la versión mejorada de cada gráfica de §9.7.
Pauta y origen queda después de v1 (R-9). Todo con el selector del 136, número y % y clic a la lista (137).

## Alcance (aprobado por Mani el 4-oct, sesión M1)

El dashboard es producto central: tiene que dar a gerencia visibilidad de TODA la operación. Por eso el 148
también audita lo que ya existe y arregla lo que esté mal.

- **Cuatro secciones, en este orden, con encabezado y ancla** (`#pulso`, `#operacion`, `#dinero`, `#pauta`):
  - **Pulso:** contratado del periodo (USD, valor vendido de los deals que entran a venta en A) y caja, cada uno
    A contra B en número y % (`Variacion`); la cohorte (meta, vendidos, faltan, meta dinámica, cumplimiento);
    banderas rojas: shows sin Grain y llamadas que ya pasaron sin resultado. Hueco visible y nombrado para la meta
    del mes (146) y las alertas por persistencia (147).
  - **Operación comercial:** embudo agendas → shows → cierres, cada paso en número y % y A contra B; deals creados
    contra agendas (138, ya existe); comparativo entre closers; motivos de pérdida; leads contra meta. Hueco para
    el embudo por etapa y los tiempos (065, M2).
  - **Dinero:** contratado, caja por moneda (nunca sumada), comisión del periodo, descuento promedio contra el
    ticket base de la cohorte, ventas por cohorte (la futura incluida) y cartera pendiente con la vencida aparte.
  - **Pauta y origen (interina):** los bloques que ya existen (Pauta interina, Origen por canal, Registros y
    agendas por canal, Embudo del formulario), movidos sin cambios.
- **Toda cifra nueva abre su lista (ADR 0067).** Se AGREGAN métricas en `metricas-con-filas.ts`,
  `metricas-filtros.ts` y `vista-metrica.ts` sin editar las existentes; el predicado de "llamada que ya pasó sin
  resultado" sale a un módulo y `lib/queries/inbox.ts` solo lo importa (una pregunta, una respuesta).
- **Audit de lo que existe** (hallazgos de la sesión M1):
  1. 🩸 `embudoPorCloser` agrupa las llamadas por el texto `calls.closer_id`, y las de Calendly (y toda la app)
     solo escriben `closer_user_id`: **sus agendas y shows caen en "sin closer"** en el comparativo. Se agrupa por
     la clave FK + texto histórico (`claveCloserSql`, como los abonos) y la etiqueta sale de `users`.
  2. Cierres por closer van por dueño del deal y shows por quien tomó la llamada: la tabla lo dice en vez de
     esconderlo.
  3. Textos viejos en pantalla y comentarios: "todavía no hay deals", "lo reescribe E5-1", "ADR 0009" donde rige el
     0048/0023.

## Done cuando

- [ ] Las cuatro secciones salen en ese orden, con ancla, en escritorio y 375 px; lo de Pauta sin cambios por dentro.
- [ ] Contratado, caja, agendas, shows y cierres muestran A contra B en número y % (sin B, `—`).
- [ ] Cada cifra nueva (contratado, sin resultado, comisión, descuento, ventas por cohorte, cartera) abre su lista,
      y un test por métrica compara la cifra con todas sus filas (con un anulado y otro programa que no cuentan).
- [ ] "Sin resultado" del dashboard y la sección 1 del Inbox salen del mismo predicado (test o import único).
- [ ] El comparativo atribuye a su closer una llamada que solo tiene `closer_user_id` (test que muerde con el código
      de hoy).
- [ ] Con filtro de closer, el comparativo sigue sin filtrarse y lo del programa entero lo dice.
- [ ] Huecos de 146, 147 y 065 visibles con su número, no tarjetas en cero.
- [ ] typecheck, lint, tests del ticket, `npm run build`; recorrido en `dev:local` como closer y gerente, consola
      limpia, clic en cada cifra; un programa ajeno da 404 forjando la URL.
