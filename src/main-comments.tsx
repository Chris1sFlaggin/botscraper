import React, { useEffect, useState } from "react";
import { render } from "react-dom";
import "./styles.scss";

import { INSTAGRAM_HOSTNAME, IG_APP_ID, COMMENT_ACTION_THRESHOLD,
  COMMENT_CANDIDATE_THRESHOLD, DEEP_SCAN_CAP, TIME_BETWEEN_ENRICH, TIME_AFTER_TWENTY_ENRICH,
  DEFAULT_SCAN_POST_CAP, SCAN_LONG_PAUSE_EVERY_POSTS, SCAN_LONG_PAUSE_EVERY_COMMENT_PAGES,
  AUDIT_PAGE_DELAY, AUDIT_MEDIA_DELAY, COMMENT_WRITE_DELAY, MAX_AUTHOR_ACTIONS_PER_RUN } from "./constants/constants";
import {
  getCookie, sleep, humanSleep, IG_HEADERS, resolveTarget, ownerMatches,
  userMediaUrlGenerator, mediaCommentsUrlGenerator, mapApiCommentToNode,
  bulkDeleteCommentsUrlGenerator, restrictUrlGenerator, blockUrlGenerator,
  removeFollowerUrlGenerator, profileInfoUrlGenerator, parseEnrichment,
} from "./utils/utils";
import { scoreTier1, scoreTier2 } from "./utils/bot-score";
import { scoreComment, refoldWithAuthorScore, markCopypasta } from "./utils/comment-score";
import { loadCommentWhitelist, saveCommentWhitelist } from "./utils/whitelist-manager";
import { exportCommentsJSON, exportCommentsCSV } from "./utils/comment-export";
import { Toast } from "./components/Toast";
import { CommentReview } from "./components/CommentReview";
import { CommentState } from "./model/comment-state";
import { CommentNode, AuthorAction } from "./model/comment";
import { UserNode } from "./model/user";

