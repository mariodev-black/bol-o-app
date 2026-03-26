import Link from "next/link";
import {
  ChevronRight,
  CircleHelp,
  Crown,
  FileText,
  LogOut,
  Medal,
  Settings,
  Shield,
  Target,
  Ticket,
  Trophy,
  User2,
} from "lucide-react";

const recentPicks = [
  { id: "1", home: "BRA", away: "SRB", guess: "2x1", result: "2x1", hit: true },
  { id: "2", home: "SUI", away: "CMR", guess: "1x0", result: "1x0", hit: true },
  { id: "3", home: "POR", away: "GHA", guess: "3x2", result: "3x1", hit: false },
  { id: "4", home: "URU", away: "KOR", guess: "0x1", result: "2x0", hit: false },
];

const settingsItems = [
  { icon: User2, title: "Dados da Conta", subtitle: "Nome, usuário e e-mail", href: "/perfil" },
  { icon: Settings, title: "Preferências", subtitle: "Notificações e aparência", href: "/perfil" },
  { icon: Shield, title: "Segurança", subtitle: "Senha e autenticação", href: "/perfil" },
  { icon: CircleHelp, title: "Ajuda e Suporte", subtitle: "FAQ e atendimento", href: "/indique" },
  { icon: FileText, title: "Política de Privacidade", subtitle: "Seus dados e privacidade", href: "/privacidade" },
];

const highlights = [
  { label: "Meus Bolões", value: "3 ativos", href: "/boloes", icon: Trophy },
  { label: "Tickets", value: "12 disponíveis", href: "/tickets", icon: Ticket },
  { label: "Taxa de acerto", value: "68%", href: "/palpites?bolao=principal", icon: Target },
];

const achievements = [
  { label: "Mestre dos placares", icon: Crown, status: "ativo" as const },
  { label: "Top 10 da rodada", icon: Medal, status: "ativo" as const },
  { label: "Sequência perfeita", icon: Target, status: "bloqueado" as const },
];

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-2.5">
      <div className="h-px flex-1 ml-3" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0) 100%)" }} />
      <h2 className="text-[18px] uppercase tracking-[0.12em] font-black" style={{ color: "rgba(255,232,186,0.82)" }}>
        {title}
      </h2>
      <div className="h-px flex-1 ml-3" style={{ background: "linear-gradient(90deg, rgba(212,175,55,0.5) 0%, rgba(212,175,55,0) 100%)" }} />
    </div>
  );
}

