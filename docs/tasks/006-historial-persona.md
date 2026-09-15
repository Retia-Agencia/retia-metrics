---
id: 006
serves: "spec §1 (qué hace) — historial completo de una persona"
status: todo
---

# 006 — Historial de llamadas de una persona

## Objetivo
Desde el dashboard, entrar a una persona muestra todas sus llamadas en orden, con resultado y
notas.

## Alcance
- Dentro: una vista (ruta o panel) que lista las `calls` de un `personId`, ordenadas por fecha.
- Fuera: no permite editar ni borrar llamadas pasadas.

## Done cuando
- [ ] La ruta usa el `personId` (UUID), nunca el correo, en la URL.
- [ ] Muestra resultado, fecha, closer y nota de cada llamada.

## Notas
Depende del ticket 005 (se entra desde el dashboard).
