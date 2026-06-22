import { AuditSnapshot, SnapshotDelta, LeadRank, LeadClass, AuditStatus, ReasonExample, SpamExample } from "../model/audit";
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
    healthScoreDelta: healthScoreOf(curr) - healthScoreOf(prev),
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

export function tallyReasons(items: ReadonlyArray<{ reasons: string[] }>): { [r: string]: number } {
  const out: { [r: string]: number } = {};
  for (const it of items) {
    for (const r of it.reasons) out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

export function healthScoreOf(s: AuditSnapshot): number {
  return 100 - leadScore(s);
}

export interface HealthGrade { grade: "A" | "B" | "C" | "D" | "F"; verdict: string; }

export function healthGrade(score: number): HealthGrade {
  if (score >= C.GRADE_A) return { grade: "A", verdict: "Sano" };
  if (score >= C.GRADE_B) return { grade: "B", verdict: "Buono" };
  if (score >= C.GRADE_C) return { grade: "C", verdict: "Attenzione" };
  if (score >= C.GRADE_D) return { grade: "D", verdict: "A rischio" };
  return { grade: "F", verdict: "Critico" };
}

export function estBotFollowers(s: AuditSnapshot): number {
  return Math.round((s.botPct / 100) * s.followerCount);
}

export type Severity = "green" | "yellow" | "red";
export interface RiskFlag { severity: Severity; text: string; }

export function riskFlags(s: AuditSnapshot): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (s.botPct >= C.RISK_BOT_RED) flags.push({ severity: "red", text: "Audience molto gonfiata — rischio reach ridotta / shadowban" });
  else if (s.botPct >= C.RISK_BOT_YELLOW) flags.push({ severity: "yellow", text: "Quota bot sopra la norma — pulizia consigliata" });
  else if (s.botPct >= C.RISK_BOT_GREEN) flags.push({ severity: "green", text: "Bot fisiologici — sotto controllo" });
  else flags.push({ severity: "green", text: "Audience pulita" });

  if (s.spamCount >= C.RISK_SPAM_RED) flags.push({ severity: "red", text: "Molti commenti spam — profilo sembra non moderato" });
  else if (s.spamCount >= C.RISK_SPAM_YELLOW) flags.push({ severity: "yellow", text: "Commenti spam presenti" });
  else if (s.spamCount >= 1) flags.push({ severity: "yellow", text: "Pochi commenti spam" });
  else flags.push({ severity: "green", text: "Nessun commento spam sui post recenti" });

  if ((s.spamReasons?.["copypasta"] ?? 0) > 0) {
    flags.push({ severity: "yellow", text: "Rete di commenti copia-incolla rilevata" });
  }
  if (s.botCount > 0 && (s.botReasons?.[C.PRIVATE_SUSPECT_REASON] ?? 0) >= C.PRIVATE_SUSPECT_FLAG_RATIO * s.botCount) {
    flags.push({ severity: "yellow", text: "Molti follower privati sospetti" });
  }
  return flags;
}

export function botExamplesFrom(
  scored: ReadonlyArray<ReasonExample>, threshold: number, cap: number,
): ReasonExample[] {
  return scored
    .filter(u => u.score >= threshold)
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);
}

export function spamExamplesFrom(
  comments: ReadonlyArray<{ author: { username: string }; text: string; score: number; reasons: string[] }>,
  threshold: number, cap: number, textMax: number,
): SpamExample[] {
  return comments
    .filter(c => c.score >= threshold)
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, cap)
    .map(c => ({
      username: c.author.username,
      score: c.score,
      reasons: c.reasons,
      text: c.text.length > textMax ? c.text.slice(0, textMax) + "…" : c.text,
    }));
}
