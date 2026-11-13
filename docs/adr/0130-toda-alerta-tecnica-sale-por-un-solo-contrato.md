# 0130 — Toda alerta técnica sale por un solo contrato: el CRM la evalúa, Juanito la entrega

- **Estado:** aceptada · 13-nov-2026 (Mani, tras la caída del 12-nov)
- **Relacionadas:** ADR 0089 (Juanito consulta al CRM), ADR 0128 (avisos a CS por Juanito), ADR 0058 (caja negra del webhook), ticket 107 (salud de fuentes), ticket 425

## Contexto

El 12-nov el proyecto de Vercel estuvo en el plan Hobby y dejó de servir unas 19 horas (de ~00:17 a 19:40 UTC):
ningún webhook entró y se perdieron 38 aplicaciones de tres programas. Nadie se enteró hasta el día siguiente. Las
señales existían a medias: la pantalla de Webhook Health marca una fuente silenciosa, pero solo si alguien la abre, y
el aviso de caída del semáforo (`avisarCaida` en Juanito) sale solo a la hora de un semáforo y al grupo de Pauta,
con un texto que no dice "el CRM está caído".

Mani pidió que cualquier falla grave le llegue por WhatsApp a él y a los devs, al grupo **CRM Retia - Health**, y que
toda alerta futura se construya de la misma manera.

## Decisión

1. **Dos preguntas, dos lugares.**
   - *¿El CRM responde?* La contesta **Juanito**, porque un CRM caído no puede avisar que está caído. Juanito llama al
     endpoint de alertas cada 5 minutos; dos fallas seguidas (no 200, contrato inválido o sin respuesta) abren la
     alerta "El CRM no responde", y la primera respuesta buena la cierra con la duración.
   - *¿El CRM funciona bien?* La contesta **el CRM**, en un registro de alertas.
2. **Un registro exhaustivo de tipos de alerta** en `lib/alertas/registro.ts`. Cada tipo declara su clave, su
   severidad y una función que, con la base, devuelve las alertas activas de ese tipo, cada una con una **clave
   estable** (el tipo más la fuente o el programa) y su texto. Una alerta nueva es **un tipo nuevo en el registro y su
   test**; ni el endpoint ni Juanito cambian. Ningún tipo recalcula un predicado que ya vive en otro módulo (N1): las
   condiciones de las fuentes salen de `saludDeFuentes` (`lib/queries/salud-fuentes.ts`).
3. **El endpoint** `POST /api/salud/alertas`, con `x-alertas-secreto` comparado en tiempo constante (secreto
   `ALERTAS_SECRETO`, propio, no el del semáforo: quien lee alertas no clasifica campañas). Sin secreto, 401 sin
   cuerpo. Responde las alertas activas con un contrato zod `.strict()`. Responder ya prueba que la app y la base
   están vivas, porque el registro lee la base. Es la cuarta excepción a "nada de la app es público" y **no lleva
   datos personales**: nombres de programa y de fuente, conteos y un enlace, nunca un lead.
4. **Juanito solo entrega y recuerda.** Guarda en su SQLite las claves abiertas; manda un mensaje al **abrirse** una
   clave y otro al **cerrarse**, nunca el mismo dos veces. El texto lo arma el CRM (como el semáforo, ticket 267);
   Juanito solo arma los dos mensajes de "no responde" y "volvió", que el CRM no puede mandar. El destino es un solo
   grupo, `RETIA_ALERTAS_GRUPO` en el `.env` de Juanito.
5. **No se repite una alerta abierta.** Una alerta que sigue abierta no vuelve a sonar; si hace falta recordatorio,
   se decide después con datos de uso.

## Consecuencias

- Orden de despliegue: CRM primero (el endpoint queda quieto sin Juanito), luego `ALERTAS_SECRETO` en Vercel y en el
  `.env` de Juanito, luego Juanito.
- Al encenderse, cada condición que ya está mal hoy suena una vez (por ejemplo, una traza de pauta rota). Es esperado.
- Los umbrales de silencio de cada fuente son datos editables (`umbral_sin_respuesta_horas`, hoy 48 h por defecto):
  para que una caída de ingesta suene en horas y no en días, se bajan desde Webhook Health, no en el código.
- Las alertas que hoy viven sueltas en Juanito (`avisarCaida` del semáforo) siguen como están; migrarlas al registro
  es un ticket aparte si Mani lo pide.
