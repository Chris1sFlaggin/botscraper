import React, { useState } from "react";
import { render } from "react-dom";
import "./styles.scss";

import { INSTAGRAM_HOSTNAME, LEAD_FOLLOWER_SAMPLE, LEAD_POSTS_SCAN,
  CLIENT_FOLLOWER_SAMPLE, CLIENT_POSTS_SCAN, MONITOR_HARVEST_CAP,
  MONITOR_DEFAULT_CLIENTS } from "./constants/constants";
import { auditAccount, harvestCandidates } from "./utils/audit-fetch";
import { rankLeads, diffSnapshots, dedupeCandidates, reportToText } from "./utils/audit-engine";
import { leadsToCSV, snapshotsToJSON, parseSnapshots, downloadText } from "./utils/monitor-export";
import { LeadTable } from "./components/LeadTable";
import { HealthReport } from "./components/HealthReport";
import { Toast } from "./components/Toast";
import { AuditSnapshot, LeadRank, MonitorRow } from "./model/audit";

type Mode = "leads" | "clients";
type MonitorState =
  | { status: "initial" }
  | { status: "running"; mode: Mode; percentage: number }
  | { status: "leads-done"; ranks: LeadRank[]; skipped: AuditSnapshot[] }
  | { status: "clients-done"; rows: MonitorRow[] };

