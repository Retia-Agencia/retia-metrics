"use client";

import { usePathname, useRouter } from "next/navigation";
import { PROGRAMAS } from "@/lib/nav";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Selector de programa. Los dos programas nunca se suman ni se promedian entre si,
 * asi que se navega de uno a otro, no se muestran juntos.
 */
export function ProgramSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const actual = PROGRAMAS.find((p) => pathname.startsWith(`/${p.slug}`))?.slug;

  if (!actual) return null;

  return (
    <Select value={actual} onValueChange={(slug) => router.push(`/${slug}`)}>
      <SelectTrigger className="w-56" aria-label="Programa">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PROGRAMAS.map((p) => (
          <SelectItem key={p.slug} value={p.slug}>
            {p.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
