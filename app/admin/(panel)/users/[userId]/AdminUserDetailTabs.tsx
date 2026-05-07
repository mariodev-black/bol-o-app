"use client";

import { formatAdminTicketType } from "@/lib/admin/format";
import type { AdminUserDetail, AdminUserListItem } from "@/lib/admin/users";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AdminUserPasswordForm } from "./AdminUserPasswordForm";

type Tab = "cadastro" | "cotas" | "afiliados" | "seguranca";
type Role = AdminUserListItem["role"];
const PAGE_SIZE = 50;

const ROLE_LABELS: Record<Role, string> = {
  user: "Usuário",
  admin: "Admin",
  super_admin: "Super admin",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(value: string | null) {
  if (!value) return "Nao informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function maskCpf(value: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return value ?? "Nao informado";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function InfoCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">{label}</p>
      <div className="mt-3 text-[14px] font-bold text-white/82">{value}</div>
    </article>
  );
}

function PermissionCard({
  role,
  canManageRole,
  onClick,
}: {
  role: Role;
  canManageRole: boolean;
  onClick: () => void;
}) {
  if (!canManageRole) {
    return (
      <InfoCard label="Permissão atual" value={<span className="uppercase text-primary">{ROLE_LABELS[role]}</span>} />
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[16px] border border-primary/20 bg-[#101010] p-4 text-left transition-colors hover:bg-primary/[0.035]"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/35">Permissão atual</p>
      <div className="mt-3 text-[14px] font-bold text-primary">{ROLE_LABELS[role]}</div>
      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.12em] text-white/28">
        Clique para alterar
      </p>
    </button>
  );
}

export function AdminUserDetailTabs({
  user,
  canManageRole,
}: {
  user: AdminUserDetail;
  canManageRole: boolean;
}) {
  const [tab, setTab] = useState<Tab>("cadastro");
  const [currentRole, setCurrentRole] = useState<Role>(user.role);
  const [selectedRole, setSelectedRole] = useState<Role>(user.role);
  const [confirmRoleOpen, setConfirmRoleOpen] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [roleMessage, setRoleMessage] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const referredUsers = user.referredUsers ?? [];
  const [visible, setVisible] = useState({
    cotas: PAGE_SIZE,
    afiliados: PAGE_SIZE,
  });
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const visibleTickets = useMemo(() => user.tickets.slice(0, visible.cotas), [user.tickets, visible.cotas]);
  const visibleReferredUsers = useMemo(() => referredUsers.slice(0, visible.afiliados), [referredUsers, visible.afiliados]);
  const paginatedTab = tab === "cotas" || tab === "afiliados" ? tab : null;
  const totalByTab = {
    cotas: user.tickets.length,
    afiliados: referredUsers.length,
  };
  const hasMore = paginatedTab ? visible[paginatedTab] < totalByTab[paginatedTab] : false;

  const tabs = [
    { id: "cadastro" as const, label: "Cadastro" },
    { id: "cotas" as const, label: "Cotas" },
    { id: "afiliados" as const, label: "Afiliados" },
    { id: "seguranca" as const, label: "Segurança" },
  ];

  async function confirmRoleChange() {
    setSavingRole(true);
    setRoleError(null);
    setRoleMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: selectedRole }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string; role?: Role } | null;
      if (!response.ok) throw new Error(data?.error ?? "Nao foi possivel alterar o role.");
      setCurrentRole(data?.role ?? selectedRole);
      setConfirmRoleOpen(false);
      setRoleMessage("Role alterado com sucesso.");
    } catch (error) {
      setRoleError(error instanceof Error ? error.message : "Nao foi possivel alterar o role.");
    } finally {
      setSavingRole(false);
    }
  }

  function openRoleDialog() {
    setSelectedRole(currentRole);
    setRoleError(null);
    setRoleMessage(null);
    setConfirmRoleOpen(true);
  }

  useEffect(() => {
    if (!paginatedTab) return;
    const node = loadMoreRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisible((current) => ({
          ...current,
          [paginatedTab]: Math.min(current[paginatedTab] + PAGE_SIZE, totalByTab[paginatedTab]),
        }));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, paginatedTab, totalByTab.afiliados, totalByTab.cotas, visible.afiliados, visible.cotas]);

  return (
    <section className="rounded-[18px] border border-white/8 bg-[#080808]">
      <div className="flex flex-wrap gap-2 border-b border-white/8 p-3">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={[
              "h-10 rounded-full px-4 text-[12px] font-black uppercase tracking-[0.12em] transition-colors",
              tab === item.id
                ? "bg-primary text-black"
                : "border border-white/10 bg-white/5 text-white/48 hover:text-white",
            ].join(" ")}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "cadastro" ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoCard label="ID" value={<span className="font-mono text-[11px]">{user.id}</span>} />
            <InfoCard label="Nome" value={user.name ?? "Sem nome"} />
            <InfoCard label="E-mail" value={user.email} />
            <InfoCard label="Telefone" value={user.phone ?? "Nao informado"} />
            <InfoCard label="CPF" value={maskCpf(user.cpf)} />
            <InfoCard label="Criado em" value={formatDate(user.createdAt)} />
            <InfoCard label="E-mail verificado" value={formatDate(user.emailVerifiedAt)} />
            <InfoCard label="Role" value={<span className="uppercase text-primary">{ROLE_LABELS[currentRole]}</span>} />
          </div>
        ) : null}

        {tab === "afiliados" ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <InfoCard label="Código afiliado" value={user.referralCode ?? "Nao informado"} />
              <InfoCard label="Indicado por" value={<span className="font-mono text-[11px]">{user.referredByUserId ?? "Nao informado"}</span>} />
              <InfoCard label="Usuários indicados" value={user.referredUsersCount.toLocaleString("pt-BR")} />
              <InfoCard label="Comissões geradas" value={formatBRL(user.commissionsCents)} />
              <InfoCard label="Transações pagas" value={`${user.paidTransactionsCount}/${user.transactionsCount}`} />
            </div>

            <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
              <div className="border-b border-white/8 px-5 py-4">
                <h2 className="text-[15px] font-black text-white">Usuários que entraram pelo link</h2>
                <p className="mt-1 text-[12px] font-medium text-white/38">
                  Lista de usuários vinculados ao código de indicação deste usuário.
                </p>
              </div>
              {referredUsers.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-[860px] w-full text-left">
                    <thead className="border-b border-white/8 bg-white/2.5">
                      <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                        <th className="px-4 py-4">Usuário</th>
                        <th className="px-4 py-4">CPF</th>
                        <th className="px-4 py-4">Cotas</th>
                        <th className="px-4 py-4">Entrou em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/6">
                      {visibleReferredUsers.map((referred) => (
                        <tr key={referred.id} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                          <td className="px-4 py-4">
                            <Link href={`/admin/users/${referred.id}`} className="block">
                              <p className="font-black text-white group-hover:text-primary">{referred.name ?? "Sem nome"}</p>
                              <p className="mt-1 text-white/35">{referred.email}</p>
                            </Link>
                          </td>
                          <td className="px-4 py-4 font-mono text-white/45">{maskCpf(referred.cpf)}</td>
                          <td className="px-4 py-4">
                            <p className="font-black text-white">{referred.ticketsCount.toLocaleString("pt-BR")}</p>
                            <p className="mt-1 text-[11px] font-bold text-white/35">
                              {referred.paidTicketsCount.toLocaleString("pt-BR")} pagas
                            </p>
                          </td>
                          <td className="px-4 py-4 text-white/45">{formatDate(referred.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ScrollFooter
                    refEl={loadMoreRef}
                    hasMore={hasMore}
                    visible={visibleReferredUsers.length}
                    total={referredUsers.length}
                    label="usuários indicados"
                  />
                </div>
              ) : (
                <div className="px-5 py-12 text-center">
                  <p className="text-[15px] font-black text-white">Nenhum usuário indicado ainda</p>
                  <p className="mt-2 text-[13px] text-white/38">Quando alguém entrar pelo link deste usuário, aparece aqui.</p>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {tab === "seguranca" ? (
          <div className="grid gap-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoCard
                label="2FA admin"
                value={
                  <span className={user.twoFactorEnabled ? "text-primary" : "text-red-300"}>
                    {user.twoFactorEnabled ? "Ativo" : "Inativo"}
                  </span>
                }
              />
              <PermissionCard
                role={currentRole}
                canManageRole={canManageRole}
                onClick={openRoleDialog}
              />
            </div>
            {roleError ? <p className="text-[12px] font-bold text-red-300">{roleError}</p> : null}
            {roleMessage ? <p className="text-[12px] font-bold text-primary">{roleMessage}</p> : null}

            <AdminUserPasswordForm userId={user.id} />
          </div>
        ) : null}

        {tab === "cotas" ? (
          <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
            <div className="border-b border-white/8 px-5 py-4">
              <h2 className="text-[15px] font-black text-white">Cotas do usuário</h2>
              <p className="mt-1 text-[12px] font-medium text-white/38">Clique em uma cota para abrir os detalhes dela.</p>
            </div>
            {user.tickets.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[840px] w-full text-left">
                  <thead className="border-b border-white/8 bg-white/2.5">
                    <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/35">
                      <th className="px-4 py-4">Cota</th>
                      <th className="px-4 py-4">Tipo</th>
                      <th className="px-4 py-4">Status</th>
                      <th className="px-4 py-4">Valor</th>
                      <th className="px-4 py-4">Palpites</th>
                      <th className="px-4 py-4">Criada em</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/6">
                    {visibleTickets.map((ticket) => (
                      <tr key={ticket.id} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                        <td className="px-4 py-4">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block font-mono text-[11px] text-white/45 group-hover:text-primary">
                            {ticket.id}
                          </Link>
                        </td>
                        <td className="px-4 py-4 font-bold uppercase text-white/58">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block">{formatAdminTicketType(ticket.ticketType)}</Link>
                        </td>
                        <td className="px-4 py-4">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block">
                            <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
                              {ticket.status}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-4 font-black text-white">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block">{formatBRL(ticket.totalAmountCents)}</Link>
                        </td>
                        <td className="px-4 py-4 text-white/45">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block">{ticket.predictionsCount}</Link>
                        </td>
                        <td className="px-4 py-4 text-white/45">
                          <Link href={`/admin/cotas/${ticket.id}`} className="block">{formatDate(ticket.createdAt)}</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ScrollFooter
                  refEl={loadMoreRef}
                  hasMore={hasMore}
                  visible={visibleTickets.length}
                  total={user.tickets.length}
                  label="cotas"
                />
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <p className="text-[15px] font-black text-white">Nenhuma cota encontrada</p>
                <p className="mt-2 text-[13px] text-white/38">Quando o usuário comprar uma cota, ela aparece aqui.</p>
              </div>
            )}
          </section>
        ) : null}
      </div>

      {confirmRoleOpen ? (
        <div className="fixed inset-0 z-120 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[22px] border border-white/10 bg-[#080808] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary">Confirmar alteração</p>
            <h3 className="mt-3 text-[22px] font-black tracking-[-0.04em] text-white">
              Alterar role deste usuário?
            </h3>
            <p className="mt-3 text-[13px] font-medium leading-relaxed text-white/52">
              Você está alterando <strong className="text-white">{user.name ?? user.email}</strong> de{" "}
              <strong className="text-white">{ROLE_LABELS[currentRole]}</strong> para{" "}
              <strong className="text-white">{ROLE_LABELS[selectedRole]}</strong>. Essa ação só é permitida para super admin.
            </p>
            <label className="mt-5 block">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/35">
                Nova permissão
              </span>
              <select
                value={selectedRole}
                onChange={(event) => {
                  setSelectedRole(event.target.value as Role);
                  setRoleError(null);
                }}
                className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-bold text-white outline-none transition-colors focus:border-primary/45"
              >
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <option key={role} value={role} className="bg-[#101010] text-white">
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setConfirmRoleOpen(false)}
                disabled={savingRole}
                className="h-11 rounded-[12px] border border-white/10 bg-white/5 text-[12px] font-black uppercase tracking-[0.12em] text-white/70 hover:bg-white/8 disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmRoleChange}
                disabled={savingRole || selectedRole === currentRole}
                className="h-11 rounded-[12px] bg-primary text-[12px] font-black uppercase tracking-[0.12em] text-black disabled:opacity-60"
              >
                {savingRole ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ScrollFooter({
  refEl,
  hasMore,
  visible,
  total,
  label,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  hasMore: boolean;
  visible: number;
  total: number;
  label: string;
}) {
  if (total === 0) return null;
  return (
    <div ref={refEl} className="border-t border-white/8 px-5 py-5 text-center">
      <p className="text-[12px] font-bold text-white/38">
        {hasMore ? `Carregando mais ${label} de ${PAGE_SIZE} em ${PAGE_SIZE}...` : `Todos os registros foram exibidos. (${visible}/${total})`}
      </p>
    </div>
  );
}
