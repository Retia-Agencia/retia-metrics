---
id: 112
etapa: E0
serves: "plan.md §7.1 R4 · plan-reparto E0 (carril Alejo)"
depends: []
status: todo
---

# 112 — CI en cada PR y `main` protegido

## Objetivo

`main` despliega a producción en cada push y no existe `.github/`. "Nada se empuja sin los cuatro
chequeos" hoy depende de que alguien se acuerde. Con dos personas eso ya no alcanza.

## Alcance

- **Dentro:** un workflow de GitHub Actions que en cada PR y push a `main` corra `npm ci`, `npm test`,
  `npm run typecheck`, `npm run lint` y `npm run build` (el build no necesita `.env.local`).
- **Dentro:** proteger `main`: PR obligatorio, CI verde y una aprobación del otro.
- **Dentro:** confirmar en Linux que `npm ci` pasa con el lock actual, y corregir `AGENTS.md` si no.
- **Fuera:** Playwright (se decide con la base local, [113]).

## Done cuando

- [ ] Un PR real pasa el CI y lo aprueba el otro (salida de E0).
- [ ] Un push directo a `main` se rechaza.
