import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminDashboardStats } from "@/lib/admin/users";
import { AdminDateRangePicker } from "./AdminDateRangePicker";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatStatus(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "paid" || normalized === "approved") return "Pago";
  if (["pending_payment", "pending", "creating", "waiting_payment"].includes(normalized)) return "Pendente";
  if (["failed", "canceled", "cancelled", "refused", "expired"].includes(normalized)) return "Falhou";
  return status || "Nao informado";
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isInputDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function defaultDateRange() {
  const now = new Date();
  return {
    startDate: toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: toInputDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function AreaChart({
  title,
  subtitle,
  points,
  valueFormatter,
}: {
  title: string;
  subtitle: string;
  points: Array<{ label: string; value: number }>;
  valueFormatter?: (value: number) => string;
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
  const gradientId = `adminChartFill-${title.replace(/\W+/g, "-")}`;
  const formatValue = valueFormatter ?? ((value: number) => value.toLocaleString("pt-BR"));

  return (
    <section className="rounded-[22px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">{subtitle}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
          Período
        </span>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-white/6 bg-black/30">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] w-full">
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#B1EB0B" stopOpacity="0.38" />
              <stop offset="100%" stopColor="#B1EB0B" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((lineIndex) => {
            const y = paddingTop + (lineIndex / 3) * usableHeight;
            return <line key={lineIndex} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" />;
          })}
          <polygon points={area} fill={`url(#${gradientId})`} />
          <polyline points={line} fill="none" stroke="#B1EB0B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point) => (
            <g key={`${point.label}-${point.x}`} className="group">
              <line
                x1={point.x}
                x2={point.x}
                y1={paddingTop}
                y2={height - paddingBottom}
                stroke="rgba(177,235,11,0.28)"
                strokeDasharray="4 6"
                className="opacity-0 transition-opacity group-hover:opacity-100"
              />
              <circle cx={point.x} cy={point.y} r="10" fill="#B1EB0B" opacity="0" className="transition-opacity group-hover:opacity-20" />
              <circle cx={point.x} cy={point.y} r="5" fill="#B1EB0B" stroke="#081000" strokeWidth="3" />
              <circle cx={point.x} cy={point.y} r="18" fill="transparent" />
              <foreignObject
                x={Math.min(width - 150, Math.max(10, point.x - 70))}
                y={Math.max(8, point.y - 52)}
                width="140"
                height="42"
                className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100"
              >
                <div className="rounded-[10px] border border-primary/20 bg-[#080B0F] px-3 py-2 text-center shadow-[0_12px_30px_rgba(0,0,0,0.35)]">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/38">{point.label}</p>
                  <p className="mt-0.5 text-[12px] font-black text-primary">{formatValue(point.value)}</p>
                </div>
              </foreignObject>
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
          <div key={item.label} className="group rounded-[14px] p-2 transition-colors hover:bg-white/3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[12px] font-black uppercase tracking-[0.12em] text-white/58 group-hover:text-white/82">{item.label}</span>
              <span className="rounded-full border border-primary/0 px-2 py-1 text-[12px] font-black text-primary transition-colors group-hover:border-primary/20 group-hover:bg-primary/10">
                {item.value.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/6">
              <div
                className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(177,235,11,0.28)] transition-all group-hover:shadow-[0_0_26px_rgba(177,235,11,0.48)]"
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

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  const fallback = defaultDateRange();
  const startDate = isInputDate(params?.start) ? params.start : fallback.startDate;
  const endDate = isInputDate(params?.end) && params.end >= startDate ? params.end : fallback.endDate;
  const stats = await getAdminDashboardStats({ startDate, endDate });
  const cards = [
    { label: "Usuários", value: stats.usersCount.toLocaleString("pt-BR"), hint: `${stats.usersTodayCount} no período` },
    { label: "Receita confirmada", value: formatBRL(stats.revenueCents), hint: `${stats.paidTransactionsCount} transações pagas` },
    { label: "Cotas pagas", value: stats.paidTicketsCount.toLocaleString("pt-BR"), hint: `${stats.ticketsCount} cotas totais` },
    { label: "Conversão PIX", value: `${stats.conversionRate}%`, hint: `${stats.pendingTransactionsCount} pendentes` },
  ];
  const revenuePoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.revenueCents }));
  const transactionPoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.paidTransactionsCount }));
  const singleDay = startDate === endDate;
  const periodSubtitle = singleDay ? "Agrupado em blocos de 4 horas." : "Agrupado por dia no período selecionado.";
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
      <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <AdminPageTitle title="Dashboard" subtitle="Visão geral segura da operação do Bolão do Milhão." />
        <AdminDateRangePicker startDate={startDate} endDate={endDate} />
      </div>
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
        <AreaChart title="Receita confirmada" subtitle={`Volume pago. ${periodSubtitle}`} points={revenuePoints} valueFormatter={formatBRL} />
        <HorizontalBars title="Status das transações" subtitle="Distribuição operacional dos pagamentos." items={statusItems} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AreaChart title="Pagamentos aprovados" subtitle={`Quantidade de transações pagas. ${periodSubtitle}`} points={transactionPoints} />
        <HorizontalBars title="Cotas por tipo" subtitle="Principal e diário na base atual." items={ticketTypeItems} />
      </div>
    </>
  );
}
