---
id: 425
etapa: operacion
serves: "Mani, 13-nov: que una falla grave (como la caída del 12-nov) avise por WhatsApp al grupo CRM Retia - Health, y que toda alerta se construya igual (ADR 0130)"
depends: []
status: done
---

# 425 — Alertas técnicas por WhatsApp: registro en el CRM, entrega por Juanito

Contrato completo en el **ADR 0130**. Este ticket construye la mitad del CRM; la de Juanito vive en su repo
(`30X/repos/Juanito`, `src/scheduler/alertas-retia.js`) y se despliega después.

## CRM (este repo)

- [x] `lib/alertas/registro.ts`: registro exhaustivo de tipos (`satisfies Record<TipoDeAlerta, ...>`). Cada tipo:
      `severidad` (`critica` | `aviso`) y `evaluar(db, ahora)` que devuelve `{ clave, texto }[]`. Tipos iniciales, todos
      sobre `saludDeFuentes` sin recalcular nada:
      `fuente_silenciosa` (estado `sin_respuestas`, `muerta` o `sin_envios`), `sobres_con_error` (`sobresPendientes > 0`),
      `completos_sin_calidad` (`sinCalidad > 0`), `lectura_form30x_vieja`, `traza_de_pauta_rota` (`trazaRota` o `fbclidRoto`).
      Clave estable: `tipo:sourceId`. Texto corto en español, con programa, fuente, la cifra y el enlace a Webhook Health.
- [x] `lib/alertas/contrato.ts`: esquemas zod `.strict()` de la respuesta (`generadoEn`, `alertas[]` con `clave`, `tipo`,
      `severidad`, `texto`). El handler valida su propia respuesta antes de devolverla.
- [x] `app/api/salud/alertas/route.ts`: `POST`, `x-alertas-secreto` contra `ALERTAS_SECRETO` en tiempo constante; sin
      secreto o distinto, 401 sin cuerpo. Excepción nombrada en el guardián de rutas públicas si existe.
- [x] Tests: el registro con una base PGlite (cada tipo abre y cierra con su caso), el 401 sin secreto, y un guardián
      que falle si la respuesta trae una llave fuera de la lista blanca.
- [x] `docs/operations.md`: `ALERTAS_SECRETO` en la tabla de variables y cómo se agrega una alerta nueva.
      `AGENTS.md`: la excepción en "Nada de la app es público" y la fila del contrato.

## Juanito (repo aparte)

- [x] `src/scheduler/alertas-retia.js`: cron cada 5 min. Dos fallas seguidas → "🔴 El CRM de Retia no responde desde
      HH:MM" una vez; la primera respuesta buena → "🟢 El CRM volvió, estuvo caído N min". Con respuesta buena, compara
      las claves contra las guardadas en SQLite (`getSetting`/`setSetting`): clave nueva → manda su `texto`; clave que
      desaparece → "✅ Resuelta: <texto guardado>". Habilitado solo con `RETIA_ALERTAS_URL`, `RETIA_ALERTAS_SECRETO` y
      `RETIA_ALERTAS_GRUPO`. Mismo molde y dependencias inyectables que `semaforo-retia.js`, con su test.
- [x] `.env.example`, `docker-compose.yml` y `docs/JUANITO-HANDOFF.md`.

## Done cuando

Con la app local y Juanito apuntando a ella, apagar la app produce el mensaje de caída a los 10 minutos y prenderla el
de "volvió"; una fuente con un sobre fallido produce su alerta una sola vez y su "resuelta" al reprocesarlo.

## Cierre (13-nov)

En producción: CRM en `1fcdbfd7` (CI verde), Juanito en `a331770` (PR #93 de Juanito). Primera corrida: 12 alertas al
grupo CRM Retia - Health. Prueba de caída con el secreto cambiado en Vercel: 🔴 a las 14:55 (desde 14:50) y 🟢 "unos
10 min" al restaurarlo, sin repetir las 12 abiertas. El "resuelta" de una alerta se probó solo en los tests.
