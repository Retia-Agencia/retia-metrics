-- Ticket 117: el enum `calificacion_envio` se retira DESPUES del deploy del 117 (las columnas son texto
-- desde la 0051). Sin CASCADE: si algo aun dependiera del tipo, falla en vez de llevarselo.
DROP TYPE "public"."calificacion_envio";