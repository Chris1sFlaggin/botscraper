import { CommentNode } from "../model/comment";
import { SPAM_KEYWORDS } from "../constants/constants";
import * as C from "../constants/constants";
import { scoreTier1 } from "./bot-score";

export interface CommentScore {
  readonly score: number;
  readonly reasons: string[];
}

const URL_RE = /https?:\/\/|www\.|\.com|\.ru|\.net|t\.me|bit\.ly/i;
const MENTION_RE = /@\w+/g;
// Strip non-word chars to see if any real text remains. \W already covers emoji,
// symbols and punctuation; \s is redundant inside \W but kept for legibility.
const NON_TEXT_RE = /[\W\s]/g;
// A comment carries real words only if it has at least one letter. Emoji/symbol/number-only
// reactions ("❤️", "🔥🔥", "👏") are not "pasted messages" and must not count as copypasta.
// ASCII-letter check (no \p{L}/u): the build targets ES5, and this matches the codebase's
// existing \W-based emoji-only detection.
const HAS_LETTER_RE = /[a-z]/i;

export function scoreCommentText(text: string): CommentScore {
  const reasons: string[] = [];
  let score = 0;
  const lower = text.toLowerCase().trim();
  if (lower === "") return { score: 0, reasons };

  if (URL_RE.test(lower) || lower.includes("link in bio")) {
    score += C.COMMENT_W_LINK; reasons.push("link in comment");
  }
  const phrases = [...SPAM_KEYWORDS, ...C.COMMENT_SPAM_PHRASES];
  if (phrases.some(p => lower.includes(p))) {
    score += C.COMMENT_W_SPAM_PHRASE; reasons.push("spam phrase");
  }
  if ((text.match(MENTION_RE) ?? []).length >= C.COMMENT_MENTION_SPAM_MIN) {
    score += C.COMMENT_W_MENTION_SPAM; reasons.push("mention spam");
  }
  const stripped = text.replace(NON_TEXT_RE, "");
  if (stripped === "" && text.trim() !== "") {
    score += C.COMMENT_W_EMOJI_ONLY; reasons.push("emoji-only");
  }
  if (C.COMMENT_GENERIC_PHRASES.includes(lower)) {
    score += C.COMMENT_W_GENERIC; reasons.push("generic filler");
  }
  const letters = text.replace(/[^a-z]/gi, "");
  const isShout = letters.length >= 5 && letters === letters.toUpperCase();
  const hasCharSpam = /(.)\1{3,}/.test(lower);
  if (isShout || hasCharSpam) {
    score += C.COMMENT_W_CAPS; reasons.push("shouting/charspam");
  }
  return { score: Math.min(score, 100), reasons };
}

export function combineCommentScore(textScore: number, authorScore: number): number {
  return Math.min(100, textScore + Math.min(authorScore, C.COMMENT_AUTHOR_CAP));
}

export function getCommentsForDisplay(
  results: readonly CommentNode[],
  whitelistAuthorIds: ReadonlySet<string>,
  searchTerm: string,
): readonly CommentNode[] {
  const term = searchTerm.toLowerCase();
  return results
    .filter(c => !whitelistAuthorIds.has(c.author.id))
    .filter(c => term === "" ||
      c.text.toLowerCase().includes(term) ||
      c.author.username.toLowerCase().includes(term))
    .slice()
    .sort((a, b) => b.score - a.score);
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export function markCopypasta(nodes: readonly CommentNode[]): CommentNode[] {
  const authorsByText = new Map<string, Set<string>>();
  for (const n of nodes) {
    const key = normalizeText(n.text);
    if (key === "" || !HAS_LETTER_RE.test(key)) continue;
    (authorsByText.get(key) ?? authorsByText.set(key, new Set()).get(key)!).add(n.author.id);
  }
  const copypastaKeys = new Set(
    Array.from(authorsByText.entries())
      .filter(([, authors]) => authors.size >= C.COPYPASTA_MIN_AUTHORS)
      .map(([key]) => key),
  );
  return nodes.map(n => {
    if (!copypastaKeys.has(normalizeText(n.text)) || n.reasons.includes("copypasta")) {
      return { ...n };
    }
    return {
      ...n,
      score: Math.min(100, n.score + C.COMMENT_W_COPYPASTA),
      reasons: [...n.reasons, "copypasta"],
    };
  });
}

// Full per-comment score with hard exclusions: verified authors and the scanned
// account's own comments are never spam (precision-first).
export function scoreComment(node: CommentNode, ownerId: string): CommentNode {
  if (node.author.is_verified || node.author.id === ownerId) {
    return { ...node, score: 0, reasons: [] };
  }
  const text = scoreCommentText(node.text);
  const author = scoreTier1(node.author, false);
  return {
    ...node,
    score: combineCommentScore(text.score, author.score),
    reasons: [...text.reasons, ...author.reasons],
  };
}

// Re-fold a comment's score with a deep-scanned author score, preserving any
// copypasta bonus the comment already earned (deep-scan must never drop it).
export function refoldWithAuthorScore(comment: CommentNode, authorScore: number): CommentNode {
  const text = scoreCommentText(comment.text);
  let score = combineCommentScore(text.score, authorScore);
  if (comment.reasons.includes("copypasta")) {
    score = Math.min(100, score + C.COMMENT_W_COPYPASTA);
  }
  return { ...comment, score };
}
