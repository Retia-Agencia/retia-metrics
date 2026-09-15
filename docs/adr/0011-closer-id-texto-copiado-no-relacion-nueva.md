# 0011 — La identidad del closer en escrituras nativas es texto copiado, no una relacion nueva a users

**Fecha:** 2026-09-15

`calls.closerId` y `sales.closerId` ya son texto libre, cruzado contra `users.closerId` por
nombre: un diseno pensado para filas de Sheets, donde no hay sesion ni usuario autenticado. Ahora
que un closer crea sus propios registros con sesion activa, la opcion "correcta" en una base de
datos relacional seria agregar una relacion real a `users.id`.

**Decidimos no agregarla.** El valor de `closerId` que se guarda en un registro nativo se copia
automatico del `closerId` ya cargado en la cuenta del closer logueado; el closer nunca lo escribe
ni lo elige. Esto mantiene una sola columna de identidad para agrupar por closer sin importar si
el dato vino de Sheets o de la app. La alternativa (sumar `userId`) resolveria la integridad
referencial, pero crearia dos formas de identificar al mismo closer, y cualquier reporte por closer
tendria que unir ambas.

**Precondicion:** todo closer necesita su `closerId` cargado en su cuenta antes de usar el CRM.
Ya estaba pendiente en `docs/spec.md`, bloque de supuestos, como tarea de onboarding.
