---
id: 416
etapa: pauta
serves: "docs/paid-media-excels-2026-11-10.md §2 (inversión por cuenta, Milena y Rosario) y §6 · docs/diseno-cifra-y-pauta.md §3, §4.3 y §5.1 · Q-8"
depends: [412]
status: todo
---

# 416 — Pauta por cuenta

## Alcance

- Dimensión `cuenta` en `lib/queries/hechos/dimensiones.ts` para el gasto (vía `pauta_objetos.cuentaId`).
- Interruptor **Total | Por cuenta** en la tabla: subfilas por cuenta bajo Inversión, Agendas según Meta y Costo por agenda según
  Meta; "Cuenta" en Ver por de "¿Qué trae ventas?"; "Cuenta de Meta" en el filtro Ver solo.
- Nunca suma programas. Si Paid Media responde Q-8 con "columnas fijas", ajustar la presentación, no la consulta.

**Migración:** Ninguna.

## Done cuando

- [ ] La suma de las cuentas = el total del programa (test).
- [ ] Las tres superficies (tabla, Ver por, Ver solo) usan la misma consulta.
