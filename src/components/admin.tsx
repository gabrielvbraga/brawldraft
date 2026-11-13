"use client";
// PAINEL DO ADMINISTRADOR: corrige counters, sinergias e dicas de mapa sem mexer no
// código, e mostra as visitas. Só aparece para contas na tabela "admins" do Supabase,
// e o banco também só deixa administrador gravar (a regra fica no supabase.sql).

import { useEffect, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { setOverrides, type Overrides } from "@/lib/engine";
import { mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import { freshSession, loadOverrides, loadVisits, saveOverrides, type Session } from "@/lib/supabase";
import { CARD, H1, H2, INPUT, Pill, PrimaryButton, SUB, SmallButton, choice } from "./ui";

const NAMES = BRAWLERS.map((b) => b.name);

export function AdminScreen(props: { t: Dict; lang: Lang; session: Session | null; isAdmin: boolean; isMod: boolean; onOpenProfile: (tag: string) => void }) {
  const { t, lang } = props;
  const [data, setData] = useState<Overrides>({ counters: [], synergies: [], tips: {} });
  const [tab, setTab] = useState<"accounts" | "counters" | "synergies" | "tips" | "visits">(props.isAdmin ? "counters" : "accounts");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [visits, setVisits] = useState<{ screen: string; day: string }[] | null>(null);
  // Linha nova sendo preenchida.
  const [a, setA] = useState(NAMES[0]);
  const [b, setB] = useState(NAMES[1]);
  const [value, setValue] = useState(2);

  useEffect(() => {
    loadOverrides().then((o) => o && setData({ counters: o.counters ?? [], synergies: o.synergies ?? [], tips: o.tips ?? {} }));
  }, []);
  useEffect(() => {
    if (tab === "visits" && props.session && visits === null) loadVisits(props.session).then((v) => setVisits(v ?? []));
  }, [tab, props.session, visits]);

  if (!props.session || (!props.isAdmin && !props.isMod)) return <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.adminDenied}</p>;

  async function saveAll() {
    if (!props.session) return;
    const ok = await saveOverrides(props.session, data);
    if (ok) setOverrides(data); // já vale neste aparelho, sem recarregar
    setMessage({ ok, text: ok ? t.savedOk : t.saveErr });
  }

  function addRow() {
    if (a === b) return;
    if (tab === "counters") setData({ ...data, counters: [...data.counters.filter((c) => !(c.strong === a && c.weak === b)), { strong: a, weak: b, value }] });
    if (tab === "synergies") setData({ ...data, synergies: [...data.synergies.filter((s) => !(s.a === a && s.b === b)), { a, b, value }] });
  }

  const select = (v: string, set: (x: string) => void) => (
    <select value={v} onChange={(e) => set(e.target.value)} className={`${INPUT} w-44`}>
      {NAMES.map((n) => (
        <option key={n}>{n}</option>
      ))}
    </select>
  );

  // Visitas agrupadas por dia e por tela.
  const count = (key: (v: { screen: string; day: string }) => string) => {
    const m = new Map<string, number>();
    for (const v of visits ?? []) m.set(key(v), (m.get(key(v)) ?? 0) + 1);
    return [...m.entries()];
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className={H1}>{props.isAdmin ? t.adminTitle : t.modPanel}</h1>
      <div className="flex flex-wrap gap-2">
        {(props.isAdmin ? (["accounts", "counters", "synergies", "tips", "visits"] as const) : (["accounts"] as const)).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={choice(tab === k)}>
            {k === "accounts" ? t.accTab : k === "counters" ? t.adminCounters : k === "synergies" ? t.adminSynergies : k === "tips" ? t.adminTips : t.visitsTitle}
          </button>
        ))}
      </div>

      {tab === "accounts" && <Accounts t={t} lang={lang} session={props.session} isAdmin={props.isAdmin} onOpenProfile={props.onOpenProfile} />}

      {(tab === "counters" || tab === "synergies") && (
        <section className={`${CARD} flex flex-col gap-4 p-5`}>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
              {tab === "counters" ? t.strongLabel : "Brawler"}
              {select(a, setA)}
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
              {tab === "counters" ? t.weakLabel : "Brawler"}
              {select(b, setB)}
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--soft)]">
              {t.valueLabel}
              <select value={value} onChange={(e) => setValue(Number(e.target.value))} className={`${INPUT} w-24`}>
                <option value={1}>1</option>
                <option value={2}>2</option>
              </select>
            </label>
            <SmallButton onClick={addRow}>{t.add}</SmallButton>
          </div>
          <ul className="flex flex-col gap-1.5">
            {(tab === "counters" ? data.counters.map((c) => [c.strong, c.weak, c.value] as const) : data.synergies.map((s) => [s.a, s.b, s.value] as const)).map(
              ([x, y, v], i) => (
                <li key={`${x}-${y}`} className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-3 py-2 text-sm">
                  <span className="flex-1">
                    <strong>{x}</strong> {tab === "counters" ? "›" : "+"} <strong>{y}</strong> · {v}
                  </span>
                  <button
                    onClick={() =>
                      tab === "counters"
                        ? setData({ ...data, counters: data.counters.filter((_, j) => j !== i) })
                        : setData({ ...data, synergies: data.synergies.filter((_, j) => j !== i) })
                    }
                    className="text-sm font-semibold text-[var(--bad)]"
                  >
                    {t.remove}
                  </button>
                </li>
              ),
            )}
          </ul>
        </section>
      )}

      {tab === "tips" && (
        <section className={`${CARD} flex flex-col gap-3 p-5`}>
          {MAPS.map((m) => (
            <label key={m.id} className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">
                {mapName(lang, m.name)} <span className="font-normal text-[var(--faint)]">· {modeName(lang, m.mode)}</span>
              </span>
              <input
                value={data.tips[String(m.gameId)] ?? ""}
                onChange={(e) => setData({ ...data, tips: { ...data.tips, [String(m.gameId)]: e.target.value } })}
                placeholder={t.tipPlaceholder}
                className={INPUT}
              />
            </label>
          ))}
        </section>
      )}

      {tab === "visits" && (
        <section className="grid gap-4 md:grid-cols-2">
          {visits === null ? (
            <p className={SUB}>{t.loading}</p>
          ) : (
            [
              [t.visitsByDay, count((v) => v.day).sort((x, y) => y[0].localeCompare(x[0]))],
              [t.visitsByScreen, count((v) => v.screen).sort((x, y) => y[1] - x[1])],
            ].map(([title, rows]) => (
              <div key={title as string} className={`${CARD} p-5`}>
                <h2 className={H2}>{title as string}</h2>
                <ul className="mt-3 flex flex-col gap-1 text-sm">
                  {(rows as [string, number][]).map(([k, n]) => (
                    <li key={k} className="flex justify-between border-b border-[var(--line)] py-1">
                      <span>{k}</span>
                      <strong>{n}</strong>
                    </li>
                  ))}
                  {(rows as [string, number][]).length === 0 && <li className="text-[var(--faint)]">—</li>}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      {tab !== "visits" && tab !== "accounts" && (
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={saveAll}>{t.saveAll}</PrimaryButton>
          {message && <span className={`text-sm font-medium ${message.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{message.text}</span>}
        </div>
      )}
    </div>
  );
}

// ================= CONTAS (admin e moderador) =================

type Account = {
  id: string;
  email: string;
  createdAt: string | null;
  lastSignIn: string | null;
  banned: boolean;
  mfa: boolean;
  nick: string | null;
  tag: string | null;
  role: "admin" | "mod" | null;
};

function Accounts(props: { t: Dict; lang: Lang; session: Session; isAdmin: boolean; onOpenProfile: (tag: string) => void }) {
  const { t, lang } = props;
  const [list, setList] = useState<Account[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US") : "—");

  async function load() {
    const s = await freshSession(props.session);
    if (!s) return setError(true);
    try {
      const res = await fetch("/api/admin/users", { headers: { Authorization: `Bearer ${s.access_token}` }, cache: "no-store" });
      const json = (await res.json()) as { users?: Account[] };
      if (!res.ok || !json.users) return setError(true);
      setList(json.users);
      setError(false);
    } catch {
      setError(true);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function act(a: Account, action: "ban" | "unban" | "mod" | "unmod") {
    if (action === "ban" && !window.confirm(t.accConfirmBan(a.nick || a.email))) return;
    const s = await freshSession(props.session);
    if (!s) return;
    setBusy(a.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: a.id }),
      });
      const ok = res.ok && ((await res.json()) as { ok?: boolean }).ok === true;
      setMsg({ ok, text: ok ? t.accDone : t.accFail });
      if (ok) await load();
    } catch {
      setMsg({ ok: false, text: t.accFail });
    }
    setBusy(null);
  }

  if (error) return <p className={`${CARD} p-5 text-sm text-[var(--bad)]`}>{t.accErr}</p>;
  if (!list) return <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.loading}</p>;

  const q = query.trim().toLowerCase().replace(/^#/, "");
  const shown = q
    ? list.filter((a) => [a.email, a.nick ?? "", (a.tag ?? "").replace(/^#/, "")].some((x) => x.toLowerCase().includes(q)))
    : list;
  const weekAgo = Date.now() - 7 * 86400000;
  const active = list.filter((a) => a.lastSignIn && Date.parse(a.lastSignIn) > weekAgo).length;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-[var(--soft)]">{t.accTotal(list.length, active, list.filter((a) => a.banned).length)}</p>
      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.accSearch} className={INPUT} aria-label={t.accSearch} />
      {msg && <p className={`text-sm font-medium ${msg.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{msg.text}</p>}
      <ul className="flex flex-col gap-2">
        {shown.slice(0, 200).map((a) => {
          const me = a.id === props.session.user.id;
          return (
            <li key={a.id} className={`${CARD} flex flex-col gap-2 p-4 sm:flex-row sm:items-center ${a.banned ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-1.5 font-bold">
                  <span className="truncate">{a.nick || a.email.split("@")[0]}</span>
                  {me && <span className="text-xs font-normal text-[var(--faint)]">({t.accYou})</span>}
                  {a.role === "admin" && <Pill bg="var(--accent-soft)" color="var(--accent)">{t.accAdmin}</Pill>}
                  {a.role === "mod" && <Pill bg="var(--good-bg)" color="var(--good)">{t.accMod}</Pill>}
                  {a.banned && <Pill bg="var(--bad-bg)" color="var(--bad)">{t.accBanned}</Pill>}
                  {a.mfa && <Pill>{t.accMfa}</Pill>}
                </p>
                <p className="truncate text-xs text-[var(--soft)]">{a.email}</p>
                <p className="text-xs text-[var(--faint)]">
                  {t.accCreated(date(a.createdAt))} · {a.lastSignIn ? t.accLast(date(a.lastSignIn)) : t.accNever}
                  {a.tag && (
                    <>
                      {" · "}
                      <button onClick={() => props.onOpenProfile(a.tag as string)} className="font-semibold text-[var(--accent)] hover:underline">
                        {a.tag.startsWith("#") ? a.tag : `#${a.tag}`}
                      </button>
                    </>
                  )}
                </p>
              </div>
              {!me && a.role !== "admin" && (
                <div className="flex flex-wrap gap-2">
                  {(props.isAdmin || !a.role) &&
                    (a.banned ? (
                      <SmallButton onClick={() => act(a, "unban")} disabled={busy === a.id}>
                        {t.accUnban}
                      </SmallButton>
                    ) : (
                      <SmallButton onClick={() => act(a, "ban")} disabled={busy === a.id}>
                        {t.accBan}
                      </SmallButton>
                    ))}
                  {props.isAdmin && !a.banned && (
                    <SmallButton onClick={() => act(a, a.role === "mod" ? "unmod" : "mod")} disabled={busy === a.id}>
                      {a.role === "mod" ? t.accRemoveMod : t.accMakeMod}
                    </SmallButton>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
