---
id: 035
fase: F1
serves: "spec §5 criterio 5 (registrar el abono con su respaldo) · enmienda parcial al ADR 0017"
depends: [019]
status: todo
---

# 035 — El comprobante de un abono: link **o** foto subida

> **Mani, 20-sep:** *"Quiero que permita links y/o fotos de comprobantes."* Y sobre el costo:
> *"toca analizar el pedo de archivos y cómo crece con el tiempo."*

## Objetivo

Al registrar un abono, el closer puede **pegar un link** (como hoy) **o subir una foto** del
comprobante desde el celular. Las dos, no una en vez de la otra.

## Por que esto es una enmienda y no un ticket cualquiera

El **ADR 0017** decidio explicitamente lo contrario: *"Los recursos y comprobantes se guardan como
links, no como archivos subidos"*. Sus razones siguen siendo validas para los RECURSOS (un
brochure ya vive en Drive y el equipo lo actualiza ahi; duplicarlo crea dos versiones que se
desincronizan).

**Pero no aplican igual al comprobante de un abono, y esa es la distincion que abre este ticket:**
un pantallazo de una transferencia **no vive en Drive**. Vive en el WhatsApp del closer. Pedirle
que lo suba a Drive y pegue el link es pedirle tres pasos desde el celular, en la mitad de una
llamada, para un archivo que nadie va a volver a editar. Es justo el caso que el ADR 0017 no
contemplo.

El propio ADR 0017 dejo la puerta: *"Si mas adelante hace falta subir archivos, se abre un ADR
nuevo; este queda superseded"*.

🎯 **El ADR nuevo lo supersede SOLO en la mitad del comprobante.** Los recursos siguen siendo
links. Escribir "queda superseded" a secas abriria la subida de archivos para todo, que no es lo
que Mani pidio.

## Lo que hay que analizar ANTES de decidir (Mani lo pidio explicito)

**El crecimiento.** Esta es la parte del ticket que no se puede saltar, y hay numeros para
dimensionarla, medidos en `production` el 19-sep: la base entera pesa **15 MB**, y `people.raw`
son 2.520 kB (551 bytes por persona). Una sola foto de comprobante de celular pesa entre **1 y 5
MB**: es decir, **20 comprobantes pesan mas que toda la base de datos de hoy.**

Preguntas a responder con datos, no con opinion:

- **Cuantos abonos se registran por mes?** Sale de `abonos`, contando por fecha. De ahi sale el
  crecimiento en MB/mes y el costo a 12 meses.
- **Se comprime la imagen antes de subirla?** Un JPEG de comprobante legible cabe en ~200 kB. La
  diferencia entre comprimir y no comprimir es de un orden de magnitud, y se hace en el navegador
  antes de subir.
- **Hay techo de retencion?** Ojo: la decision del 19-sep fue *"se guarda TODO para siempre"*
  para el lead y `people.raw`. **Un comprobante es otra cosa y no hereda esa decision
  automaticamente**, aunque lo natural es que la herede. Hay que decidirlo, no asumirlo.

## Y la pregunta de seguridad, que es la que mas pesa

**Un comprobante es un dato de pago de una persona identificable.** Hoy `comprobanteUrl` es un
link a Drive, o sea que el control de acceso lo hace Drive y no nosotros. Si el archivo pasa a
vivir en nuestra infraestructura, el control de acceso **pasa a ser nuestro**.

- Vercel Blob por defecto sirve URLs **publicas y no adivinables**. "No adivinable" no es "con
  permiso": quien tenga el link entra sin sesion. Eso choca de frente con la regla dura
  *"Nada de la app es publico. Sin sesion no se ve ni una cifra."*
- Blob tambien ofrece almacenamiento privado, que pide firmar la URL o servirla por una ruta con
  `requireRole`. Es mas trabajo y es lo que la regla dura exige.
- **Quien puede ver el comprobante de un abono ajeno?** Dentro del dashboard rige "todos ven
  todo" (ADR 0009), pero una cifra agregada y la foto del pago de una persona con nombre no son
  lo mismo. **No se asume que 0009 cubre esto.**

## Alcance

- Dentro: el formulario de abono acepta link, o archivo, o ninguno. Los tres son validos.
- Dentro: validacion en el borde (tipo y tamano), como todo input (`zod` en el borde).
- Dentro: compresion en el navegador antes de subir, si el analisis dice que vale la pena.
- Dentro: la ruta que sirve el archivo pasa por guarda de rol. Nunca una URL publica.
- Dentro: el ADR nuevo, que supersede al 0017 **solo en la mitad del comprobante**.
- Fuera: subir archivos para RECURSOS. El ADR 0017 sigue firme ahi.
- Fuera: migrar los comprobantes que hoy son links. Siguen siendo links y funcionan.

## Done cuando

- [ ] Un closer registra un abono con una foto desde el celular, sin salir de la app.
- [ ] Un closer registra un abono pegando un link, como hoy. **No se rompio nada.**
- [ ] El archivo NO es accesible sin sesion. Probado pidiendo la URL desde una ventana sin
      sesion, no mirando que el boton no aparezca.
- [ ] Un archivo que no es imagen, o que pasa el tamano maximo, se rechaza en el servidor.
- [ ] El ADR nuevo dice explicitamente que los recursos siguen siendo links.
- [ ] Hay un numero de crecimiento estimado por mes, escrito, no intuido.

## Nota

`abonos.comprobante_url` ya existe y no hay que migrarlo: una URL de Blob es una URL. Lo que cambia
es quien la produce y quien controla el acceso.
