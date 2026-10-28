---
id: 324
etapa: media
serves: "ADR 0111 punto 2d · propuesta.md §4.3 (análisis de competidores) y §4.4 (el banco)"
depends: [321, 323]
status: todo
---

# 324 — Banco I: referentes, candidatos y calificación

## Alcance

- Portar al CRM las pantallas del cockpit que media usa para ver candidatos, calificarlos (fuego / producción
  dispendiosa / no sirve) y curar referentes y sugeridos. Se porta lo que media usa hoy; lo que nadie usa se lista en
  este archivo y no se porta (ADR 0077).
- **Lo que media pidió para el cockpit y entra al portarlo** (faltante 4 de la verificación del 28-oct): vista previa
  del referente con sonido, y el número de referentes nuevos por creador al mes como **dato del creador** (media habló
  de 30), con aviso cuando el mes va por debajo.
- El botón que dispara el descubrimiento de referentes llama a n8n por el módulo del 323.

## Done cuando

- Media califica en el CRM y la calificación llega al aprendizaje que lee el motor.
- Recorrido con el usuario `media` en celular; humo verde.
