import type { SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  fill: "none",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export function IconeCategoria({ categoria, className }: { categoria: string; className?: string }) {
  const c = categoria.toLowerCase();
  let d: React.ReactNode;
  if (c.includes("unha")) {
    d = (
      <>
        <rect x="14" y="22" width="20" height="20" rx="5" />
        <rect x="20" y="14" width="8" height="8" rx="1" />
        <path d="M22 6h4v8h-4z" />
        <path d="M19 28v8" />
      </>
    );
  } else if (c.includes("sobrancelha") || c.includes("buço") || c.includes("buco")) {
    d = (
      <>
        <path d="M8 16c8-6 24-6 32 0" />
        <path d="M8 31c6-7 26-7 32 0c-6 7-26 7-32 0z" />
        <circle cx="24" cy="31" r="3.5" />
      </>
    );
  } else if (c.includes("trat") || c.includes("color")) {
    d = (
      <>
        <path d="M24 6c6 8 12 14 12 21a12 12 0 0 1-24 0c0-7 6-13 12-21z" />
        <path d="M18 28a6 6 0 0 0 6 6" />
      </>
    );
  } else if (c.includes("cabelo")) {
    d = (
      <>
        <circle cx="14" cy="36" r="5" />
        <circle cx="34" cy="36" r="5" />
        <path d="M17.5 32.5L36 8M30.5 32.5L12 8" />
      </>
    );
  } else {
    d = <path d="M24 6l3.5 12.5L40 22l-12.5 3.5L24 38l-3.5-12.5L8 22l12.5-3.5z" />;
  }
  return (
    <svg viewBox="0 0 48 48" stroke="currentColor" className={className} {...base}>
      {d}
    </svg>
  );
}

export function IconeRelogio({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
export function IconeVolta({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </svg>
  );
}
export function IconeSino({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" className={className} {...base}>
      <path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15z" />
      <path d="M10 21h4" />
    </svg>
  );
}
export function IconeZap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" stroke="currentColor" className={className} {...base} strokeWidth={1.7}>
      <path d="M20 12a8 8 0 0 1-11.9 7L4 20l1.1-4A8 8 0 1 1 20 12z" />
      <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-.8-.4-1.6-1.2-2-2l.8-1-1-2z" />
    </svg>
  );
}
