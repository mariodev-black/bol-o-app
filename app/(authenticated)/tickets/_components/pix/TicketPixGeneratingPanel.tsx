"use client";

import { Loader2 } from "lucide-react";
import { montserrat } from "./ticket-pix-ui-constants";

export function TicketPixGeneratingPanel() {
  return (
    <div className="mx-auto flex min-h-[min(70vh,560px)] w-full max-w-[430px] flex-col items-center justify-center px-4 py-10">
      <div
        className="relative w-full overflow-hidden rounded-2xl border-2 border-primary/40 px-6 py-14 text-center shadow-[0_0_48px_rgba(177,235,11,0.12)]"
        style={{
          background:
            "linear-gradient(165deg, rgba(177,235,11,0.08) 0%, #0d0d0d 45%, #080808 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-12deg, transparent, transparent 12px, rgba(177,235,11,0.9) 12px, rgba(177,235,11,0.9) 13px)",
          }}
        />
        <div className="relative flex flex-col items-center">
          <div className="relative mb-8">
            <div
              className="absolute inset-0 animate-ping rounded-full bg-primary/25"
              style={{ animationDuration: "2.2s" }}
            />
            <div
              className="relative flex size-24 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10"
              style={{ boxShadow: "0 0 40px rgba(177,235,11,0.25)" }}
            >
              <Loader2
                className="size-11 animate-spin text-primary"
                strokeWidth={2.2}
                aria-hidden
              />
            </div>
          </div>
          <p
            className="text-[15px] font-black uppercase tracking-[0.12em] text-white sm:text-base"
            style={{ fontFamily: montserrat }}
          >
            Gerando seu PIX…
          </p>
          <p
            className="mx-auto mt-3 max-w-[280px] text-[13px] leading-relaxed text-white/50"
            style={{ fontFamily: montserrat }}
          >
            Aguarde enquanto registramos seu pedido e emitimos o QR Code no gateway de pagamento.
          </p>
          <div className="mt-8 flex items-center justify-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-2 rounded-full bg-primary/90 animate-pulse"
                style={{ animationDelay: `${i * 160}ms`, animationDuration: "1s" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
