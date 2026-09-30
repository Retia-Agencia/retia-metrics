# 0052 — El cuarto rol: Paid Trafficker, y su pregunta `manejaPauta`

**Fecha:** 2026-09-24 · **Reescrito:** 2026-09-27 (referencias al dia) · **Estado:** aceptado (Mani: entra en el builder v1) · **Implementación:**
ticket 102 · **Aplica:** ADR 0025 (las preguntas de rol viven en un solo lugar), ADR 0051 (el CRM genera los
links), ADR 0048 (alcance por membresía)

## El problema

El link generado por el CRM (ADR 0051) tiene dos límites: el árbol de campañas del CRM puede divergir
del de Meta, y una campaña creada en Meta sin pasar por el CRM sale sin UTM correcto. Los dos se cierran
cuando los paid traffickers crean sus campañas dentro del CRM. Mani decidió el 24-sep que el rol entra en la primera versión del builder.

Un paid trafficker no cumple ninguna de las tres preguntas que existen hoy en `lib/auth/roles.ts`: no
tiene acceso total, no administra el CRM y no trabaja leads.

## Decidimos

**1. Un rol nuevo, `paid_trafficker`, y una cuarta pregunta, `manejaPauta`**, en `lib/auth/roles.ts` y
en ningún otro lado (ADR 0025). **Nunca se escribe `rol === "paid_trafficker"` a mano.**

**2. Qué puede:** crear y editar campañas de **sus programas** (por membresía, ADR 0048), generar sus
links y cargar el gasto de sus campañas. Nada más: no ve deals, llamadas ni abonos, y no administra.

**3. Quién más cumple `manejaPauta`:** el gerente y el developer (administrar incluye la pauta). El
closer no.

**4. 🔴 Qué ve del Dashboard** queda abierto para Gerencia: la propuesta es la parte de pauta de sus
programas (gasto, registros, agendas, CPL, costo por agenda), sin caja ni comparativo entre closers.

## Consecuencias

- El `pgEnum` de roles gana un valor: una migración (la genera y aplica la sesión principal).
- `tests/roles.test.ts` y la matriz de guardas ganan la cuarta pregunta, mordida en los dos sentidos.
- La vista `todo` del developer sigue siendo superset de todas (ticket 032).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Darle rol de gerente | Vería caja, closers y usuarios, y podría administrar |
| Que las campañas las cargue siempre un gerente | Deja abiertos los dos límites del link generado |
| Preguntar `rol === "paid_trafficker"` donde haga falta | Es el bug que el ADR 0025 existe para evitar |

---

## Enmienda 2026-09-29 (ADR 0062, reunión con Pauta; Mani)

- **Punto 2:** el gasto de Meta entra por la API; el trafficker solo carga a mano el de otras plataformas.
- **Punto 4, cerrado:** ve el Dashboard de sus programas **menos el comparativo entre closers y la
  comisión**. Sí ve ventas contratadas y caja, porque ROAS y ad profit las necesitan. Sigue sin ver deals,
  llamadas ni abonos sueltos.
