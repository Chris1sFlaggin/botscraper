import { describe, it, expect } from "vitest";
import {
  userMediaUrlGenerator, mediaCommentsUrlGenerator, bulkDeleteCommentsUrlGenerator,
  restrictUrlGenerator, blockUrlGenerator, mapApiCommentToNode, ownerMatches,
} from "./utils";

describe("comment url generators", () => {
  it("user media paginates with max_id", () => {
    expect(userMediaUrlGenerator("42")).toContain("/feed/user/42/");
    expect(userMediaUrlGenerator("42", "abc")).toContain("max_id=abc");
  });
  it("media comments paginates with min_id", () => {
    expect(mediaCommentsUrlGenerator("99")).toContain("/media/99/comments/");
    expect(mediaCommentsUrlGenerator("99", "m1")).toContain("min_id=m1");
  });
  it("bulk delete + restrict + block point at the right endpoints", () => {
    expect(bulkDeleteCommentsUrlGenerator("99")).toContain("/media/99/comments/bulk_delete/");
    expect(restrictUrlGenerator()).toContain("/restrict_action/restrict/");
    expect(blockUrlGenerator("7")).toContain("/friendships/7/block/");
  });
});

describe("mapApiCommentToNode", () => {
  it("maps pk/text/author with media context", () => {
    const n = mapApiCommentToNode(
      { pk: "c1", text: "hi", created_at: 5, comment_like_count: 2,
        user: { pk: "u1", username: "bob", full_name: "Bob", profile_pic_url: "p", is_verified: true } },
      "m1", "CODE",
    );
    expect(n).toMatchObject({ id: "c1", mediaId: "m1", mediaCode: "CODE", text: "hi", likeCount: 2, score: 0 });
    expect(n.author).toMatchObject({ id: "u1", username: "bob", is_verified: true });
  });
});

describe("ownerMatches", () => {
  it("true only when ds_user_id equals target id", () => {
    expect(ownerMatches("10", "10")).toBe(true);
    expect(ownerMatches("10", "11")).toBe(false);
    expect(ownerMatches(null, "10")).toBe(false);
  });
});
