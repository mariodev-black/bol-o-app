"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

export type RecipientUser = {
  id: string;
  email: string;
  name: string | null;
};

const inputClass =
  "w-full rounded-[12px] border border-white/10 bg-black/40 px-4 py-3 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-primary/45";

type Props = {
  eligibleUsers: number;
  sendToAll: boolean;
  onSendToAllChange: (value: boolean) => void;
  selected: RecipientUser[];
  onSelectedChange: (users: RecipientUser[]) => void;
};

export function AdminNotificationRecipientPicker({
  eligibleUsers,
  sendToAll,
  onSendToAllChange,
  selected,
  onSelectedChange,
}: Props) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<RecipientUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const selectedIds = new Set(selected.map((u) => u.id));
  const query = search.trim();

  const fetchResults = useCallback(
    async (q: string, exclude: RecipientUser[]) => {
      if (q.length < 2) {
        setSearchResults([]);
        setSearchError(null);
        return;
      }
      setSearching(true);
      setSearchError(null);
      try {
        const excludeParam = exclude.map((u) => u.id).join(",");
        const params = new URLSearchParams({ q });
        if (excludeParam) params.set("exclude", excludeParam);
        const r = await fetch(`/api/admin/notifications/users?${params}`, {
          credentials: "include",
        });
        const d = (await r.json()) as { items?: RecipientUser[]; error?: string };
        if (!r.ok) throw new Error(d.error ?? "Busca falhou");
        setSearchResults(d.items ?? []);
      } catch (err) {
        setSearchResults([]);
        setSearchError(err instanceof Error ? err.message : "Busca falhou");
      } finally {
        setSearching(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (sendToAll) {
      setSearchResults([]);
      return;
    }
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      void fetchResults(query, selected);
    }, 280);
    return () => window.clearTimeout(t);
  }, [query, sendToAll, selected, fetchResults]);

  function addUser(user: RecipientUser) {
    if (selectedIds.has(user.id)) return;
    onSelectedChange([...selected, user]);
    inputRef.current?.focus();
    setPickerOpen(true);
  }

  function removeUser(id: string) {
    onSelectedChange(selected.filter((u) => u.id !== id));
    inputRef.current?.focus();
  }

  function clearSelection() {
    onSelectedChange([]);
    inputRef.current?.focus();
  }

  const showDropdown =
    !sendToAll && pickerOpen && query.length >= 2;

  const recipientLabel = sendToAll
    ? `Todos (${eligibleUsers.toLocaleString("pt-BR")} usuários com e-mail)`
    : selected.length === 0
      ? "Nenhum selecionado"
      : `${selected.length} selecionado(s)`;

  return (
    <div className="mt-6 border-t border-white/8 pt-6">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
        Destinatários
      </p>
      <p className="mt-1 text-[13px] font-bold text-primary">{recipientLabel}</p>

      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-[12px] border border-white/10 bg-black/30 p-4">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-[#B1EB0B]"
          checked={sendToAll}
          onChange={(e) => {
            onSendToAllChange(e.target.checked);
            if (e.target.checked) {
              setPickerOpen(false);
              setSearch("");
              setSearchResults([]);
            }
          }}
        />
        <span>
          <span className="block text-[14px] font-bold text-white">
            Enviar para todos os usuários
          </span>
          <span className="mt-1 block text-[12px] font-medium text-white/40">
            Contas com e-mail cadastrado ({eligibleUsers.toLocaleString("pt-BR")})
          </span>
        </span>
      </label>

      {!sendToAll ? (
        <div className="mt-4 space-y-3">
          <div className="relative">
            <label className="grid gap-2" htmlFor={`${listboxId}-input`}>
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                Adicionar usuários
              </span>
              <input
                ref={inputRef}
                id={`${listboxId}-input`}
                className={inputClass}
                value={search}
                role="combobox"
                aria-expanded={showDropdown}
                aria-controls={listboxId}
                aria-autocomplete="list"
                autoComplete="off"
                placeholder="Nome, e-mail ou CPF — Enter adiciona o primeiro resultado"
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPickerOpen(true);
                }}
                onFocus={() => setPickerOpen(true)}
                onBlur={() => {
                  window.setTimeout(() => setPickerOpen(false), 180);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setPickerOpen(false);
                    return;
                  }
                  if (e.key === "Enter" && searchResults[0]) {
                    e.preventDefault();
                    addUser(searchResults[0]);
                  }
                }}
              />
            </label>

            {showDropdown ? (
              <div
                className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[12px] border border-white/10 bg-[#0a0a0a] shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
              >
                {searching ? (
                  <p className="px-4 py-3 text-[12px] text-white/40">Buscando...</p>
                ) : searchError ? (
                  <p className="px-4 py-3 text-[12px] font-bold text-red-300">{searchError}</p>
                ) : searchResults.length > 0 ? (
                  <ul
                    id={listboxId}
                    role="listbox"
                    className="max-h-52 overflow-y-auto"
                  >
                    {searchResults.map((user) => (
                      <li key={user.id} role="option">
                        <button
                          type="button"
                          className="flex w-full flex-col items-start gap-0.5 border-b border-white/6 px-4 py-3 text-left transition-colors hover:bg-white/5 last:border-0"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => addUser(user)}
                        >
                          <span className="text-[13px] font-bold text-white">
                            {user.email}
                          </span>
                          {user.name ? (
                            <span className="text-[12px] text-white/45">{user.name}</span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-3 text-[12px] text-white/40">
                    Nenhum usuário encontrado. Tente outro termo.
                  </p>
                )}
              </div>
            ) : null}
          </div>

          <p className="text-[11px] font-medium text-white/35">
            Clique nos resultados ou pressione Enter para adicionar vários, um após o outro, sem
            perder a busca.
          </p>

          {selected.length > 0 ? (
            <div className="rounded-[12px] border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/50">
                  Selecionados ({selected.length})
                </span>
                <button
                  type="button"
                  className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45 hover:text-white"
                  onClick={clearSelection}
                >
                  Limpar todos
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selected.map((user) => (
                  <span
                    key={user.id}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary/35 bg-primary/10 py-1.5 pl-3 pr-2"
                  >
                    <span className="truncate text-[12px] font-bold text-white">
                      {user.name ? `${user.name} · ${user.email}` : user.email}
                    </span>
                    <button
                      type="button"
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[14px] leading-none text-white/80 hover:bg-white/20"
                      aria-label={`Remover ${user.email}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => removeUser(user.id)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-white/35">
              Busque e adicione um ou mais usuários antes de enviar.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
