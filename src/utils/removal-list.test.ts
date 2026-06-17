import { describe, it, expect } from "vitest";
import { buildRemovalList, parseRemovalList, bindCheck } from "./removal-list";
import { UserNode } from "../model/user";

const node = (p: Partial<UserNode>): UserNode => ({
  id: "1", username: "bot1", full_name: "", profile_pic_url: "",
  is_private: false, is_verified: false, followed_by_viewer: false,
  follows_viewer: true, requested_by_viewer: false, ...p,
});

describe("buildRemovalList", () => {
  it("binds the list to the target and projects bot fields", () => {
    const list = buildRemovalList(
      { id: "999", username: "client" },
      [node({ id: "1", username: "bot1", score: 72, reasons: ["no profile pic"] })],
      "2026-06-18T10:00:00.000Z",
    );
    expect(list.schemaVersion).toBe(1);
    expect(list.app).toBe("botscraper");
    expect(list.target).toEqual({ id: "999", username: "client" });
    expect(list.scannedAt).toBe("2026-06-18T10:00:00.000Z");
    expect(list.bots).toEqual([
      { id: "1", username: "bot1", full_name: "", score: 72, reasons: ["no profile pic"] },
    ]);
  });
  it("defaults missing score/reasons to 0/[]", () => {
    const list = buildRemovalList({ id: "9", username: "c" }, [node({ id: "2", username: "b2" })], "t");
    expect(list.bots[0].score).toBe(0);
    expect(list.bots[0].reasons).toEqual([]);
  });
});

describe("parseRemovalList", () => {
  const valid = JSON.stringify(buildRemovalList(
    { id: "999", username: "client" },
    [node({ id: "1", username: "bot1", score: 72, reasons: ["x"] })],
    "2026-06-18T10:00:00.000Z",
  ));
  it("accepts a well-formed file", () => {
    const r = parseRemovalList(valid);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.list.target.id).toBe("999");
  });
  it("rejects invalid JSON", () => {
    expect(parseRemovalList("{not json").ok).toBe(false);
  });
  it("rejects wrong schemaVersion", () => {
    const bad = JSON.parse(valid); bad.schemaVersion = 2;
    expect(parseRemovalList(JSON.stringify(bad)).ok).toBe(false);
  });
  it("rejects a missing target id", () => {
    const bad = JSON.parse(valid); delete bad.target.id;
    expect(parseRemovalList(JSON.stringify(bad)).ok).toBe(false);
  });
  it("rejects bots that are not an array", () => {
    const bad = JSON.parse(valid); bad.bots = "nope";
    expect(parseRemovalList(JSON.stringify(bad)).ok).toBe(false);
  });
});

describe("bindCheck", () => {
  const list = buildRemovalList({ id: "999", username: "client" }, [], "t");
  it("passes when the logged-in id matches the target", () => {
    expect(bindCheck(list, "999").ok).toBe(true);
  });
  it("blocks on mismatch and names both ids", () => {
    const r = bindCheck(list, "111");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("999");
      expect(r.error).toContain("111");
      expect(r.error).toContain("client");
    }
  });
  it("blocks when no session id is present", () => {
    expect(bindCheck(list, null).ok).toBe(false);
  });
});
