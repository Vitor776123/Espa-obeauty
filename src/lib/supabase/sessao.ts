import "server-only";
import { createServerClient } from "@supabase/ssr";
import { connection } from "next/server";
import { cookies } from "next/headers";

/**
 * Cliente de login (chave pública + cookies). Serve só para entrar/sair e saber QUEM é a pessoa.
 * Quem pode entrar no painel é decidido pela tabela beauty.equipe, não por este cliente.
 */
export async function clienteSessao() {
  // A sessão é sempre lida na hora do pedido; isso marca o ponto como dinâmico antes de qualquer Date.now() da biblioteca.
  await connection();
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          // chamado de um Server Component: o proxy já renova a sessão
        }
      },
    },
  });
}
