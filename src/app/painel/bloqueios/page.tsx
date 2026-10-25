import { Suspense } from "react";
import { exigirMembro } from "@/lib/auth";
import { listarProfissionais } from "@/lib/dados";
import { escopoDe, listarBloqueios } from "@/lib/painel";
import { dataPorExtenso, hojeSP, somarDias } from "@/lib/tempo";
import { Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";
import { BotaoRemover, FormularioBloqueio } from "@/app/painel/bloqueios/formulario";

export const metadata = { title: "Bloqueios" };

async function Bloqueios() {
  const m = await exigirMembro();
  const hoje = hojeSP();
  const [profs, lista] = await Promise.all([
    listarProfissionais({ incluirInativos: true }),
    listarBloqueios({ de: hoje, ate: somarDias(hoje, 180), escopo: escopoDe(m) }),
  ]);
  const nome = (id: string | null) => (id ? (profs.find((p) => p.id === id)?.nome ?? "Profissional") : "Todas as profissionais");

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[24rem_minmax(0,1fr)]">
      <div className="lg:col-span-2">
        <Titulo titulo="Bloqueios" descricao="Folgas, compromissos e pausas. Horários bloqueados somem do site e do novo agendamento." />
      </div>
      <FormularioBloqueio hoje={hoje} profissionais={profs.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))} admin={m.papel === "admin"} />
      <section aria-labelledby="h-prox">
        <h2 id="h-prox" className="mb-4 text-2xl">Próximos bloqueios</h2>
        {lista.length === 0 ? (
          <Vazio titulo="Nenhum bloqueio">Quando você bloquear um horário, ele aparece aqui.</Vazio>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((b) => (
              <li key={b.id} className="flex items-center gap-4 rounded-2xl border border-linha bg-white p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold first-letter:uppercase">{dataPorExtenso(b.data)}</p>
                  <p className="tabular text-sm text-suave">
                    {b.inicio === "00:00" && b.fim === "23:59" ? "Dia inteiro" : `${b.inicio} às ${b.fim}`} · {nome(b.profissional_id)}
                    {b.motivo ? ` · ${b.motivo}` : ""}
                  </p>
                </div>
                <BotaoRemover id={b.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Bloqueios />
    </Suspense>
  );
}
