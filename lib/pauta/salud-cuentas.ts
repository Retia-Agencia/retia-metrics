import { and, eq, inArray } from "drizzle-orm";
import { cuentasPublicitarias } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { estadoDeCuenta, type EstadoDeCuentaMeta } from "@/lib/pauta/meta-api";
import type { TokensMeta } from "@/lib/integraciones";

type FetchMeta = typeof globalThis.fetch;

export interface CuentaMetaSalud {
  nombre: string;
  estado: "al_dia" | "problema";
  detalle: string | null;
}

const DETALLE_POR_ESTADO = new Map<number, string>([
  [2, "deshabilitada"],
  [3, "pago pendiente"],
  [7, "en revisión de riesgo"],
  [8, "liquidación pendiente"],
  [9, "en periodo de gracia"],
  [100, "cierre pendiente"],
  [101, "cerrada"],
]);

// ponytail: porcentaje del tope; ignora el ritmo de gasto. Evolución: días de margen según el gasto diario reciente.
export const UMBRAL_CERCA_DEL_TOPE = 0.1;

export function diagnosticoDeCuenta(
  estado: EstadoDeCuentaMeta,
): Omit<CuentaMetaSalud, "nombre"> {
  if (estado.accountStatus === 1) {
    if (estado.spendCap > 0 && estado.amountSpent >= estado.spendCap) {
      return { estado: "problema", detalle: "llegó al tope de gasto" };
    }
    if (estado.spendCap > 0) {
      const restante = estado.spendCap - estado.amountSpent;
      if (restante / estado.spendCap < UMBRAL_CERCA_DEL_TOPE) {
        return {
          estado: "problema",
          detalle: `cerca del tope de gasto (queda ${Math.round(restante / estado.spendCap * 100)}% del tope)`,
        };
      }
    }
    return { estado: "al_dia", detalle: null };
  }

  const base = DETALLE_POR_ESTADO.get(estado.accountStatus) ?? `estado ${estado.accountStatus} de Meta`;
  const razon = estado.disableReason === 0 ? "" : ` (razón ${estado.disableReason})`;
  return { estado: "problema", detalle: `${base}${razon}` };
}

export async function saludDeCuentasMeta(
  db: Db,
  args: { tokens: TokensMeta; programIds: string[]; f?: FetchMeta },
): Promise<Map<string, CuentaMetaSalud[]>> {
  const resultado = new Map(args.programIds.map((programId) => [programId, [] as CuentaMetaSalud[]]));
  if (args.programIds.length === 0) return resultado;

  const cuentas = await db.select({
    idMeta: cuentasPublicitarias.idMeta,
    programId: cuentasPublicitarias.programId,
    nombre: cuentasPublicitarias.nombre,
  }).from(cuentasPublicitarias).where(and(
    eq(cuentasPublicitarias.activo, true),
    inArray(cuentasPublicitarias.programId, args.programIds),
  ));
  const estados = await Promise.allSettled(cuentas.map((cuenta) => {
    const token = args.tokens.get(cuenta.programId);
    if (!token) throw new Error("El programa no tiene Meta conectado en Integraciones.");
    return estadoDeCuenta(cuenta.idMeta, token, args.f);
  }));

  for (const [indice, cuenta] of cuentas.entries()) {
    const estado = estados[indice]!;
    const salud: CuentaMetaSalud = !args.tokens.has(cuenta.programId)
      ? { nombre: cuenta.nombre, estado: "problema", detalle: "el programa no tiene Meta conectado en Integraciones" }
      : estado.status === "fulfilled"
      ? { nombre: cuenta.nombre, ...diagnosticoDeCuenta(estado.value) }
      : { nombre: cuenta.nombre, estado: "problema", detalle: "no se pudo leer en Meta" };
    resultado.get(cuenta.programId)!.push(salud);
  }
  return resultado;
}
