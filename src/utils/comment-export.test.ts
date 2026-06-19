import { describe, it, expect } from "vitest";
import { buildCommentExport, buildCommentCSV } from "./comment-export";
import { CommentNode } from "../model/comment";

const c: CommentNode = {
  id: "c1", mediaId: "m1", mediaCode: "AAA", text: 'he said "hi"', createdAt: 0, likeCount: 0,
  author: { id: "u1", username: "bob", full_name: "Bob", profile_pic_url: "p",
    is_private: false, is_verified: false, followed_by_viewer: false,
    follows_viewer: true, requested_by_viewer: false },
  score: 70, reasons: ["link in comment", "spam phrase"],
};

describe("buildCommentExport", () => {
  it("wraps comments with schema + target + timestamp", () => {
    const out = buildCommentExport({ id: "10", username: "acct" }, [c], "2026-06-19T00:00:00Z");
    expect(out.schemaVersion).toBe(1);
    expect(out.app).toBe("botscraper-comments");
    expect(out.target).toEqual({ id: "10", username: "acct" });
    expect(out.comments[0]).toMatchObject({ comment_id: "c1", author_username: "bob", score: 70 });
  });
});

describe("buildCommentCSV", () => {
  it("emits a header and escapes quotes in text", () => {
    const csv = buildCommentCSV([c]);
    const [header, row] = csv.split("\n");
    expect(header).toBe("comment_id,media_code,author_username,author_id,score,reasons,text");
    expect(row).toContain('"he said ""hi"""');
    expect(row).toContain('"link in comment; spam phrase"');
  });
});
