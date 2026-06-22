import { describe, it, expect } from "vitest";
import {
  botPct, leadScore, classifyLead, pitchLine, diffSnapshots,
  dedupeCandidates, rankLeads, emptySnapshot, tallyReasons,
  healthScoreOf, healthGrade, estBotFollowers, riskFlags,
} from "./audit-engine";
import { AuditSnapshot } from "../model/audit";

const snap = (p: Partial<AuditSnapshot> = {}): AuditSnapshot => ({
  username: "u", id: "1", scannedAt: "2026-06-21T00:00:00.000Z", status: "ok",
  followerCount: 1000, followersSampled: 300, botCount: 0, botPct: 0,
  postsScanned: 5, commentsScanned: 100, spamCount: 0, spamPct: 0, ...p,
});

describe("botPct", () => {
  it("percent of sampled scores at/above threshold", () => {
    expect(botPct([30, 10, 40, 5], 25)).toBe(50);
  });
  it("zero for an empty sample", () => {
    expect(botPct([], 25)).toBe(0);
  });
});

describe("leadScore + classifyLead", () => {
  it("blends botPct (60%) and spam% (40%)", () => {
    expect(leadScore(snap({ botPct: 40, spamPct: 0.5 }))).toBe(44); // 24 + 20
  });
  it("classifies by thresholds", () => {
    expect(classifyLead(72)).toBe("hot");
    expect(classifyLead(44)).toBe("warm");
    expect(classifyLead(8)).toBe("cold");
  });
});

describe("pitchLine", () => {
  it("mentions handle, bot%, and spam count", () => {
    const p = pitchLine(snap({ username: "x", botPct: 38, spamCount: 120 }));
    expect(p).toContain("@x");
    expect(p).toContain("38");
    expect(p).toContain("120");
  });
});

describe("diffSnapshots", () => {
  it("computes deltas current minus previous", () => {
    const prev = snap({ followerCount: 1000, botPct: 30, spamCount: 50, scannedAt: "2026-06-01T00:00:00.000Z" });
    const curr = snap({ followerCount: 1200, botPct: 9, spamCount: 12, scannedAt: "2026-06-21T00:00:00.000Z" });
    const d = diffSnapshots(prev, curr);
    expect(d.followerCountDelta).toBe(200);
    expect(d.botPctDelta).toBe(-21);
    expect(d.spamCountDelta).toBe(-38);
    expect(d.healthScoreDelta).toBe(13); // health 95 (curr) - 82 (prev)
    expect(d.prevAt).toBe("2026-06-01T00:00:00.000Z");
  });
});

describe("dedupeCandidates", () => {
  it("strips @, lowercases, trims, drops empties + dups", () => {
    expect(dedupeCandidates(["@A", "a ", " B", "", "@@a"])).toEqual(["a", "b"]);
  });
});

describe("rankLeads", () => {
  it("sorts by leadScore desc and excludes non-ok status", () => {
    const hot = snap({ username: "hot", botPct: 90, spamPct: 0.9 });
    const cold = snap({ username: "cold", botPct: 5, spamPct: 0 });
    const priv = snap({ username: "priv", status: "private", botPct: 99 });
    const out = rankLeads([cold, priv, hot]);
    expect(out.map(r => r.snapshot.username)).toEqual(["hot", "cold"]);
    expect(out[0].leadClass).toBe("hot");
  });
});

describe("emptySnapshot", () => {
  it("zero-fills metrics with the given status", () => {
    const s = emptySnapshot("u", "9", "2026-06-21T00:00:00.000Z", "private", 500);
    expect(s).toMatchObject({ username: "u", id: "9", status: "private", followerCount: 500, botPct: 0, spamCount: 0 });
  });
});

describe("tallyReasons", () => {
  it("counts each reason across items", () => {
    const out = tallyReasons([
      { reasons: ["no profile pic", "gibberish username"] },
      { reasons: ["no profile pic"] },
      { reasons: [] },
    ]);
    expect(out).toEqual({ "no profile pic": 2, "gibberish username": 1 });
  });
  it("empty for no items", () => {
    expect(tallyReasons([])).toEqual({});
  });
});

describe("healthScoreOf + healthGrade", () => {
  it("health is 100 minus the problem score", () => {
    expect(healthScoreOf(snap({ botPct: 9, spamPct: 0 }))).toBe(95);  // leadScore 5
    expect(healthScoreOf(snap({ botPct: 40, spamPct: 0.5 }))).toBe(56); // leadScore 44
  });
  it("grades by band boundaries", () => {
    expect(healthGrade(95).grade).toBe("A");
    expect(healthGrade(85).grade).toBe("A");
    expect(healthGrade(84).grade).toBe("B");
    expect(healthGrade(70).grade).toBe("B");
    expect(healthGrade(55).grade).toBe("C");
    expect(healthGrade(35).grade).toBe("D");
    expect(healthGrade(34).grade).toBe("F");
    expect(healthGrade(95).verdict).toBe("Sano");
  });
});

describe("estBotFollowers", () => {
  it("rounds botPct% of followerCount", () => {
    expect(estBotFollowers(snap({ followerCount: 74319, botPct: 9 }))).toBe(6689);
    expect(estBotFollowers(snap({ followerCount: 1000, botPct: 0 }))).toBe(0);
  });
});

describe("riskFlags", () => {
  const sev = (s: AuditSnapshot) => riskFlags(s).map(f => `${f.severity}`);
  it("red bot share at 25%+", () => {
    expect(riskFlags(snap({ botPct: 30 }))[0]).toMatchObject({ severity: "red" });
  });
  it("green clean audience under 5%", () => {
    expect(riskFlags(snap({ botPct: 2, spamCount: 0 }))[0]).toMatchObject({ severity: "green" });
  });
  it("flags copypasta ring when present in spamReasons", () => {
    const out = riskFlags(snap({ botPct: 2, spamCount: 4, spamReasons: { copypasta: 3 } }));
    expect(out.some(f => f.text.indexOf("copia-incolla") >= 0)).toBe(true);
  });
  it("flags private-suspect mass at 30%+ of botCount", () => {
    const out = riskFlags(snap({ botPct: 12, botCount: 100, botReasons: { "private + suspect": 30 } }));
    expect(out.some(f => f.text.indexOf("privati sospetti") >= 0)).toBe(true);
  });
  it("always returns a bot flag and a spam flag", () => {
    expect(sev(snap({ botPct: 0, spamCount: 0 })).length).toBe(2);
  });
});
