import { desc } from "drizzle-orm";
import { reportesActivos } from "@/lib/catalogo/reportes-whatsapp";
import { tokensMeta } from "@/lib/integraciones";
import { db } from "@/lib/db";
import { fotosPauta } from "@/lib/db/schema";
import { diaCalendarioAnterior } from "@/lib/dias-habiles";
import { fechaDeInstanteEnBogota, isoEnBogota } from "@/lib/format";
import { sincronizarDiaEnCurso } from "@/lib/pauta/dia-en-curso";
import { saludDeCuentasMeta } from "@/lib/pauta/salud-cuentas";
import { sincronizarPautaEnVentana } from "@/lib/pauta/sincronizar";
import * as agenda from "@/lib/queries/hechos/agenda";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { esquemaRespuestaSemaforo, type RespuestaSemaforo } from "@/lib/reporte-whatsapp/contrato";
import { armarMensajeDeHorasDeAgenda } from "@/lib/reporte-whatsapp/horas-de-agenda";
import { armarMensajeDeLaHora, enlaceAlHub } from "@/lib/reporte-whatsapp/mensaje";
import { queTocaAhora } from "@/lib/reporte-whatsapp/que-toca";
import { semaforoDelPrograma } from "@/lib/semaforo/semaforo";
import { secretoDeSemaforoValido } from "@/lib/semaforo/secreto";

export const runtime = "nodejs";

function horaTexto(hora: number): string {
  return `${String(hora).padStart(2, "0")}:00`;
}

async function ultimaFoto(): Promise<Date | null> {
  const [fila] = await db.select({ tomadaEn: fotosPauta.tomadaEn })
    .from(fotosPauta)
    .orderBy(desc(fotosPauta.tomadaEn))
    .limit(1);
  return fila?.tomadaEn ?? null;
}

