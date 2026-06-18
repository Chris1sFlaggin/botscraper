import { describe, it, expect } from "vitest";
import {
  followersUrlGenerator,
  friendshipShowUrlGenerator,
  parseResolvedTarget,
  shouldRemoveAfterShow,
} from "./utils";

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

describe("friendshipShowUrlGenerator", () => {
  it("builds the friendships/show path for an id", () => {
    expect(friendshipShowUrlGenerator("42")).toBe(
      "https://www.instagram.com/api/v1/friendships/show/42/",
    );
  });
});

describe("parseResolvedTarget", () => {
  it("extracts id/username/isPrivate/followerCount from web_profile_info", () => {
    const json = { data: { user: { id: "777", username: "client", is_private: false, edge_followed_by: { count: 74000 } } } };
    expect(parseResolvedTarget(json)).toEqual({ id: "777", username: "client", isPrivate: false, followerCount: 74000 });
  });
  it("defaults followerCount to -1 when the count is absent", () => {
    const json = { data: { user: { id: "777", username: "client", is_private: false } } };
    expect(parseResolvedTarget(json)?.followerCount).toBe(-1);
  });
  it("returns null when the user is absent", () => {
    expect(parseResolvedTarget({ data: {} })).toBeNull();
    expect(parseResolvedTarget(null)).toBeNull();
  });
});

describe("shouldRemoveAfterShow", () => {
  it("removes only a current, non-mutual, non-whitelisted follower", () => {
    expect(shouldRemoveAfterShow({ followed_by: true, following: false }, false)).toBe(true);
  });
  it("keeps mutuals (target follows them back)", () => {
    expect(shouldRemoveAfterShow({ followed_by: true, following: true }, false)).toBe(false);
  });
  it("skips accounts that no longer follow", () => {
    expect(shouldRemoveAfterShow({ followed_by: false, following: false }, false)).toBe(false);
  });
  it("skips whitelisted accounts", () => {
    expect(shouldRemoveAfterShow({ followed_by: true, following: false }, true)).toBe(false);
  });
});
