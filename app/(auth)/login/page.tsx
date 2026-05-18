import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LoginContent } from "@/app/(auth)/_components/LoginContent";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";
import { buildPageMetadata } from "@/lib/seo/config";

export const metadata: Metadata = buildPageMetadata({
  title: "Entrar no Bolão do Milhão — Login bolão da Copa 2026",
  description:
    "Faça login no Bolão do Milhão com CPF ou e-mail. Acesse seus palpites da Copa 2026, ranking e premiação.",
  path: "/login",
});

function safeReturnPath(from: string | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

export default async function LoginPage(props: {
  searchParams?: Promise<{ from?: string }>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : undefined;
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (token) {
    const userId = await verifySessionToken(token).catch(() => null);
    if (userId) {
      const next = safeReturnPath(searchParams?.from) ?? "/boloes";
      redirect(next);
    }
  }

  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
