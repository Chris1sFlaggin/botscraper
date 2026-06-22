import React from "react";
import { AuditSnapshot, SnapshotDelta } from "../model/audit";
import { healthScoreOf, healthGrade, estBotFollowers, riskFlags, recommendedAction } from "../utils/audit-engine";

function reasonRows(map: { [r: string]: number } | undefined): { reason: string; count: number }[] {
  if (!map) return [];
  return Object.keys(map).map(k => ({ reason: k, count: map[k] })).sort((a, b) => b.count - a.count);
}
function signed(n: number): string { return (n > 0 ? "+" : "") + n; }

function Bars(p: { rows: { reason: string; count: number }[] }): React.JSX.Element {
  const max = p.rows.reduce((m, e) => Math.max(m, e.count), 1);
  return (
    <>
      {p.rows.map(e => (
        <div className="reason-row" key={e.reason}>
          <span className="reason-label">{e.reason}</span>
          <span className="reason-bar"><span className="reason-fill" style={{ width: Math.round((e.count / max) * 100) + "%" }} /></span>
          <span className="reason-count">{e.count}</span>
        </div>
      ))}
    </>
  );
}

export function HealthReport(p: { snapshot: AuditSnapshot; delta: SnapshotDelta | null }): React.JSX.Element {
  const s = p.snapshot;
  const hasData = s.followersSampled > 0 || s.commentsScanned > 0;
  if (s.status === "private") {
    return (
      <div className="health-report">
        <div className="hr-head"><h3>@{s.username}</h3><span className="grade grade-F">privato</span></div>
        <p className="hint">Profilo privato e non seguito — non auditabile con questo account.</p>
      </div>
    );
  }
  if (!hasData) {
    return (
      <div className="health-report">
        <div className="hr-head"><h3>@{s.username}</h3><span className="grade grade-F">nessun dato</span></div>
        <p className="hint">Nessun dato raccolto: profilo irraggiungibile o rate-limit di Instagram. Aspetta 10–15 minuti, evita scansioni ravvicinate, poi riprova.</p>
      </div>
    );
  }
  const score = healthScoreOf(s);
  const g = healthGrade(score);
  const est = estBotFollowers(s);
  const flags = riskFlags(s);
  const bots = reasonRows(s.botReasons);
  const spam = reasonRows(s.spamReasons);
  return (
    <div className="health-report">
      <div className="hr-head">
        <h3>@{s.username}</h3>
        <span className={"grade grade-" + g.grade}>{g.grade} · {g.verdict} · {score}/100</span>
      </div>
      {s.status === "partial" && <p className="hr-warn">⚠ Dati parziali: alcune chiamate a Instagram sono fallite (probabile rate-limit). I numeri sono su un campione ridotto — riscansiona tra qualche minuto.</p>}
      <p className="hr-headline">
        {s.followerCount.toLocaleString()} follower · <strong>~{est.toLocaleString()} sospetti ({s.botPct}%)</strong> · {s.spamCount} commenti spam
      </p>
      <p className="hint">
        campione {s.followersSampled} follower · {s.postsScanned} post · {s.commentsScanned} commenti
        {p.delta && <> · trend: salute {signed(p.delta.healthScoreDelta)} · bot% {signed(p.delta.botPctDelta)} · spam {signed(p.delta.spamCountDelta)}</>}
      </p>

      <div className="hr-section">
        <h4>Rischi</h4>
        <ul className="risk-list">
          {flags.map((f, i) => <li key={i} className={"risk risk-" + f.severity}>{f.text}</li>)}
        </ul>
      </div>

      <div className="hr-section">
        <h4>Perché sono bot <span className="hint">({s.botCount} sospetti su {s.followersSampled})</span></h4>
        {bots.length === 0 ? <p className="hint">nessun segnale</p> : <Bars rows={bots} />}
        {s.sampleBots && s.sampleBots.length > 0 &&
          <p className="examples">esempi: {s.sampleBots.map(b => "@" + b.username + " (" + b.score + ")").join(" · ")}</p>}
      </div>

      <div className="hr-section">
        <h4>Commenti spam per tipo</h4>
        {spam.length === 0 ? <p className="hint">nessuno</p> : <Bars rows={spam} />}
        {s.sampleSpam && s.sampleSpam.length > 0 &&
          <ul className="spam-examples">
            {s.sampleSpam.map((c, i) => <li key={i}><strong>@{c.username}</strong>: {c.text} <span className="hint">({c.score})</span></li>)}
          </ul>}
      </div>

      <div className="hr-action">{"➡"} {recommendedAction(s)}</div>
    </div>
  );
}
