import { describe, it, expect } from "vitest";
import { followersUrlGenerator } from "./utils";

describe("followersUrlGenerator", () => {
  it("targets the given user id (not a cookie)", () => {
    expect(followersUrlGenerator("123456")).toContain("/friendships/123456/followers/");
  });
  it("omits max_id on the first page", () => {
    expect(followersUrlGenerator("123456")).not.toContain("max_id=");
  });
  it("appends an encoded max_id when provided", () => {
    const url = followersUrlGenerator("123456", "QVFD/abc=");
    expect(url).toContain("max_id=QVFD%2Fabc%3D");
  });
});