function App() {
  const [state, setState] = useState<CommentState>({ status: "initial" });
  const [toast, setToast] = useState<{ show: boolean; text: string }>({ show: false, text: "" });
  const [username, setUsername] = useState("");
  const [maxPosts, setMaxPosts] = useState("");
  const [maxComments, setMaxComments] = useState("");

  const onScan = async () => {
    if (state.status !== "initial") return;
    const name = username.trim().replace(/^@/, "");
    if (name === "") { alert("Inserisci uno username."); return; }
    const target = await resolveTarget(name);
    if (target === null) { alert(`Profilo @${name} non trovato.`); return; }
    const isOwner = ownerMatches(getCookie("ds_user_id"), target.id);
    if (!isOwner && !confirm(`Non sei loggato come @${name}. Posso solo scansionare ed esportare (niente delete/azioni). Continuo?`)) return;
    setState({
      status: "scanning",
      target: { id: target.id, username: target.username },
      isOwner,
      maxPosts: maxPosts.trim() === "" ? undefined : Math.max(0, Math.floor(Number(maxPosts)) || 0),
      maxCommentsPerPost: maxComments.trim() === "" ? undefined : Math.max(0, Math.floor(Number(maxComments)) || 0),
      postsScanned: 0, totalPosts: -1, percentage: 0,
      results: [], selectedResults: [], whitelistAuthors: loadCommentWhitelist(),
      searchTerm: "", removalThreshold: COMMENT_ACTION_THRESHOLD,
      authorAction: "none", isEnriching: false,
    });
  };

  // SCAN: page media → page comments per media → score → copypasta → auto-select >= threshold.
  useEffect(() => {
    const scan = async () => {
      if (state.status !== "scanning" || state.percentage > 0 || state.results.length > 0) return;
      // Empty input → a finite default cap, not unlimited: "scan all posts" with no
      // cap is the read-rate-limit foot-gun. Type a bigger number to go further.
      const cap = state.maxPosts && state.maxPosts > 0 ? state.maxPosts : DEFAULT_SCAN_POST_CAP;
      const perPost = state.maxCommentsPerPost && state.maxCommentsPerPost > 0 ? state.maxCommentsPerPost : 0;

      // 1) collect media ids.
      const media: { id: string; code: string }[] = [];
      let mediaMaxId: string | undefined;
      let moreMedia = true;
      while (moreMedia) {
        let json: any;
        try { json = await fetch(userMediaUrlGenerator(state.target.id, mediaMaxId), IG_HEADERS).then(r => r.json()); }
        catch (e) { console.error(e); break; }
        for (const item of (json.items ?? [])) {
          media.push({ id: String(item.pk ?? item.id), code: item.code ?? "" });
          if (cap > 0 && media.length >= cap) break;
        }
        mediaMaxId = json.next_max_id;
        moreMedia = !!mediaMaxId && (cap === 0 || media.length < cap);
        await humanSleep(AUDIT_MEDIA_DELAY);
      }

      // 2) page comments per media, score as we go.
      const all: CommentNode[] = [];
      let processed = 0;
      let commentPages = 0;
      for (const m of media) {
        let minId: string | undefined;
        let count = 0;
        let more = true;
        while (more) {
          let json: any;
          try { json = await fetch(mediaCommentsUrlGenerator(m.id, minId), IG_HEADERS).then(r => r.json()); }
          catch (e) { console.error(e); break; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ingest = (raw: any): void => {
            all.push(scoreComment(mapApiCommentToNode(raw, m.id, m.code), state.target.id));
            count++;
          };
          for (const raw of (json.comments ?? [])) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ingest(raw);
            // include replies when the payload carries them (confirmed default a)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const reply of (raw.child_comments ?? [])) ingest(reply);
            if (perPost > 0 && count >= perPost) break;
          }
          minId = json.next_min_id ?? json.next_max_id;
          more = !!minId && (perPost === 0 || count < perPost);
          await humanSleep(AUDIT_PAGE_DELAY);
          commentPages++;
          if (commentPages % SCAN_LONG_PAUSE_EVERY_COMMENT_PAGES === 0) {
            setToast({ show: true, text: "Pausa anti rate-limit..." });
            await sleep(TIME_AFTER_TWENTY_ENRICH);
          }
        }
        processed++;
        const pct = Math.min(99, Math.round((processed / Math.max(media.length, 1)) * 100));
        setState(prev => prev.status === "scanning"
          ? { ...prev, postsScanned: processed, totalPosts: media.length, percentage: pct, results: markCopypasta(all) }
          : prev);
        setToast({ show: true, text: `Post ${processed}/${media.length} — ${all.length} commenti` });
        if (processed % SCAN_LONG_PAUSE_EVERY_POSTS === 0) {
          setToast({ show: true, text: "Pausa anti rate-limit (post)..." });
          await sleep(TIME_AFTER_TWENTY_ENRICH);
        }
      }

      const scored = markCopypasta(all);
      setState(prev => {
        if (prev.status !== "scanning") return prev;
        const wl = new Set(prev.whitelistAuthors.map(u => u.id));
        const selected = scored.filter(c => c.score >= prev.removalThreshold && !wl.has(c.author.id));
        return { ...prev, percentage: 100, results: scored, selectedResults: selected };
      });
      setToast({ show: true, text: "Scan completato!" });
    };
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // DEEP-SCAN authors: enrich top candidates and re-fold author score.
  useEffect(() => {
    const deep = async () => {
      if (state.status !== "scanning" || !state.isEnriching) return;
      const seen = new Map<string, UserNode>();
      for (const c of state.results) {
        if (c.score >= COMMENT_CANDIDATE_THRESHOLD && !seen.has(c.author.id)) seen.set(c.author.id, c.author);
      }
      // es5 fix #1: Array.from instead of [...seen.values()]
      const authors = Array.from(seen.values()).slice(0, DEEP_SCAN_CAP);
      let i = 0;
      const enriched = new Map<string, number>();
      for (const a of authors) {
        i++;
        try {
          const json: any = await fetch(profileInfoUrlGenerator(a.username), IG_HEADERS).then(r => r.json());
          const base = scoreTier1(a, false);
          const r = scoreTier2({ score: base.score, reasons: [...base.reasons], isCandidate: true }, parseEnrichment(json?.data?.user));
          enriched.set(a.id, r.score);
        } catch (e) { console.error("enrich failed", a.username, e); }
        setToast({ show: true, text: `Deep-scan autori ${i}/${authors.length}` });
        await sleep(TIME_BETWEEN_ENRICH + Math.floor(Math.random() * 1000));
        if (i % 20 === 0) { setToast({ show: true, text: "Pausa anti rate-limit..." }); await sleep(TIME_AFTER_TWENTY_ENRICH); }
      }
      setState(prev => {
        if (prev.status !== "scanning") return prev;
        const results = prev.results.map(c => {
          const a = enriched.get(c.author.id);
          return a === undefined ? c : refoldWithAuthorScore(c, a);
        });
        const wl = new Set(prev.whitelistAuthors.map(u => u.id));
        return {
          ...prev, isEnriching: false, results,
          selectedResults: results.filter(c => c.score >= prev.removalThreshold && !wl.has(c.author.id)),
        };
      });
      setToast({ show: true, text: "Deep-scan completato!" });
    };
    deep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === "scanning" && state.isEnriching]);

  // ACT: group deletes by media (bulk_delete), then per-author action, with anti-block delays.
  useEffect(() => {
    const act = async () => {
      if (state.status !== "acting") return;
      const csrftoken = getCookie("csrftoken");
      if (csrftoken === null) { alert("csrftoken mancante."); return; }
      const headers = {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrftoken": csrftoken, "x-ig-app-id": IG_APP_ID, "x-requested-with": "XMLHttpRequest",
      };
      const post = (url: string, body: string) =>
        fetch(url, { headers, method: "POST", mode: "cors", credentials: "include", body });

      // group work upfront so we can report progress across deletes + author actions
      const byMedia = new Map<string, CommentNode[]>();
      for (const c of state.selectedResults) (byMedia.get(c.mediaId) ?? byMedia.set(c.mediaId, []).get(c.mediaId)!).push(c);
      const deleteGroups = Array.from(byMedia);
      const allAuthorIds = state.authorAction !== "none"
        ? Array.from(new Set(state.selectedResults.map(c => c.author.id)))
        : [];
      // Cap per-author actions (block/restrict/remove) per run: mass actions on the
      // account are the classic action-block/ban trigger. The rest is resumed later.
      const authorIds = allAuthorIds.slice(0, MAX_AUTHOR_ACTIONS_PER_RUN);
      const authorsDeferred = allAuthorIds.length - authorIds.length;
      if (authorsDeferred > 0) {
        alert(`Per sicurezza max ${MAX_AUTHOR_ACTIONS_PER_RUN} azioni autore per volta. ${authorsDeferred} rimandati: rifai l'azione domani sui restanti.`);
      }
      const totalUnits = deleteGroups.length + authorIds.length;
      let unit = 0;
      const bumpProgress = () => {
        unit += 1;
        const pct = totalUnits > 0 ? Math.min(99, Math.round((unit / totalUnits) * 100)) : 99;
        setState(prev => (prev.status === "acting" ? { ...prev, percentage: pct } : prev));
      };

      // delete grouped by media
      const deleted = new Set<string>();
      for (const [mediaId, comments] of deleteGroups) {
        try {
          const res = await post(bulkDeleteCommentsUrlGenerator(mediaId),
            `comment_ids_to_delete=${comments.map(c => c.id).join(",")}`);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body: any = await res.json().catch(() => ({}));
          if (res.ok && body?.status === "ok") comments.forEach(c => deleted.add(c.id));
          else console.error("bulk_delete failed", mediaId, res.status, body);
        } catch (e) { console.error(e); }
        bumpProgress();
        if (unit % 10 === 0) { setToast({ show: true, text: "Pausa anti rate-limit..." }); await sleep(TIME_AFTER_TWENTY_ENRICH); }
        await humanSleep(COMMENT_WRITE_DELAY);
      }

      // author action on unique authors
      const actioned = new Set<string>();
      for (const id of authorIds) {
        try {
          let res: Response;
          if (state.authorAction === "restrict") res = await post(restrictUrlGenerator(), `target_user_id=${id}`);
          else if (state.authorAction === "block") res = await post(blockUrlGenerator(id), "");
          else res = await post(removeFollowerUrlGenerator(id), "");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body: any = await res.json().catch(() => ({}));
          if (res.ok && body?.status === "ok") actioned.add(id);
          else console.error("author action failed", state.authorAction, id, res.status, body);
        } catch (e) { console.error(e); }
        bumpProgress();
        if (unit % 10 === 0) { setToast({ show: true, text: "Pausa anti rate-limit..." }); await sleep(TIME_AFTER_TWENTY_ENRICH); }
        await humanSleep(COMMENT_WRITE_DELAY);
      }

      setState(prev => prev.status === "acting" ? {
        ...prev, percentage: 100,
        actionLog: prev.selectedResults.map(c => ({
          comment: c, commentDeleted: deleted.has(c.id), authorActioned: actioned.has(c.author.id),
        })),
      } : prev);
      setToast({ show: true, text: "Azioni completate." });
    };
    act();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // ---- handlers ----
  const onToggle = (checked: boolean, c: CommentNode) => {
    if (state.status !== "scanning") return;
    setState({ ...state, selectedResults: checked
      ? [...state.selectedResults, c]
      : state.selectedResults.filter(x => x.id !== c.id) });
  };
  const onWhitelist = (a: UserNode) => {
    if (state.status !== "scanning") return;
    const exists = state.whitelistAuthors.some(u => u.id === a.id);
    const next = exists ? state.whitelistAuthors.filter(u => u.id !== a.id) : [...state.whitelistAuthors, a];
    saveCommentWhitelist(next);
    setState({ ...state, whitelistAuthors: next,
      selectedResults: exists ? state.selectedResults : state.selectedResults.filter(c => c.author.id !== a.id) });
  };
  const onThreshold = (n: number) => {
    if (state.status !== "scanning") return;
    const wl = new Set(state.whitelistAuthors.map(u => u.id));
    setState({ ...state, removalThreshold: n,
      selectedResults: state.results.filter(c => c.score >= n && !wl.has(c.author.id)) });
  };
  const onApply = () => {
    if (state.status !== "scanning" || !state.isOwner) return;
    if (!confirm(`Confermi: elimina ${state.selectedResults.length} commenti` +
      (state.authorAction !== "none" ? ` + azione "${state.authorAction}" sugli autori?` : "?"))) return;
    setState({ status: "acting", authorAction: state.authorAction, selectedResults: state.selectedResults, percentage: 0, actionLog: [] });
  };

  let markup: React.JSX.Element;
  if (state.status === "initial") {
    markup = (
      <section className="launch-screen">
        <div className="launch-copy">
          <span className="eyebrow">Comment bot/spam cleanup</span>
          <h1>Scan comments across a profile.</h1>
          <p>Enter the account you manage. Scans every post's comments, scores bot/spam, then review and delete (and optionally restrict/block authors). Not your account → export only.</p>
          <div className="launch-actions">
            <input className="search-bar" placeholder="@account" value={username}
              onChange={e => setUsername(e.currentTarget.value)} />
            <input className="search-bar" type="number" min={0} placeholder="max posts (default 20)" value={maxPosts}
              onChange={e => setMaxPosts(e.currentTarget.value)} style={{ maxWidth: 160 }} />
            <input className="search-bar" type="number" min={0} placeholder="max comments/post (∞)" value={maxComments}
              onChange={e => setMaxComments(e.currentTarget.value)} style={{ maxWidth: 200 }} />
            <button className="run-scan" onClick={onScan}>Scan comments</button>
          </div>
        </div>
      </section>
    );
  } else if (state.status === "scanning") {
    markup = (
      <CommentReview
        results={state.results}
        selectedIds={new Set(state.selectedResults.map(c => c.id))}
        whitelistIds={new Set(state.whitelistAuthors.map(u => u.id))}
        removalThreshold={state.removalThreshold}
        percentage={state.percentage}
        isOwner={state.isOwner}
        authorAction={state.authorAction}
        searchTerm={state.searchTerm}
        isEnriching={state.isEnriching}
        onSearch={t => setState({ ...state, searchTerm: t })}
        onThreshold={onThreshold}
        onDeepScan={() => setState({ ...state, isEnriching: true })}
        onToggle={onToggle}
        onWhitelist={onWhitelist}
        onAuthorAction={(a: AuthorAction) => setState({ ...state, authorAction: a })}
        onApply={onApply}
        onExportJSON={() => exportCommentsJSON(state.target, state.selectedResults)}
        onExportCSV={() => exportCommentsCSV(state.selectedResults)}
      />
    );
  } else {
    const ok = state.actionLog.filter(e => e.commentDeleted).length;
    markup = (
      <section className="results-container column">
        <div className="badge">Applying… {state.percentage}%</div>
        {state.percentage >= 100 && <p className="p-medium">Deleted {ok}/{state.actionLog.length} comments.</p>}
      </section>
    );
  }

  return (
    <main id="main" role="main" className="iu">
      <section className="overlay">
        {markup}
        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false, text: "" })} />}
      </section>
    </main>
  );
}

if (location.hostname !== INSTAGRAM_HOSTNAME) {
  alert("Can be used only on Instagram routes");
} else {
  document.title = "BotScraper — comment scanner";
  document.body.innerHTML = "";
  render(<App />, document.body);
}
