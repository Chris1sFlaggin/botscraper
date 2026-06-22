import { Enrichment, UserNode } from "../model/user";
import { UNFOLLOWERS_PER_PAGE, WITHOUT_PROFILE_PICTURE_URL_IDS, IG_APP_ID } from "../constants/constants";
import { buildRemovalList } from "./removal-list";
import { ScanningTab } from "../model/scanning-tab";
import { ScanningFilter } from "../model/scanning-filter";
import { UnfollowLogEntry } from "../model/unfollow-log-entry";
import { UnfollowFilter } from "../model/unfollow-filter";
import { CommentNode } from "../model/comment";

export async function copyListToClipboard(nonFollowersList: readonly UserNode[]): Promise<void> {
  const sortedList = [...nonFollowersList].sort((a, b) => (a.username > b.username ? 1 : -1));

  let output = '';
  sortedList.forEach(user => {
    output += user.username + '\n';
  });

  await navigator.clipboard.writeText(output);
  alert('List copied to clipboard!');
}

export function exportToJSON(users: readonly UserNode[]) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(users, null, 2));
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href",     dataStr);
  downloadAnchorNode.setAttribute("download", "instagram_unfollowers.json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

export function exportToCSV(users: readonly UserNode[]) {
  const headers = ['id', 'username', 'full_name', 'score', 'reasons', 'is_verified', 'is_private', 'profile_pic_url'];
  const rows = users.map(user => [
    user.id,
    user.username,
    `"${user.full_name.replace(/"/g, '""')}"`,
    user.score ?? 0,
    `"${(user.reasons ?? []).join('; ')}"`,
    user.is_verified,
    user.is_private,
    user.profile_pic_url
  ]);
  
  const csvContent = "data:text/csv;charset=utf-8," 
    + headers.join(",") + "\n" 
    + rows.map(e => e.join(",")).join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "instagram_unfollowers.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function getMaxPage(nonFollowersList: readonly UserNode[]): number {
  const pageCalc = Math.ceil(nonFollowersList.length / UNFOLLOWERS_PER_PAGE);
  return pageCalc < 1 ? 1 : pageCalc;
}

export function getCurrentPageUnfollowers(nonFollowersList: readonly UserNode[], currentPage: number): readonly UserNode[] {
  // Preserve incoming order (callers pass a score-sorted list).
  return [...nonFollowersList].splice(UNFOLLOWERS_PER_PAGE * (currentPage - 1), UNFOLLOWERS_PER_PAGE);
}

export function isWithoutProfilePicture(user: UserNode): boolean {
  const url = user.profile_pic_url ?? "";
  if (url === "") {
    return true;
  }
  // Instagram serves default/anonymous avatars from static asset paths, not the scontent CDN.
  if (/anonymousUser|rsrc\.php|\/static\//.test(url)) {
    return true;
  }
  return WITHOUT_PROFILE_PICTURE_URL_IDS.some(id => url.includes(id));
}

export function getUsersForDisplay(
  results: readonly UserNode[],
  whitelistedResults: readonly UserNode[],
  currentTab: ScanningTab,
  searchTerm: string,
  filter: ScanningFilter,
): readonly UserNode[] {
  const users: UserNode[] = [];
  for (const result of results) {
    const isWhitelisted = whitelistedResults.find(user => user.id === result.id) !== undefined;
    switch (currentTab) {
      case "non_whitelisted":
        if (isWhitelisted) {
          continue;
        }
        break;
      case "whitelisted":
        if (!isWhitelisted) {
          continue;
        }
        break;
      default:
        assertUnreachable(currentTab);
    }
    if ((result.score ?? 0) < filter.minScore) {
      continue;
    }
    const userMatchesSearchTerm =
      result.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      result.full_name.toLowerCase().includes(searchTerm.toLowerCase());
    if (searchTerm !== "" && !userMatchesSearchTerm) {
      continue;
    }
    users.push(result);
  }
  // Highest bot-score first so the most likely bots surface at the top.
  return [...users].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export function getUnfollowLogForDisplay(log: readonly UnfollowLogEntry[], searchTerm: string, filter: UnfollowFilter) {
  const entries: UnfollowLogEntry[] = [];
  for (const entry of log) {
    if (!filter.showSucceeded && entry.unfollowedSuccessfully) {
      continue;
    }
    if (!filter.showFailed && !entry.unfollowedSuccessfully) {
      continue;
    }
    const userMatchesSearchTerm = entry.user.username.toLowerCase().includes(searchTerm.toLowerCase());
    if (searchTerm !== "" && !userMatchesSearchTerm) {
      continue;
    }
    entries.push(entry);
  }
  return entries;
}

/**
 * When writing a switch-case with a finite number of cases, use this function in the
 * `default` clause of switch-case statements for exhaustive checking. This will make
 * TS complain until ALL cases are handled. For example, if we have a switch-case
 * in-which we evaluate every possible status of a component's state, if we add this
 * to the default clause and then add a new status to the state type, TS will complain
 * and force us to handle it as well, thus avoiding forgetting it.
 */
export function assertUnreachable(_value: never): never {
  throw new Error('Statement should be unreachable');
}

export function sleep(ms: number): Promise<any> {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

// Human-like delay: the base wait plus up to +60% random jitter. Fixed intervals
// are an automation fingerprint; randomizing the gaps looks organic and lowers
// rate-limit / action-block risk. Never waits less than the base.
export function humanSleep(baseMs: number): Promise<any> {
  return sleep(baseMs + Math.floor(Math.random() * baseMs * 0.6));
}

export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length !== 2) {
    return null;
  }
  return parts.pop()!.split(';').shift()!;
}

export function urlGenerator(nextCode?: string): string {
  const ds_user_id = getCookie('ds_user_id');
  if (nextCode === undefined) {
    // First url
    return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24"}`;
  }
  return `https://www.instagram.com/graphql/query/?query_hash=3dec7e2c57367ef3da3d987d89f9dbc8&variables={"id":"${ds_user_id}","include_reel":"true","fetch_mutual":"false","first":"24","after":"${nextCode}"}`;
}

export function unfollowUserUrlGenerator(idToUnfollow: string): string {
  return `https://www.instagram.com/web/friendships/${idToUnfollow}/unfollow/`;
}

export const IG_HEADERS: RequestInit = { headers: { "x-ig-app-id": IG_APP_ID }, credentials: "include" };

export function followersUrlGenerator(targetId: string, maxId?: string): string {
  const base = `https://www.instagram.com/api/v1/friendships/${targetId}/followers/?count=50`;
  return maxId ? `${base}&max_id=${encodeURIComponent(maxId)}` : base;
}

export function profileInfoUrlGenerator(username: string): string {
  return `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`;
}

export function removeFollowerUrlGenerator(idToRemove: string): string {
  // Instagram web uses verb-first friendship actions: friendships/{action}/{id}/
  // (like friendships/destroy/{id}/ for unfollow), NOT friendships/{id}/{action}.
  return `https://www.instagram.com/api/v1/friendships/remove_follower/${idToRemove}/`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApiUserToNode(u: any): UserNode {
  return {
    id: String(u.pk ?? u.id ?? ""),
    username: u.username ?? "",
    full_name: u.full_name ?? "",
    profile_pic_url: u.profile_pic_url ?? "",
    is_private: !!u.is_private,
    is_verified: !!u.is_verified,
    followed_by_viewer: false,
    follows_viewer: true,
    requested_by_viewer: false,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseEnrichment(user: any): Enrichment {
  // -1 = field absent in the response. Tier-2 scoring ignores -1 so missing data never
  // produces a false "zero posts / zero followers" flag.
  return {
    followerCount: user?.edge_followed_by?.count ?? -1,
    followingCount: user?.edge_follow?.count ?? -1,
    mediaCount: user?.edge_owner_to_timeline_media?.count ?? -1,
    isJoinedRecently: !!user?.is_joined_recently,
    hasBio: !!(user?.biography && String(user.biography).trim() !== ""),
    hasExternalUrl: !!user?.external_url,
  };
}

export function friendshipShowUrlGenerator(id: string): string {
  return `https://www.instagram.com/api/v1/friendships/show/${id}/`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseResolvedTarget(json: any): { id: string; username: string; isPrivate: boolean; followerCount: number } | null {
  const user = json?.data?.user;
  if (!user || (user.id === undefined && user.pk === undefined)) {
    return null;
  }
  return {
    id: String(user.id ?? user.pk),
    username: user.username ?? "",
    isPrivate: !!user.is_private,
    // Real follower total, used to seed an honest scan progress bar (web_profile_info exposes it
    // even though the followers-list pages do not). -1 when absent.
    followerCount: user.edge_followed_by?.count ?? -1,
  };
}

export function shouldRemoveAfterShow(
  show: { following: boolean; followed_by: boolean },
  isWhitelisted: boolean,
): boolean {
  return show.followed_by === true && show.following === false && !isWhitelisted;
}

export async function resolveTarget(
  username: string,
): Promise<{ id: string; username: string; isPrivate: boolean; followerCount: number } | null> {
  try {
    const json = await fetch(profileInfoUrlGenerator(username), IG_HEADERS).then(res => res.json());
    return parseResolvedTarget(json);
  } catch (e) {
    console.error("resolveTarget failed for", username, e);
    return null;
  }
}

export function exportRemovalList(
  target: { readonly id: string; readonly username: string },
  bots: readonly UserNode[],
): void {
  const now = new Date().toISOString();
  const list = buildRemovalList(target, bots, now);
  const blob = new Blob([JSON.stringify(list, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `botscraper-removal-${target.username}-${now.split("T")[0]}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function userMediaUrlGenerator(userId: string, maxId?: string): string {
  const base = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=33`;
  return maxId ? `${base}&max_id=${encodeURIComponent(maxId)}` : base;
}

export function mediaCommentsUrlGenerator(mediaId: string, minId?: string): string {
  const base = `https://www.instagram.com/api/v1/media/${mediaId}/comments/?can_support_threading=true&count=50`;
  return minId ? `${base}&min_id=${encodeURIComponent(minId)}` : base;
}

export function bulkDeleteCommentsUrlGenerator(mediaId: string): string {
  return `https://www.instagram.com/api/v1/media/${mediaId}/comments/bulk_delete/`;
}

export function restrictUrlGenerator(): string {
  return `https://www.instagram.com/api/v1/web/restrict_action/restrict/`;
}

export function blockUrlGenerator(userId: string): string {
  return `https://www.instagram.com/api/v1/web/friendships/${userId}/block/`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mapApiCommentToNode(c: any, mediaId: string, mediaCode: string): CommentNode {
  return {
    id: String(c.pk ?? c.id ?? ""),
    mediaId,
    mediaCode,
    text: c.text ?? "",
    createdAt: Number(c.created_at ?? 0),
    likeCount: Number(c.comment_like_count ?? 0),
    author: mapApiUserToNode(c.user ?? {}),
    score: 0,
    reasons: [],
  };
}

export function ownerMatches(dsUserId: string | null, targetId: string): boolean {
  return dsUserId !== null && dsUserId === targetId;
}
