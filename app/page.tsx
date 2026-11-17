"use client";
import { useEffect, useMemo, useState } from "react";

type Evento = {
  id: string;
  title: string;
  eventType: string;
  scope: string;
  state: string | null;
  city: string | null;
  date: string;
  legalBasis: string | null;
  suspendsWork: boolean;
  isProjected: boolean;
};

const C = {
  national: "#1f7a4d",
  state: "#2563a8",
  municipal: "#7c5cbf",
  ponto: "#c98a0e",
  luto: "#4a5568",
  normal: "#e5e7eb",
  ink: "#0c1626",
};

const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
  PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí", PR: "Paraná",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia", RR: "Roraima",
  RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe", SP: "São Paulo",
  TO: "Tocantins",
};

const UFS = Object.keys(UF_NAMES);

const UF_POS: Record<string, [number, number]> = {
  RR: [1, 3], AP: [1, 5],
  AM: [2, 2], PA: [2, 5], MA: [2, 8], CE: [2, 9], RN: [2, 10],
  AC: [3, 1], PI: [3, 8], PE: [3, 9], PB: [3, 10],
  RO: [4, 3], MT: [4, 5], TO: [4, 6], AL: [4, 8],
  MS: [5, 3], GO: [5, 5], DF: [5, 6], BA: [5, 8], SE: [5, 9],
  MG: [6, 6], ES: [6, 9],
  SP: [7, 6], RJ: [7, 7],
  PR: [8, 6],
  SC: [9, 7],
  RS: [10, 6],
};

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const DOWS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function isoOf(y: number, m: number, d: number) {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

function fmtBR(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function scopeRank(e: Evento) {
  return e.scope === "NATIONAL" ? 0 : e.scope === "STATE" ? 1 : 2;
}

function colorOf(e: Evento) {
  if (e.eventType === "PONTO_FACULTATIVO") return C.ponto;
  if (e.eventType === "LUTO_OFICIAL") return C.luto;
  if (e.scope === "NATIONAL") return C.national;
  if (e.scope === "STATE") return C.state;
  return C.municipal;
}

function typeLabel(e: Evento) {
  if (e.eventType === "PONTO_FACULTATIVO") return "Ponto facultativo";
  if (e.eventType === "LUTO_OFICIAL") return "Luto oficial";
  if (e.scope === "NATIONAL") return "Feriado nacional";
  if (e.scope === "STATE") return "Feriado estadual";
  return "Feriado municipal";
}

function scopeLabel(e: Evento) {
  if (e.scope === "NATIONAL") return "Nacional";
  if (e.scope === "STATE") return `Estado · ${UF_NAMES[e.state ?? ""] ?? e.state}`;
  return `Cidade · ${e.city ?? ""}${e.state ? ` / ${e.state}` : ""}`;
}

export default function Home() {
  const [hojeIso, setHojeIso] = useState("2026-01-01");
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [selectedDate, setSelectedDate] = useState("2026-01-01");
  const [filterUF, setFilterUF] = useState<string | null>(null);
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(0);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; uf: string } | null>(null);

  useEffect(() => {
    const agora = new Date();
    const iso = isoOf(agora.getFullYear(), agora.getMonth(), agora.getDate());
    setHojeIso(iso);
    setSelectedDate(iso);
    setCalYear(agora.getFullYear());
    setCalMonth(agora.getMonth());
  }, []);

  useEffect(() => {
    setCarregando(true);
    fetch(`/api/events?de=${calYear}-01-01&ate=${calYear}-12-31`)
      .then((r) => r.json())
      .then((d) => setEventos(d.eventos ?? []))
      .catch((err) => {
        console.error("Erro ao buscar eventos:", err);
        setEventos([]);
      })
      .finally(() => setCarregando(false));
  }, [calYear]);

  const porDia = useMemo(() => {
    const m = new Map<string, Evento[]>();
    for (const e of eventos) {
      const k = new Date(e.date).toISOString().slice(0, 10);
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(e);
    }
    return m;
  }, [eventos]);

  const eventsOn = (iso: string) => porDia.get(iso) ?? [];

  const byState = useMemo(() => {
    const map: Record<string, Evento[]> = {};
    for (const e of eventsOn(selectedDate)) {
      if (e.scope === "NATIONAL") {
        for (const uf of UFS) (map[uf] = map[uf] ?? []).push(e);
      } else if (e.state) {
        (map[e.state] = map[e.state] ?? []).push(e);
      }
    }
    return map;
  }, [porDia, selectedDate]);

  const lista = useMemo(() => {
    let l = eventsOn(selectedDate).slice().sort((a, b) => scopeRank(a) - scopeRank(b));
    if (filterUF) l = l.filter((e) => e.scope === "NATIONAL" || e.state === filterUF);
    return l;
  }, [porDia, selectedDate, filterUF]);

  const painted = Object.keys(byState).filter((k) => byState[k].length).length;

  function mudarMes(delta: number) {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m);
    setCalYear(y);
  }

  function selecionarDia(iso: string) {
    setSelectedDate(iso);
    const y = +iso.slice(0, 4);
    if (y !== calYear) setCalYear(y);
  }

  function voltarParaHoje() {
    const agora = new Date();
    const iso = isoOf(agora.getFullYear(), agora.getMonth(), agora.getDate());
    setFilterUF(null);
    setSelectedDate(iso);
    setCalYear(agora.getFullYear());
    setCalMonth(agora.getMonth());
  }

  function copiarResumo() {
    const txt =
      `Feriados e eventos em ${fmtBR(selectedDate)}:\n` +
      (lista.length
        ? lista
            .map((e) => `- ${typeLabel(e)}: ${e.title} (${scopeLabel(e)}; ${e.legalBasis ?? "—"})`)
            .join("\n")
        : "Nenhum evento nesta data.");
    navigator.clipboard.writeText(txt);
  }

  const grade = useMemo(() => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const days = new Date(calYear, calMonth + 1, 0).getDate();
    const prevDays = new Date(calYear, calMonth, 0).getDate();
    const cells: { d: number; iso: string; outside: boolean }[] = [];
    for (let i = 0; i < first; i++) {
      const d = prevDays - first + 1 + i;
      const m = calMonth - 1 < 0 ? 11 : calMonth - 1;
      const y = calMonth - 1 < 0 ? calYear - 1 : calYear;
      cells.push({ d, iso: isoOf(y, m, d), outside: true });
    }
    for (let d = 1; d <= days; d++) {
      cells.push({ d, iso: isoOf(calYear, calMonth, d), outside: false });
    }
    const total = (7 - ((first + days) % 7)) % 7;
    for (let i = 1; i <= total; i++) {
      const m = calMonth + 1 > 11 ? 0 : calMonth + 1;
      const y = calMonth + 1 > 11 ? calYear + 1 : calYear;
      cells.push({ d: i, iso: isoOf(y, m, i), outside: true });
    }
    return cells;
  }, [calYear, calMonth]);

  return (
    <div style={{ background: "#fff", color: C.ink, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif" }}>
      <header style={{ borderBottom: "1px solid #e5e7eb", background: "#fff", position: "sticky", top: 0, zIndex: 30 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
  <span style={{ fontWeight: 700, fontSize: 22, color: C.ink, letterSpacing: "-0.3px" }}>Mapa de</span>
  <img src="/logo.png" alt="" style={{ height: 38, width: "auto" }} />
  <span style={{ fontWeight: 700, fontSize: 22, color: C.ink, letterSpacing: "-0.3px" }}>Feriados</span>
</div>
          <span style={{ width: 1, height: 22, background: "#d1d5db" }} />
          <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
            Feriados, pontos facultativos e lutos oficiais
          </span>
        </div>
      </header>
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "45fr 55fr", gap: 24, alignItems: "stretch" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(12,22,38,0.06)", padding: 20, minHeight: 440, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Calendário</h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: "#5b6472" }}>
                    Pontos coloridos indicam o tipo de evento de cada dia.
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => mudarMes(-1)} aria-label="Mês anterior" style={btnOutline}>←</button>
                  <strong style={{ minWidth: 130, textAlign: "center", fontSize: 14 }}>
                    {MESES[calMonth]} de {calYear}
                  </strong>
                  <button onClick={() => mudarMes(1)} aria-label="Próximo mês" style={btnOutline}>→</button>
                  <select
                    value={calYear}
                    onChange={(e) => setCalYear(+e.target.value)}
                    style={{ padding: "4px 8px", fontWeight: 700, border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
                  >
                    {[2026, 2027, 2028, 2029, 2030].map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, flex: 1 }}>
                {DOWS.map((d) => (
                  <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "#4a5568", textTransform: "uppercase", padding: "4px 0" }}>
                    {d}
                  </div>
                ))}
                {grade.map(({ d, iso, outside }) => {
                  const evs = eventsOn(iso);
                  const sel = iso === selectedDate;
                  const isToday = iso === hojeIso;
                  return (
                    <button
                      key={iso}
                      onClick={() => selecionarDia(iso)}
                      style={{
                        position: "relative",
                        minHeight: 36,
                        border: sel ? `2px solid ${C.national}` : "1px solid #e5e7eb",
                        borderRadius: 6,
                        background: sel ? "#e8f3ec" : "#fff",
                        cursor: "pointer",
                        padding: "4px 6px",
                        fontSize: 15,
                        fontWeight: 700,
                        textAlign: "left",
                        color: C.ink,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        opacity: outside ? 0.3 : 1,
                        outline: isToday && !sel ? `2px solid ${C.ink}` : "none",
                        outlineOffset: isToday && !sel ? -2 : 0,
                      }}
                    >
                      <span>{d}</span>
                      <span style={{ display: "flex", gap: 3, flexWrap: "wrap", alignSelf: "flex-end", marginTop: 1 }}>
                        {evs.slice(0, 4).map((e, i) => (
                          <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: colorOf(e) }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", marginTop: 12, paddingTop: 10, borderTop: "1px solid #e5e7eb", fontSize: 11 }}>
                {[
                  ["Feriado nacional", C.national],
                  ["Feriado estadual", C.state],
                  ["Feriado municipal", C.municipal],
                  ["Ponto facultativo", C.ponto],
                  ["Luto oficial", C.luto],
                ].map(([l, c]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: c }} />
                    {l}
                  </span>
                ))}
              </div>
            </section>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" }}>
              <button onClick={copiarResumo} style={btnAction}>Copiar resumo</button>
              <button onClick={() => window.print()} style={btnAction}>Imprimir</button>
              <button onClick={voltarParaHoje} style={btnAction}>Voltar para hoje</button>
            </div>
            <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(12,22,38,0.06)", padding: 20, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Eventos de {fmtBR(selectedDate)}</h3>
                <span style={{ background: "#f1f5f9", color: C.ink, fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
                  {carregando ? "..." : `${lista.length} evento${lista.length === 1 ? "" : "s"}`}
                </span>
              </div>
              {filterUF && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12, fontSize: 13 }}>
                  <span style={{ color: "#5b6472" }}>Filtro ativo: {UF_NAMES[filterUF]} ({filterUF})</span>
                  <button onClick={() => setFilterUF(null)} style={{ background: "none", border: 0, color: C.national, textDecoration: "underline", cursor: "pointer", fontSize: 13 }}>
                    Limpar filtro
                  </button>
                </div>
              )}
              <div style={{ maxHeight: 380, overflowY: "auto", paddingRight: 4 }}>
                {lista.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "36px 12px", color: "#4a5568" }}>
                    <strong style={{ fontSize: 16, color: C.ink }}>Nenhum evento nesta data</strong>
                    <p style={{ margin: "4px 0 0", fontSize: 14 }}>Dia útil normal. Escolha outra data no calendário.</p>
                  </div>
                ) : (
                  lista.map((e) => (
                    <article key={e.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", background: "#fff", boxShadow: "0 1px 2px rgba(12,22,38,0.05)", display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      <span style={{ alignSelf: "flex-start", color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: colorOf(e) }}>
                        {typeLabel(e)}
                      </span>
                      <div style={{ fontWeight: 700, fontSize: 16 }}>{e.title}</div>
                      <div style={{ fontSize: 13, color: "#4a5568" }}>Abrangência: {scopeLabel(e)}</div>
                      <div style={{ fontSize: 13, color: "#4a5568" }}>Base legal: {e.legalBasis ?? "—"}</div>
                      <div style={{ fontSize: 13, color: "#4a5568" }}>
                        {e.isProjected ? "Valor projetado" : "Confirmado"}
                        {e.suspendsWork ? "" : " · não suspende o expediente"}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
          <div>
            <section style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", boxShadow: "0 1px 3px rgba(12,22,38,0.06)", padding: 12, display: "flex", flexDirection: "column", width: "fit-content", margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Mapa por unidade federativa</h3>
                <span style={{ border: "1px solid #e5e7eb", fontSize: 12, fontWeight: 600, padding: "2px 8px", borderRadius: 999 }}>
                  {painted} estado{painted === 1 ? "" : "s"} com evento
                </span>
              </div>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: "#5b6472" }}>
                Clique em um estado para filtrar a lista de eventos. Cores indicam o tipo do evento do dia.
              </p>
              <div style={{ position: "relative", width: "fit-content", margin: "0 auto" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 34px)", gridTemplateRows: "repeat(11, 34px)", gap: 3, justifyContent: "center", width: "fit-content" }}>
                  {UFS.map((uf) => {
                    const [r, c] = UF_POS[uf];
                    const evs = byState[uf] ?? [];
                    const cor = evs.length
                      ? colorOf(evs.slice().sort((a, b) => scopeRank(a) - scopeRank(b))[0])
                      : C.normal;
                    const sel = filterUF === uf;
                    const dim = filterUF && filterUF !== uf;
                    return (
                      <button
                        key={uf}
                        onClick={() => setFilterUF(sel ? null : uf)}
                        onMouseEnter={(ev) => {
                          const rect = ev.currentTarget.getBoundingClientRect();
                          const parent = ev.currentTarget.parentElement!.getBoundingClientRect();
                          setTooltip({ x: rect.left - parent.left + 12, y: rect.top - parent.top + 12, uf });
                        }}
                        onMouseLeave={() => setTooltip(null)}
                        title={UF_NAMES[uf]}
                        style={{
                          gridRow: r,
                          gridColumn: c,
                          width: 34,
                          height: 34,
                          borderRadius: 4,
                          border: sel ? `2px solid ${C.ink}` : uf === "DF" ? "1px dashed #6b7280" : "1px solid #d8e2dc",
                          background: cor,
                          color: evs.length ? "#fff" : C.ink,
                          fontWeight: 700,
                          fontSize: 10,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          opacity: dim ? 0.35 : 1,
                          boxShadow: sel ? "0 2px 8px rgba(12,22,38,0.25)" : "none",
                          padding: 0,
                        }}
                      >
                        {uf}
                      </button>
                    );
                  })}
                </div>
                {tooltip && (
                  <div style={{ position: "absolute", left: tooltip.x, top: tooltip.y, pointerEvents: "none", background: C.ink, color: "#fff", padding: "8px 10px", borderRadius: 8, fontSize: 12.5, maxWidth: 240, zIndex: 50, boxShadow: "0 6px 16px rgba(12,22,38,0.25)" }}>
                    <strong>{UF_NAMES[tooltip.uf]}</strong>
                    <br />
                    {(byState[tooltip.uf] ?? []).length
                      ? byState[tooltip.uf].map((e) => e.title).join(", ")
                      : "Sem evento nesta data"}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", flexWrap: "nowrap", justifyContent: "center", gap: 10, margin: "12px auto 0", fontSize: 10, whiteSpace: "nowrap" }}>
                {[
                  ["Feriado nacional", C.national],
                  ["Feriado estadual", C.state],
                  ["Feriado municipal", C.municipal],
                  ["Ponto facultativo", C.ponto],
                  ["Luto oficial", C.luto],
                  ["Dia útil normal", C.normal],
                ].map(([l, c]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 4, background: c }} />
                    {l}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 12, color: "#5b6472" }}>Estados sem evento aparecem em cinza claro.</span>
                {filterUF && (
                  <button onClick={() => setFilterUF(null)} style={{ background: "none", border: 0, color: C.national, cursor: "pointer", fontSize: 13 }}>
                    Limpar filtro
                  </button>
                )}
              </div>
            </section>
          </div>
        </div>
        <footer style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #e5e7eb", textAlign: "center", color: "#5b6472", fontSize: 12 }}>
          Mapa de Feriados · Conferir sempre a legislação vigente
        </footer>
      </main>
    </div>
  );
}

const btnOutline: React.CSSProperties = {
  height: 30,
  padding: "0 10px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  fontSize: 13,
  cursor: "pointer",
};

const btnAction: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 34,
  padding: "0 12px",
  border: "1px solid #d1d5db",
  borderRadius: 6,
  background: "#fff",
  color: "#0c1626",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};