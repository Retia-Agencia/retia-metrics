---
id: 241
etapa: dinero
serves: "235 · ADR 0085 puntos 7 y 8 (C-4: Supabase no respalda los archivos)"
depends: [238]
status: hecho
---

# 241 — Respaldo de los comprobantes en Drive, y barrido de pendientes

## Por qué existe

Los respaldos de Supabase cubren la base, no los archivos. Un comprobante es evidencia de dinero: si el bucket se
pierde, se pierde con él. Además, una subida que nunca se confirmó deja un archivo huérfano.

## La regla del respaldo

**Drive es un espejo del CRM, no una fuente.** Se regenera desde la base; nadie lo edita a mano, y lo que se cambie
allá no vuelve. Por eso los nombres pueden ser legibles para humanos: si el dato cambia en el CRM, el espejo se
reacomoda en la siguiente corrida.

## Estructura (decidida el 13-oct con Mani)

```
Comprobantes CRM Retia/                      ← unidad compartida propia, en el Workspace de Retia
  ComunicArte/
    C3/
      2026-10-13 Ana Pérez USD 300,00 (a1b2c3).jpg
      ANULADO 2026-10-02 Juan Gómez USD 150,00 (d4e5f6).pdf
    Sin cohorte/
  Tactical Investor/
  Comunícate con Confianza/
```

- **Programa / cohorte del deal.** "Sin cohorte" para la cohorte por definir (227). Si el deal cambia de cohorte (231),
  el archivo se mueve.
- **Nombre:** fecha del abono, nombre del lead como está en el CRM, **monto del abono con su moneda** (el comprobante
  prueba ese pago, no el valor de la venta) y los primeros 6 caracteres del `archivo_id`. La fecha al inicio ordena la
  carpeta; el id evita choques entre dos abonos iguales y permite reconstruir el bucket desde Drive.
- **Anulado:** el archivo se queda y se renombra con `ANULADO` al inicio.
- El `archivo_id` completo también va en las `appProperties` del archivo de Drive; `archivos.drive_file_id` guarda
  dónde quedó y `respaldado_en` cuándo.

## Alcance

- Cron diario en Vercel (cabe en Hobby), con secreto de cron: sube lo nuevo, mueve o renombra lo que cambió, y borra de
  Storage los `pendiente` de más de 24 h que no cuelgan de nada.
- Usa la cuenta de servicio que ya existe (`lib/sheets/auth.ts`) con un scope de Drive nuevo (`drive.file` si alcanza
  para una unidad compartida; si no, `drive`), solo en el respaldo. La lectura de hojas sigue con solo lectura.
- Si la variable `DRIVE_COMPROBANTES_ID` no está, el cron no hace nada y lo dice en su respuesta (no revienta).

## Dónde vive (13-oct)

Retia tiene Google Workspace (cuenta `administrativa@retiagrowth.com`) con unidades compartidas, entre ellas una que se
llama "Retia". **El respaldo va en una unidad compartida NUEVA, "Comprobantes CRM Retia", no en una carpeta dentro de
"Retia".** Por qué:

- En una unidad compartida, **el permiso de sus miembros cubre todo lo que hay adentro** y una carpeta no puede
  restringir por debajo de eso. Quien hoy esté en "Retia" vería los comprobantes, y C-1 dice que solo los ve quien
  abre la ficha del deal en el CRM.
- La cuenta de servicio necesita ser "Administrador de contenido" para escribir. En "Retia" tendría escritura sobre
  todos los documentos de la empresa; en una unidad propia, solo sobre los comprobantes (mínimo privilegio).
- Una cuenta de servicio no tiene cuota en "Mi unidad", así que una unidad compartida es obligatoria de todas formas.

**Pasos de Mani (una vez, desde `administrativa@retiagrowth.com`):** crear la unidad "Comprobantes CRM Retia";
agregar a `retia-metrics-sync@retia-growth.iam.gserviceaccount.com` como **Administrador de contenido**; agregar a
Mani y a gerencia como lectores (o administradores, para quien la gestione); nadie más. El id de la unidad va a una
variable de entorno (`DRIVE_COMPROBANTES_ID`), no al código.

**Estado (13-oct):** la unidad existe (id `0ADSvd0QdWDh-Uk9PVA`) y la cuenta de servicio la ve, pero como
**Colaborador**: puede crear y editar, no mover ni enviar a la papelera. Mover un archivo cuando el deal cambia de
cohorte exige **Administrador de contenido**; subirle el rol antes de construir. Verificado leyendo las capacidades
de la unidad por API.

## Done cuando

- [ ] Una corrida respalda los comprobantes nuevos con la estructura acordada y es idempotente (dos corridas = mismo
      resultado).
- [ ] Cambiar la cohorte del deal, el nombre del lead o anular el abono se refleja en la siguiente corrida.
- [ ] Un `pendiente` viejo sin dueño se borra de Storage; uno colgado de un abono nunca.
- [ ] La ruta del cron rechaza una llamada sin su secreto.
