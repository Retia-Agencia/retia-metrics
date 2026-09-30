import { paginaConRol } from "@/lib/auth/page-guards";
import { programasActivos } from "@/lib/queries/programas";
import { entregasDePrograma, entregasHuerfanas } from "@/lib/queries/entregas-webhook";
import { conciliarProgramaConHoja } from "@/lib/queries/conciliacion-sheets";
import { HORAS_SIN_ESTADO, saludDeFuentes, type EstadoDeFuente } from "@/lib/queries/salud-fuentes";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haceCuanto, num } from "@/lib/format";
import {
  EntregasWebhook,
  SelectorYRefresco,
  type EntregaVista,
} from "@/components/admin/entregas-webhook";

export const dynamic = "force-dynamic";

/**
 * `/ajustes/salud`: la salud del CRM (ticket 110, pedido de Mani del 28-sep). Un lugar
 * donde ver cada entrega del webhook —el codigo HTTP, el motivo y el lead que trajo—,
 * la conciliacion con la hoja mientras las dos convivan, y el aviso de salud de la
 * fuente (ticket 107).
 *
 * La ve quien administra (`esAdministrador`: gerente y developer). `paginaConRol("gerente")`
 * lo enforza en el servidor: el developer pasa por `puedeAcceder` (ADR 0025) y un closer
 * es rebotado —nunca se compara `rol === "..."` a mano—. Es una pantalla por programa: el
 * programa es frontera y NUNCA se cruzan dos (ADR 0043). El programa sale del slug de la
 * URL (id opaco), no de la sesion.
 */

/** El tono del estado de una fuente: bien, atento o mal. */
const TONO_ESTADO: Record<EstadoDeFuente, "exito" | "info" | "alerta" | "peligro" | "neutro"> = {
  al_dia: "exito",
  volvio: "info",
  sin_respuestas: "alerta",
  muerta: "peligro",
  sin_envios: "neutro",
};

const TEXTO_ESTADO: Record<EstadoDeFuente, string> = {
  al_dia: "Al día",
  volvio: "Volvió",
  sin_respuestas: "Sin respuestas",
  muerta: "Muerta",
  sin_envios: "Sin envíos",
};

export default async function SaludPage({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string }>;
}) {
  await paginaConRol("gerente");

  // Quien administra ve todos los programas activos (no una membresia de closer): esta
  // pantalla es de operacion del sistema.
  const programas = await programasActivos();
  if (programas.length === 0) {
    return (
      <PageShell titulo="Salud del CRM" descripcion="Cada entrega del webhook, por programa.">
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No hay programas activos todavía. Crea uno en Ajustes → Programas y cohortes para ver la
            salud de su intake.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const { programa: slugPedido } = await searchParams;
  const programa = programas.find((p) => p.slug === slugPedido) ?? programas[0];

  const [entregas, huerfanas, salud, conciliacion] = await Promise.all([
    entregasDePrograma(programa.id),
    entregasHuerfanas(),
    saludDeFuentes(),
    conciliarProgramaConHoja(programa.id),
  ]);

  const saludDelPrograma = salud.filter((s) => s.programId === programa.id);
  const entregasVista: EntregaVista[] = entregas.map((e) => ({
    ...e,
    recibidoEn: e.recibidoEn.toISOString(),
  }));
  const huerfanasVista: EntregaVista[] = huerfanas.map((e) => ({
    ...e,
    recibidoEn: e.recibidoEn.toISOString(),
  }));

  return (
    <PageShell
      titulo="Salud del CRM"
      descripcion="Cada entrega del webhook, por programa: el código, el motivo y el lead que trajo."
      acciones={<SelectorYRefresco programas={programas} slugActual={programa.slug} />}
    >
      <div className="space-y-6">
        {/* El aviso de salud de la fuente (ticket 107). */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado del intake</CardTitle>
          </CardHeader>
          <CardContent>
            {saludDelPrograma.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Este programa no tiene una fuente activa. Actívala en Ajustes → Fuentes de datos para
                empezar a recibir leads.
              </p>
            ) : (
              <div className="space-y-1 text-sm">
                {saludDelPrograma.map((s) => (
                  <div key={s.sourceId} className="flex flex-wrap items-center gap-2">
                    <Badge variant={TONO_ESTADO[s.estado]}>{TEXTO_ESTADO[s.estado]}</Badge>
                    <span className="font-medium">{s.nombre}</span>
                    <span className="text-muted-foreground">último envío {haceCuanto(s.ultimo)}</span>
                    {s.sobresPendientes > 0 ? (
                      <span className="text-tono-alerta">
                        · {num(s.sobresPendientes)} sobres sin procesar
                      </span>
                    ) : null}
                    {s.sinEstado > 0 ? (
                      <span className="text-tono-alerta">
                        · {num(s.sinEstado)} {s.sinEstado === 1 ? "envío" : "envíos"} sin estado en {HORAS_SIN_ESTADO} h
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Las entregas del programa. */}
        <EntregasWebhook entregas={entregasVista} titulo={`Entregas — ${programa.nombre}`} />

        {/* La conciliacion con la hoja mientras convivan (ticket 110). */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conciliación con Sheets</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {conciliacion.estado === "sin_hoja" ? (
              <p className="text-muted-foreground">
                Este programa no tiene una hoja de Google configurada, así que no hay nada que conciliar.
              </p>
            ) : conciliacion.estado === "error" ? (
              <p className="text-tono-peligro">
                No se pudo leer la hoja: {conciliacion.mensaje}
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  <span className="cifra">{num(conciliacion.conciliacion.totalHoja)}</span> envíos en la
                  hoja ·{" "}
                  <span className="cifra">{num(conciliacion.conciliacion.totalCrm)}</span> en el CRM.
                </p>
                <ConciliacionLista
                  titulo="En la hoja y NO en el CRM"
                  tokens={conciliacion.conciliacion.enHojaNoEnCrm}
                  vacio="Todo lo que está en la hoja llegó al CRM."
                  tono="peligro"
                />
                <ConciliacionLista
                  titulo="En el CRM y NO en la hoja"
                  tokens={conciliacion.conciliacion.enCrmNoEnHoja}
                  vacio="Todo lo que está en el CRM está también en la hoja."
                  tono="alerta"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Las entregas huerfanas: sin fuente resuelta, no son de ningun programa. */}
        {huerfanasVista.length > 0 ? (
          <EntregasWebhook
            entregas={huerfanasVista}
            titulo="Entregas huérfanas (sin fuente reconocida)"
          />
        ) : null}
      </div>
    </PageShell>
  );
}

/** Una lista de tokens de la conciliacion, con su estado vacio escrito. */
function ConciliacionLista({
  titulo,
  tokens,
  vacio,
  tono,
}: {
  titulo: string;
  tokens: string[];
  vacio: string;
  tono: "peligro" | "alerta";
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <span className="font-medium">{titulo}</span>
        <Badge variant={tokens.length === 0 ? "exito" : tono} className="cifra">
          {num(tokens.length)}
        </Badge>
      </div>
      {tokens.length === 0 ? (
        <p className="text-muted-foreground">{vacio}</p>
      ) : (
        <ul className="cifra max-h-48 overflow-y-auto text-xs text-muted-foreground">
          {tokens.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
