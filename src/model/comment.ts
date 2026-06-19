import { UserNode } from "./user";

export type AuthorAction = "none" | "restrict" | "block" | "remove";

export interface CommentNode {
  readonly id: string;
  readonly mediaId: string;
  readonly mediaCode: string;
  readonly text: string;
  readonly createdAt: number;
  readonly likeCount: number;
  readonly author: UserNode;
  readonly score: number;
  readonly reasons: readonly string[];
}
