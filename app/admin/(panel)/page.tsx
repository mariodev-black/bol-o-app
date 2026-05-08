import { AdminPageTitle } from "@/app/admin/_components/AdminShell";
import { formatAdminTicketType } from "@/lib/admin/format";
import { getAdminDashboardStats } from "@/lib/admin/users";
import { AdminDateRangePicker } from "./AdminDateRangePicker";

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
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

function dateRangeDays(startDate: string, endDate: string) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const start = Date.UTC(startYear, startMonth - 1, startDay);
  const end = Date.UTC(endYear, endMonth - 1, endDay);
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
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
  const width = 1120;
  const height = 280;
  const paddingX = 28;
  const paddingTop = 24;
  const paddingBottom = 68;
  const axisLabelY = height - 28;
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
    <section className="rounded-[22px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] w-full">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-black text-white">{title}</h2>
          <p className="mt-1 text-[12px] font-medium text-white/38">{subtitle}</p>
        </div>
        <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
          Período
        </span>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-white/6 bg-black/30 pb-1">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
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
          {coords.map((point, index) => {
            const previousX = coords[index - 1]?.x ?? paddingX;
            const nextX = coords[index + 1]?.x ?? width - paddingX;
            const hitStart = index === 0 ? paddingX : (previousX + point.x) / 2;
            const hitEnd = index === coords.length - 1 ? width - paddingX : (point.x + nextX) / 2;
            const tooltipX = Math.min(width - 150, Math.max(10, point.x - 70));
            const tooltipY = Math.max(8, point.y - 58);
            const labelAnchor = index === 0 ? "start" : index === coords.length - 1 ? "end" : "middle";

            return (
            <g key={`${point.label}-${point.x}`} className="group">
              <rect
                x={hitStart}
                y={paddingTop}
                width={Math.max(28, hitEnd - hitStart)}
                height={usableHeight}
                fill="transparent"
              />
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
              <g className="pointer-events-none opacity-0 transition-opacity group-hover:opacity-100">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width="140"
                  height="48"
                  rx="12"
                  fill="#080B0F"
                  stroke="rgba(177,235,11,0.28)"
                />
                <text x={tooltipX + 70} y={tooltipY + 18} textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="10" fontWeight="800">
                  {point.label}
                </text>
                <text x={tooltipX + 70} y={tooltipY + 35} textAnchor="middle" fill="#B1EB0B" fontSize="13" fontWeight="900">
                  {formatValue(point.value)}
                </text>
              </g>
              <text x={point.x} y={axisLabelY} textAnchor={labelAnchor} fill="rgba(255,255,255,0.42)" fontSize="12" fontWeight="800">
                {point.label}
              </text>
            </g>
            );
          })}
        </svg>
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
  const revenuePoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.revenueCents }));
  const transactionPoints = stats.dailySeries.map((point) => ({ label: point.label, value: point.paidTransactionsCount }));
  const singleDay = startDate === endDate;
  const longRange = dateRangeDays(startDate, endDate) > 14;
  const periodSubtitle = singleDay
    ? "Agrupado em blocos de 4 horas."
    : longRange
      ? "Agrupado em blocos de 4 dias."
      : "Agrupado por dia no período selecionado.";
  const ticketTypeItems = stats.ticketTypeBreakdown.map((item) => ({
    label: formatAdminTicketType(item.label),
    value: item.value,
  }));
  const maxTicketType = Math.max(1, ...ticketTypeItems.map((item) => item.value));
  const cards = [
    { label: "Receita confirmada", value: formatBRL(stats.revenueCents), hint: `${stats.paidTransactionsCount} transações pagas` },
    { label: "Cotas pagas", value: stats.paidTicketsCount.toLocaleString("pt-BR"), hint: `${stats.ticketsCount} cotas totais` },
    { label: "Conversão PIX", value: `${stats.conversionRate}%`, hint: `${stats.pendingTransactionsCount} pendentes` },
  ];
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
        <article className="rounded-[18px] border border-white/8 bg-[#101010] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-white/35">Cotas por tipo</p>
          <div className="mt-4 grid gap-3">
            {ticketTypeItems.length ? ticketTypeItems.map((item) => (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.12em] text-white/50">{item.label}</span>
                  <span className="text-[12px] font-black text-primary">{item.value.toLocaleString("pt-BR")}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/7">
                  <div
                    className="h-full rounded-full bg-primary shadow-[0_0_18px_rgba(177,235,11,0.28)]"
                    style={{ width: `${Math.max(4, (item.value / maxTicketType) * 100)}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-[12px] font-bold text-white/35">Sem cotas no período.</p>
            )}
          </div>
        </article>
      </div>
      <div className="mt-5 w-full">
        <AreaChart title="Receita confirmada" subtitle={`Volume pago. ${periodSubtitle}`} points={revenuePoints} valueFormatter={formatBRL} />
      </div>
      <div className="mt-5 w-full">
        <AreaChart title="Pagamentos aprovados" subtitle={`Quantidade de transações pagas. ${periodSubtitle}`} points={transactionPoints} />
      </div>
    </>
  );
}
