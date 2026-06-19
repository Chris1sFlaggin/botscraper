import { describe, it, expect } from "vitest";
import { isAuthorWhitelisted } from "./whitelist-manager";
import { UserNode } from "../model/user";

const u = (id: string): UserNode => ({
  id, username: "u" + id, full_name: "", profile_pic_url: "p",
  is_private: false, is_verified: false, followed_by_viewer: false,
  follows_viewer: true, requested_by_viewer: false,
});

describe("isAuthorWhitelisted", () => {
  it("matches by id", () => {
    expect(isAuthorWhitelisted("2", [u("1"), u("2")])).toBe(true);
    expect(isAuthorWhitelisted("9", [u("1"), u("2")])).toBe(false);
  });
});
