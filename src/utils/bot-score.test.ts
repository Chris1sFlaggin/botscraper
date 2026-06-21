import { describe, it, expect } from "vitest";
import { digitRatio, hasTrailingDigits, isGibberish, hasSpam, isFinsta, scoreTier1, scoreTier2 } from "./bot-score";
import { UserNode } from "../model/user";
import { Enrichment } from "../model/scored-user";

const node = (p: Partial<UserNode>): UserNode => ({
  id: "1", username: "real_person", full_name: "Real Person",
  profile_pic_url: "https://cdn.example/normal.jpg", is_private: false, is_verified: false,
  followed_by_viewer: false, follows_viewer: true, requested_by_viewer: false, ...p,
});
// profile_pic_url containing a known default-avatar id => "no profile pic"
const NO_PIC = "https://x/44884218_345707102882519_2446069589734326272_n.jpg";

describe("heuristics", () => {
  it("digitRatio high for numeric usernames", () => expect(digitRatio("user12345678")).toBeGreaterThan(0.3));
  it("digitRatio low for words", () => expect(digitRatio("realperson")).toBeLessThan(0.3));
  it("trailing digit block", () => expect(hasTrailingDigits("john4821")).toBe(true));
  it("no trailing block for short suffix", () => expect(hasTrailingDigits("john8")).toBe(false));
  it("birth-year suffix is not a trailing digit block", () => {
    expect(hasTrailingDigits("monia_1977")).toBe(false);
    expect(hasTrailingDigits("giulia2001")).toBe(false);
  });
  it("non-year 4-digit block still flagged", () => {
    expect(hasTrailingDigits("user3500")).toBe(true);
    expect(hasTrailingDigits("user82910472")).toBe(true);
  });
  it("gibberish detection", () => expect(isGibberish("xkcdfghj")).toBe(true));
  it("real word not gibberish", () => expect(isGibberish("giulia")).toBe(false));
  it("spam keywords", () => expect(hasSpam("FREE FOLLOWERS link in bio")).toBe(true));
  it("clean name not spam", () => expect(hasSpam("Marco Rossi")).toBe(false));
  it("fancy unicode + emoji name is not spam", () => expect(hasSpam("𝑀𝑒𝑙𝑖𝑠𝑠𝑎 ❤️🌺🍀💖")).toBe(false));
});

describe("finsta exclusion", () => {
  it("privato in username excluded", () => expect(scoreTier1(node({ username: "giulia.privato", full_name: "" }), false).score).toBe(0));
  it("pvt marker excluded", () => expect(scoreTier1(node({ username: "marco_pvt", full_name: "Marco", profile_pic_url: NO_PIC }), false).score).toBe(0));
  it("isFinsta detects prv", () => expect(isFinsta(node({ username: "anna_prv" }))).toBe(true));
  it("isFinsta false for normal handle", () => expect(isFinsta(node({ username: "annamaria", full_name: "Anna Maria" }))).toBe(false));
});

describe("scoreTier1", () => {
  it("verified is excluded", () =>
    expect(scoreTier1(node({ is_verified: true, username: "u1234567", profile_pic_url: NO_PIC }), false).score).toBe(0));
  it("mutual is excluded", () =>
    expect(scoreTier1(node({ username: "u1234567", profile_pic_url: NO_PIC }), true).score).toBe(0));
  it("real user scores below candidate threshold", () =>
    expect(scoreTier1(node({}), false).score).toBeLessThan(25));
  it("obvious bot is a candidate", () => {
    const r = scoreTier1(node({ username: "asdkj82910472", full_name: "", profile_pic_url: NO_PIC, is_private: true }), false);
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.isCandidate).toBe(true);
    expect(r.reasons).toContain("no profile pic");
  });
});

describe("scoreTier2", () => {
  const enr = (p: Partial<Enrichment>): Enrichment => ({
    followerCount: 5, followingCount: 50, mediaCount: 10,
    isJoinedRecently: false, hasBio: true, hasExternalUrl: false, ...p,
  });
  it("recently joined + zero posts raises score", () => {
    const base = scoreTier1(node({ username: "asdkj82910472", full_name: "", profile_pic_url: NO_PIC }), false);
    const after = scoreTier2(base, enr({ isJoinedRecently: true, mediaCount: 0 }));
    expect(after.score).toBeGreaterThan(base.score);
    expect(after.reasons).toContain("recently joined");
    expect(after.reasons).toContain("zero posts");
  });
  it("mass-follow no audience flagged", () => {
    const base = scoreTier1(node({ username: "user99999" }), false);
    expect(scoreTier2(base, enr({ followingCount: 4000, followerCount: 10 })).reasons).toContain("mass-follow, no audience");
  });
  it("missing enrichment data (-1) adds nothing", () => {
    const base = scoreTier1(node({ username: "user99999" }), false);
    const after = scoreTier2(base, enr({ followerCount: -1, followingCount: -1, mediaCount: -1, hasBio: true, hasExternalUrl: true }));
    expect(after.score).toBe(base.score);
  });
  it("score capped at 100", () => {
    const base = scoreTier1(node({ username: "asdkj82910472", full_name: "", profile_pic_url: NO_PIC, is_private: true }), false);
    const after = scoreTier2(base, enr({ followingCount: 5000, followerCount: 0, mediaCount: 0, isJoinedRecently: true, hasBio: false }));
    expect(after.score).toBeLessThanOrEqual(100);
  });
});
