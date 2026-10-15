import { createHash, timingSafeEqual } from "node:crypto";
import { desc } from "drizzle-orm";
import { reportesActivos } from "@/lib/catalogo/reportes-whatsapp";
import { tokenActivoMeta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { fotosPauta } from "@/lib/db/schema";
import { isoEnBogota } from "@/lib/format";
import { sincronizarDiaEnCurso } from "@/lib/pauta/dia-en-curso";
import { esquemaRespuestaSemaforo, type RespuestaSemaforo } from "@/lib/reporte-whatsapp/contrato";
import { armarMensajeDeLaHora, enlaceAlHub } from "@/lib/reporte-whatsapp/mensaje";
import { queTocaAhora } from "@/lib/reporte-whatsapp/que-toca";
import { semaforoDelPrograma } from "@/lib/semaforo/semaforo";

export const runtime = "nodejs";

function hash(valor: string): Buffer {
  return createHash("sha256").update(valor).digest();
}

function secretoValido(request: Request): boolean {
  const esperado = process.env.SEMAFORO_SECRETO;
  const recibido = request.headers.get("x-semaforo-secreto");
  return Boolean(esperado && recibido && timingSafeEqual(hash(esperado), hash(recibido)));
}

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
  if (!secretoValido(request)) return new Response(null, { status: 401 });

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
  if (pendientes.length > 0) {
    let estado: NonNullable<RespuestaSemaforo["sincronizacion"]>["estado"] = "error";
    try {
      const resultado = await sincronizarDiaEnCurso(db, {
        token: await tokenActivoMeta(db),
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

  const porPrograma = new Map(reportes.map((reporte) => [reporte.programId, reporte]));
  const origen = new URL(request.url).origin;
  const bloques: RespuestaSemaforo["envios"][number]["bloques"] = await Promise.all(
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
                horas: [
                  ...reporte.horas,
                  ...(reporte.horaCierre === null ? [] : [reporte.horaCierre]),
                ],
              });
          }
        }));
        return {
          programa: reporte.programa,
          tipo: pendiente.tipo,
          enlaceHub: enlaceAlHub(origen, reporte.slug),
          metricas,
          error: null,
        };
      } catch {
        return {
          programa: reporte.programa,
          tipo: pendiente.tipo,
          enlaceHub: enlaceAlHub(origen, reporte.slug),
          metricas: [],
          error: "No se pudo calcular el semáforo de este programa.",
        };
      }
    }),
  );
  const hora = pendientes[0]?.hora;
  const envios = hora === undefined
    ? []
    : [{ hora, texto: armarMensajeDeLaHora(bloques, hora, sincronizacion, origen), bloques }];

  const respuesta = esquemaRespuestaSemaforo.parse({
    generadoEn: isoEnBogota(ahora),
    sincronizacion,
    envios,
    configuracion: reportes.map((reporte) => ({
      programa: reporte.programa,
      horas: reporte.horas.map(horaTexto),
      horaCierre: reporte.horaCierre === null ? null : horaTexto(reporte.horaCierre),
    })),
  });
  return Response.json(respuesta);
}
