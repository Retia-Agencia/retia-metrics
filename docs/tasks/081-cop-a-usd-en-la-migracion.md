---
id: 081
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-5 · insumo §7 y §9, spec §7"
depends: [078]
status: todo
---

# 081 — COP → USD a la tasa del dia de la migracion

## Objetivo

Traer los cobros historicos que se hicieron en pesos, sin inventar una TRM historica que no
existe.

🩸 **La caja real se mueve en COP:** el bloque de totales de `Estudiantes Septiembre` dice
`$49.423.529`. Los tickets son en USD (spec §7).

## La regla

- Se convierte **a la tasa del dia de la migracion**, **una sola tasa para toda la corrida**, y
  **esa tasa queda escrita** (en el rastro de la corrida y en este ticket).
- **Nunca convertir en silencio:** cada monto sigue mostrando su moneda al lado del numero.
- No se reconstruye la TRM del dia de cada pago. No existe una fuente unica y fabricarla produciria
  cifras precisas y falsas. **Una aproximacion declarada vale mas que una exactitud inventada.**

## Alcance

- **Dentro:** la conversion, la tasa escrita, y la marca de que ese abono **fue convertido** (para
  que dentro de un ano nadie lo lea como un pago original en USD).
- **Fuera:** conversion automatica en la app. El sistema **no convierte solo**: si un pago entra en
  COP, lo convierte el closer al registrarlo (spec §7).

## Done cuando

- [ ] La tasa usada esta escrita en el ticket y en el rastro de la corrida.
- [ ] Todo abono convertido queda marcado como tal.
- [ ] Ninguna cifra aparece sin su moneda.

## Kiro

Si.
