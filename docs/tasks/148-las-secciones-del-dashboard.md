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

- [x] Las cuatro secciones salen en ese orden, con ancla, en escritorio y 375 px; lo de Pauta sin cambios por dentro.
- [x] Contratado, caja, agendas, shows y cierres muestran A contra B en número y % (sin B, `—`).
- [x] Cada cifra nueva (contratado, sin resultado, comisión, descuento, ventas por cohorte, cartera) abre su lista,
      y un test por métrica compara la cifra con todas sus filas (con un anulado y otro programa que no cuentan).
- [x] "Sin resultado" del dashboard y la sección 1 del Inbox salen del mismo predicado (test o import único).
- [x] El comparativo atribuye a su closer una llamada que solo tiene `closer_user_id` (test que muerde con el código
      de hoy).
- [x] Con filtro de closer, el comparativo sigue sin filtrarse y lo del programa entero lo dice.
- [x] Huecos de 146, 147 y 065 visibles con su número, no tarjetas en cero. (146 y 065 llegaron a `main` antes: quedan montados; solo queda el hueco del 147.)
- [x] typecheck, lint, tests del ticket, `npm run build`; recorrido en `dev:local` como closer y gerente, consola
      limpia, clic en cada cifra; un programa ajeno da 404 forjando la URL.

## Cierre (4-oct, sesión M1) · pendiente de la revisión central

Implementó Codex en tres rondas (brief más dos correcciones); revisó y verificó M1.

- **Secciones:** Pulso, Operación comercial, Dinero y Pauta y origen (interina), cada una en `components/dashboard/`;
  `dashboard-programa.tsx` solo compone.
- **Montado de M2 y M3:** la meta del mes (`leerMetasDelMes`, 146) en Pulso con enlace a Metas, y el embudo por
  etapa del 065 (conversión, tiempo en etapa, abiertos por etapa y owner, sin dueño por antigüedad, ticket
  estimado de los motivos de pérdida) en Operación. El contratado sale de `contratadoDeDeals` (una cifra, un módulo).
- **Métricas nuevas con lista:** `contratado` (comisión, descuento y ventas por cohorte abren esa misma lista; la
  fila de cohorte la filtra con `cohorte=<uuid>`), `sin_resultado` y `cartera` (foto de hoy, la lista lo dice).
- **Un predicado:** `llamadaPasadaSinResultado(ahora)` y `ETAPAS_CERRADAS` en `metricas-filtros.ts`; el Inbox y
  el dashboard lo importan (`tests/sin-resultado-compartido.test.ts`).
- **Bug del comparativo arreglado:** llamadas y abonos se agrupan por la identidad de la cuenta (FK, o el texto
  histórico que casa con su `closer_id`); antes las llamadas de Calendly caían en "sin closer". El test muerde
  con el código viejo (verificado) y hay otro para la llamada histórica de la hoja.
- **Verificado:** typecheck, lint, `npm run build`; tests `metricas-con-filas` (31), `dashboard` (25),
  `vista-dashboard` (6), `paginas` (83), `inbox` (30), `sin-resultado-compartido`, `vigencia-centralizada`,
  `saldo-centralizado`. Recorrido en `dev:local`: gerente en escritorio, closer en 375 px (sin scroll horizontal),
  consola limpia, clic en contratado, sin resultado y cartera hasta la lista; un closer sin membresía recibe 404
  en el dashboard y en la lista forjada; un `cohorte` inválido en la URL se ignora.

## Lo que sigue del dashboard (para otras sesiones)

