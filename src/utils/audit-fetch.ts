/* eslint-disable @typescript-eslint/no-explicit-any */
import { AuditSnapshot } from "../model/audit";
import { CommentNode } from "../model/comment";
import { emptySnapshot, botPct, dedupeCandidates } from "./audit-engine";
import {
  resolveTarget, followersUrlGenerator, mapApiUserToNode, userMediaUrlGenerator,
  mediaCommentsUrlGenerator, mapApiCommentToNode, IG_HEADERS, sleep,
} from "./utils";
import { scoreTier1 } from "./bot-score";
import { scoreComment, markCopypasta } from "./comment-score";
import * as C from "../constants/constants";

export interface AuditOpts {
  followerSample: number;
  postsScan: number;
}

export async function auditAccount(username: string, opts: AuditOpts): Promise<AuditSnapshot> {
  const scannedAt = new Date().toISOString();
  const target = await resolveTarget(username);
  if (target === null) return emptySnapshot(username, "", scannedAt, "partial", 0);

  const snap = emptySnapshot(target.username, target.id, scannedAt, "ok", target.followerCount);

  // 1) follower sample -> bot%
  const scores: number[] = [];
  let maxId: string | undefined;
  let pages = 0;
  while (scores.length < opts.followerSample) {
    let json: any;
    try { json = await fetch(followersUrlGenerator(target.id, maxId), IG_HEADERS).then(r => r.json()); }
    catch (e) { console.error(e); snap.status = "partial"; break; }
    const users = json.users ?? [];
    if (users.length === 0) {
      if (scores.length === 0 && target.isPrivate) snap.status = "private";
      break;
    }
    for (const u of users) {
      scores.push(scoreTier1(mapApiUserToNode(u), false).score);
      if (scores.length >= opts.followerSample) break;
    }
    maxId = json.next_max_id;
    if (!maxId) break;
    pages++;
    await sleep(1500);
    if (pages % C.MONITOR_PAUSE_EVERY === 0) await sleep(C.TIME_AFTER_TWENTY_ENRICH);
  }
  snap.followersSampled = scores.length;
  snap.botCount = scores.filter(s => s >= C.BOT_SAMPLE_THRESHOLD).length;
  snap.botPct = botPct(scores, C.BOT_SAMPLE_THRESHOLD);

  // 2) recent posts -> spam comments
  const media: { id: string; code: string }[] = [];
  let mediaMaxId: string | undefined;
  while (media.length < opts.postsScan) {
    let json: any;
    try { json = await fetch(userMediaUrlGenerator(target.id, mediaMaxId), IG_HEADERS).then(r => r.json()); }
    catch (e) { console.error(e); snap.status = "partial"; break; }
    for (const it of (json.items ?? [])) {
      media.push({ id: String(it.pk ?? it.id), code: it.code ?? "" });
      if (media.length >= opts.postsScan) break;
    }
    mediaMaxId = json.next_max_id;
    if (!mediaMaxId) break;
    await sleep(1200);
  }
  snap.postsScanned = media.length;

  let comments: CommentNode[] = [];
  for (const m of media) {
    let json: any;
    try { json = await fetch(mediaCommentsUrlGenerator(m.id), IG_HEADERS).then(r => r.json()); }
    catch (e) { console.error(e); snap.status = "partial"; continue; }
    for (const raw of (json.comments ?? [])) {
      comments.push(scoreComment(mapApiCommentToNode(raw, m.id, m.code), target.id));
    }
    await sleep(1500);
  }
  comments = markCopypasta(comments);
  snap.commentsScanned = comments.length;
  snap.spamCount = comments.filter(c => c.score >= C.COMMENT_ACTION_THRESHOLD).length;
  snap.spamPct = comments.length ? snap.spamCount / comments.length : 0;
  return snap;
}

export async function harvestCandidates(
  seed: string, source: "followers" | "commenters", cap: number,
): Promise<string[]> {
  const target = await resolveTarget(seed);
  if (target === null) return [];
  const handles: string[] = [];

  if (source === "followers") {
    let maxId: string | undefined;
    let pages = 0;
    while (handles.length < cap) {
      let json: any;
      try { json = await fetch(followersUrlGenerator(target.id, maxId), IG_HEADERS).then(r => r.json()); }
      catch (e) { console.error(e); break; }
      for (const u of (json.users ?? [])) {
        if (u.username) handles.push(u.username);
        if (handles.length >= cap) break;
      }
      maxId = json.next_max_id;
      if (!maxId) break;
      pages++;
      await sleep(1500);
      if (pages % C.MONITOR_PAUSE_EVERY === 0) await sleep(C.TIME_AFTER_TWENTY_ENRICH);
    }
  } else {
    const media: string[] = [];
    let mediaMaxId: string | undefined;
    while (media.length < C.LEAD_POSTS_SCAN) {
      let json: any;
      try { json = await fetch(userMediaUrlGenerator(target.id, mediaMaxId), IG_HEADERS).then(r => r.json()); }
      catch (e) { console.error(e); break; }
      for (const it of (json.items ?? [])) {
        media.push(String(it.pk ?? it.id));
        if (media.length >= C.LEAD_POSTS_SCAN) break;
      }
      mediaMaxId = json.next_max_id;
      if (!mediaMaxId) break;
      await sleep(1200);
    }
    for (const mid of media) {
      let json: any;
      try { json = await fetch(mediaCommentsUrlGenerator(mid), IG_HEADERS).then(r => r.json()); }
      catch (e) { console.error(e); continue; }
      for (const raw of (json.comments ?? [])) {
        if (raw.user && raw.user.username) handles.push(raw.user.username);
        if (handles.length >= cap) break;
      }
      await sleep(1500);
    }
  }
  return dedupeCandidates(handles);
}
