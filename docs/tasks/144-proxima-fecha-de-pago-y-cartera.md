---
id: 144
etapa: NC2
serves: "comercial.md R-5, GC-14, GC-15"
depends: [132, QM-3, GC-17]
status: bloqueado
---

# 144 — La próxima fecha de pago y la lista de cartera por fecha

**Bloqueado por:** QM-3 (¿la próxima fecha vive al lado de la fecha límite del ADR 0053 o la reemplaza?
Recomendación: al lado) y GC-17 (Mani habla con 2 o 3 closers sobre cómo pactan los abonos).

> **4-oct (148, punto 5):** el Dinero del dashboard ya muestra cartera total, vencida y "sin saldo calculable"; falta la
> cartera del mes por próxima fecha de cobro, que es este ticket. En la base local 6 de 7 deals salen "sin saldo
> calculable" por no tener valor vendido: medir cuántos hay así en producción antes de confiar en el total.

## Objetivo

En Ganado pago parcial se anota la próxima fecha de pago, y hay una lista de toda la cartera por cobrar
(vencida y por vencer) ordenada por esa fecha, con saldo (sobre el valor vendido, 132) y dueño: *"que no sea
un esfuerzo para el closer pensar cuándo tiene que cobrar"*.
