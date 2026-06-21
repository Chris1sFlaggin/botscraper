import { AuditSnapshot, LeadRank } from "../model/audit";

export function leadsToCSV(ranks: readonly LeadRank[]): string {
  const header = ["username", "leadScore", "leadClass", "botPct", "spamCount", "followerCount", "scannedAt"];
  const rows = ranks.map(r => [
    r.snapshot.username, String(r.leadScore), r.leadClass,
    String(r.snapshot.botPct), String(r.snapshot.spamCount),
    String(r.snapshot.followerCount), r.snapshot.scannedAt,
  ].join(","));
  return header.join(",") + "\n" + rows.join("\n");
}

export function snapshotsToJSON(snaps: readonly AuditSnapshot[]): string {
  return JSON.stringify(snaps, null, 2);
}

export function parseSnapshots(text: string): AuditSnapshot[] {
  const data = JSON.parse(text);
  return Array.isArray(data) ? data : [data];
}

export function downloadText(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
