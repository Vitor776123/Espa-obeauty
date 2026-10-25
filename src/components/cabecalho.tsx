import Link from "next/link";
import { Marca } from "@/components/marca";

export function CabecalhoSite() {
  return (
    <div className="no-escuro bg-ameixa text-perola">
      <header className="container-site flex items-center justify-between gap-4 py-5">
        <Marca tom="claro" />
        <nav className="flex items-center gap-1 sm:gap-3" aria-label="Principal">
          <Link href="/#servicos" className="btn btn-quieto-claro hidden sm:inline-flex">
            Serviços
          </Link>
          <Link href="/entrar" className="btn btn-quieto-claro hidden sm:inline-flex">
            Equipe
          </Link>
          <Link href="/agendar" className="btn btn-ambar btn-pequeno">
            Agendar
          </Link>
        </nav>
      </header>
    </div>
  );
}
