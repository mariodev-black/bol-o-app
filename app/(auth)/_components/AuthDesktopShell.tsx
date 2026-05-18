import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Award, ShieldCheck, Users } from "lucide-react";
import logo from "@/app/assets/logo.svg";
import sideImage from "@/app/assets/login-r-side-desk.png";
import { AuthScreenLayout } from "@/app/(auth)/_components/AuthScreenLayout";

const FEATURES = [
  { icon: ShieldCheck, label: "100% seguro e regulamentado" },
  { icon: Award, label: "Prêmios pagos em até 24h" },
  { icon: Users, label: "Mais de 48.000 jogadores ativos" },
] as const;

type AuthDesktopShellProps = {
  children: React.ReactNode;
};

export function AuthDesktopShell({ children }: AuthDesktopShellProps) {
  return (
    <main className="min-h-dvh bg-black text-white lg:grid lg:grid-cols-[minmax(0,46%)_1fr]">
      <aside className="relative hidden min-h-dvh overflow-hidden lg:block">
        <Image src={sideImage} alt="" fill priority sizes="46vw" className="object-cover" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,6,13,0.72)_0%,rgba(3,6,13,0.48)_52%,rgba(3,6,13,0.78)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.58)_100%)]" />

        <div className="absolute left-[7.5%] top-[7%]">
          <Link href="/" aria-label="Bolão do Milhão">
            <Image src={logo} alt="Bolão do Milhão" width={178} height={42} priority className="h-auto w-[178px]" />
          </Link>
        </div>

        <div className="absolute left-[7.5%] top-1/2 max-w-[430px] -translate-y-1/2">
          <h1 className="text-[54px] font-black leading-[0.98] tracking-[-0.055em]">
            Dispute o
            <br />
            <span className="text-primary">prêmio de</span>
            <br />
            R$ 1.000.000
          </h1>
          <p className="mt-6 max-w-[360px] text-[22px] font-medium leading-[1.22] text-white/88">
            Faça seus palpites, suba no ranking e concorra ao maior bolão esportivo do Brasil.
          </p>
          <div className="mt-7 flex flex-col gap-4">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 text-[15px] font-medium text-white/72">
                <span className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-primary/25 bg-primary/12 shadow-[0_0_18px_rgba(177,235,11,0.18)]">
                  <Icon className="h-[17px] w-[17px] text-primary" strokeWidth={2.1} />
                </span>
                {label}
              </div>
            ))}
          </div>
        </div>
      </aside>

      <Suspense fallback={<div className="min-h-dvh bg-black" />}>
        <AuthScreenLayout>{children}</AuthScreenLayout>
      </Suspense>
    </main>
  );
}
