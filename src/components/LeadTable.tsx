import React from "react";
import { LeadRank, AuditSnapshot } from "../model/audit";

export function LeadTable(p: {
  ranks: readonly LeadRank[];
  skipped: readonly AuditSnapshot[];
  onCopyPitch: (text: string) => void;
}): React.JSX.Element {
  return (
    <div className="lead-table">
      <table>
        <thead>
          <tr><th>#</th><th>account</th><th>lead</th><th>bot%</th><th>spam</th><th>follower</th><th>pitch</th></tr>
        </thead>
        <tbody>
          {p.ranks.map((r, i) => (
            <tr key={r.snapshot.username} className={`lead-${r.leadClass}`}>
              <td>{i + 1}</td>
              <td>@{r.snapshot.username}</td>
              <td><span className={`chip chip-${r.leadClass}`}>{r.leadClass.toUpperCase()} {r.leadScore}</span></td>
              <td>{r.snapshot.botPct}%</td>
              <td>{r.snapshot.spamCount}</td>
              <td>{r.snapshot.followerCount}</td>
              <td><button className="copy-pitch" onClick={() => p.onCopyPitch(r.pitch)}>copia</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">bot% = stima su un campione dei follower più recenti, non un conteggio esatto.</p>
      {p.skipped.length > 0 && (
        <p className="skipped">Saltati (privati/non auditabili): {p.skipped.map(s => "@" + s.username).join(", ")}</p>
      )}
    </div>
  );
}
