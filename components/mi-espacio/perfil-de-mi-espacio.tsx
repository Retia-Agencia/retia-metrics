import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Rol } from "@/lib/auth/roles";

/** Cómo se nombra cada rol en la interfaz (ticket 172). */
const ETIQUETA_ROL: Record<Rol, string> = {
  gerente: "Gerencia comercial",
  closer: "Closer",
  developer: "Desarrollo",
};

/**
 * El perfil de Mi espacio (ticket 172): nombre, foto y rol, todo de Google / la sesión y
 * sin editar. `closer_id` NO se muestra (167, 159). Es un componente de servidor: recibe
 * datos planos y no toca la base.
 */
export function PerfilDeMiEspacio({
  nombre,
  imagen,
  rol,
}: {
  nombre: string;
  imagen: string | null;
  rol: Rol;
}) {
  const iniciales = nombre
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <Avatar className="size-12">
          {imagen ? <AvatarImage src={imagen} alt="" /> : null}
          <AvatarFallback>{iniciales || "?"}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-base font-medium">{nombre}</p>
          <Badge variant="secondary" className="mt-1">
            {ETIQUETA_ROL[rol]}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