export async function POST(request: Request) {
  if (!secretoDeSemaforoValido(request)) return new Response(null, { status: 401 });

  const ahora = new Date();
  const reportes = await reportesActivos(db);
  const pendientes = queTocaAhora(ahora, reportes.map((reporte) => ({
    programId: reporte.programId,
    activo: true,
    horas: reporte.horas,
    horaCierre: reporte.horaCierre,
    metricas: reporte.metricas,
  })));

  let sincronizacion: RespuestaSemaforo["sincronizacion"] = null;
  let problemaCierre: string | null = null;
  const diaCierre = diaCalendarioAnterior(fechaDeInstanteEnBogota(ahora));
  if (pendientes.length > 0) {
    let estado: NonNullable<RespuestaSemaforo["sincronizacion"]>["estado"] = "error";
    try {
      const resultado = await sincronizarDiaEnCurso(db, {
        tokens: await tokensMeta(db),
        ahora,
        disparadaPor: "endpoint",
      });
      estado = resultado.estado;
    } catch {
      estado = "error";
    }
    const foto = await ultimaFoto();
    sincronizacion = { estado, ultimaFoto: foto ? isoEnBogota(foto) : null };
  }

  if (pendientes.some((pendiente) => pendiente.tipo === "cierre")) {
    const aviso = `No se pudo releer el ${diaCierre} en Meta; cifras del último cron.`;
    try {
      const resultado = await sincronizarPautaEnVentana(db, {
        tokens: await tokensMeta(db),
        desde: diaCierre,
        hasta: diaCierre,
        disparadaPor: "endpoint",
        refrescarArbol: false,
        ahora,
      });
      if (resultado.estado === "error") problemaCierre = aviso;
    } catch {
      problemaCierre = aviso;
    }
  }

  let cuentasMetaPorPrograma = new Map<string, RespuestaSemaforo["envios"][number]["bloques"][number]["cuentasMeta"]>();
  if (pendientes.length > 0) {
    try {
      cuentasMetaPorPrograma = await saludDeCuentasMeta(db, {
        tokens: await tokensMeta(db),
        programIds: pendientes.map((pendiente) => pendiente.programId),
      });
    } catch {
      cuentasMetaPorPrograma = new Map();
    }
  }

  const porPrograma = new Map(reportes.map((reporte) => [reporte.programId, reporte]));
  const salud = pendientes.length > 0 ? await saludDeFuentes(db, ahora) : [];
  const trazaRotaPorPrograma = new Map<string, NonNullable<RespuestaSemaforo["envios"][number]["bloques"][number]["trazaRota"]>>();
  for (const fuente of salud) {
    if (!fuente.trazaRota && !fuente.fbclidRoto) continue;
    const fuentes = trazaRotaPorPrograma.get(fuente.programId) ?? [];
    fuentes.push({
      fuente: fuente.nombre,
      pagos: fuente.pagos,
      pagosSinId: fuente.pagosSinId,
      pagosSinFbclid: fuente.pagosSinFbclid,
      sinId: fuente.trazaRota,
      fbclidRoto: fuente.fbclidRoto,
    });
    trazaRotaPorPrograma.set(fuente.programId, fuentes);
  }
  const origen = new URL(request.url).origin;
  const bloquesConDestino = await Promise.all(
    pendientes.map(async (pendiente) => {
      const reporte = porPrograma.get(pendiente.programId)!;
      try {
        const metricas = await Promise.all(pendiente.metricas.map((metrica) => {
          switch (metrica) {
            case "costo_por_agenda":
              return semaforoDelPrograma(db, {
                programId: pendiente.programId,
                ahora,
                tipo: pendiente.tipo,
                horas: reporte.horas,
              }).then((resultado) => pendiente.tipo === "cierre" && problemaCierre
                ? {
                  ...resultado,
                  notas: [...resultado.notas, { tipo: "problema" as const, texto: problemaCierre }],
                }
                : resultado);
          }
        }));
        return {
          destino: reporte.destino,
          programId: pendiente.programId,
          bloque: {
            programa: reporte.programa,
            tipo: pendiente.tipo,
            enlaceHub: enlaceAlHub(origen, reporte.slug),
            metricas,
            cuentasMeta: cuentasMetaPorPrograma.get(pendiente.programId) ?? [],
            trazaRota: trazaRotaPorPrograma.get(pendiente.programId) ?? [],
            error: null,
          },
        };
      } catch {
        return {
          destino: reporte.destino,
          programId: pendiente.programId,
          bloque: {
            programa: reporte.programa,
            tipo: pendiente.tipo,
            enlaceHub: enlaceAlHub(origen, reporte.slug),
            metricas: [],
            cuentasMeta: cuentasMetaPorPrograma.get(pendiente.programId) ?? [],
            trazaRota: trazaRotaPorPrograma.get(pendiente.programId) ?? [],
            error: "No se pudo calcular el semáforo de este programa.",
          },
        };
      }
    }),
  );
  const hora = pendientes[0]?.hora;
  type BloqueConPrograma = {
    programId: string;
    bloque: RespuestaSemaforo["envios"][number]["bloques"][number];
  };
  const bloquesPorDestino = new Map<string | null, BloqueConPrograma[]>();
  for (const { destino, programId, bloque } of bloquesConDestino) {
    const bloques = bloquesPorDestino.get(destino) ?? [];
    bloques.push({ programId, bloque });
    bloquesPorDestino.set(destino, bloques);
  }
  const destinos = [...bloquesPorDestino.keys()].sort((a, b) => {
    if (a === null) return -1;
    if (b === null) return 1;
    return a.localeCompare(b);
  });
  const envios = hora === undefined
    ? []
    : (await Promise.all(destinos.map(async (destino) => {
        const bloquesConPrograma = bloquesPorDestino.get(destino)!;
        const bloques = bloquesConPrograma.map(({ bloque }) => bloque);
        const envioSemaforo = {
          tipo: "semaforo" as const,
          hora,
          destino,
          texto: armarMensajeDeLaHora(bloques, hora, sincronizacion, origen),
          bloques,
        };
        const bloquesDeCierre = bloquesConPrograma.filter(({ bloque }) => bloque.tipo === "cierre");
        if (bloquesDeCierre.length === 0) return [envioSemaforo];

        const programas = await Promise.all(bloquesDeCierre.map(async ({ programId, bloque }) => {
          try {
            const horas: string[] = [];
            let offset = 0;
            let total = 0;
            do {
              const pagina = await agenda.listar(db, {
                programId,
                rango: { desde: diaCierre, hasta: diaCierre },
                filtros: { area: ["paid"] },
                orden: { campo: "horaMinuto", sentido: "asc" },
                pagina: { limite: 200, offset },
              });
              horas.push(...pagina.filas.map((fila) => fila.horaMinuto));
              offset += pagina.filas.length;
              total = pagina.total;
            } while (offset < total);
            const agendasMeta = bloque.metricas.find((metrica) => metrica.metrica === "costo_por_agenda")?.agendasMeta ?? null;
            return { programa: bloque.programa, horas, agendasMeta, error: false };
          } catch {
            return { programa: bloque.programa, horas: [], error: true };
          }
        }));
        return [envioSemaforo, {
          tipo: "horas_agenda" as const,
          hora,
          destino,
          texto: armarMensajeDeHorasDeAgenda(diaCierre, programas),
          bloques: [],
        }];
      }))).flat();

  const respuesta = esquemaRespuestaSemaforo.parse({
    generadoEn: isoEnBogota(ahora),
    sincronizacion,
    envios,
    configuracion: reportes.map((reporte) => ({
      programa: reporte.programa,
      destino: reporte.destino,
      horas: reporte.horas.map(horaTexto),
      horaCierre: reporte.horaCierre === null ? null : horaTexto(reporte.horaCierre),
    })),
  });
  return Response.json(respuesta);
}
