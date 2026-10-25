import { Suspense } from "react";
import { notFound } from "next/navigation";
import { exigirAdmin } from "@/lib/auth";
import { getServico, listarProfissionais, listarServicos } from "@/lib/dados";
import { Titulo, EsqueletoPainel } from "@/app/painel/ui";
import { FormularioServico } from "@/app/painel/servicos/[id]/formulario";

export const metadata = { title: "Serviço" };

async function EditarServico({ params }: { params: Promise<{ id: string }> }) {
  await exigirAdmin();
  const { id } = await params;
  const [profissionais, todos] = await Promise.all([listarProfissionais(), listarServicos({ incluirInativos: true })]);
  const categorias = [...new Set(todos.map((s) => s.categoria))];
  const novo = id === "novo";
  const servico = novo ? null : /^[0-9a-f-]{36}$/.test(id) ? await getServico(id) : null;
  if (!novo && !servico) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <Titulo titulo={servico ? servico.nome : "Novo serviço"} descricao={servico ? "Edite as informações e salve." : "Preencha o que a cliente vai ver no site."} />
      <FormularioServico
        servico={servico}
        profissionais={profissionais}
        categorias={categorias}
        proximaOrdem={Math.max(0, ...todos.map((s) => s.ordem)) + 1}
      />
    </div>
  );
}

export default function Pagina(props: Parameters<typeof EditarServico>[0]) {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <EditarServico {...props} />
    </Suspense>
  );
}
