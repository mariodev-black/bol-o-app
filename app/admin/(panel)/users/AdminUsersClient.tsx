"use client";

import { adminStatGridClass, adminStatValueClass } from "@/app/admin/_components/admin-layout";
import { AdminTableScroll } from "@/app/admin/_components/AdminTableScroll";
import type { AdminUserListItem } from "@/lib/admin/users";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type SortOption = "recent" | "oldest" | "most_tickets" | "least_tickets" | "most_points";
const PAGE_SIZE = 50;

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  most_tickets: "Mais cotas",
  least_tickets: "Menos cotas",
  most_points: "Mais pontos",
};

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatCpfInput(value: string) {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function maskCpf(cpf: string | null) {
  const digits = onlyDigits(cpf ?? "");
  if (digits.length !== 11) return cpf || "-";
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function roleLabel(role: AdminUserListItem["role"]) {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  return "Usuário";
}

export function AdminUsersClient({ users }: { users: AdminUserListItem[] }) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const filteredUsers = useMemo(() => {
    const digitsQuery = onlyDigits(query);
    const textQuery = normalize(query);
    const result = users.filter((user) => {
      if (!textQuery && !digitsQuery) return true;
      const cpfDigits = onlyDigits(user.cpf ?? "");
      const haystack = [
        normalize(user.name),
        normalize(user.email),
        normalize(user.cpf),
        cpfDigits,
      ].join(" ");
      if (digitsQuery.length >= 2) return cpfDigits.includes(digitsQuery) || haystack.includes(textQuery);
      return haystack.includes(textQuery);
    });

    return [...result].sort((a, b) => {
      if (sortBy === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      if (sortBy === "most_tickets") return b.ticketsCount - a.ticketsCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "least_tickets") return a.ticketsCount - b.ticketsCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === "most_points") return b.scorePoints - a.scorePoints || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [query, sortBy, users]);

  const stats = useMemo(() => {
    return {
      totalUsers: users.length,
      filteredUsers: filteredUsers.length,
      totalTickets: users.reduce((acc, user) => acc + user.ticketsCount, 0),
      paidTickets: users.reduce((acc, user) => acc + user.paidTicketsCount, 0),
      scorePoints: users.reduce((acc, user) => acc + user.scorePoints, 0),
    };
  }, [filteredUsers.length, users]);

  const visibleUsers = useMemo(
    () => filteredUsers.slice(0, visibleCount),
    [filteredUsers, visibleCount]
  );
  const hasMoreUsers = visibleCount < filteredUsers.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, sortBy]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasMoreUsers) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredUsers.length));
      },
      { rootMargin: "240px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredUsers.length, hasMoreUsers, visibleCount]);

  return (
    <>
      <div className={adminStatGridClass}>
        {[
          { label: "Usuários", value: stats.totalUsers.toLocaleString("pt-BR") },
          { label: "Cotas totais", value: stats.totalTickets.toLocaleString("pt-BR") },
          { label: "Cotas pagas", value: stats.paidTickets.toLocaleString("pt-BR") },
          { label: "Pontos totais", value: stats.scorePoints.toLocaleString("pt-BR") },
        ].map((card) => (
          <article key={card.label} className="rounded-[16px] border border-white/8 bg-[#101010] p-4">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/80">{card.label}</p>
            <p className={adminStatValueClass}>{card.value}</p>
          </article>
        ))}
      </div>

      <section className="mb-5 rounded-[18px] border border-white/8 bg-[#101010] p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
          <label className="block">
            <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
              Buscar por nome, e-mail ou CPF
            </span>
            <input
              value={query}
              onChange={(event) => {
                const value = event.target.value;
                setQuery(/^[\d.\-\s]+$/.test(value) ? formatCpfInput(value) : value);
              }}
              inputMode="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              placeholder="Digite nome, email ou CPF"
              className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-semibold text-white outline-none transition-colors placeholder:text-white/25 focus:border-primary/45"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-[12px] font-black uppercase tracking-[0.18em] text-white/80">
              Ordenar por
            </span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
              className="h-12 w-full rounded-[12px] border border-white/10 bg-black/40 px-4 text-[14px] font-bold text-white outline-none transition-colors focus:border-primary/45"
            >
              {Object.entries(SORT_LABELS).map(([value, label]) => (
                <option key={value} value={value} className="bg-[#101010] text-white">
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[18px] border border-white/8 bg-[#101010]">
        <AdminTableScroll>
          <table className="min-w-[1120px] w-full text-left">
            <thead className="border-b border-white/8 bg-white/2.5">
              <tr className="text-[11px] font-black uppercase tracking-[0.16em] text-white/80">
                <th className="px-4 py-4">Usuário</th>
                <th className="px-4 py-4">Contato</th>
                <th className="px-4 py-4">CPF</th>
                <th className="px-4 py-4">Role</th>
                <th className="px-4 py-4">Nº de cotas</th>
                <th className="px-4 py-4">Pontos</th>
                <th className="px-4 py-4">Criado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6">
              {visibleUsers.map((user) => (
                <tr key={user.id} className="group text-[13px] text-white/72 transition-colors hover:bg-white/2.5">
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <p className="font-black text-white group-hover:text-primary">{user.name ?? "Sem nome"}</p>
                      <p className="mt-1 font-mono text-[11px] text-white/28">{user.id}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <p className="font-semibold">{user.email}</p>
                      <p className="mt-1 text-white/80">{user.phone ?? "-"}</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4 font-mono text-white/80">
                    <Link href={`/admin/users/${user.id}`} className="block">{maskCpf(user.cpf)}</Link>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black uppercase text-primary">
                        {roleLabel(user.role)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <p className="text-[18px] font-black leading-none text-white">{user.ticketsCount.toLocaleString("pt-BR")}</p>
                      <p className="mt-1 text-[14px] font-bold text-white/80">{user.paidTicketsCount.toLocaleString("pt-BR")} pagas</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      <p className="text-[18px] font-black leading-none text-primary">{user.scorePoints.toLocaleString("pt-BR")}</p>
                      <p className="mt-1 text-[14px] font-bold text-white/80">pontos nas cotas</p>
                    </Link>
                  </td>
                  <td className="px-4 py-4 text-white/80">
                    <Link href={`/admin/users/${user.id}`} className="block">
                      {new Intl.DateTimeFormat("pt-BR").format(new Date(user.createdAt))}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredUsers.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[15px] font-black text-white">Nenhum usuário encontrado</p>
              <p className="mt-2 text-[13px] text-white/38">Ajuste a busca ou altere a ordenação para ver outros resultados.</p>
            </div>
          ) : null}
          {filteredUsers.length > 0 ? (
            <div ref={loadMoreRef} className="border-t border-white/8 px-5 py-5 text-center">
              <p className="text-[12px] font-bold text-white/38">
                {hasMoreUsers
                  ? `Carregando mais usuários de ${PAGE_SIZE} em ${PAGE_SIZE}...`
                  : "Todos os usuários foram exibidos."}
              </p>
            </div>
          ) : null}
        </AdminTableScroll>
      </section>
    </>
  );
}
