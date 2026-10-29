# 0114: El CRM decide los avisos al equipo y Juanito los entrega

- **Estado:** aceptado · 28-oct-2026 (Mani, grill sobre llevar el CRM a resultados y decisiones con Juanito). Se
  construye en los tickets 340 a 346.
- **Amplía:** ADR 0089 (el semáforo): el mismo molde de máquina, secreto y "¿qué mando ahora?" pasa de un reporte de
  pauta a avisos para closers y para el grupo de ventas de cada programa.
- **Enmienda:** `plan.md` §7 E y `overview.md` §8: "la confirmación de la llamada no llega al CRM (fuera de v1)". Ahora
  llega, la dice el closer y la reenvía Juanito.
- **Confirma:** ADR 0024 (una cifra, una definición), ADR 0004 (el CRM es la fuente de todo lo que no es el lead), ADR
  0042 (toda escritura deja rastro), ADR 0057 (la llamada de Calendly lleva la huella `calendly:<uuid>`).

## Contexto

Leímos los cuatro grupos de ventas de Retia (Ventas ComunicArte, Ventas JP Vieira, Ventas Francisco y Retia Wha
Closing, del 25-sep al 29-oct). Gerencia pregunta a mano, casi todos los días, lo mismo: *¿cómo estamos de calls hoy?,
¿cuántas confirmadas?, ¿cómo vemos los 3 cupos de hoy?, ¿qué pasó con el show?* Los closers contestan a mano y Michael
calcula el show rate a mano. El CRM ya sabe casi todo eso, pero solo lo muestra a quien entra.

Además: a los closers de Retia Juanito les sigue mandando el link del Google Sheet después de cada llamada (Push 5),
cuando el registro vive en el CRM desde el 28-sep. Y el 22-oct Juanito se cayó y nadie lo supo hasta que un closer
preguntó por los links.

Juanito ya hace en 30X dos cosas útiles aquí: pregunta al closer el resultado después de la llamada (Push 4, que guarda
en su propia SQLite) y le pregunta quiénes le confirmaron (18.CN, desde el 13-oct).

## Decisión

1. **El CRM decide qué avisar, a quién y cuándo; Juanito solo entrega.** Juanito le pregunta al CRM cada pocos minutos
   "¿qué mando ahora?" y recibe avisos con su destino y su texto ya armado. Juanito no calcula ninguna cifra ni guarda
   estado de negocio. Cada aviso tiene una llave única, así que repetir la consulta no lo duplica, y Juanito confirma
   cada entrega.
2. **El resultado de una llamada se registra en el CRM, no por WhatsApp.** El aviso al closer lleva un enlace al deal
   (id opaco) o a su lista. El motor de etapas exige lo que falta (valor, abono), y eso no cabe en un mensaje. El Push
   4 no se trae a Retia y el Push 5 (el link al Sheet) se apaga.
3. **El destinatario es un correo de usuario del CRM, y Juanito lo traduce a número** con su propio directorio y su
   opt-in anti-ban. Ningún teléfono sale del CRM. Un correo que Juanito no resuelve se informa como no entregado, nunca
   se pierde en silencio.
4. **Ningún dato del lead viaja en un aviso.** Hora, programa, conteos, nombres de closers y enlaces. Un aviso nunca
   lista: cuenta y enlaza, así que mide igual con 1 pendiente que con 40.
5. **Al closer:** un aviso por llamada 15 minutos después de que termina, si sigue sin resultado (una línea, un
   enlace, una sola vez). Lo pendiente no se repite: entra al resumen de la mañana, que usa **los mismos conteos de la
   pestaña Notificaciones**.
6. **Al grupo de ventas del programa, el pulso del día:** a las 8 a. m. la agenda del día por closer; a la 1 p. m. y a
   las 5 p. m. las ventas de hoy contra la meta del día y las confirmadas; al cierre, lo que quedó sin resultado. El
   grupo es un dato del programa, igual que el destino del semáforo (274).
7. **La confirmación la dice el closer y la reenvía Juanito.** Juanito sigue haciendo la pregunta y entendiendo la
   respuesta ("1 3", "el 2 canceló"); al CRM le manda el resultado interpretado por la huella `calendly:<uuid>`, que
   los dos ya usan. El CRM la escribe con rastro y origen whatsapp, idempotente. **"Cancelada según el closer" solo se
   anota**: no cancela la llamada (eso es de Calendly o de la reagenda en el CRM) y no mueve ninguna etapa.
8. **Cada aviso queda con su estado (servido, entregado, vencido) y la última consulta de Juanito queda guardada.** El
   Hub muestra un banner cuando Juanito no consulta en horario hábil.
9. **Se enciende y se apaga por programa**, como el reporte del semáforo (265).

## Consecuencias

- Los endpoints de avisos son excepciones nombradas a "nada es público", con el mismo molde del semáforo: secreto en
  cabecera comparado en tiempo constante, 401 sin cuerpo, respuesta validada con un esquema `.strict()` sin campos de
  persona del lead.
- 🩸 **Techo aceptado (Mani):** nadie avisa a nadie cuando Juanito muere; solo el banner del Hub, que hay que abrir. En
  la práctica, el pulso de las 8 a. m. que no llega al grupo es el aviso. Mejora cuando duela: un monitor de latidos
  externo al que Juanito le hace ping, o Vercel Pro con un cron corto (R3).
- El correo de Calendly de un closer (el que conoce Juanito) y su correo de Google (el del CRM) pueden ser distintos:
  hay que alinearlos antes de encender un programa.
- Fuera de este corte: el setteo (los intentos de contacto viven en Kapso y en un Excel, el CRM no los tiene), las
  alertas por persistencia (esperan QD-6), la fuente rota por DM y el anuncio automático de ventas (los closers lo
  hacen como ritual del equipo).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Push 4 de 30X en Retia, con el resultado guardado en Juanito | dos fuentes de verdad para el mismo hecho; el CRM no se enteraría |
| El closer responde el resultado por WhatsApp y Juanito lo escribe en el CRM | una venta por WhatsApp llega sin valor ni abono: el motor la rechazaría o quedaría a medias |
| El CRM guarda el WhatsApp de cada usuario | el endpoint empezaría a devolver teléfonos y Juanito igual necesita su propio opt-in |
| Un aviso por cada pendiente, repetido | a un closer atrasado le llega una sábana; la fatiga mata el canal |
| Juanito suma su propio conteo de confirmadas al pulso | dos fuentes en un mismo mensaje, y el CRM sigue sin poder medir el show rate por confirmación |
| El CRM cancela la llamada cuando el closer dice "canceló" | un error de dedo mueve datos reales sin pantalla y deja a Calendly desincronizado |
| Pulso por DM a cada gerente o en un grupo aparte | las preguntas se hacen en el grupo de ventas, y los closers no verían el marcador |
