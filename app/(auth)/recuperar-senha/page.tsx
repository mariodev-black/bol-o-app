import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { RecuperarSenhaContent } from "@/app/(auth)/_components/RecuperarSenhaContent";
import { sessionCookieName, verifySessionToken } from "@/lib/auth/session";

export default async function RecuperarSenhaPage() {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (token) {
    const userId = await verifySessionToken(token).catch(() => null);
    if (userId) redirect("/boloes");
  }

  return (
    <Suspense fallback={null}>
      <RecuperarSenhaContent />
    </Suspense>
  );
}