function App() {
  const [state, setState] = useState<MonitorState>({ status: "initial" });
  const [toast, setToast] = useState<{ show: boolean; text: string }>({ show: false, text: "" });
  const [mode, setMode] = useState<Mode>("leads");
  const [leadHandles, setLeadHandles] = useState("");
  const [seed, setSeed] = useState("");
  const [seedSource, setSeedSource] = useState<"followers" | "commenters">("commenters");
  const [clientHandles, setClientHandles] = useState(MONITOR_DEFAULT_CLIENTS.join("\n"));
  const [prevSnaps, setPrevSnaps] = useState<{ [username: string]: AuditSnapshot }>({});

  const note = (text: string) => setToast({ show: true, text });

  const onLoadSnapshots = async (files: FileList | null) => {
    if (!files) return;
    const acc: { [u: string]: AuditSnapshot } = { ...prevSnaps };
    for (const f of Array.from(files)) {
      try {
        for (const s of parseSnapshots(await f.text())) acc[s.username.toLowerCase()] = s;
      } catch (e) { console.error("bad snapshot file", f.name, e); }
    }
    setPrevSnaps(acc);
    note(`Snapshot caricati: ${Object.keys(acc).length} account`);
  };

  const runLeads = async () => {
    let candidates = dedupeCandidates(leadHandles.split(/[\s,]+/));
    if (seed.trim() !== "") {
      note("Harvest candidati dal seed...");
      const harvested = await harvestCandidates(seed.trim().replace(/^@/, ""), seedSource, MONITOR_HARVEST_CAP);
      candidates = dedupeCandidates(candidates.concat(harvested));
    }
    if (candidates.length === 0) { alert("Nessun candidato. Incolla degli handle o un seed."); return; }
    setState({ status: "running", mode: "leads", percentage: 0 });
    const snaps: AuditSnapshot[] = [];
    for (let i = 0; i < candidates.length; i++) {
      note(`Audit lead ${i + 1}/${candidates.length}: @${candidates[i]}`);
      snaps.push(await auditAccount(candidates[i], { followerSample: LEAD_FOLLOWER_SAMPLE, postsScan: LEAD_POSTS_SCAN }));
      setState({ status: "running", mode: "leads", percentage: Math.round(((i + 1) / candidates.length) * 100) });
    }
    setState({ status: "leads-done", ranks: rankLeads(snaps), skipped: snaps.filter(s => s.status !== "ok") });
    note("Lead audit completato.");
  };

  const runClients = async () => {
    const clients = dedupeCandidates(clientHandles.split(/[\s,]+/));
    if (clients.length === 0) { alert("Nessun cliente in lista."); return; }
    setState({ status: "running", mode: "clients", percentage: 0 });
    const rows: MonitorRow[] = [];
    for (let i = 0; i < clients.length; i++) {
      note(`Audit cliente ${i + 1}/${clients.length}: @${clients[i]}`);
      const curr = await auditAccount(clients[i], { followerSample: CLIENT_FOLLOWER_SAMPLE, postsScan: CLIENT_POSTS_SCAN });
      const prev = prevSnaps[curr.username.toLowerCase()];
      rows.push({ curr, delta: prev ? diffSnapshots(prev, curr) : null });
      setState({ status: "running", mode: "clients", percentage: Math.round(((i + 1) / clients.length) * 100) });
    }
    setState({ status: "clients-done", rows });
    note("Monitoraggio clienti completato.");
  };

  const copyPitch = async (text: string) => {
    try { await navigator.clipboard.writeText(text); note("Pitch copiato."); }
    catch (e) { console.error(e); note("Copia non riuscita."); }
  };

  const copyReport = async (snap: AuditSnapshot, d: MonitorRow["delta"]) => {
    try { await navigator.clipboard.writeText(reportToText(snap, d)); note("Report copiato."); }
    catch (e) { console.error(e); note("Copia non riuscita."); }
  };

  let markup: React.JSX.Element;
  if (state.status === "initial") {
    markup = (
      <section className="launch-screen">
        <div className="launch-copy">
          <span className="eyebrow">Lead & client monitor (read-only)</span>
          <div className="mode-toggle">
            <button className={mode === "leads" ? "active" : ""} onClick={() => setMode("leads")}>Trova clienti</button>
            <button className={mode === "clients" ? "active" : ""} onClick={() => setMode("clients")}>Monitora clienti</button>
          </div>
          {mode === "leads" ? (
            <>
              <p>Incolla handle candidati (uno per riga). Opzionale: un seed da cui pescare candidati.</p>
              <textarea className="search-bar" rows={5} placeholder="@account1&#10;@account2" value={leadHandles} onChange={e => setLeadHandles(e.currentTarget.value)} />
              <input className="search-bar" placeholder="seed opzionale (@hub)" value={seed} onChange={e => setSeed(e.currentTarget.value)} />
              <select value={seedSource} onChange={e => setSeedSource(e.currentTarget.value as "followers" | "commenters")}>
                <option value="commenters">da chi commenta il seed</option>
                <option value="followers">dai follower del seed</option>
              </select>
              <button className="run-scan" onClick={runLeads}>Trova lead</button>
            </>
          ) : (
            <>
              <p>Lista clienti (uno per riga). Carica gli snapshot precedenti per vedere il delta.</p>
              <textarea className="search-bar" rows={5} value={clientHandles} onChange={e => setClientHandles(e.currentTarget.value)} />
              <input type="file" accept="application/json" multiple onChange={e => onLoadSnapshots(e.currentTarget.files)} />
              <span className="hint">{Object.keys(prevSnaps).length} snapshot precedenti caricati</span>
              <button className="run-scan" onClick={runClients}>Scansiona clienti</button>
            </>
          )}
        </div>
      </section>
    );
  } else if (state.status === "running") {
    markup = <section className="results-container column"><div className="badge">Scansione… {state.percentage}%</div></section>;
  } else if (state.status === "leads-done") {
    markup = (
      <section className="results-container column">
        <div className="toolbar-row">
          <button onClick={() => downloadText("leads.csv", leadsToCSV(state.ranks), "text/csv")}>Export CSV</button>
          <button onClick={() => downloadText("leads.json", snapshotsToJSON(state.ranks.map(r => r.snapshot)), "application/json")}>Export JSON</button>
        </div>
        <LeadTable ranks={state.ranks} skipped={state.skipped} onCopyPitch={copyPitch} />
      </section>
    );
  } else {
    const today = new Date().toISOString().split("T")[0];
    markup = (
      <section className="results-container column">
        <div className="toolbar-row">
          <button onClick={() => downloadText(`snapshots-${today}.json`, snapshotsToJSON(state.rows.map(r => r.curr)), "application/json")}>Esporta snapshot</button>
        </div>
        {state.rows.map(r => (
          <div className="report-block" key={r.curr.username}>
            <HealthReport snapshot={r.curr} delta={r.delta} />
            {r.curr.status === "ok" && <button onClick={() => copyReport(r.curr, r.delta)}>Copia report</button>}
          </div>
        ))}
      </section>
    );
  }

  return (
    <main id="main" role="main" className="iu">
      <section className="overlay">
        {markup}
        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false, text: "" })} />}
      </section>
    </main>
  );
}

if (location.hostname !== INSTAGRAM_HOSTNAME) {
  alert("Can be used only on Instagram routes");
} else {
  document.title = "BotScraper — lead & client monitor";
  document.body.innerHTML = "";
  render(<App />, document.body);
}
