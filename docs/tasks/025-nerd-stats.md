---
id: 025
fase: F4
serves: "spec §1 pilar 4"
depends: [024]
status: todo
---

# 025 — Nerd Stats

## Objetivo
Un developer ve la salud de la herramienta sin abrir la base.

## Alcance
- Dentro: `/nerd-stats` con `paginaConRol("developer")`:
  - últimas corridas de sync por fuente (duración, filas, personas nuevas, errores de `sync_runs`);
  - últimos cambios de configuración (`change_log` con `origen="app"`, quién y cuándo);
  - conteos por programa (personas, llamadas, ventas, abonos) y por origen (`sheets`/`app`);
  - commit y fecha del despliegue (`VERCEL_GIT_COMMIT_SHA`), y si `CRON_SECRET` está configurado
    (solo sí/no, nunca el valor);
  - usuarios activos por rol.
- Fuera: métricas de rendimiento de Vercel, logs de requests, "ver como".

## Done cuando
- [ ] Ninguna cifra expone datos personales (solo conteos y metadatos).
- [ ] Carga en menos de 1 segundo con los datos actuales.
