import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { LoginContent } from "@/app/(auth)/_components/LoginContent";
import { AuthDesktopShell } from "@/app/(auth)/_components/AuthDesktopShell";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

function safeReturnPath(from: string | undefined): string | null {
  if (!from || !from.startsWith("/") || from.startsWith("//")) return null;
  if (from.startsWith("/login") || from.startsWith("/cadastrar")) return null;
  return from;
}

export default async function LoginPage(props: { searchParams?: Promise<{ from?: string }> }) {
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
    <AuthDesktopShell>
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
    </AuthDesktopShell>
  );
}
