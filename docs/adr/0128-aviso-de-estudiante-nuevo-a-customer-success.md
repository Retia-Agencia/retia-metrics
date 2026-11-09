# 0128 — Aviso de estudiante nuevo a Customer Success

- **Estado:** aceptada · 9-nov-2026 (pedido de Daniel Tovar en Ventas Francisco; Mani decidió números individuales, varios por persona, con opt-in)
- **Relacionadas:** ADR 0089 (Juanito consulta al CRM), ADR 0097 (bandeja de salida de `moverEtapa`), ADR 0037 (el deal), ADR 0118 (quién administra usuarios), ticket 408

## Contexto

CS de cada programa se enteraba de un estudiante nuevo revisando el CRM a diario. Hace falta avisarles por WhatsApp apenas el deal entra a pago parcial o completo, con nombre, celular y correo, para arrancar el onboarding.

## Decisión

1. **Disparo:** `moverEtapa` escribe una fila de `avisos_estudiante_nuevo` en la misma transacción en que el deal entra a una etapa vendida, igual que `eventos_meta`. Una por deal, por el índice único: "primera vez" lo garantiza la base, no el código.
2. **Destinatarios al leer, no al escribir:** los números de `usuarios_whatsapp` de usuarios `customer_success` activos con membresía activa del programa del deal. Un CS puede tener varios números; un número es de una sola persona (índice único). Ventana de 48 h: un CS nuevo no recibe avisos viejos.
3. **Entrega:** Juanito consulta `POST /api/semaforo/estudiantes-nuevos` con el secreto del semáforo y confirma lo entregado en `.../confirmar`. Lo no confirmado reaparece, así que una caída de Juanito no pierde avisos. Los avisos sin ningún destinatario se cuentan en `sinDestinatario`, nunca se descartan.
4. **Opt-in (convención de Juanito):** Juanito nunca inicia una conversación. Solo manda a números que ya le escribieron; el CRM le entrega la lista `telefonosCs` para que reconozca ese primer mensaje. Sin opt-in no manda ni confirma.
5. **Datos personales:** a diferencia del semáforo, este endpoint lleva nombre, celular y correo de un lead, solo dentro de `texto` y solo al CS de ese programa (el programa es frontera). Contrato `.strict()` con lista blanca y guardián propio. Es la tercera excepción a "nada de la app es público".
6. **Sin producto:** el deal no tiene producto ni SKU hoy; el aviso muestra programa y código de cohorte.

## Consecuencias

- Orden de despliegue: migración y CRM primero (los endpoints quedan quietos), Juanito después.
- Un número solo recibe si está cargado en Ajustes › Usuarios y le escribió antes a Juanito.
