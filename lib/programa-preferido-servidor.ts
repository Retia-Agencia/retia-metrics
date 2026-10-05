import { cookies } from "next/headers";
import { COOKIE_PROGRAMA_PREFERIDO } from "@/lib/programa-preferido";

export async function programaPreferidoDeCookie(): Promise<string | null> {
  return (await cookies()).get(COOKIE_PROGRAMA_PREFERIDO)?.value ?? null;
}
