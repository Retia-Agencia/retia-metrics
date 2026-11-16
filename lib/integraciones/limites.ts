/**
 * Tope de largo de un secreto pegado en Programa › Integraciones. Lo leen el esquema del servidor
 * (`registro.ts`) y el `maxLength` de los campos de la pantalla: si los dos no comparten el número,
 * el navegador recorta el pegado en silencio y el proveedor rechaza la mitad del token.
 *
 * Medido el 16-nov-2026: un Personal Access Token de Calendly (JWT) mide 1005 caracteres, y el tope
 * anterior de 500 lo partía. 4096 deja margen a JWTs con más claims sin aceptar basura sin límite;
 * `integraciones.secretos` es jsonb y no impone largo.
 *
 * Vive aparte de `registro.ts` porque la pantalla es cliente y `registro.ts` arrastra módulos de servidor.
 */
export const LARGO_MAXIMO_SECRETO = 4096;
