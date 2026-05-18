import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CadastrarContent } from "@/app/(auth)/_components/CadastrarContent";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Cadastro grátis — Bolão da Copa 2026 | Bolão do Milhão",
  description:
    "Cadastre-se no Bolão do Milhão em poucos minutos. Garanta sua cota do bolão da Copa 2026 por R$ 39,90 e comece a enviar palpites.",
  path: "/cadastrar",
});

function safeReturnPath(from: string | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

export default async function CadastrarPage(props: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (token) {
    const userId = await verifySessionToken(token).catch(() => null);
    if (userId) redirect(safeReturnPath(searchParams?.from) ?? "/tickets");
  }

  return (
    <Suspense fallback={null}>
      <CadastrarContent />
    </Suspense>
  );
}
