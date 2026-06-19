import { CommentNode, AuthorAction } from "./comment";
import { UserNode } from "./user";

export interface CommentActionLogEntry {
  readonly comment: CommentNode;
  readonly commentDeleted: boolean;
  readonly authorActioned: boolean;
}

export type CommentState =
  | { readonly status: "initial" }
  | {
      readonly status: "scanning";
      readonly target: { readonly id: string; readonly username: string };
      readonly isOwner: boolean;
      readonly maxPosts?: number;
      readonly maxCommentsPerPost?: number;
      readonly postsScanned: number;
      readonly totalPosts: number;
      readonly percentage: number;
      readonly results: readonly CommentNode[];
      readonly selectedResults: readonly CommentNode[];
      readonly whitelistAuthors: readonly UserNode[];
      readonly searchTerm: string;
      readonly removalThreshold: number;
      readonly authorAction: AuthorAction;
      readonly isEnriching: boolean;
    }
  | {
      readonly status: "acting";
      readonly authorAction: AuthorAction;
      readonly selectedResults: readonly CommentNode[];
      readonly percentage: number;
      readonly actionLog: readonly CommentActionLogEntry[];
    };
