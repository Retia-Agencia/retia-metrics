---
id: 100
etapa: E6
serves: "ADR 0050 · ADR 0051 (destinos) · propuesta 24-sep §3.5"
depends: [097, 101]
status: todo
---

# 100 — La tab Programs: la ficha del programa

## Objetivo

Un lugar donde ver todo lo que define un programa, sin entrar a Ajustes: cohortes, destinos
(formulario y checkouts), Calendly, fuente de leads, tasa de comisión y el equipo con sus membresías.

## Alcance

- **Dentro:** la ficha; el gerente edita, el closer lee los suyos (ADR 0048).
- **Dentro:** los **destinos** del programa (URL del formulario y URL de checkout), que alimentan el
  builder (ADR 0051).
- **Dentro:** la tasa de comisión del programa (hoy no existe como columna: 80/697 y 100/1.500).
- **Fuera:** lo que ya vive en `/ajustes/programas` se reutiliza; no se duplica la edición.

## Done cuando

- [ ] Un closer ve la ficha de sus programas y no la de otros.
- [ ] Un programa sin URL de formulario lo dice, y el builder no genera links rotos.

## Kiro

Sí, con revisión visual.
