/**
 * Lo de una fuente webhook que tambien necesita la pantalla (ticket 105, ADR 0055).
 * Vive aparte de `fuentes.ts` porque ese modulo carga la base y `node:crypto`, y un
 * componente de cliente no puede importarlo. Aqui no hay nada mas que datos puros.
 */

/**
 * Proveedores de formulario con adaptador. Es copia del enum `proveedor_formulario`
 * de la base, porque el cliente no importa el esquema; `tests/fuentes-webhook.test.ts`
 * las compara y falla si se separan.
 */
export const PROVEEDORES_FORMULARIO = ["typeform", "dapta"] as const;
export type ProveedorFormulario = (typeof PROVEEDORES_FORMULARIO)[number];

/**
 * La ruta del webhook de una fuente (ADR 0055 punto 1). **Derivada, nunca guardada**
 * (ADR 0024): sale del id opaco de la fuente, que es lo que identifica el programa y
 * el secreto. La pantalla le antepone el origen de la app para copiarla en el proveedor.
 */
export function rutaDelWebhook(fuenteId: string): string {
  return `/api/webhooks/formularios/${fuenteId}`;
}