export default function PerfilPage() {
  return (
    <div className="flex flex-1 flex-col px-4 sm:px-6 py-6 max-w-xl mx-auto w-full gap-4">
      <header className="pt-1">
        <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(218,182,130,0.85)" }}>
          Centro do Jogador
        </p>
        <h1 className="mt-1 text-[34px] sm:text-[38px] leading-none font-black text-white tracking-tight">Perfil Elite</h1>
        <p className="mt-2 text-[14px]" style={{ color: "rgba(255,255,255,0.52)" }}>
          Gestão completa da sua conta, desempenho e status.
        </p>
      </header>

      <section
        className="rounded-[28px] p-4 sm:p-5 border relative overflow-hidden"
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          background:
            "radial-gradient(130% 110% at 0% 0%, rgba(212,175,55,0.16) 0%, rgba(212,175,55,0) 52%), radial-gradient(140% 100% at 100% 100%, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0) 58%), linear-gradient(160deg, #0E1524 0%, #0A101D 60%, #090F1A 100%)",
          boxShadow: "0 14px 38px rgba(0,0,0,0.34)",
        }}
      >
        <div className="absolute -right-10 -top-12 w-32 h-32 rounded-full blur-3xl" style={{ background: "rgba(212,175,55,0.22)" }} aria-hidden />
        <div className="absolute -left-12 -bottom-14 w-36 h-36 rounded-full blur-3xl" style={{ background: "rgba(59,130,246,0.2)" }} aria-hidden />
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative w-[70px] h-[70px] rounded-2xl bg-[#D4AF37] text-[#0E141B] flex items-center justify-center text-[30px] font-black shadow-[0_12px_24px_rgba(212,175,55,0.35)]">
              OP
              <span className="absolute -right-1 -bottom-1 w-6 h-6 rounded-full flex items-center justify-center border border-[#D4AF37] bg-[#0A0E19]">
                <Trophy className="w-3 h-3" style={{ color: "#D4AF37" }} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-[30px] sm:text-[32px] font-black text-white leading-[0.95] truncate">Pedro Alves</p>
              <p className="text-[13px] mt-1" style={{ color: "rgba(255,255,255,0.62)" }}>
                @pedro123 · Membro desde Jan 2026
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className="px-3 py-1 rounded-lg text-[11px] font-black border"
              style={{ background: "rgba(212,175,55,0.12)", borderColor: "rgba(212,175,55,0.38)", color: "#D4AF37" }}
            >
              Nível Ouro
            </span>
            <span
              className="px-3 py-1 rounded-lg text-[11px] font-black border"
              style={{ background: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.38)", color: "#93C5FD" }}
            >
              Premium
            </span>
          </div>
        </div>

        <div className="relative mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Palpites", value: "32", color: "white" },
            { label: "Acertos", value: "5", color: "#22C55E" },
            { label: "Pontos", value: "32", color: "#FACC15" },
            { label: "Ranking", value: "#6", color: "#60A5FA" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl px-3 py-2.5 border"
              style={{
                borderColor: "rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <p className="text-[26px] leading-none font-black" style={{ color: item.color }}>
                {item.value}
              </p>
              <p className="text-[11px] mt-1 uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.48)" }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Visão Geral" />
        <div className="grid grid-cols-3 gap-2">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-xl border px-2 py-2.5 transition-all duration-200 hover:-translate-y-px text-center"
                style={{
                  borderColor: "rgba(255,255,255,0.1)",
                  background: "linear-gradient(180deg, rgba(11,17,30,0.96) 0%, rgba(8,12,22,0.96) 100%)",
                }}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className="w-8 h-8 rounded-lg border flex items-center justify-center shrink-0"
                    style={{ borderColor: "rgba(212,175,55,0.28)", background: "rgba(212,175,55,0.1)" }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-bold text-white leading-tight">{item.label}</p>
                    <p className="text-[10px] leading-tight mt-0.5" style={{ color: "rgba(255,255,255,0.58)" }}>
                      {item.value}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "linear-gradient(180deg, #0D1628 0%, #0A0E19 100%)" }}
      >
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <h2 className="text-[22px] font-black text-white">Últimos Palpites</h2>
          <Link href="/palpites?bolao=principal" className="text-sm font-bold inline-flex items-center gap-1" style={{ color: "#7EA8FF" }}>
            Ver todos <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="px-3 py-2">
          {recentPicks.map((pick) => (
            <div
              key={pick.id}
              className="grid grid-cols-[24px_1fr_auto_auto] items-center gap-3 px-2 py-2.5 border-b last:border-b-0"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}
            >
              <span className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: pick.hit ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)" }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: pick.hit ? "#22C55E" : "#EF4444" }} />
              </span>
              <p className="text-sm font-semibold text-white">
                {pick.home} <span style={{ color: "rgba(255,255,255,0.45)" }}>vs</span> {pick.away}
              </p>
              <p className="text-sm font-black" style={{ color: "rgba(255,255,255,0.8)" }}>
                {pick.guess}
              </p>
              <p className="text-sm font-black" style={{ color: pick.hit ? "#22C55E" : "#EF4444" }}>
                {pick.result}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Conquistas" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {achievements.map((badge) => (
            <div
              key={badge.label}
              className="rounded-2xl border px-3 py-3"
              style={{
                borderColor: badge.status === "bloqueado" ? "rgba(255,255,255,0.08)" : "rgba(212,175,55,0.28)",
                background:
                  badge.status === "bloqueado"
                    ? "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.01) 100%)"
                    : "linear-gradient(180deg, rgba(14,20,35,0.96) 0%, rgba(9,14,25,0.96) 100%)",
                opacity: badge.status === "bloqueado" ? 0.65 : 1,
              }}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-9 h-9 rounded-xl border flex items-center justify-center"
                  style={{
                    borderColor: badge.status === "bloqueado" ? "rgba(255,255,255,0.12)" : "rgba(212,175,55,0.34)",
                    background: badge.status === "bloqueado" ? "rgba(255,255,255,0.03)" : "rgba(212,175,55,0.12)",
                  }}
                >
                  <badge.icon className="w-4.5 h-4.5" style={{ color: badge.status === "bloqueado" ? "rgba(255,255,255,0.4)" : "#D4AF37" }} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">{badge.label}</p>
                  <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: "rgba(255,255,255,0.46)" }}>
                    {badge.status}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section
        className="rounded-2xl border overflow-hidden"
        style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(9,14,26,0.96)" }}
      >
        <h2 className="px-4 py-3 border-b text-[22px] font-black text-white" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          Configurações
        </h2>
        {settingsItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="w-full px-4 py-3 border-b last:border-b-0 flex items-center justify-between text-left"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl border flex items-center justify-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
                  <Icon className="w-5 h-5" style={{ color: "rgba(255,255,255,0.56)" }} />
                </span>
                <span>
                  <p className="text-[15px] font-bold text-white">{item.title}</p>
                  <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {item.subtitle}
                  </p>
                </span>
              </div>
              <ChevronRight className="w-4 h-4" style={{ color: "rgba(255,255,255,0.35)" }} />
            </Link>
          );
        })}
      </section>

      <button
        type="button"
        className="w-full rounded-2xl border h-14 text-lg font-black inline-flex items-center justify-center gap-2 mb-3"
        style={{
          borderColor: "rgba(239,68,68,0.35)",
          color: "#F87171",
          background: "linear-gradient(180deg, rgba(127,29,29,0.22) 0%, rgba(69,10,10,0.38) 100%)",
        }}
      >
        <LogOut className="w-5 h-5" />
        Sair da conta
      </button>
    </div>
  );
}

