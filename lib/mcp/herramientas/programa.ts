import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { ErrorDeApp } from "@/lib/errors";
import type { ContextoMcp } from "./tipos";

export async function programaVisible(contexto: ContextoMcp, slug: string) {
  const programa = await programaVisiblePorSlug(
    contexto.session.user.id,
    contexto.rol,
    slug,
    contexto.db,
  );
  if (!programa) throw new ErrorDeApp("No existe ese programa", 404);
  return programa;
}
