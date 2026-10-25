import { Suspense } from "react";
import Link from "next/link";
import { exigirAdmin } from "@/lib/auth";
import { listarHorarios, listarProfissionais } from "@/lib/dados";
import { nomeDiaCurto } from "@/lib/tempo";
import { Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";

export const metadata = { title: "Profissionais" };

async function Profissionais() {
  await exigirAdmin();
  const [profs, horarios] = await Promise.all([listarProfissionais({ incluirInativos: true }), listarHorarios()]);

  return (
    <div className="mx-auto max-w-4xl">
      <Titulo
        titulo="Profissionais"
        descricao="Cada profissional tem agenda e horário de trabalho próprios. O site só oferece horários de quem está ativa."
        acao={
          <Link href="/painel/profissionais/nova" className="btn btn-principal">
            Nova profissional
          </Link>
        }
      />
      {profs.length === 0 ? (
        <Vazio titulo="Nenhuma profissional" />
      ) : (
        <ul className="space-y-3">
          {profs.map((p) => {
            const dias = horarios.filter((h) => h.profissional_id === p.id).sort((a, b) => a.dia_semana - b.dia_semana);
            return (
              <li key={p.id} className={`flex flex-wrap items-center gap-4 rounded-2xl border border-linha bg-white p-5 ${p.ativo ? "" : "opacity-60"}`}>
                <span className="grid h-12 w-12 place-items-center rounded-full font-display text-xl text-white" style={{ background: p.cor }} aria-hidden>
                  {p.nome.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {p.nome} {!p.ativo ? <span className="selo selo-neutro ml-1">Inativa</span> : null}
                  </p>
                  <p className="text-sm capitalize text-suave">
                    {dias.length ? dias.map((d) => nomeDiaCurto(d.dia_semana)).join(", ") : "Sem horário de trabalho cadastrado"}
                  </p>
                </div>
                <Link href={`/painel/agenda?prof=${p.id}`} className="btn btn-quieto btn-pequeno">
                  Ver agenda
                </Link>
                <Link href={`/painel/profissionais/${p.id}`} className="btn btn-contorno btn-pequeno">
                  Editar
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Profissionais />
    </Suspense>
  );
}
