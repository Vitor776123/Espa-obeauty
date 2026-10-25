import { Suspense } from "react";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { listarHorarios, listarProfissionais, listarServicos } from "@/lib/dados";
import { Titulo, EsqueletoPainel } from "@/app/painel/ui";
import { FormularioProfissional } from "@/app/painel/profissionais/[id]/formulario";

export const metadata = { title: "Profissional" };

async function EditarProfissional({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const [profs, horarios, servicos] = await Promise.all([listarProfissionais({ incluirInativos: true }), listarHorarios(), listarServicos({ incluirInativos: true })]);
  const nova = id === "nova";
  const prof = nova ? null : (profs.find((p) => p.id === id) ?? null);
  if (!nova && !prof) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo titulo={prof ? prof.nome : "Nova profissional"} descricao="Dados, horário de trabalho e serviços que ela faz. Para dar acesso ao painel, use Configurações > Equipe." />
      <FormularioProfissional
        prof={prof}
        horarios={prof ? horarios.filter((h) => h.profissional_id === prof.id) : []}
        servicos={servicos.map((s) => ({ id: s.id, nome: s.nome, categoria: s.categoria, faz: prof ? s.profissionais.includes(prof.id) : s.ativo }))}
        proximaOrdem={Math.max(0, ...profs.map((p) => p.ordem)) + 1}
      />
    </div>
  );
}

export default function Pagina(props: Parameters<typeof EditarProfissional>[0]) {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <EditarProfissional {...props} />
    </Suspense>
  );
}
