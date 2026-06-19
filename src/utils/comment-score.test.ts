import { describe, it, expect } from "vitest";
import { scoreCommentText, combineCommentScore, getCommentsForDisplay, markCopypasta } from "./comment-score";
import { CommentNode } from "../model/comment";
import { UserNode } from "../model/user";

const author = (id: string, username: string): UserNode => ({
  id, username, full_name: "", profile_pic_url: "https://scontent/x.jpg",
  is_private: false, is_verified: false, followed_by_viewer: false,
  follows_viewer: true, requested_by_viewer: false,
});
const node = (id: string, text: string, score: number, authorId = id): CommentNode => ({
  id, mediaId: "m1", mediaCode: "AAA", text, createdAt: 0, likeCount: 0,
  author: author(authorId, `u${authorId}`), score, reasons: [],
});

describe("scoreCommentText", () => {
  it("flags external links", () => {
    const r = scoreCommentText("great post http://spam.ru/x");
    expect(r.score).toBeGreaterThanOrEqual(25);
    expect(r.reasons).toContain("link in comment");
  });
  it("flags promo phrases", () => {
    expect(scoreCommentText("dm me for promo").score).toBeGreaterThanOrEqual(25);
  });
  it("flags >=3 @mentions", () => {
    const r = scoreCommentText("@a @b @c look");
    expect(r.reasons).toContain("mention spam");
  });
  it("flags emoji-only", () => {
    const r = scoreCommentText("🔥🔥🔥");
    expect(r.reasons).toContain("emoji-only");
  });
  it("flags generic one-liner", () => {
    expect(scoreCommentText("nice").reasons).toContain("generic filler");
  });
  it("flags all-caps shout", () => {
    expect(scoreCommentText("FOLLOW MEEEE NOW").reasons).toContain("shouting/charspam");
  });
  it("does not flag a normal comment", () => {
    expect(scoreCommentText("loved the lighting in this shot").score).toBe(0);
  });
});

describe("combineCommentScore", () => {
  it("caps author contribution at 30 and total at 100", () => {
    expect(combineCommentScore(50, 80)).toBe(80);   // 50 + min(80,30)=30 => 80
    expect(combineCommentScore(90, 90)).toBe(100);  // 90 + 30 => capped 100
    expect(combineCommentScore(0, 10)).toBe(10);
  });
});

describe("getCommentsForDisplay", () => {
  it("drops whitelisted authors, filters by search, sorts by score desc", () => {
    const all = [node("1", "aaa", 10), node("2", "bbb", 90), node("3", "ccc", 50)];
    const wl = new Set(["3"]);
    const out = getCommentsForDisplay(all, wl, "");
    expect(out.map(c => c.id)).toEqual(["2", "1"]);
    expect(getCommentsForDisplay(all, new Set(), "bbb").map(c => c.id)).toEqual(["2"]);
  });
});

describe("markCopypasta", () => {
  it("flags identical text from >=3 distinct authors, leaves others", () => {
    const dup = (id: string, aid: string) => ({
      id, mediaId: "m", mediaCode: "C", text: "Check my page!!!", createdAt: 0,
      likeCount: 0,
      author: { id: aid, username: "u" + aid, full_name: "", profile_pic_url: "x",
        is_private: false, is_verified: false, followed_by_viewer: false,
        follows_viewer: true, requested_by_viewer: false },
      score: 0, reasons: [] as string[],
    });
    const unique = { ...dup("9", "9"), text: "unique nice shot" };
    const out = markCopypasta([dup("1", "a"), dup("2", "b"), dup("3", "c"), unique]);
    expect(out.filter(c => c.reasons.includes("copypasta")).length).toBe(3);
    expect(out.find(c => c.id === "9")!.reasons).not.toContain("copypasta");
    expect(out.find(c => c.id === "1")!.score).toBe(25);
  });
  it("does not flag the same author posting twice", () => {
    const same = (id: string) => ({
      id, mediaId: "m", mediaCode: "C", text: "spammy", createdAt: 0, likeCount: 0,
      author: { id: "SAME", username: "u", full_name: "", profile_pic_url: "x",
        is_private: false, is_verified: false, followed_by_viewer: false,
        follows_viewer: true, requested_by_viewer: false },
      score: 0, reasons: [] as string[],
    });
    const out = markCopypasta([same("1"), same("2"), same("3")]);
    expect(out.some(c => c.reasons.includes("copypasta"))).toBe(false);
  });
});
