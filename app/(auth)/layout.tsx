import { Suspense } from "react";
import { AuthDesktopShell } from "@/app/(auth)/_components/AuthDesktopShell";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <AuthDesktopShell>{children}</AuthDesktopShell>
    </Suspense>
  );
}
