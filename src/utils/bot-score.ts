import { UserNode } from "../model/user";
import { Enrichment } from "../model/scored-user";
import { isWithoutProfilePicture } from "./utils";
import * as C from "../constants/constants";

export function digitRatio(s: string): number {
  if (s.length === 0) return 0;
  return (s.match(/\d/g) ?? []).length / s.length;
}

export function hasTrailingDigits(s: string): boolean {
  return /\d{4,}$/.test(s);
}

export function vowelRatio(s: string): number {
  const letters = (s.match(/[a-z]/gi) ?? []).length;
  if (letters === 0) return 0;
  return (s.match(/[aeiou]/gi) ?? []).length / letters;
}

export function isGibberish(s: string): boolean {
  return s.length >= C.GIBBERISH_MIN_LEN && vowelRatio(s) < C.VOWEL_RATIO_THRESHOLD;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasSpam(name: string): boolean {
  const lower = name.toLowerCase();
  if (/https?:\/\/|www\.|\.com|\.ru|t\.me/.test(lower)) return true;
  // NB: deliberately no emoji/fancy-font check — real people decorate names with emoji and
  // stylized unicode, so that produced too many false positives. Spam = links + promo phrases.
  return C.SPAM_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Finsta ("fake insta") markers in the username/name signal a real person's private alt
 * account, not a bot. Hard exclusion.
 */
export function isFinsta(node: UserNode): boolean {
  const hay = `${node.username} ${node.full_name}`.toLowerCase();
  return C.FINSTA_KEYWORDS.some(k => hay.includes(k));
}

export interface ScoreResult {
  readonly score: number;
  readonly reasons: string[];
  readonly isCandidate: boolean;
}

/**
 * Tier 1: scored from the cheap followers-list fields only.
 * Verified accounts and mutuals (accounts the logged-in user follows back) are hard-excluded.
 */
export function scoreTier1(node: UserNode, isMutual: boolean): ScoreResult {
  if (node.is_verified || isMutual || isFinsta(node)) {
    return { score: 0, reasons: [], isCandidate: false };
  }
  const reasons: string[] = [];
  let score = 0;
  const u = node.username;
  const noPic = isWithoutProfilePicture(node);
  const dr = digitRatio(u);

  if (noPic) { score += C.W_NO_PIC; reasons.push("no profile pic"); }
  if (dr >= C.DIGIT_RATIO_THRESHOLD) { score += C.W_DIGIT_RATIO; reasons.push("many digits in username"); }
  if (hasTrailingDigits(u)) { score += C.W_TRAILING_DIGITS; reasons.push("trailing digit block"); }
  if (isGibberish(u)) { score += C.W_GIBBERISH; reasons.push("gibberish username"); }

  const name = node.full_name.trim();
  if (name === "") { score += C.W_EMPTY_NAME; reasons.push("empty name"); }
  else if (normalize(name) === normalize(u)) { score += C.W_NAME_EQ_USERNAME; reasons.push("name equals username"); }

  if (hasSpam(node.full_name)) { score += C.W_SPAM_NAME; reasons.push("spam in name"); }
  if (node.is_private && (noPic || dr >= C.DIGIT_RATIO_THRESHOLD)) { score += C.W_PRIVATE_SUSPECT; reasons.push("private + suspect"); }

  const capped = Math.min(score, 100);
  return { score: capped, reasons, isCandidate: capped >= C.TIER2_CANDIDATE_THRESHOLD };
}

/**
 * Tier 2: adds signals from a per-profile enrichment fetch. Only run on Tier-1 candidates.
 */
export function scoreTier2(base: ScoreResult, e: Enrichment): ScoreResult {
  const reasons = [...base.reasons];
  let score = base.score;

  if (e.followingCount >= 1000 && e.followerCount <= e.followingCount / 20) {
    score += C.W_MASS_FOLLOW; reasons.push("mass-follow, no audience");
  }
  if (e.mediaCount === 0) { score += C.W_ZERO_POSTS; reasons.push("zero posts"); }
  else if (e.mediaCount >= 1 && e.mediaCount <= 3) { score += C.W_FEW_POSTS; reasons.push("very few posts"); }
  if (e.isJoinedRecently) { score += C.W_JOINED_RECENTLY; reasons.push("recently joined"); }
  if (e.followerCount === 0) { score += C.W_ZERO_FOLLOWERS; reasons.push("zero followers"); }
  if (!e.hasBio && !e.hasExternalUrl) { score += C.W_EMPTY_BIO; reasons.push("empty bio"); }

  return { score: Math.min(score, 100), reasons, isCandidate: true };
}
