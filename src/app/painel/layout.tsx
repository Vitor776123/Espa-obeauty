import { Suspense } from "react";
import type { Metadata } from "next";
import { exigirMembro } from "@/lib/auth";
import { Marca } from "@/components/marca";
import { sair } from "@/app/entrar/actions";
import { NavPainel, type ItemNav } from "@/app/painel/nav";

export const metadata: Metadata = { title: { default: "Painel", template: "%s · Painel" }, robots: { index: false, follow: false } };

async function Moldura({ children }: { children: React.ReactNode }) {
  const m = await exigirMembro();
  const itens: ItemNav[] = [
    { href: "/painel", rotulo: "Hoje" },
    { href: "/painel/agenda", rotulo: "Agenda" },
    { href: "/painel/novo", rotulo: "Novo agendamento" },
    { href: "/painel/clientes", rotulo: "Clientes" },
    ...(m.papel === "admin"
      ? [
          { href: "/painel/servicos", rotulo: "Serviços" },
          { href: "/painel/profissionais", rotulo: "Profissionais" },
          { href: "/painel/bloqueios", rotulo: "Bloqueios" },
          { href: "/painel/configuracoes", rotulo: "Configurações" },
        ]
      : [{ href: "/painel/bloqueios", rotulo: "Bloqueios" }]),
  ];

  const rodapeLateral = (
    <div className="border-t border-perola/15 pt-4 text-sm">
      <p className="truncate font-semibold text-perola">{m.nome}</p>
      <p className="text-cha/80">{m.papel === "admin" ? "Administradora" : "Profissional"}</p>
      <form action={sair} className="mt-3">
        <button type="submit" className="text-cha underline-offset-4 hover:text-perola hover:underline">
          Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh bg-perola md:grid md:grid-cols-[16rem_1fr]">
      {/* barra lateral (computador) */}
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between gap-8 bg-ameixa p-6 md:flex">
        <div className="space-y-8">
          <Marca tom="claro" />
          <NavPainel itens={itens} />
        </div>
        {rodapeLateral}
      </aside>

      {/* barra superior (celular) */}
      <header className="sticky top-0 z-30 bg-ameixa text-perola md:hidden">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3.5 [&::-webkit-details-marker]:hidden">
            <Marca tom="claro" link={false} />
            <span className="btn btn-pequeno border border-perola/30 text-perola group-open:bg-perola group-open:text-ameixa">Menu</span>
          </summary>
          <div className="space-y-6 border-t border-perola/15 px-5 pb-6 pt-4">
            <NavPainel itens={itens} />
            {rodapeLateral}
          </div>
        </details>
      </header>

      <main className="min-w-0 overflow-x-clip px-5 py-8 md:px-10 md:py-10">{children}</main>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-dvh place-items-center bg-perola" aria-busy>
          <span className="lampada acendendo" style={{ ["--d" as string]: "18px" } as React.CSSProperties} />
        </div>
      }
    >
      <Moldura>{children}</Moldura>
    </Suspense>
  );
}
