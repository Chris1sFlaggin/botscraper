import React from "react";
import { MonitorRow } from "../model/audit";

function delta(n: number, goodWhenNegative = false): React.JSX.Element {
  const sign = n > 0 ? "+" : "";
  const cls = n === 0 ? "flat" : (n < 0) === goodWhenNegative ? "good" : "bad";
  return <span className={`delta delta-${cls}`}>{sign}{n}</span>;
}

export function ClientTable(p: { rows: readonly MonitorRow[] }): React.JSX.Element {
  return (
    <table className="client-table">
      <thead>
        <tr><th>cliente</th><th>follower</th><th>bot%</th><th>spam</th><th>dall'ultima</th></tr>
      </thead>
      <tbody>
        {p.rows.map(({ curr, delta: d }) => (
          <tr key={curr.username}>
            <td>@{curr.username}{curr.status !== "ok" ? ` (${curr.status})` : ""}</td>
            <td>{curr.followerCount}</td>
            <td>{curr.botPct}%</td>
            <td>{curr.spamCount}</td>
            <td>
              {d === null ? <em>nessuno snapshot precedente</em> : (
                <>follower {delta(d.followerCountDelta)} · bot% {delta(d.botPctDelta, true)} · spam {delta(d.spamCountDelta, true)}</>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
