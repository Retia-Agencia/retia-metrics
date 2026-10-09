import Link from "next/link";
import { db } from "@/lib/db";
import { NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { fecha as fechaCorta, fechaHoraEnBogota } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CHIPS_NOTIFICACIONES,
  NOMBRE_DE_CHIP,
  POR_PAGINA,
  chipPedido,
  conteoSinVer,
  conteosDeChips,
  notificacionesDeChip,
  type ChipNotificacion,
} from "@/lib/mi-espacio/notificaciones";
import { TarjetasNotificacion } from "./tarjetas-notificacion";

/**
 * La pestaña Notificaciones de Mi espacio (ticket 222): lo que te toca HOY, por tipo, con
 * las tarjetas de TUS deals. Reemplaza a "Necesita atención" (el viejo `TabAtencion`): la
 * bandeja, el bloque de novedades de Calendly y el de duplicados se funden en chips.
 *
 * Un chip activo a la vez, en la URL (`?tab=notificaciones&chip=<id>&pagina=<n>`); un `chip`
 * desconocido cae a `hoy`. Cada chip es la única respuesta de `lib/mi-espacio/notificaciones.ts`
 * (predicado, conteo y lista). Paginado en el servidor, 24 por página. Sin datos personales en
 * la URL: el chip y la página son opacos.
 */
export async function TabNotificaciones({
  programId,
  slug,
  userId,
  chip: chipCrudo,
  pagina: paginaCruda,
}: {
  programId: string;
  slug: string;
  userId: string;
  chip?: string;
  pagina?: string;
}) {
  const chip = chipPedido(chipCrudo);
  const paginaPedida = Number.parseInt(paginaCruda ?? "", 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 0;

  const [conteos, resultado, sinVer] = await Promise.all([
    conteosDeChips(db, { programId, userId }),
    notificacionesDeChip(db, { programId, userId, chip, pagina }),
    conteoSinVer(db, { programId, userId }),
  ]);

  const paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
  const origen = origenDeLaPagina("/mi-espacio", {
    programa: slug,
    tab: "notificaciones",
    chip,
    ...(pagina > 0 ? { pagina: String(pagina) } : {}),
  });

  const hrefDeChip = (c: ChipNotificacion) =>
    `/mi-espacio?tab=notificaciones&programa=${slug}&chip=${c}`;
  const hrefDePagina = (n: number) =>
    `/mi-espacio?tab=notificaciones&programa=${slug}&chip=${chip}${n > 0 ? `&pagina=${n}` : ""}`;

  return (
    <div className="space-y-4">
      {/* El total "sin ver" (223): el mismo número que el circulito del menú. */}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sinVer > 0 ? `Tienes ${sinVer} sin ver.` : "Estás al día: no hay nada sin ver."}
      </p>

      {/* Chips con su conteo, uno activo a la vez. */}
      <nav aria-label="Tipos de notificación" className="flex flex-wrap gap-2">
        {CHIPS_NOTIFICACIONES.map((c) => {
          const activo = c === chip;
          return (
            <Link
              key={c}
              href={hrefDeChip(c)}
              aria-current={activo ? "true" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-4xl border px-3 py-1 text-sm transition-colors",
                activo
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-border text-foreground hover:bg-muted",
              )}
            >
              {NOMBRE_DE_CHIP[c]}
              <Badge variant={activo ? "secondary" : "neutro"} className="cifra">
                {conteos[c]}
              </Badge>
            </Link>
          );
        })}
      </nav>

      {/* La línea de resumen del chip activo. */}
      <p className="text-sm text-muted-foreground">
        {resumenDeChip(chip, resultado.total, resultado.proxima)}
      </p>

      {resultado.tarjetas.length > 0 ? (
        <TarjetasNotificacion
          tarjetas={resultado.tarjetas}
          nombreDePendiente={NOMBRE_DE_PENDIENTE}
          programaSlug={slug}
          origen={origen}
        />
      ) : (
        <p className="text-sm text-muted-foreground">No hay nada aquí por ahora.</p>
      )}

      {paginas > 1 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Páginas">
          {pagina > 0 ? (
            <Link href={hrefDePagina(pagina - 1)} className="text-marca-texto underline-offset-2 hover:underline">
              Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            Página <span className="cifra">{pagina + 1}</span> de <span className="cifra">{paginas}</span>
          </span>
          {pagina + 1 < paginas ? (
            <Link href={hrefDePagina(pagina + 1)} className="text-marca-texto underline-offset-2 hover:underline">
              Siguiente
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}

/** "Tienes N en <chip>." y, si el chip tiene fecha, "La próxima es <fecha>." */
function resumenDeChip(
  chip: ChipNotificacion,
  total: number,
  proxima: Date | string | null,
): string {
  const base = `Tienes ${total} en ${NOMBRE_DE_CHIP[chip]}.`;
  if (total === 0 || proxima == null) return base;
  const texto = typeof proxima === "string" ? fechaCorta(proxima) : fechaHoraEnBogota(proxima);
  return `${base} La próxima es ${texto}.`;
}