Todo lo pendiente del dashboard, en un solo lugar. La sesión central decide número de ticket y ola; cada punto dice
qué es, por qué importa y dónde vive. Las referencias de HubSpot (#n) son de `comercial.md` §9.7.

**A. Deuda que deja el 148 (lo construido funciona, le falta esto)**

1. **Que las cifras del embudo por etapa (065) abran su lista.** Hoy salen sin clic, y eso rompe el ADR 0067. La
   ruta `/dashboard/lista` filtra por métrica y los ids no pueden ir en la URL. Toca agregar métricas por etapa en
   `metricas-con-filas.ts` (abiertos por etapa y owner, sin dueño por antigüedad, entraron a cada paso), usando el
   universo de `lib/queries/embudo-etapas.ts`, y un test cifra contra filas por métrica.
2. **Que las filas del comparativo entre closers abran su lista**, por closer y por columna (agendas, shows,
   cierres, caja). El código opaco del closer ya existe (`codigoDeCloser`).
3. **Definir el % de cierre.** Hoy divide cierres por fecha de venta entre shows por fecha de llamada: son dos
   universos y puede pasar de 100%. Por closer es peor, porque los cierres van por el dueño del deal y los shows por
   quien tomó la llamada (la tabla lo dice, pero no lo resuelve). Hay que decidir con Mani o Dani: ¿tasa por
   cohorte de llamadas (de los shows del periodo, cuántos terminaron vendidos) o por periodo? Afecta también a
   `mi-espacio-metricas.ts`.
4. **La lista abierta desde un dashboard "sin comparación" muestra una B propia**: `vistaDeLista` vuelve a resolver
   el periodo y le calcula una B. Ya pasaba antes del 148.
5. **Cartera por próxima fecha de pago (GC-15, #4).** Hoy solo hay total, vencida y "sin saldo calculable". Falta
   la cartera del mes por fecha de cobro. En la base local, 6 de 7 deals salen "sin saldo calculable" por no tener
   valor vendido: revisar cuántos hay así en producción antes de confiar en el total.
6. **Las etiquetas del comparativo** salen de `coalesce(closer_id, nombre, email)`. Si una cuenta no tiene
   `closer_id`, la etiqueta es su nombre, distinto del que muestran las listas (que usan `users.closer_id`).
   Conviene una sola etiqueta de closer en todo el dashboard.

**B. Lo que pidió comercial y no está (comercial.md §9.7 y §9.8)**

7. **Alertas por persistencia (147, GC-40)**: el hueco ya está en Pulso. Es la parte 2 de la ola O5.
8. **Banderas rojas que faltan en Pulso (GC-32, GC-20)**: "atendido sin valor" (falta una propiedad exigida, del
   128) y "Atendido sin Grain" como bandera aparte del "shows sin Grain".
9. **Agendas creadas contra ocurridas, y su resultado por semana (#8, #9, #11, #13)**: hoy el embudo cuenta por
   fecha de la cita. Falta separar "se agendó" de "ocurrió", y mostrar el no-show en número y %.
10. **Agenda futura aparte del resultado (#10, #12)**: las citas que vienen son agenda, no resultado.
11. **Series mensuales en Dinero (#1, #4, #6)**: contratado y cupos por mes con la meta del mes como línea, y el
    recaudo por mes según la fecha del abono, siempre en ejes lineales.
12. **Acumulado del mes contra el mes anterior al mismo día hábil, con la meta del mes como tercera línea (#2,
    #5)**: hoy son tarjetas con su variación, no una curva.
13. **Color por antigüedad en las listas (GC-35)**: se dejó para después en el 137.
14. **El dashboard de "todos los programas"** (`app/(app)/dashboard`) no tiene las secciones nuevas. Ahí solo
    entran sumas en la misma unidad (ADR 0048): el contratado en USD y la cartera en USD sí; la comisión, el
    descuento y las tasas van por programa.

**C. Después de v1**

15. **El dashboard del paid trafficker, acotado a sus programas (102)**: parte 2 de O5, toca estas pantallas.
16. **Pauta y origen v2 (R-9, §9.8)**: CPL, costo por agenda, costo por venta y ROAS, más paid contra orgánico
    superpuestos (GC-37). Necesita el gasto de Meta (119, 120). Hoy esa sección es la interina, sin cambios.
