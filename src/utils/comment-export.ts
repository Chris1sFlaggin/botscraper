import { CommentNode } from "../model/comment";

export interface CommentExportRow {
  readonly comment_id: string;
  readonly media_code: string;
  readonly author_username: string;
  readonly author_id: string;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly text: string;
}

export interface CommentExport {
  readonly schemaVersion: 1;
  readonly app: "botscraper-comments";
  readonly target: { readonly id: string; readonly username: string };
  readonly scannedAt: string;
  readonly comments: readonly CommentExportRow[];
}

export function buildCommentExport(
  target: { readonly id: string; readonly username: string },
  comments: readonly CommentNode[],
  scannedAt: string,
): CommentExport {
  return {
    schemaVersion: 1,
    app: "botscraper-comments",
    target: { id: target.id, username: target.username },
    scannedAt,
    comments: comments.map(c => ({
      comment_id: c.id,
      media_code: c.mediaCode,
      author_username: c.author.username,
      author_id: c.author.id,
      score: c.score,
      reasons: [...c.reasons],
      text: c.text,
    })),
  };
}

const q = (s: string): string => `"${s.replace(/"/g, '""')}"`;

export function buildCommentCSV(comments: readonly CommentNode[]): string {
  const header = "comment_id,media_code,author_username,author_id,score,reasons,text";
  const rows = comments.map(c =>
    [c.id, c.mediaCode, c.author.username, c.author.id, String(c.score),
     q(c.reasons.join("; ")), q(c.text)].join(","),
  );
  return [header, ...rows].join("\n");
}

function download(filename: string, mime: string, data: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportCommentsJSON(
  target: { readonly id: string; readonly username: string },
  comments: readonly CommentNode[],
): void {
  const now = new Date().toISOString();
  download(`botscraper-comments-${target.username}-${now.split("T")[0]}.json`,
    "application/json", JSON.stringify(buildCommentExport(target, comments, now), null, 2));
}

export function exportCommentsCSV(comments: readonly CommentNode[]): void {
  const now = new Date().toISOString();
  download(`botscraper-comments-${now.split("T")[0]}.csv`, "text/csv", buildCommentCSV(comments));
}
