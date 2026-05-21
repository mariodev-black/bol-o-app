import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RecuperarSenhaContent } from "@/app/(auth)/_components/RecuperarSenhaContent";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Recuperar senha — Bolão do Milhão",
  description:
    "Redefina a senha da sua conta no Bolão do Milhão. Receba um código por e-mail e crie uma nova senha em poucos passos.",
  path: "/recuperar-senha",
});

export default async function RecuperarSenhaPage() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (token) {
    const userId = await verifySessionToken(token).catch(() => null);
    if (userId) redirect("/boloes");
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center px-4 text-sm text-white/50">
          Carregando...
        </main>
      }
    >
      <RecuperarSenhaContent />
    </Suspense>
  );
}
