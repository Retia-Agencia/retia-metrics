---
id: 274
etapa: hub
serves: "El reporte de pauta de AI Second Brain Jurídico va a su propio grupo de WhatsApp (ADR 0089, enmienda del 16-oct)"
depends: [268, 269]
status: todo
---

# 274 — El grupo del reporte vuelve al programa

## Por qué

El 268 dejó un solo grupo para todos los programas, en el `.env` de Juanito. SBJ (EstadoX) no es de Retia y su
reporte va a otro grupo. Decisión en la enmienda del 16-oct del ADR 0089.

## Qué

**Juanito primero** (repo `30X/repos/Juanito`, `src/scheduler/semaforo-retia.js`): cada envío se manda a
`envio.destino || RETIA_SEMAFORO_GRUPO`, y el aviso de caída a `item.destino || RETIA_SEMAFORO_GRUPO`. Sin destino,
el comportamiento es el de hoy. Tests en `test/semaforo-retia.test.js`: dos envíos con destinos distintos salen a sus
grupos; uno sin destino, al grupo por defecto; el aviso de caída respeta el destino guardado. PR, merge y despliegue
en el VPS **antes** de empujar la parte del CRM.

**CRM:**

1. **Migración aditiva** (la genera y aplica la sesión principal): `reportes_whatsapp.destino text` nulo, con un
   `CHECK` de forma (`destino ~ '^[0-9-]+@g\.us$'` o nulo; probarlo contra el motor, ver la regla del regex en
   `AGENTS.md`).
2. **`lib/catalogo/reportes-whatsapp.ts`:** el esquema zod acepta `destino` (vacío → `null`; si viene, la misma
   forma que el `CHECK`, con un mensaje en español). El cambio va a `change_log` por el molde.
3. **Programa › General (`components/pauta/reporte-whatsapp.tsx`):** un campo "Grupo de WhatsApp" opcional, con la
   ayuda "Vacío: el grupo de alertas de Retia". Sistema "Tinta".
4. **Endpoint `POST /api/semaforo/envios`:** agrupa los programas que tocan por `destino` (nulo es un destino más) y
   devuelve **un envío por destino**, cada uno con `hora`, `destino`, `texto` (`armarMensajeDeLaHora` sobre sus
   bloques) y `bloques`. `configuracion` lleva el `destino` de cada programa. Contrato en
   `lib/reporte-whatsapp/contrato.ts` con `destino: string | null` en los dos.
5. **Docs:** `docs/operations.md` (cómo se configura el grupo de un programa y que Juanito tiene que estar en él) y
   `AGENTS.md` (la fila del contrato del semáforo).

## Done cuando

- `tests/semaforo-endpoint.test.ts`: dos programas sin destino salen en un envío; uno con destino propio sale en otro;
  `configuracion` trae el destino; la lista blanca del contrato sigue mordiendo.
- `tests/reporte-whatsapp.test.ts`: un destino con otra forma se rechaza con 400 y la base no se mueve; vacío se
  guarda como nulo; el cambio deja `change_log`.
- Juanito desplegado y verificado antes del push del CRM.
- Typecheck, lint y `npm run build` limpios.
