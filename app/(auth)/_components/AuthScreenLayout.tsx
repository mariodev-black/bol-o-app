"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import bannerLogin from "@/app/assets/banner-login.png";
import logo from "@/app/assets/logo.svg";
import {
  normalizePendingReferralInput,
  readPendingReferralCode,
} from "@/lib/referrals/pending-referral-client";

type AuthScreenLayoutProps = {
  children: React.ReactNode;
};

function buildAuthHref(
  base: "/login" | "/cadastrar",
  from: string | null,
  ref: string | null,
): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (ref) params.set("ref", ref);
  const q = params.toString();
  return q ? `${base}?${q}` : base;
}

export function AuthScreenLayout({ children }: AuthScreenLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLogin = (pathname ?? "").startsWith("/login");
  const isCadastro = (pathname ?? "").startsWith("/cadastrar");
  const showTabs = isLogin || isCadastro;
  const [storedReferral, setStoredReferral] = useState<string | null>(null);
  const prevTabRef = useRef<"login" | "cadastro">(isLogin ? "login" : "cadastro");
  const [panelDirection, setPanelDirection] = useState<"left" | "right">("right");

  useEffect(() => {
    setStoredReferral(readPendingReferralCode());
  }, []);

  const fromParam = searchParams.get("from");
  const refFromUrl = normalizePendingReferralInput(searchParams.get("ref"));
  const referralCode = refFromUrl ?? storedReferral;

  const loginHref = useMemo(
    () => buildAuthHref("/login", fromParam, referralCode),
    [fromParam, referralCode],
  );
  const cadastroHref = useMemo(
    () => buildAuthHref("/cadastrar", fromParam, referralCode),
    [fromParam, referralCode],
  );

  const activeTab: "login" | "cadastro" = isLogin ? "login" : "cadastro";

  useEffect(() => {
    if (!showTabs) return;
    const prev = prevTabRef.current;
    if (prev !== activeTab) {
      setPanelDirection(activeTab === "login" ? "right" : "left");
      prevTabRef.current = activeTab;
    }
  }, [activeTab, showTabs]);

  const panelAnimationClass =
    panelDirection === "right"
      ? "animate-auth-tab-panel-right"
      : "animate-auth-tab-panel-left";

  return (
    <div className="flex min-h-dvh w-full flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 sm:px-5">
        <Link href="/" className="shrink-0" aria-label="Bolão do Milhão — início">
          <Image
            src={logo}
            alt="Bolão do Milhão"
            width={140}
            height={36}
            priority
            className="h-8 w-auto sm:h-9"
          />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={cadastroHref}
            className="flex h-9 min-w-[5.5rem] items-center justify-center rounded-lg bg-[#B1EB0B] px-3 text-[11px] font-black uppercase tracking-wide text-[#0E141B] sm:min-w-[6.25rem] sm:text-xs"
          >
            Cadastre-se
          </Link>
          <Link
            href={loginHref}
            className="flex h-9 min-w-[4.75rem] items-center justify-center rounded-lg border border-[#B1EB0B]/55 bg-transparent px-3 text-[11px] font-black uppercase tracking-wide text-[#B1EB0B] sm:min-w-[5.25rem] sm:text-xs"
          >
            Entrar
          </Link>
        </div>
      </header>

      <div className="relative w-full shrink-0">
        <div className="relative mx-auto w-full max-w-lg overflow-hidden rounded-b-2xl lg:max-w-none lg:rounded-b-[1.25rem]">
          <Image
            src={bannerLogin}
            alt=""
            priority
            className="h-auto w-full object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 55vw"
          />
        </div>
      </div>

      <div className="relative z-10 -mt-5 flex flex-1 flex-col pb-8 sm:px-4 lg:mx-auto lg:w-full lg:max-w-lg">
        <div
          className={[
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#000000] shadow-[0_-8px_40px_rgba(0,0,0,0.45)]",
            showTabs ? "rounded-t-[1.35rem]" : "rounded-t-[1.35rem]",
          ].join(" ")}
        >
          {showTabs ? (
            <div
              className="relative grid grid-cols-2 border-b border-white/8 p-1.5"
              role="tablist"
              aria-label="Cadastro ou login"
            >
              <span
                aria-hidden
                className="auth-tab-indicator pointer-events-none absolute bottom-1.5 top-1.5 left-1.5 w-[calc(50%-6px)] rounded-xl bg-[#B1EB0B]"
                style={{
                  transform:
                    activeTab === "login"
                      ? "translateX(calc(100%))"
                      : "translateX(0)",
                }}
              />
              <Link
                href={cadastroHref}
                role="tab"
                aria-selected={isCadastro}
                className={[
                  "relative z-10 flex h-11 items-center justify-center rounded-xl text-[13px] font-black uppercase tracking-wide transition-colors duration-300 ease-out",
                  isCadastro
                    ? "text-[#0E141B]"
                    : "text-white/55 hover:text-white/75",
                ].join(" ")}
              >
                Cadastro
              </Link>
              <Link
                href={loginHref}
                role="tab"
                aria-selected={isLogin}
                className={[
                  "relative z-10 flex h-11 items-center justify-center rounded-xl text-[13px] font-black uppercase tracking-wide transition-colors duration-300 ease-out",
                  isLogin
                    ? "text-[#0E141B]"
                    : "text-white/55 hover:text-white/75",
                ].join(" ")}
              >
                Entrar
              </Link>
            </div>
          ) : null}

          <div
            key={showTabs ? activeTab : pathname}
            className={[
              "flex flex-1 flex-col px-4 py-5 sm:px-5 sm:py-6",
              showTabs ? panelAnimationClass : "animate-auth-tab-panel-fade",
            ].join(" ")}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
