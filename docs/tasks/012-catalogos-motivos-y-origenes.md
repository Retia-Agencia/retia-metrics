---
id: 012
fase: F0
serves: "ADR 0015 (motivos); spec §1 pilar 1 (origen del lead)"
depends: [011]
status: todo
---

# 012 — Catálogos de motivos y orígenes del lead

## Objetivo
Existen los catálogos `motivos` y `origenes`, sobre el molde, con semillas tomadas de los
reportes diarios.

## Alcance
- Dentro: tabla `motivos` con semilla: Dinero, Horario, Sin fit, Viaje, Otro programa, Decisión
  de un tercero, Sin respuesta, Sin motivo.
- Dentro: tabla `origenes` con semilla: Agenda del día, Follow-up, Cola de descartados, Cola de
  setteo, Masivos, Lanzamiento, Referido.
- Dentro: `lib/catalogo/motivos.ts` y `lib/catalogo/origenes.ts` usando el molde.
- Fuera: la pantalla (013) y las columnas en `calls` (018).

## Done cuando
- [ ] Ambos catálogos pasan los mismos tests que plataformas, sin código nuevo en el molde.
