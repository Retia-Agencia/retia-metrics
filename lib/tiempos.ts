/** Topes de ejecucion compartidos por paginas, handlers y conexiones a la base. */
export const MAX_SEGUNDOS_PAGINA = 30;
export const MAX_SEGUNDOS_MAQUINA = 60;
export const MAX_SEGUNDOS_CRON = 300;
export const STATEMENT_TIMEOUT_MS = 15_000;
// El pooler ignora el parametro de arranque; medido el 15-nov, el corte visible debe hacerlo pg.
export const QUERY_TIMEOUT_MS = 15_000;
export const CONEXION_TIMEOUT_MS = 10_000;
