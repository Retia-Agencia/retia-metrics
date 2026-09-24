---
id: 064
etapa: E5
serves: "plan v2 §6 etapa 5 · tarea E5-1 · ADR 0022, 0023, 0024, tickets 004 y 005"
depends: [060]
status: todo
---

# 064 — Reescribir el dashboard sobre deals, conservando las definiciones

## Objetivo

Que `lib/queries/dashboard.ts` lea del modelo nuevo **sin cambiar una sola definicion de negocio**.

## Lo que NO cambia de significado

- **Caja recaudada ≠ ventas cerradas** (ADR 0013). La caja es `sum(abonos)` por fecha del abono.
- **Una venta es un deal en Abonado o Completo**, nunca "un deal".
- **La meta y la meta dinamica son de la cohorte y no se reparten entre closers** (ADR 0023). Un
  closer tiene **contribucion**, no meta propia.
- **Solo dias habiles; los festivos cuentan como habiles.** Regla de Retia, no del calendario.
- **La ventana de venta es dato por cohorte** (ADR 0022).
- **"Todos ven todo"** (ADR 0009): un closer ve el comparativo, la caja y la pauta.
- El filtro sale de la **URL y nunca de la sesion** (ADR 0023).
- 🩸 **Los leads de un closer son las personas de las que es responsable, asi que la suma de los
  closers NO da el total del programa.** La pantalla lo dice en vez de cuadrarlo a la fuerza.

## Alcance

- **Dentro:** reescribir `dashboard.ts`, `ventas.ts`, `personas.ts`, `vista-dashboard.ts` sobre
  leads y deals.
- **Fuera:** las metricas nuevas (ticket 065), Urgencias (066), ROAS (067).

## ⚠️ La trampa del SQL

**Nada de subconsultas correlacionadas con la plantilla `sql` de drizzle.** Meter una TABLA en la
plantilla desactiva la calificacion de columnas y **el conteo devuelve 0 sin lanzar ningun
error**. Se agrupa aparte y se une en memoria, que a esta escala es gratis. Si dudas, imprime
`query.toSQL().sql`: cuesta un comando.

## Done cuando

- [ ] Las cifras del dashboard sobre `dev` **cuadran con las del modelo viejo** donde las
      definiciones no cambiaron. Si una cambia, hay una razon escrita.
- [ ] Ninguna consulta cuenta ventas como deals a secas.
- [ ] `grep` no encuentra subconsultas correlacionadas nuevas.
- [ ] Toda lectura de `deals`, `calls` y `abonos` pasa por `vigente()`.

## Kiro

Si.

---

## Enmienda 2026-09-24 (ADR 0048)

- "Todos ven todo" rige **dentro del programa**: un closer solo ve los programas de su membresía
  (ticket 094).
- "Los leads de un closer son las personas de las que es responsable": en el modelo v2 el responsable
  es el **owner del deal**; se lee así.
- La vista "todos los programas" es el ticket 095.
