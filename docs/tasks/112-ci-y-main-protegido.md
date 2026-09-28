---
id: 112
etapa: E0
serves: "plan.md §7.1 R4 · plan-reparto E0 (carril Alejo)"
depends: []
status: done
---

# 112 — CI en cada push a `main` (sin protección)

## Objetivo

`main` despliega a producción en cada push y no existe `.github/`. "Nada se empuja sin los cuatro
chequeos" hoy depende de que alguien se acuerde. Con dos personas eso ya no alcanza.

## Alcance

- **Dentro:** un workflow de GitHub Actions que en cada PR y push a `main` corra `npm ci`, `npm test`,
  `npm run typecheck`, `npm run lint` y `npm run build` (el build no necesita `.env.local`).
- ~~**Dentro:** proteger `main`: PR obligatorio, CI verde y una aprobación del otro.~~ **Fuera por
  decisión de Mani (28-sep): *"no quiero nada complejo, necesitamos velocidad de implementación"*.** Se
  empuja directo a `main` con los cuatro chequeos corridos en local; el CI corre en cada push como
  **alarma, no como reja**. Si el CI queda en rojo, lo siguiente que se hace es arreglarlo.
- **Dentro:** confirmar en Linux que `npm ci` pasa con el lock actual, y corregir `AGENTS.md` si no.
- **Fuera:** Playwright (se decide con la base local, [113]).

## Done cuando

- [x] El workflow corre `npm ci`, typecheck, lint, test y build en cada push a `main` y en cada PR
      (`.github/workflows/ci.yml`, 28-sep) y hay plantilla de PR con el checklist de contratos.
- [x] `npm ci` pasa en Linux: la primera corrida lo midió roto (faltaban `@emnapi/core` y
      `@emnapi/runtime` 1.11.3 en el lock) y se resincronizó el lock (`649bf2c`).
- [ ] ~~Un PR real pasa el CI y lo aprueba el otro. Un push directo a `main` se rechaza.~~ Fuera (Mani, 28-sep).
