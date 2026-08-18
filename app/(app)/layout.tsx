import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { paginaConSesion } from "@/lib/auth/page-guards";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await paginaConSesion();

  return (
    <div className="flex min-h-full flex-1">
      <AppSidebar
        rol={session.user.rol}
        nombre={session.user.name ?? session.user.email ?? "Usuario"}
        email={session.user.email ?? ""}
        imagen={session.user.image}
      />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
