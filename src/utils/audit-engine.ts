import { AuditSnapshot, SnapshotDelta, LeadRank, LeadClass, AuditStatus } from "../model/audit";
import * as C from "../constants/constants";

export function emptySnapshot(
  username: string, id: string, scannedAt: string, status: AuditStatus, followerCount: number,
): AuditSnapshot {
  return {
    username, id, scannedAt, status, followerCount,
    followersSampled: 0, botCount: 0, botPct: 0,
    postsScanned: 0, commentsScanned: 0, spamCount: 0, spamPct: 0,
  };
}

export function botPct(scores: readonly number[], threshold: number): number {
  if (scores.length === 0) return 0;
  let n = 0;
  for (const s of scores) if (s >= threshold) n++;
  return Math.round((100 * n) / scores.length);
}

export function leadScore(s: AuditSnapshot): number {
  const raw = 0.6 * s.botPct + 0.4 * (s.spamPct * 100);
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function classifyLead(score: number): LeadClass {
  if (score >= C.LEAD_HOT) return "hot";
  if (score >= C.LEAD_WARM) return "warm";
  return "cold";
}

export function pitchLine(s: AuditSnapshot): string {
  return `Ciao @${s.username}, ho dato un'occhiata al profilo: circa ${s.botPct}% di follower sospetti e ${s.spamCount} commenti spam sui post recenti. Ti stanno abbassando la reach — posso ripulirli. Ti mando un report gratuito?`;
}

export function diffSnapshots(prev: AuditSnapshot, curr: AuditSnapshot): SnapshotDelta {
  return {
    username: curr.username,
    prevAt: prev.scannedAt,
    currAt: curr.scannedAt,
    followerCountDelta: curr.followerCount - prev.followerCount,
    botPctDelta: curr.botPct - prev.botPct,
    spamCountDelta: curr.spamCount - prev.spamCount,
  };
}

export function dedupeCandidates(handles: readonly string[]): string[] {
  const seen: { [k: string]: true } = {};
  const out: string[] = [];
  for (const h of handles) {
    const n = h.trim().toLowerCase().replace(/^@+/, "");
    if (n === "" || seen[n]) continue;
    seen[n] = true;
    out.push(n);
  }
  return out;
}

export function rankLeads(snapshots: readonly AuditSnapshot[]): LeadRank[] {
  const ranks: LeadRank[] = [];
  for (const s of snapshots) {
    if (s.status !== "ok") continue;
    const score = leadScore(s);
    ranks.push({ snapshot: s, leadScore: score, leadClass: classifyLead(score), pitch: pitchLine(s) });
  }
  ranks.sort((a, b) => b.leadScore - a.leadScore);
  return ranks;
}
