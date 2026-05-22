import type { ReactNode } from "react";

export function AdminInfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
      <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{label}</p>
      <div className="mt-3 text-[14px] font-bold text-white/82">{value}</div>
    </article>
  );
}
