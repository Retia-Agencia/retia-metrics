---
id: 433
etapa: configuracion
serves: "Mani, 14-nov: un onboarding paso a paso, súper intuitivo · ADR 0132 punto 3 · docs/onboarding-de-programa.md F3"
depends: [430, 432]
status: en main
---

# 433 — El recorrido de configuración de un programa inactivo

## Qué
Con el programa inactivo, la tab Programa deja las pestañas y pinta el registro del 430 como una lista numerada:
título, para qué sirve, estado (Listo, Falta, Recomendado) y el editor que ya existe adentro, plegable. El primer
pendiente abre desplegado. Al final, Activar, habilitado solo con los exigidos listos.

## Done cuando
- [ ] Ningún editor reescrito: se reusan los de la ficha.
- [ ] Typecheck, lint, tests del cambio y build en verde; `npm run test:humo` y clic en cada paso con la consola abierta,
      en claro, oscuro y 375 px, comparado con `docs/bocetos/una-forma-de-metrica.html`.
- [ ] Tracker y `status:` iguales (N9).
