---
id: 082
etapa: E7
serves: "plan v2 §6 etapa 7 · tarea E7-6 · ADR 0004 (enmendado), ADR 0069; reescrito el 15-oct tras el corte en cero (203)"
depends: [203]
status: todo
---

# 082 — Apagar las pestañas de gestión de la hoja

> **Reescrito el 15-oct.** La versión del 21-sep suponía que la operación pasaría al CRM con una migración
> (078) y que el Apps Script del `Estado` alimentaba al CRM. Las dos cosas cambiaron: el 7-oct el corte en
> cero (203) reinició ComunicArte y Tactical Investor en el CRM sin migrar nada, y desde el ADR 0069 el
> `estado` no enruta (la etapa de entrada la decide el CRM con tres hechos del envío). Lo que sigue es el
> estado real.

## Objetivo

Que el equipo deje de trabajar en Sheets y opere solo en el CRM. Es el último paso de la época de las hojas.

## Lo que se sabe al 15-oct

- **Los closers siguen usando las hojas.** Medido el 15-oct (`docs/operations.md` §9, incidente del 14-oct):
  los campos ocultos de Meta corrieron 3 columnas en las dos hojas y el enrutador de CA dejó de clasificar.
  Se notó porque había gente mirando `Setteo` y `Descartados`. Mani había dado por hecho que ya no se usaban.
- **El Apps Script ya no le importa al CRM.** El CRM no lee el `Estado` de la hoja ni la hoja en sí: los
  leads entran por el webhook (ADR 0004, sync retirado el 28-sep con el 108) y el 15-oct tenía 0 errores en
  `sobres_crudos` con las hojas rotas. La advertencia vieja ("apagar el Apps Script deja de crear deals") ya
  no aplica. El Apps Script solo sostiene las pestañas que los closers todavía miran.
- **No hubo migración que respaldar.** El argumento viejo para no borrar ("son el respaldo de la migración")
  cambió de forma: las pestañas son el **historial de la operación antes del 7-oct**, que no está en el CRM.
  Siguen sin borrarse.

## Alcance

- **Dentro:** confirmar con los closers de ComunicArte y Tactical Investor (y con Jero) que ya no
  necesitan `Setteo`, `Descartados`, `Registro de llamadas` ni `Estudiantes`, o qué les falta en el CRM para
  dejarlas. Lo que falte se anota en `docs/anotaciones.md` y bloquea este ticket.
- **Dentro:** dejar esas pestañas en **solo lectura** (protección de rango de Google Sheets), con un aviso
  arriba que diga que la operación vive en el CRM desde el 7-oct.
- **Dentro:** **no se borra ninguna pestaña.** Una pestaña borrada no se recupera.
- **Dentro:** la pestaña de intake (la que escribe Typeform) sigue viva. No la lee el CRM, pero es un
  respaldo gratuito de los envíos.
- **Dentro, al final:** apagar los activadores de los Apps Script de enrutamiento, cuando nadie dependa de
  las pestañas que alimentan. Antes de eso, arreglar las constantes corridas el 14-oct (handoff del 15-oct)
  si los closers siguen usándolas.
- **Fuera:** cualquier código del CRM. Este ticket no toca el repo salvo para cerrar el tracker.

## Done cuando

- [ ] El equipo confirma por escrito (WhatsApp o reunión) que opera solo en el CRM.
- [ ] Las pestañas de gestión están en solo lectura, con su aviso. Ninguna borrada.
- [ ] Los activadores de enrutamiento están apagados, o hay una razón escrita para mantenerlos.
- [ ] La copia de `work/retia/apps-script-sheets/` y su README dicen el estado final.

## Quién

**Mani, a mano.** Es la hoja de producción del equipo y una conversación con los closers. Ningún agente.
