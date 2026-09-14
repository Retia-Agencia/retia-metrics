# 0005 — El dedup se garantiza con un indice unico, no solo con codigo

**Fecha:** 2026-08-19

Los formularios de aplicacion tienen duplicados masivos: Tactical Investor tiene ~2.950 filas que
son ~1.840 personas (38%), y hay un correo con 12 aplicaciones. Toda tasa del dashboard se calcula
sobre personas; calcularla sobre filas infla los numeros cerca de un 60% y toda decision de
presupuesto sale mal.

**Decidimos garantizarlo en dos capas:** dedup puro en `lib/sheets/dedup.ts` (por correo
normalizado: minusculas y trim) **y** un indice unico en la base sobre
`(program_id, email_normalizado)`. Las tablas `calls`, `sales` y `ad_spend` llevan el mismo
tratamiento con un indice unico sobre `(program_id, huella_fila)`.

La capa de codigo sola no basta. Un bug en el sync, una importacion manual o un script de seed mal
corrido meten duplicados en silencio, y el sintoma no es un error sino un numero que se ve
plausible. Con el indice unico, el intento falla ruidosamente en el momento en vez de corromper el
calculo durante semanas.

El dedup conserva la fecha de primera aplicacion mas antigua, no deja que una aplicacion posterior
con campos vacios borre lo que ya se sabia, y cuenta `num_aplicaciones` como senal de intensidad.
