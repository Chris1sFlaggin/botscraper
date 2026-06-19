import { CommentNode } from "../model/comment";
import { SPAM_KEYWORDS } from "../constants/constants";
import * as C from "../constants/constants";

export interface CommentScore {
  readonly score: number;
  readonly reasons: string[];
}

const URL_RE = /https?:\/\/|www\.|\.com|\.ru|\.net|t\.me|bit\.ly/i;
const MENTION_RE = /@\w+/g;
// Strip emoji/symbols/whitespace to see if any "real" text remains.
// Uses \W + \s rather than Unicode property escapes (\p{}) to stay ES5-compatible.
const NON_TEXT_RE = /[\W\s]/g;

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
    if (key === "") continue;
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
