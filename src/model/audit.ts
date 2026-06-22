export type LeadClass = "hot" | "warm" | "cold";
export type AuditStatus = "ok" | "private" | "partial";

export interface ReasonExample { username: string; score: number; reasons: string[]; }
export interface SpamExample { username: string; text: string; score: number; reasons: string[]; }

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
  botReasons?: { [reason: string]: number };
  spamReasons?: { [reason: string]: number };
  sampleBots?: ReasonExample[];
  sampleSpam?: SpamExample[];
}

export interface SnapshotDelta {
  username: string;
  prevAt: string;
  currAt: string;
  followerCountDelta: number;
  botPctDelta: number;
  spamCountDelta: number;
  healthScoreDelta: number;
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
