import Link from "next/link";

/** Quando o logo oficial estiver em /public/logo.png, é só trocar para "/logo.png". */
const LOGO_URL: string | null = null;

export function Marca({
  tom = "escuro",
  tamanho = "normal",
  link = true,
}: {
  tom?: "escuro" | "claro";
  tamanho?: "normal" | "grande";
  link?: boolean;
}) {
  const cor = tom === "claro" ? "text-perola" : "text-ameixa";
  const sub = tom === "claro" ? "text-cha" : "text-suave";
  const conteudo = (
    <span className={`inline-flex items-center gap-3 ${cor}`}>
      {LOGO_URL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={LOGO_URL} alt="" width={44} height={44} className="h-11 w-11 object-contain" />
      ) : null}
      <span className="flex flex-col leading-none">
        <span
          className={`font-display italic ${tamanho === "grande" ? "text-4xl" : "text-[1.65rem]"} font-medium tracking-tight`}
        >
          Espaço Beauty
        </span>
        <span className={`mt-1.5 text-[0.78rem] font-medium tracking-[0.04em] ${sub}`}>Eliana Domingues</span>
      </span>
    </span>
  );
  return link ? (
    <Link href="/" aria-label="Espaço Beauty, início" className="inline-block">
      {conteudo}
    </Link>
  ) : (
    conteudo
  );
}
