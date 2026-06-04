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

type AuthTab = "login" | "cadastro";

type AuthScreenLayoutProps = {
  children: React.ReactNode;
  mode?: "page" | "modal";
  activeTab?: AuthTab;
  onTabChange?: (tab: AuthTab) => void;
  panelDirection?: "left" | "right";
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

export function AuthScreenLayout({
  children,
  mode = "page",
  activeTab: activeTabProp,
  onTabChange,
  panelDirection: panelDirectionProp,
}: AuthScreenLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isModal = mode === "modal";
  const isLoginPage = (pathname ?? "").startsWith("/login");
  const isCadastroPage = (pathname ?? "").startsWith("/cadastrar");
  const showTabs = isModal || isLoginPage || isCadastroPage;
  const [storedReferral, setStoredReferral] = useState<string | null>(null);
  const prevTabRef = useRef<AuthTab>(
    activeTabProp ?? (isLoginPage ? "login" : "cadastro"),
  );
  const [panelDirection, setPanelDirection] = useState<"left" | "right">(
    panelDirectionProp ?? "right",
  );

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

  const activeTab: AuthTab =
    activeTabProp ?? (isLoginPage ? "login" : "cadastro");

  useEffect(() => {
    if (panelDirectionProp) {
      setPanelDirection(panelDirectionProp);
      return;
    }
    if (!showTabs) return;
    const prev = prevTabRef.current;
    if (prev !== activeTab) {
      setPanelDirection(activeTab === "login" ? "right" : "left");
      prevTabRef.current = activeTab;
    }
  }, [activeTab, showTabs, panelDirectionProp]);

  const panelAnimationClass =
    panelDirection === "right"
      ? "animate-auth-tab-panel-right"
      : "animate-auth-tab-panel-left";

  const tabButtonClass = (selected: boolean) =>
    [
      "flex h-12 items-center justify-center rounded-t-[14px] text-[13px] font-black uppercase tracking-[0.06em] transition-colors duration-200",
      selected
        ? "bg-[#B1EB0B] text-[#0E141B]"
        : "bg-transparent text-white/45 hover:text-white/65",
    ].join(" ");

  return (
    <div
      className={[
        "flex w-full flex-col bg-black text-white",
        isModal ? "max-h-[min(92dvh,820px)] overflow-hidden rounded-t-[1.35rem] sm:rounded-[1.35rem]" : "min-h-dvh",
      ].join(" ")}
    >
      {!isModal ? (
        <header className="flex shrink-0 items-center justify-center px-4 pb-2 pt-5 sm:px-5 sm:pt-6">
          <Link href="/" className="shrink-0" aria-label="Bolão do Milhão — início">
            <Image
              src={logo}
              alt="Bolão do Milhão"
              width={168}
              height={44}
              priority
              quality={100}
              className="h-[38px] w-auto sm:h-10"
            />
          </Link>
        </header>
      ) : null}

      <div className={["relative w-full shrink-0", isModal ? "" : ""].join(" ")}>
        <div
          className={[
            "relative mx-auto w-full overflow-hidden",
            isModal ? "rounded-none" : "max-w-[1080px] rounded-b-2xl lg:rounded-b-[1.25rem]",
          ].join(" ")}
        >
          <Image
            src={bannerLogin}
            alt=""
            quality={100}
            priority
            className="block h-auto w-full"
            sizes="(max-width: 1024px) 100vw, 1080px"
          />
        </div>
      </div>

      <div
        className={[
          "relative z-10 flex min-h-0 flex-1 flex-col",
          isModal ? "-mt-2 overflow-y-auto pb-4" : "-mt-2 flex-1 pb-8 sm:px-4 lg:mx-auto lg:w-full lg:max-w-lg",
        ].join(" ")}
      >
        <div
          className={[
            "flex min-h-0 flex-1 flex-col overflow-hidden bg-[#000000]",
            isModal
              ? "shadow-none"
              : "shadow-[0_-8px_40px_rgba(0,0,0,0.45)] rounded-t-[1.35rem]",
          ].join(" ")}
        >
          {showTabs ? (
            <div
              className="grid grid-cols-2 gap-0 px-3"
              role="tablist"
              aria-label="Cadastro ou login"
            >
              {isModal && onTabChange ? (
                <>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "cadastro"}
                    className={tabButtonClass(activeTab === "cadastro")}
                    onClick={() => onTabChange("cadastro")}
                  >
                    Cadastro
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "login"}
                    className={tabButtonClass(activeTab === "login")}
                    onClick={() => onTabChange("login")}
                  >
                    Entrar
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href={cadastroHref}
                    role="tab"
                    aria-selected={isCadastroPage}
                    className={tabButtonClass(isCadastroPage)}
                  >
                    Cadastro
                  </Link>
                  <Link
                    href={loginHref}
                    role="tab"
                    aria-selected={isLoginPage}
                    className={tabButtonClass(isLoginPage)}
                  >
                    Entrar
                  </Link>
                </>
              )}
            </div>
          ) : null}

          <div
            key={showTabs ? activeTab : pathname}
            className={[
              "flex flex-1 flex-col px-4 pb-6 pt-4 sm:px-5 sm:pb-7 sm:pt-5",
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
