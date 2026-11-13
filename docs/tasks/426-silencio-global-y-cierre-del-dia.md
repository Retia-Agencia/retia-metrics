---
id: 426
etapa: operacion
serves: "Mani, 13-nov: avisar si el CRM deja de recibir envíos en 3 h y un mensaje de cierre del día con la salud del CRM (ADR 0130, enmienda punto 6)"
depends: [425]
status: en curso
---

# 426 — Silencio global de 3 h y cierre del día por Juanito

Contrato en el **ADR 0130, punto 6**. Hecho a mano el 13-nov, antes del código: las 4 fuentes de Dapta se desactivaron y el
umbral de silencio de las 4 fuentes vivas quedó en 12 h, por el molde del catálogo (con `change_log`).

## CRM (este repo)

- [ ] `lib/alertas/registro.ts`: cada tipo pasa a `evaluar(fuentes, ahora)` y devuelve sus alertas; los cinco tipos por
      fuente siguen igual por un ayudante. Tipo nuevo `sin_envios_global` (crítica, clave `sin_envios_global:todas`):
      ninguna fuente activa recibió envíos en `HORAS_SILENCIO_GLOBAL` = 3 h, medido con el `ultimo` que ya trae
      `saludDeFuentes`. Sin fuentes activas no suena.
- [ ] `lib/salud/cierre.ts`: `textoDeCierre(db, ahora)` arma el mensaje del día (Bogotá): envíos que llegaron hoy por fuente
      activa con la hora del último, alertas abiertas (las de `alertasActivas`), fuentes webhook sin activar, alarmas de
      Calendly por programa cuando son mayores que cero, y los avisos cableados (semáforo por programa con sus horas,
      avisos a CS creados y entregados hoy, alertas técnicas). Sin datos personales.
- [ ] `app/api/salud/cierre/route.ts`: `POST`, mismo secreto que las alertas, respuesta `.strict()` `{ generadoEn, texto }`;
      ruta pública en `proxy.ts`.
- [ ] Tests del tipo global (abre y cierra), del texto de cierre con una base PGlite (fuente inactiva listada, conteo del
      día, sin correos ni nombres de leads) y del 401.

## Juanito

- [ ] Job de cierre en `src/scheduler/alertas-retia.js`: `CIERRE_RETIA_CRON` por defecto `0 21 * * *` (Bogotá), manda el
      `texto` al grupo de alertas; si el CRM no responde, una línea que lo dice. Con su test.

## Done cuando

En producción, el grupo CRM Retia - Health recibe el cierre de las 9:00 p.m. y la alerta global existe en el registro.
