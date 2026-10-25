import Link from "next/link";
import type { Metadata } from "next";
import { Marca } from "@/components/marca";
import { FormLogin } from "@/app/entrar/form";

export const metadata: Metadata = { title: "Acesso da equipe", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <main className="grid min-h-dvh md:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden bg-ameixa md:block">
        <div className="absolute inset-0 grid place-items-center p-12">
          <div className="max-w-sm text-perola">
            <Marca tom="claro" tamanho="grande" link={false} />
            <p className="mt-8 text-lg text-cha">Agenda, clientes e serviços em um só lugar.</p>
          </div>
        </div>
        <div aria-hidden className="absolute bottom-0 left-1/2 flex -translate-x-1/2 gap-6 pb-10">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} className="lampada acendendo" style={{ ["--i" as string]: i, ["--d" as string]: "14px" } as React.CSSProperties} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="md:hidden">
            <Marca />
          </div>
          <h1 className="mt-8 text-4xl md:mt-0">Acesso da equipe</h1>
          <p className="mt-2 text-suave">Entre com o e-mail e a senha que a administradora criou para você.</p>
          <FormLogin />
          <Link href="/" className="btn btn-quieto mt-6 w-full">
            Voltar ao site
          </Link>
        </div>
      </div>
    </main>
  );
}
