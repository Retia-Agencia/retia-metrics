import Link from "next/link";
import { db } from "@/lib/db";
import { NOMBRE_DE_PENDIENTE } from "@/lib/deals/etapas";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { fecha as fechaCorta, fechaHoraEnBogota } from "@/lib/format";
import { Pestanas, type GrupoDePestanas } from "@/components/layout/pestanas";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import {
  CHIPS_NOTIFICACIONES,
  DESCRIPCION_DE_CHIP,
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
  q,
}: {
  programId: string;
  slug: string;
  userId: string;
  chip?: string;
  pagina?: string;
  q?: string;
}) {
  const chip = chipPedido(chipCrudo);
  const paginaPedida = Number.parseInt(paginaCruda ?? "", 10);
  const pagina = Number.isFinite(paginaPedida) && paginaPedida > 0 ? paginaPedida : 0;
  // La búsqueda viaja con todo; vacía o corta, `leadsQueCasan` no estrecha nada.
  const busqueda = (q ?? "").trim();

  const [conteos, resultado, sinVer] = await Promise.all([
    conteosDeChips(db, { programId, userId, q: busqueda }),
    notificacionesDeChip(db, { programId, userId, chip, pagina, q: busqueda }),
    conteoSinVer(db, { programId, userId }),
  ]);

  const paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));
  const origen = origenDeLaPagina("/mi-espacio", {
    programa: slug,
    tab: "notificaciones",
    chip,
    ...(busqueda ? { q: busqueda } : {}),
    ...(pagina > 0 ? { pagina: String(pagina) } : {}),
  });

  // El `q` se conserva al cambiar de chip; la página se reinicia (otro chip, otra lista).
  const sufijoBusqueda = busqueda ? `&q=${encodeURIComponent(busqueda)}` : "";
  const hrefDeChip = (c: ChipNotificacion) =>
    `/mi-espacio?tab=notificaciones&programa=${slug}&chip=${c}${sufijoBusqueda}`;
  const hrefDePagina = (n: number) =>
    `/mi-espacio?tab=notificaciones&programa=${slug}&chip=${chip}${sufijoBusqueda}${n > 0 ? `&pagina=${n}` : ""}`;

  // Los chips como pestañas (mismo look que el Inbox): etiqueta, conteo y la descripción en
  // el `title` de cada pestaña. Un solo grupo.
  const grupos: GrupoDePestanas[] = [
    {
      pestanas: CHIPS_NOTIFICACIONES.map((c) => ({
        id: c,
        etiqueta: NOMBRE_DE_CHIP[c],
        total: conteos[c],
        descripcion: DESCRIPCION_DE_CHIP[c],
        href: hrefDeChip(c),
      })),
    },
  ];

  return (
    <div className="space-y-4">
      {/* El total "sin ver" (223): el mismo número que el circulito del menú. */}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {sinVer > 0 ? `Tienes ${sinVer} sin ver.` : "Estás al día: no hay nada sin ver."}
      </p>

      {/* Las pestañas (mismo look que el Inbox) y el buscador a su lado. */}
      <div className="flex flex-wrap items-center gap-2">
        <Pestanas grupos={grupos} activa={chip} etiqueta="Tipo de notificación" />
        <div className="min-w-48 flex-1 basis-56">
          <BuscadorUrl />
        </div>
      </div>

      {/* La descripción del chip activo, visible debajo de la barra (en móvil no hay tooltip). */}
      <p className="text-xs text-muted-foreground">{DESCRIPCION_DE_CHIP[chip]}</p>

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
  // Vencidos y Sin Grain ordenan del más antiguo: su fecha clave ya pasó.
  const cual = chip === "vencidos" || chip === "sin_grain" ? "La más antigua es" : "La próxima es";
  return `${base} ${cual} ${texto}.`;
}
