import Image from "next/image";
/**
 * O espelho de camarim do hero: moldura em arco com lâmpadas que acendem uma a uma.
 * Geometria em um quadro de 400 × 540; as posições viram porcentagens do contêiner.
 */
const W = 400;
const H = 540;
const CX = 200;
const CY = 200; // centro do semicírculo
const R = 186; // raio no meio da moldura (borda externa 200, espessura 28)

type P = { x: number; y: number };

function pontos(): P[] {
  const lista: P[] = [];
  // lado esquerdo, de baixo para cima
  for (let y = 500; y > CY; y -= 52) lista.push({ x: CX - R, y });
  // arco, da esquerda para a direita
  const passos = 15;
  for (let i = 0; i <= passos; i++) {
    const ang = Math.PI - (Math.PI * i) / passos;
    lista.push({ x: CX + R * Math.cos(ang), y: CY - R * Math.sin(ang) });
  }
  // lado direito, de cima para baixo
  for (let y = CY + 52; y <= 500; y += 52) lista.push({ x: CX + R, y });
  return lista;
}

const LAMPADAS = pontos();

export function Espelho() {
  return (
    <div
      className="relative mx-auto w-full max-w-[26rem] select-none"
      style={{ aspectRatio: `${W} / ${H}`, containerType: "inline-size" }}
      role="img"
      aria-label="Espelho de camarim com o nome Espaço Beauty"
    >
      {/* moldura */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(165deg, #84365a, #4a1a31)",
          boxShadow: "0 0 0 2px rgb(242 182 109 / 0.55), 0 0 110px -10px rgb(242 182 109 / 0.3), 0 30px 60px -28px #000",
          borderRadius: `${(200 / W) * 100}% ${(200 / W) * 100}% 0 0 / ${(200 / H) * 100}% ${(200 / H) * 100}% 0 0`,
        }}
      />
      {/* vidro */}
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${(28 / W) * 100}%`,
          right: `${(28 / W) * 100}%`,
          top: `${(28 / H) * 100}%`,
          bottom: 0,
          borderRadius: `${(172 / 344) * 100}% ${(172 / 344) * 100}% 0 0 / ${(172 / 512) * 100}% ${(172 / 512) * 100}% 0 0`,
          background:
            "radial-gradient(120% 80% at 30% 15%, #fffaf6 0%, #f8ece9 45%, #efd9d8 100%)",
        }}
      >
        {/* reflexo */}
        <div
          className="respirando absolute -left-1/4 top-0 h-full w-1/2 -skew-x-12"
          style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.55), transparent)" }}
        />
        <Image
          src="/fotos/recorte-tesoura.webp"
          alt="Eliana Domingues com tesoura e pente"
          width={760}
          height={1078}
          priority
          sizes="(min-width:768px) 26rem, 17rem"
          className="absolute bottom-0 left-1/2 w-[104%] max-w-none -translate-x-1/2"
        />
      </div>
      {/* lâmpadas */}
      {LAMPADAS.map((p, i) => (
        <span
          key={i}
          className="lampada acendendo absolute -translate-x-1/2 -translate-y-1/2"
          style={
            {
              left: `${(p.x / W) * 100}%`,
              top: `${(p.y / H) * 100}%`,
              ["--d" as string]: "3.6cqw",
              ["--i" as string]: i,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
