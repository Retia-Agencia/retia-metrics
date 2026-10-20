# 0095: Las integraciones de un programa viven en una tabla, con un solo molde de secreto

- **Estado:** aceptado, 19-oct-2026 (Mani, `/grill-with-docs`). Se construye en el 278; desbloquea el 279.
- **Enmienda:** ADR 0057 (el token de Calendly vivía en `programs` y un CHECK exigía el token para activar un programa),
  ADR 0062 punto del token (uno global en `meta_conexiones`), la decisión del 29-sep del token de Typeform por fuente
  (126 B) y el ADR 0094 punto 4 en lo que toca a Ajustes › Meta.
- **Confirma:** ADR 0012 (el tipo es código, la instancia es fila), ADR 0043 (el programa es frontera), ADR 0055 (el
  HMAC es de la fuente), ADR 0077 (cada dato en la pantalla de su objeto), ADR 0093 (Form30x en Vercel).

## Contexto

Cada conexión con un proveedor cayó donde se construyó: Calendly en `programs`, Typeform y el HMAC en `sources`, Meta en
`meta_conexiones`, Form30x en Vercel. Cada una copió las mismas reglas de secreto (un escritor, nunca se devuelve, el
rastro sin el valor, un guardián). La llave de Dapta, que necesita el 279, solo estaba en el `~/.zshrc` de Mani, una por
workspace, y cada programa tiene su workspace. Mani (19-oct): *"que todo quede por programa, como una pestaña de
integraciones, para que sea súper sencillo agregar nuevas"*.

Medido el 19-oct en producción (solo lectura): 4 programas activos con token y clave de firma de Calendly; el token de
Typeform es el mismo valor en las 3 fuentes que lo tienen (una cuenta); una conexión de Meta.

## Decisión

1. **Una tabla `integraciones`**, una fila por `(programa, tipo)` con índice único. El tipo es un `pgEnum`
   (`dapta`, `typeform`, `calendly`, `meta`) porque el código decide con él: cómo se prueba y quién lo lee. Columnas:
   `secretos` (jsonb, los valores que no se devuelven nunca; Calendly tiene dos, el token y la clave de firma del
   webhook), `config` (jsonb, lo no secreto, p. ej. el workspace o el usuario del proveedor), `probada_en` y quién la
   cargó. Se descartaron las columnas por integración (cada una nueva repetía el molde) y el tipo como texto (el código
   igual tiene que saber probarlo).
2. **Entran Dapta, Typeform, Calendly y Meta.** Meta pasa a ser **por programa**: cada programa guarda su token (hoy el
   mismo valor en todos) y el gasto de una cuenta se lee con el token del programa de esa cuenta. Así un programa puede
   usar otro portafolio sin código. Rotar el token es cargarlo en cada programa. **Se quedan fuera** y la pestaña los
   muestra como heredados, con enlace: el HMAC del webhook (es la identidad de cada fuente, y un programa tiene N, ADR
   0064) y Form30x (la key es de la compañía y ve forms ajenos a Retia, ADR 0093).
3. **Un solo molde, en `lib/integraciones/`.** Un registro exhaustivo `INTEGRACIONES` (como `PROVEEDORES` de ingesta)
   dice por tipo: el esquema de sus secretos, el de su config y `probar()` contra el proveedor. **Un escritor**: guarda
   solo si la prueba pasa y, en la misma transacción, escribe `change_log` con el valor oculto y `probada_en`. **Un
   lector del secreto por tipo**, que solo importan los módulos que hablan con ese proveedor. Un test guardián falla si
   otro archivo lee la columna `secretos` o si un estado devuelto la trae. El HMAC de las fuentes usa el mismo helper
   del rastro oculto, para que la regla viva en un lugar.
4. **La migración copia en la base y va en dos pasos.** Paso 1: una migración crea la tabla y copia los secretos con
   `INSERT ... SELECT` (ningún secreto pasa por un script, un archivo ni el chat), y el código desplegado lee solo de
   `integraciones`. El CHECK `programs_activo_con_token` se quita: un programa activo exige su integración de Calendly
   y lo verifica `reactivarPrograma`, igual que la fuente principal (ADR 0068). Las columnas viejas quedan sin lector.
   Paso 2, cuando producción muestre que las citas, los envíos y el gasto siguen entrando: otra migración borra
   `programs.calendly_token`, `programs.calendly_signing_key`, `sources.typeform_token` y `meta_conexiones`. Hueco
   aceptado: un token rotado entre la migración y el deploy se perdería; son minutos y no se rota en ese rato.
5. **La ve quien configura el programa** (`configuraPrograma`: gerente y developer), dentro del alcance del ADR 0094.
   Un programa ajeno responde 404, y cada server action resuelve el programa de la fila que toca. Se muerde forjando
   la petición.
6. **Lo suelto se quita (ADR 0077):** el botón de token de Typeform de cada fuente, la tarjeta Calendly de Captación,
   la tarjeta Cuentas de Meta de General y **Ajustes › Meta entero**. En Integraciones, cada fila trae lo suyo: Meta su
   token, sus cuentas vinculadas y "sincronizar ahora"; Calendly su token y el estado del webhook. La fuente conserva
   su form id y su HMAC.

## Consecuencias

- Agregar una integración es un valor del enum, una entrada del registro y su `probar()`; la pestaña la pinta sola.
- La pestaña nunca recibe un secreto: recibe tipo, configurada o no, `probada_en` y la config no secreta.
- El paid trafficker deja de ver la conexión de Meta (Ajustes › Meta, que el ADR 0094 le abría con
  `manejaPautaGlobal`). El gasto lo sigue viendo en el Hub.
- Ya no hay vista global de las cuentas de todos los programas; cada programa muestra las suyas.
- Los secretos siguen en claro en la base, como antes (ADR 0055, 0057). Cifrarlos es otra decisión.
