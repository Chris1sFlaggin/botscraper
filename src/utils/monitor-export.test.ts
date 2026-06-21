import { describe, it, expect } from "vitest";
import { leadsToCSV, snapshotsToJSON, parseSnapshots } from "./monitor-export";
import { AuditSnapshot, LeadRank } from "../model/audit";

const snap = (p: Partial<AuditSnapshot> = {}): AuditSnapshot => ({
  username: "u", id: "1", scannedAt: "2026-06-21T00:00:00.000Z", status: "ok",
  followerCount: 1000, followersSampled: 300, botCount: 30, botPct: 10,
  postsScanned: 5, commentsScanned: 100, spamCount: 4, spamPct: 0.04, ...p,
});
const rank = (p: Partial<AuditSnapshot> = {}): LeadRank => ({
  snapshot: snap(p), leadScore: 42, leadClass: "warm", pitch: "hi",
});

describe("leadsToCSV", () => {
  it("emits a header plus one row per rank", () => {
    const csv = leadsToCSV([rank({ username: "a" }), rank({ username: "b" })]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain("username");
    expect(lines[1]).toContain("a");
  });
});

describe("snapshot JSON round-trip", () => {
  it("parseSnapshots(snapshotsToJSON(x)) equals x", () => {
    const x = [snap({ username: "a" }), snap({ username: "b" })];
    expect(parseSnapshots(snapshotsToJSON(x))).toEqual(x);
  });
  it("wraps a single object into an array", () => {
    const x = snap({ username: "solo" });
    expect(parseSnapshots(JSON.stringify(x))).toEqual([x]);
  });
});
