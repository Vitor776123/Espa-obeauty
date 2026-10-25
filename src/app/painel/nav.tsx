"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type ItemNav = { href: string; rotulo: string };

export function NavPainel({ itens, aoNavegar }: { itens: ItemNav[]; aoNavegar?: () => void }) {
  const caminho = usePathname();
  return (
    <nav aria-label="Painel" className="flex flex-col gap-1">
      {itens.map((i) => {
        const ativo = i.href === "/painel" ? caminho === "/painel" : caminho.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            onClick={aoNavegar}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-xl px-4 py-2.5 text-[0.95rem] font-medium transition ${
              ativo ? "bg-perola text-ameixa" : "text-cha hover:bg-perola/10 hover:text-perola"
            }`}
          >
            {i.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
