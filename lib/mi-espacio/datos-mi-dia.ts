import type { Db } from "@/lib/db/tipos";
import { estaAgendada } from "@/lib/deals/resultados-de-llamada";
import { llamadasDelCloser, type RangoMiDia } from "@/lib/mi-espacio/llamadas-del-dia";
import { pendientesDelCloserEnPrograma, tipoDePendientePedido } from "@/lib/mi-espacio/pendientes";
import { opcionesDeFicha } from "@/lib/queries/ficha-deal";
import { resolverPeriodo } from "@/lib/periodo";
import { grupoDeCitas, tasasDelAlcance } from "@/lib/queries/tasas-del-grupo";
import { razonVacia } from "@/lib/cobertura";

type Busqueda = Record<string, string | string[] | undefined>;

function uno(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export interface EntradaDeMiDia {
  programId: string;
  userId: string;
  hoy: string;
  busqueda: Busqueda;
}

/** Mi día: las llamadas del closer en el rango pedido, ordenadas como pide la URL. */
export async function cargarDatosDeMiDia(db: Db, entrada: EntradaDeMiDia) {
  const rangoPedido = uno(entrada.busqueda.rango);
  const rango: RangoMiDia = rangoPedido === "manana" || rangoPedido === "semana" ? rangoPedido : "hoy";
  const ordenPedido = uno(entrada.busqueda.orden);
  const orden: "hora" | "lead" | "estado" = ordenPedido === "lead" || ordenPedido === "estado" ? ordenPedido : "hora";
  const dir = uno(entrada.busqueda.dir) === "desc" ? "desc" as const : "asc" as const;
  const soloSinConfirmar = uno(entrada.busqueda.conf) === "sin";
  const tipoPendiente = tipoDePendientePedido(uno(entrada.busqueda.tipo));
  const ahora = new Date();
  const rangoDelMes = resolverPeriodo({ preset: "este_mes", comparaciones: [] }, { hoy: entrada.hoy }).a;
  // El resumen cuenta TODAS las llamadas de hoy; la tabla, el rango y el filtro pedidos. Con
  // rango "hoy" la tabla sale de la misma lectura (filtrada en memoria): una consulta, no dos.
  const deHoy = llamadasDelCloser(db, {
    programId: entrada.programId,
    userId: entrada.userId,
    rango: "hoy",
    hoy: entrada.hoy,
  });
  const delRango = rango === "hoy"
    ? deHoy.then((todas) => soloSinConfirmar ? todas.filter((fila) => fila.confirmacion !== "confirmada") : [...todas])
    : llamadasDelCloser(db, {
      programId: entrada.programId,
      userId: entrada.userId,
      rango,
      hoy: entrada.hoy,
      soloSinConfirmar,
    });
  const [filas, llamadasDeHoy, opciones, pendientes, grupo] = await Promise.all([
    delRango,
    deHoy,
    opcionesDeFicha(db, entrada.programId, null, null),
    pendientesDelCloserEnPrograma(db, {
      programId: entrada.programId,
      userId: entrada.userId,
      dia: entrada.hoy,
      ahora,
    }),
    grupoDeCitas(db, { programId: entrada.programId, rango: rangoDelMes, ahora }),
  ]);
  const tasas = tasasDelAlcance(grupo, entrada.userId);
  // La regla de "sigue agendada" vive en su módulo dueño (guardián N1): aquí solo se ordena.
  const valorEstado = (fila: (typeof filas)[number]) => {
    if (fila.confirmacion === "confirmada") return "Confirmó";
    if (!estaAgendada(fila.resultado) || fila.hora < ahora) return "Ya pasó";
    return "Sin confirmar";
  };
  const signo = dir === "asc" ? 1 : -1;
  filas.sort((a, b) => signo * (orden === "hora"
    ? a.hora.getTime() - b.hora.getTime()
    : orden === "lead"
      ? (a.leadNombre ?? a.leadEmail).localeCompare(b.leadNombre ?? b.leadEmail, "es")
      : valorEstado(a).localeCompare(valorEstado(b), "es")));
  return {
    filas,
    rango,
    soloSinConfirmar,
    orden,
    dir,
    ahora,
    motivosReagenda: opciones.motivos,
    pendientes: pendientes.filas,
    tipoPendiente,
    resumen: {
      llamadasHoy: llamadasDeHoy.length,
      confirmadas: llamadasDeHoy.filter((fila) => fila.confirmacion === "confirmada").length,
      vencidos: pendientes.filas.filter((fila) => fila.grupo === "vencido").length,
      paraHoy: pendientes.filas.filter((fila) => fila.grupo === "hoy").length,
      asistencia: tasas.razonShow,
      showSinConfirmar: tasas.razonShowSinConfirmar,
    },
  };
}

export type DatosDeMiDia = Awaited<ReturnType<typeof cargarDatosDeMiDia>>;
