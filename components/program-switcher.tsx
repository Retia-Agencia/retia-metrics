"use client";

import { usePathname, useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Programa = { slug: string; nombre: string };

/**
 * Selector de programa. Los programas nunca se suman ni se promedian entre si,
 * asi que se navega de uno a otro, no se muestran juntos. La lista llega como dato
 * (sale de la base, ADR 0012); este componente no conoce ningun programa.
 */
export function ProgramSwitcher({ programas }: { programas: readonly Programa[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const actual = programas.find((p) => pathname.startsWith(`/programas/${p.slug}`))?.slug;

  if (!actual) return null;

  return (
    <Select value={actual} onValueChange={(slug) => router.push(`/programas/${slug}`)}>
      <SelectTrigger className="w-56" aria-label="Programa">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {programas.map((p) => (
          <SelectItem key={p.slug} value={p.slug}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
