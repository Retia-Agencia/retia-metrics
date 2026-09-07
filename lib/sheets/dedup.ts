import { normalizarEmail, limpiar, parsearFecha } from "./mapeo";

/**
 * Dedup por correo. Es la pieza mas critica del sistema.
 *
 * La BBDD de Tactical Investor tiene 2.954 filas que son ~1.825 personas: un 37,8%
 * de duplicados, con un correo que aplico 12 veces. Comunicarte, en cambio, tiene
 * apenas 5,1%. Calcular tasas sobre filas infla la conversion y toda decision de
 * presupuesto sale mal.
 *
 * Esta funcion es pura: recibe filas, devuelve personas. Se testea aislada.
 */

export type FilaCruda = Record<string, unknown>;

export type PersonaDeducida = {
  emailNormalizado: string;
  nombre: string | null;
  telefono: string | null;
  cargo: string | null;
  ingresoDeclarado: string | null;
  urgencia: string | null;
  porQueAplico: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  estado: string | null;
  fechaPrimeraAplicacion: Date | null;
  fechaUltimaAplicacion: Date | null;
  numAplicaciones: number;
  raw: FilaCruda;
};

const CAMPOS_TEXTO = [
  "nombre",
  "telefono",
  "cargo",
  "ingresoDeclarado",
  "urgencia",
  "porQueAplico",
  "utmSource",
  "utmMedium",
  "utmCampaign",
  "estado",
] as const;

/**
 * Agrupa filas por correo normalizado.
 *
 * Reglas al fusionar:
 * - `fechaPrimeraAplicacion` conserva la MAS ANTIGUA, no la ultima vista.
 * - Cada campo de texto se queda con el valor mas reciente NO VACIO: una segunda
 *   aplicacion que dejo un campo en blanco no borra lo que ya se sabia.
 * - `numAplicaciones` cuenta las filas, como senal de intensidad.
 * - `raw` guarda la fila mas reciente, para auditar sin volver a la hoja.
 *
 * Las filas sin correo valido se descartan y se devuelven aparte: no se inventan
 * identidades ni se cuentan como personas.
 */
export function deduplicarPorCorreo(filas: FilaCruda[]): {
  personas: PersonaDeducida[];
  sinCorreo: number;
} {
  const porCorreo = new Map<string, PersonaDeducida>();
  let sinCorreo = 0;

  for (const fila of filas) {
    const email = normalizarEmail(fila.emailNormalizado);
    if (!email) {
      sinCorreo++;
      continue;
    }

    const fecha = parsearFecha(fila.fechaAplicacion);
    const existente = porCorreo.get(email);

    if (!existente) {
      const p: PersonaDeducida = {
        emailNormalizado: email,
        nombre: null,
        telefono: null,
        cargo: null,
        ingresoDeclarado: null,
        urgencia: null,
        porQueAplico: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        estado: null,
        fechaPrimeraAplicacion: fecha,
        fechaUltimaAplicacion: fecha,
        numAplicaciones: 1,
        raw: fila,
      };
      for (const c of CAMPOS_TEXTO) p[c] = limpiar(fila[c]);
      porCorreo.set(email, p);
      continue;
    }

    existente.numAplicaciones += 1;

    if (fecha) {
      if (!existente.fechaPrimeraAplicacion || fecha < existente.fechaPrimeraAplicacion) {
        existente.fechaPrimeraAplicacion = fecha;
      }
      if (!existente.fechaUltimaAplicacion || fecha > existente.fechaUltimaAplicacion) {
        existente.fechaUltimaAplicacion = fecha;
        existente.raw = fila;
      }
    }

    // Sin fecha parseable NO se asume que la fila es la mas reciente: solo rellena
    // huecos (la rama `existente[c] === null` de abajo). Al reves, una celda de
    // fecha en blanco pisaba en silencio los datos de la aplicacion buena anterior,
    // y la bitacora lo registraba como un cambio legitimo del sync.
    const esMasReciente =
      fecha != null &&
      (existente.fechaUltimaAplicacion == null || fecha >= existente.fechaUltimaAplicacion);

    for (const c of CAMPOS_TEXTO) {
      const v = limpiar(fila[c]);
      if (v === null) continue;
      if (existente[c] === null || esMasReciente) existente[c] = v;
    }
  }

  return { personas: [...porCorreo.values()], sinCorreo };
}

/**
 * Convierte una matriz de la hoja en filas con nombres de campo, segun los
 * indices ya resueltos. Descarta filas completamente vacias.
 */
export function filasDesdeMatriz(
  matriz: string[][],
  indices: Record<string, number>,
): FilaCruda[] {
  const filas: FilaCruda[] = [];
  for (const f of matriz) {
    if (!f.some((c) => String(c ?? "").trim() !== "")) continue;
    const obj: FilaCruda = {};
    for (const [campo, i] of Object.entries(indices)) obj[campo] = f[i];
    filas.push(obj);
  }
  return filas;
}
