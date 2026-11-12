"use client";
// PAINEL DO ADMINISTRADOR: corrige counters, sinergias e dicas de mapa sem mexer no
// código, e mostra as visitas. Só aparece para contas na tabela "admins" do Supabase,
// e o banco também só deixa administrador gravar (a regra fica no supabase.sql).

import { useEffect, useState } from "react";
import { BRAWLERS } from "@/data/brawlers";
import { MAPS } from "@/data/maps";
import { setOverrides, type Overrides } from "@/lib/engine";
import { mapName, modeName, type Dict, type Lang } from "@/lib/i18n";
import { loadOverrides, loadVisits, saveOverrides, type Session } from "@/lib/supabase";
import { CARD, H1, H2, INPUT, PrimaryButton, SUB, SmallButton, choice } from "./ui";

const NAMES = BRAWLERS.map((b) => b.name);

export function AdminScreen(props: { t: Dict; lang: Lang; session: Session | null; isAdmin: boolean }) {
  const { t, lang } = props;
  const [data, setData] = useState<Overrides>({ counters: [], synergies: [], tips: {} });
  const [tab, setTab] = useState<"counters" | "synergies" | "tips" | "visits">("counters");
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

  if (!props.session || !props.isAdmin) return <p className={`${CARD} p-5 text-sm text-[var(--soft)]`}>{t.adminDenied}</p>;

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
      <h1 className={H1}>{t.adminTitle}</h1>
      <div className="flex flex-wrap gap-2">
        {(["counters", "synergies", "tips", "visits"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={choice(tab === k)}>
            {k === "counters" ? t.adminCounters : k === "synergies" ? t.adminSynergies : k === "tips" ? t.adminTips : t.visitsTitle}
          </button>
        ))}
      </div>

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

      {tab !== "visits" && (
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton onClick={saveAll}>{t.saveAll}</PrimaryButton>
          {message && <span className={`text-sm font-medium ${message.ok ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{message.text}</span>}
        </div>
      )}
    </div>
  );
}
