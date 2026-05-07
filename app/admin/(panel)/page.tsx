import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminDashboardStats } from "@/lib/admin/users";
import Link from "next/link";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatCompactBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

function formatStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Pago";
  if (["pending_payment", "pending", "creating", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["failed", "canceled", "cancelled", "refused", "expired"].includes(normalized)) return "Falhou";
  return status || "Nao informado";
}

function statusClassName(status: string) {
  const label = formatStatus(status);
  if (label === "Pago") return "border-primary/20 bg-primary/10 text-primary";
  if (label === "Pendente") return "border-orange-400/25 bg-orange-400/10 text-orange-200";
  if (label === "Falhou") return "border-red-400/25 bg-red-400/10 text-red-200";
  return "border-white/10 bg-white/5 text-white/55";
}

function AreaChart({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points: Array<{ label: string; value: number }>;
}) {
  const width = 640;
  const height = 240;
  const paddingX = 24;
  const paddingTop = 22;
  const paddingBottom = 42;
  const max = Math.max(1, ...points.map((point) => point.value));
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;
  const coords = points.map((point, index) => {
    const x = paddingX + (points.length <= 1 ? 0 : (index / (points.length - 1)) * usableWidth);
    const y = paddingTop + usableHeight - (point.value / max) * usableHeight;
    return { ...point, x, y };
  });
  const line = coords.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingBottom} ${line} ${width - paddingX},${height - paddingBottom}`;

  return (
    <section className="rounded-[22px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">{subtitle}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
          14 dias
        </span>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-white/6 bg-black/30">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
          <defs>
            <linearGradient id="adminChartFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#B1EB0B" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#B1EB0B" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((lineIndex) => {
            const y = paddingTop + (lineIndex / 3) * usableHeight;
            return <line key={lineIndex} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />;
          })}
          <polygon points={area} fill="url(#adminChartFill)" />
          <polyline points={line} fill="none" stroke="#B1EB0B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point) => (
            <g key={`${point.label}-${point.x}`}>
              <circle cx={point.x} cy={point.y} r="5" fill="#B1EB0B" stroke="#081000" strokeWidth="3" />
              <text x={point.x} y={height - 18} textAnchor="middle" fill="rgba(255,255,255,0.36)" fontSize="12" fontWeight="700">
                {point.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}

function HorizontalBars({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <section className="rounded-[22px] border border-white/8 bg-[#101010] p-5">
      <h2 className="text-[15px] font-black text-white">{title}</h2>
      <p className="mt-1 text-[12px] font-medium text-white/38">{subtitle}</p>
      <div className="mt-5 grid gap-4">
        {items.length ? items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[12px] font-black uppercase tracking-[0.12em] text-white/58">{item.label}</span>
              <span className="text-[12px] font-black text-primary">{item.value.toLocaleString("pt-BR")}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(177,235,11,0.28)]"
                style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }}
              />
            </div>
          </div>
        )) : (
          <p className="rounded-[14px] border border-white/8 bg-white/3 p-4 text-[13px] font-semibold text-white/42">Sem dados ainda.</p>
        )}
      </div>
    </section>
  );
}

export default async function AdminDashboardPage() {
  const stats = await getAdminDashboardStats();
  const cards = [
    { label: "Usuários", value: stats.usersCount.toLocaleString("pt-BR"), hint: `+${stats.usersTodayCount} hoje` },
    { label: "Receita confirmada", value: formatBRL(stats.revenueCents), hint: `${stats.paidTransactionsCount} transações pagas` },
    { label: "Cotas pagas", value: stats.paidTicketsCount.toLocaleString("pt-BR"), hint: `${stats.ticketsCount} cotas totais` },
    { label: "Conversão PIX", value: `${stats.conversionRate}%`, hint: `${stats.pendingTransactionsCount} pendentes` },
  ];
  const revenuePoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.revenueCents }));
  const transactionPoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.paidTransactionsCount }));
  const ticketTypeItems = stats.ticketTypeBreakdown.map((item) => ({
    label: formatAdminTicketType(item.label),
    value: item.value,
  }));
  const statusItems = stats.transactionStatusBreakdown.map((item) => ({
    label: formatStatus(item.label),
    value: item.value,
  }));

  return (
    <>
      <AdminPageTitle title="Dashboard" subtitle="Visão geral segura da operação do Bolão do Milhão." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="rounded-[18px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">{card.label}</p>
            <p className="mt-4 text-[30px] font-black leading-none tracking-[-0.05em] text-primary">{card.value}</p>
            <p className="mt-3 text-[12px] font-bold text-white/35">{card.hint}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
        <AreaChart title="Receita confirmada" subtitle="Volume pago por dia, sem sair da identidade verde." points={revenuePoints} />
        <HorizontalBars title="Status das transações" subtitle="Distribuição operacional dos pagamentos." items={statusItems} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AreaChart title="Pagamentos aprovados" subtitle="Quantidade de transações pagas por dia." points={transactionPoints} />
        <HorizontalBars title="Cotas por tipo" subtitle="Principal e diário na base atual." items={ticketTypeItems} />
      </div>
      <section className="mt-5 overflow-hidden rounded-[22px] border border-white/8 bg-[#101010]">
        <div className="border-b border-white/8 px-5 py-4">
          <h2 className="text-[15px] font-black text-white">Últimas transações</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">
            Acompanhamento rápido dos pagamentos mais recentes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[760px] w-full text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                <th className="px-4 py-4">Usuário</th>
                <th className="px-4 py-4">Status</th>
                <th className="px-4 py-4">Valor</th>
                <th className="px-4 py-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {stats.recentTransactions.map((transaction) => (
                <tr key={transaction.id} className="text-[13px] text-white/72">
                  <td className="px-4 py-4">
                    <p className="font-black text-white">{transaction.userName ?? "Sem nome"}</p>
                    <p className="mt-1 text-white/35">{transaction.userEmail}</p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${statusClassName(transaction.status)}`}>
                      {formatStatus(transaction.status)}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-black text-primary">{formatCompactBRL(transaction.amountCents)}</td>
                  <td className="px-4 py-4 text-white/45">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(transaction.createdAt))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-white/8 px-5 py-4">
          <Link href="/admin/transactions" className="text-[12px] font-black uppercase tracking-[0.14em] text-primary">
            Ver todas as transações
          </Link>
        </div>
      </section>
    </>
  );
}
