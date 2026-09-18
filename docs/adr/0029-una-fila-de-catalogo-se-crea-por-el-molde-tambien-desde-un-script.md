# 0029 — Una fila de catalogo se crea por el molde, tambien desde un script

**Fecha:** 2026-09-18 · **Estado:** aceptado (Mani, 18-sep) · **Enmienda:** ADR 0012, ADR 0024

## El problema

El 18-sep (CIERRE 7) se cargaron los 5 enlaces de pago de PayPal de ComunicArte en `production`
con `scripts/cargar-enlaces-pago.ts`. El script hacia `db.insert(enlacesPago)` en crudo.
Resultado, verificado en la base: **`change_log` de `enlaces_pago` quedo en 0**. Cinco filas de
negocio reales aparecieron en produccion sin quien ni cuando.

No fallo nada. Esa es la forma de la falla: **omitir un rastro no lanza ningun error.** Dentro de
tres meses, la pregunta "¿quien puso estos links y con que autorizacion?" no tiene respuesta en la
base, solo en la memoria de alguien.

La pregunta que quedo abierta en el handoff estaba mal planteada: *"¿un script de semilla debe
dejar rastro?"*. Puesta asi mete en la misma bolsa dos cosas distintas:

- `scripts/seed-datos.ts` sembrando una base **vacia**, donde no hay a quien atribuirle nada ni
  historia que auditar.
- `scripts/cargar-enlaces-pago.ts` metiendo cinco filas de negocio en una base **viva**, que es
  exactamente lo mismo que hace la pantalla, solo que desde la terminal.

Y el mismo dia se pago el precio de no distinguirlas: `npm run seed:datos` se corrio contra
`production` dando por hecho que seria un no-op, y **inserto 3 productos duplicados** porque
reconcilia por nombre y los nombres reales habian cambiado. Una semilla sobre una base viva no es
una semilla: es una escritura.

## Decidimos

**1. La linea no es "script o pantalla". Es "la base ya esta viva".**

Un script que escribe filas de negocio en una base con datos reales esta haciendo lo mismo que un
humano en una pantalla, y se somete a las mismas reglas.

**2. Una fila de catalogo se crea llamando la funcion de `lib/catalogo/`, nunca con `db.insert`.**

Es el ADR 0024 aplicado al alta: si dos lugares responden la misma pregunta —*"¿como nace un
enlace de pago?"*— la respuesta vive en un modulo y los dos la importan. La pantalla ya llamaba
`crearEnlacePago`; el script ahora tambien. De ahi salen **gratis** la validacion con el esquema
zod de la entidad y la fila de `change_log`. No hay que acordarse de registrar: no hay forma de
crear la fila sin que quede registrada.

**3. Un script que escribe en una base viva nombra a su actor, y se niega a arrancar sin el.**

El molde pide un `userId` para `change_log` y un script no tiene sesion. La respuesta vive en UN
solo lugar, `actorDelScript()` en `scripts/actor.ts`, para que el proximo script no se vuelva a
inventar la respuesta (ni se salte el molde por no tenerla). Lee `SCRIPT_ACTOR_EMAIL`, exige que
el usuario exista en **esa** base y este activo, y devuelve su id.

Va por variable de entorno y no por argumento de linea de comandos a proposito: un argumento se
copia de un README y termina siendo siempre el correo de otra persona.

Se exige que el usuario exista y este activo, **no un rol**. Quien puede crear que cosa ya lo
decide la funcion del catalogo que el script llama; lo que este modulo garantiza es que
`change_log` apunte a una persona real y no a un uuid inventado.

**4. Las semillas de arranque son la excepcion, y es explicita.**

Sembrar una base vacia (local, `dev`, o `production` la primera vez) no tiene a quien atribuirle
nada. `scripts/seed-datos.ts` queda como esta, y `scripts/usuarios.ts` tambien: ese existe
justamente para el caso en que no hay ningun administrador con quien actuar, asi que exigirle un
actor lo dejaria inservible el dia que hace falta. Son dos excepciones nombradas, no un permiso
general para que un script escriba en crudo.

## Estado real hoy, sin adornos

| Script | Escribe en | Pasa por el molde | Deja rastro |
|---|---|---|---|
| `scripts/cargar-enlaces-pago.ts` | base viva | **si** (desde este ADR) | **si** |
| `scripts/seed-datos.ts` | base vacia (excepcion 4) | no | no |
| `scripts/usuarios.ts` | acceso de emergencia (excepcion 4) | valida con el mismo zod, escribe en crudo | no |
| `scripts/backfill-fechas-centinela.ts` | reparacion de una sola vez, ya ejecutada | no aplica (no es catalogo) | no |

**Lo que NO se arreglo con este ADR, y hay que decirlo:** los 5 enlaces de pago que ya estan en
`production` siguen sin fila en `change_log`. No se les inventa una con fecha de hoy y un autor
elegido a dedo: un rastro de auditoria fabricado es peor que su ausencia, porque el de mentira se
ve igual que el de verdad. Queda escrito aca y en el handoff: esos 5 entraron el 18-sep con el
script viejo.

**Y queda una cosa sin decidir:** `seed-datos.ts` corrido sobre una base viva sigue pudiendo
insertar de mas, que es como nacieron los 3 productos duplicados. La reja natural es que cada
seccion se niegue a tocar una tabla que ya tiene filas que la semilla no puso, pero eso choca con
un uso real: la seccion de `sources` **actualiza** filas existentes a proposito, y re-sembrar es
como hoy se ajusta el plan de sync en `dev`. Decidir cuales secciones son de arranque y cuales
son configuracion re-corrible es su propia decision, y no se toma de paso en este ADR.

## Consecuencias

- **A favor:** la pregunta desaparece en vez de responderse. Nadie tiene que acordarse de escribir
  en `change_log`, porque la unica forma de crear la fila ya lo hace.
- **A favor:** el proximo script hereda el actor sin pensarlo, importando un modulo.
- **En contra:** correr `cargar-enlaces-pago` ahora exige una variable mas. Es el costo de que la
  base sepa quien hizo cada cosa, y falla al arrancar con un mensaje que dice exactamente que
  poner, no a mitad de la carga con filas ya escritas.
- **En contra:** la tabla de arriba envejece. Cuando se agregue un script que escriba catalogo, va
  en esa tabla o el ADR empieza a mentir.
