---
status: done
---

# 203 · Reinicio operativo de ComunicArte y Tactical Investor

## Decisión

El 7-oct-2026 Mani decidió que el corte comercial no trae la historia dispersa de Sheets. ComunicArte y Tactical
Investor empiezan desde cero en el CRM; Comunícate con Confianza queda intacto. Las hojas dejan de ser herramienta
operativa y no se ejecuta el 078 para estos dos programas.

## Alcance

- Respaldar producción fuera del repo antes de borrar.
- Identificar los programas por `program_id`, nunca por nombre ni por coincidencia de slug.
- Borrar en una sola transacción la historia operativa de ambos: sobres y entregas de webhook, envíos, contactos,
  leads, deals, movimientos, actividades, cuotas, llamadas, notificaciones de Calendly, abonos, rarezas, pauta y
  corridas legadas de sync.
- Conservar la configuración: programas, cohortes, fuentes y secretos, tokens y firma de Calendly, membresías,
  cuentas de Calendly, recursos, enlaces de pago y catálogos.
- No tocar ninguna fila operativa ni de configuración de Comunícate con Confianza.
- Verificar por API que los webhooks externos de Typeform y Calendly están activos y apuntan a las rutas correctas;
  verificar en producción que el host de Calendly resuelve a la membresía y asigna el deal.

## Criterios de cierre

- El respaldo se puede listar con `pg_restore --list`.
- Todos los conteos operativos de ComunicArte y Tactical quedan en cero después de la transacción.
- Los conteos de Comunícate con Confianza coinciden exactamente antes y después.
- Las fuentes principales, secretos, tokens, firmas y membresías de los dos programas sobreviven sin cambios.
- Typeform y Calendly conservan una suscripción activa por programa hacia producción.
- Un recorrido firmado de formulario + cita deja el deal en Agendado y con el dueño que corresponde al host; sus
  datos de prueba se eliminan antes del conteo final.

## Cierre · 7-oct-2026

- Respaldo completo validado con PostgreSQL 17 en
  `~/retia-backups/retia-production-antes-reinicio-comercial-20261007-204022.dump` (fuera del repo).
- La transacción borró 6.003 leads, 7.667 envíos, 1.064 sobres, 1.052 entregas, 666 deals, 241 llamadas,
  683 movimientos, 442 actividades, 38 notificaciones y 12.113 contactos de los dos programas.
- Conteo final de ambos: cero en todas las tablas operativas. Comunícate con Confianza conservó exactamente 8
  leads, 18 envíos, 40 sobres/entregas, 9 deals, 7 llamadas y 18 contactos.
- La huella de programas, fuentes, secretos, tokens, firmas y membresías fue idéntica antes y después.
- Typeform y Calendly: suscripciones externas activas hacia producción. Prueba firmada completa en cada programa:
  formulario crea lead/deal, Calendly lo mueve a Agendado y lo entrega al host; los dos casos sintéticos se borraron.
- Configuración confirmada por Mani: Jero opera solo como setter. Aunque técnicamente usa la capacidad comercial del
  rol `closer`, no hospeda llamadas y por eso **no debe** tener `calendly_email` ni pertenecer a las organizaciones de
  Calendly. Andrea y Maru sí están vinculadas y la cita les entrega el deal automáticamente como hosts.
