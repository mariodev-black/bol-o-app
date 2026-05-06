"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

interface StepsBreadcrumbProps {
  backHref: string;
  items: string[];
}

export function StepsBreadcrumb({ backHref, items }: StepsBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="rounded-xl px-2.5 py-2 mb-4"
      style={{ background: "#101010" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <Link
          href={backHref}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ background: "rgba(177,235,11,0.14)", border: "1px solid rgba(177,235,11,0.34)", color: "#E8FF8A" }}
          aria-label="Voltar"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        <div className="flex items-center gap-1 min-w-0 overflow-x-auto whitespace-nowrap">
          {items.map((item, idx) => (
            <div key={`${item}-${idx}`} className="inline-flex items-center gap-1 shrink-0">
              <span
                className={`text-[12px] font-semibold ${idx === items.length - 1 ? "" : ""}`}
                style={{ color: idx === items.length - 1 ? "#E8FF8A" : "rgba(255,255,255,0.7)" }}
              >
                {item}
              </span>
              {idx < items.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-white/40" />}
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}
