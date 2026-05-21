"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import type { UserNotificationDto } from "@/lib/notifications/user-notifications";

type NotificationsResponse = {
  items: UserNotificationDto[];
  unreadCount: number;
  page: number;
  perPage: number;
  total: number;
  pageCount: number;
};

function formatNotificationDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function NotificationDetailModal({
  item,
  open,
  onOpenChange,
}: {
  item: UserNotificationDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open || !item || !portalReady) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[140] flex items-end justify-center p-0 sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/82 backdrop-blur-[6px]"
        aria-label="Fechar notificação"
        onClick={() => onOpenChange(false)}
      />

      <div
        className="relative z-[1] flex max-h-[min(88dvh,640px)] w-full max-w-[440px] flex-col overflow-y-auto rounded-t-[18px] border border-primary/25 p-6 shadow-[0_24px_64px_rgba(0,0,0,0.65)] sm:rounded-[18px]"
        style={{
          background: "linear-gradient(165deg, #101412 0%, #050605 100%)",
        }}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/8 hover:text-white"
          aria-label="Fechar"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>

        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-primary">
          Notificação
        </p>
        <h3
          id="notification-detail-title"
          className="mt-2 pr-10 text-left text-[20px] font-black leading-snug text-white"
        >
          {item.title}
        </h3>
        <p className="mt-1 text-[12px] text-white/45">
          {formatNotificationDate(item.createdAt)}
        </p>
        <div className="mt-5 whitespace-pre-line text-[14px] leading-relaxed text-white/88">
          {item.body}
        </div>
        {item.kind === "bolao_promo" ? (
          <Link
            href="/boloes"
            onClick={() => onOpenChange(false)}
            className="mt-6 flex h-11 w-full shrink-0 items-center justify-center rounded-[10px] bg-primary text-[13px] font-black uppercase tracking-wide text-black transition-opacity hover:opacity-90"
          >
            Garantir minha cota
          </Link>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

function NotificationsPanel({
  loading,
  error,
  data,
  onClose,
  onSelect,
}: {
  loading: boolean;
  error: string | null;
  data: NotificationsResponse | null;
  onClose: () => void;
  onSelect: (item: UserNotificationDto) => void;
}) {
  return (
    <div
      className="notifications-panel-pop absolute right-0 top-[calc(100%+10px)] z-[80] w-[min(100vw-24px,360px)] overflow-hidden rounded-[14px] border border-primary/35 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.55)]"
      role="dialog"
      aria-label="Notificações"
    >
      <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
        <h2 className="text-[15px] font-black text-white">Notificações</h2>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 items-center justify-center rounded-lg text-white/50 transition-colors hover:bg-white/8 hover:text-white"
          aria-label="Fechar notificações"
        >
          <X className="size-4" strokeWidth={2.5} />
        </button>
      </div>

      <div className="max-h-[min(60vh,380px)] overflow-y-auto">
        {loading ? (
          <div className="space-y-0">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="animate-pulse border-b border-white/6 px-4 py-4"
              >
                <div className="h-3 w-[90%] rounded bg-white/10" />
                <div className="mt-2 h-2.5 w-1/3 rounded bg-white/6" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="px-4 py-6 text-center text-[13px] text-white/55">{error}</p>
        ) : !data?.items.length ? (
          <p className="px-4 py-8 text-center text-[13px] text-white/45">
            Nenhuma notificação por enquanto.
          </p>
        ) : (
          <ul>
            {data.items.map((item) => (
              <li key={item.id} className="border-b border-white/6 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`w-full px-4 py-3.5 text-left transition-colors hover:bg-white/[0.04] ${item.unread ? "bg-primary/[0.04]" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    {item.unread ? (
                      <span
                        className="mt-1.5 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(177,235,11,0.5)]"
                        aria-hidden
                      />
                    ) : (
                      <span className="mt-1.5 size-2 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-white">
                        {item.preview}
                      </p>
                      <p className="mt-1 text-[11px] text-white/40">
                        {formatNotificationDate(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data && data.total > 0 ? (
        <p className="border-t border-white/6 px-4 py-2.5 text-center text-[11px] text-white/38">
          Pág. {data.page}/{data.pageCount} · Total: {data.total}
        </p>
      ) : null}
    </div>
  );
}

export function NotificationsBell({ variant }: { variant: "mobile" | "desktop" }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [detailItem, setDetailItem] = useState<UserNotificationDto | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const fetchGenRef = useRef(0);

  const fetchNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    const gen = ++fetchGenRef.current;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch("/api/notifications?perPage=10", {
        credentials: "include",
        cache: "no-store",
      });
      const json = (await r.json().catch(() => ({}))) as NotificationsResponse & {
        error?: string;
      };
      if (gen !== fetchGenRef.current) return;
      if (!r.ok) {
        throw new Error(json.error ?? "Falha ao carregar");
      }
      setData(json);
      setUnreadCount(json.unreadCount ?? 0);
    } catch (e) {
      if (gen !== fetchGenRef.current) return;
      if (!opts?.silent) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
        setData(null);
      }
    } finally {
      if (gen === fetchGenRef.current && !opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const id = window.setInterval(() => void fetchNotifications({ silent: true }), 60_000);
    return () => window.clearInterval(id);
  }, [fetchNotifications]);

  useEffect(() => {
    if (open) void fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleSelect = async (item: UserNotificationDto) => {
    setOpen(false);
    let next = item;
    if (item.unread) {
      try {
        const r = await fetch(`/api/notifications/${item.id}/read`, {
          method: "PATCH",
          credentials: "include",
        });
        const json = (await r.json().catch(() => ({}))) as { item?: UserNotificationDto };
        if (r.ok && json.item) {
          next = json.item;
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  unreadCount: Math.max(0, prev.unreadCount - 1),
                  items: prev.items.map((n) =>
                    n.id === item.id ? { ...n, ...json.item, unread: false } : n,
                  ),
                }
              : prev,
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      } catch {
        /* abre o modal mesmo se falhar marcar lida */
      }
    }
    setDetailItem(next);
    setDetailOpen(true);
  };

  const showDot = unreadCount > 0;

  const panel =
    open ? (
      <NotificationsPanel
        loading={loading}
        error={error}
        data={data}
        onClose={() => setOpen(false)}
        onSelect={(item) => void handleSelect(item)}
      />
    ) : null;

  const detailModal = (
    <NotificationDetailModal
      item={detailItem}
      open={detailOpen}
      onOpenChange={setDetailOpen}
    />
  );

  if (variant === "desktop") {
    return (
      <div ref={rootRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative flex h-[36px] w-[36px] items-center justify-center rounded-[9px] transition-[border-color,box-shadow]"
          style={{
            background: open ? "rgba(177,235,11,0.08)" : "#151515",
            border: open
              ? "1px solid rgba(177,235,11,0.45)"
              : "1px solid rgba(255,255,255,0.08)",
            boxShadow: open ? "0 0 18px rgba(177,235,11,0.12)" : "none",
          }}
          aria-label="Notificações"
          aria-expanded={open}
        >
          <Bell
            className={`h-[16px] w-[16px] ${open ? "text-primary" : "text-white/70"}`}
            strokeWidth={2}
          />
          {showDot ? (
            <span
              className="absolute right-[7px] top-[7px] size-[6px] rounded-full bg-primary shadow-[0_0_8px_rgba(177,235,11,0.55)]"
              aria-hidden
            />
          ) : null}
        </button>

        {panel}
        {detailModal}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-10 w-10 items-center justify-end rounded-xl"
        aria-label="Notificações"
        aria-expanded={open}
      >
        <Bell
          className={`h-6 w-6 ${open ? "text-primary" : "text-white"}`}
          strokeWidth={2}
        />
        {showDot ? (
          <span
            aria-hidden
            className="absolute right-0 top-1.5 size-2 rounded-full bg-primary shadow-[0_0_0_3px_rgba(177,235,11,0.12)]"
          />
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[75] bg-black/40 md:hidden"
            aria-label="Fechar notificações"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-3 top-[92px] z-[80] sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+10px)]">
            {panel}
          </div>
        </>
      ) : null}

      {detailModal}
    </div>
  );
}
