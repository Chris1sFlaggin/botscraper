export type LeadClass = "hot" | "warm" | "cold";
export type AuditStatus = "ok" | "private" | "partial";

export interface AuditSnapshot {
  username: string;
  id: string;
  scannedAt: string; // ISO
  status: AuditStatus;
  followerCount: number;
  followersSampled: number;
  botCount: number;
  botPct: number;
  postsScanned: number;
  commentsScanned: number;
  spamCount: number;
  spamPct: number;
}

export interface SnapshotDelta {
  username: string;
  prevAt: string;
  currAt: string;
  followerCountDelta: number;
  botPctDelta: number;
  spamCountDelta: number;
}

export interface LeadRank {
  snapshot: AuditSnapshot;
  leadScore: number;
  leadClass: LeadClass;
  pitch: string;
}

export interface MonitorRow {
  curr: AuditSnapshot;
  delta: SnapshotDelta | null;
}
