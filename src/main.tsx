import React, { ChangeEvent, useEffect, useState } from "react";
import { render } from "react-dom";
import "./styles.scss";

import { Typename, UserNode } from "./model/user";
import { Toast } from "./components/Toast";
import { UserCheckIcon } from "./components/icons/UserCheckIcon";
import { UserUncheckIcon } from "./components/icons/UserUncheckIcon";
import {
  DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
  DEFAULT_TIME_BETWEEN_UNFOLLOWS,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
  DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
  INSTAGRAM_HOSTNAME,
  DEFAULT_REMOVAL_THRESHOLD,
  DEEP_SCAN_CAP,
  TIER2_CANDIDATE_THRESHOLD,
  TIME_BETWEEN_ENRICH,
  TIME_AFTER_TWENTY_ENRICH,
  IG_APP_ID,
} from "./constants/constants";
import {
  assertUnreachable,
  getCookie,
  getCurrentPageUnfollowers,
  getUsersForDisplay,
  sleep,
  urlGenerator,
  followersUrlGenerator,
  profileInfoUrlGenerator,
  removeFollowerUrlGenerator,
  mapApiUserToNode,
  parseEnrichment,
  IG_HEADERS,
} from "./utils/utils";
import { scoreTier1, scoreTier2 } from "./utils/bot-score";
import { NotSearching } from "./components/NotSearching";
import { State } from "./model/state";
import { Searching } from "./components/Searching";
import { Toolbar } from "./components/Toolbar";
import { Unfollowing } from "./components/Unfollowing";
import { Timings } from "./model/timings";
import { loadWhitelist, saveWhitelist, loadTimings, saveTimings } from "./utils/whitelist-manager";

const LOCAL_PREVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const isLocalPreview = LOCAL_PREVIEW_HOSTS.has(location.hostname);

const _avatarUrl = (seed: string): string =>
  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=0f172a,1f2937,312e81&fontFamily=Verdana`;

const _createPreviewUser = (
  id: string,
  username: string,
  fullName: string,
  options: { readonly isPrivate?: boolean; readonly isVerified?: boolean; readonly score?: number; readonly reasons?: readonly string[] } = {},
): UserNode => ({
  id,
  username,
  full_name: fullName,
  profile_pic_url: _avatarUrl(username),
  is_private: options.isPrivate ?? false,
  is_verified: options.isVerified ?? false,
  followed_by_viewer: true,
  follows_viewer: true,
  requested_by_viewer: false,
  score: options.score ?? 0,
  reasons: options.reasons ?? [],
  reel: {
    id,
    expiring_at: 0,
    has_pride_media: false,
    latest_reel_media: 0,
    seen: null,
    owner: {
      __typename: Typename.GraphUser,
      id,
      profile_pic_url: _avatarUrl(username),
      username,
    },
  },
});

const _getPreviewUsers = (): readonly UserNode[] => [
  _createPreviewUser("1", "asdkj82910472", "", { isPrivate: true, score: 85, reasons: ["no profile pic", "gibberish username", "empty name"] }),
  _createPreviewUser("2", "free.followers.now", "FREE FOLLOWERS link in bio", { score: 70, reasons: ["spam in name"] }),
  _createPreviewUser("3", "user99381722", "user99381722", { score: 60, reasons: ["many digits in username", "name equals username"] }),
  _createPreviewUser("4", "citrus.archive", "Mara Kim", { score: 0, reasons: [] }),
  _createPreviewUser("5", "elias.market", "Elias Noor", { isVerified: true, score: 0, reasons: [] }),
  _createPreviewUser("6", "fieldnotes.studio", "Nadia Reyes", { score: 10, reasons: [] }),
  _createPreviewUser("7", "glint.supply", "Remy Park", { score: 0, reasons: [] }),
  _createPreviewUser("8", "harbor.sequence", "Ivy Chen", { isPrivate: true, score: 30, reasons: ["private + suspect"] }),
];

// pause
let scanningPaused = false;

function pauseScan() {
  scanningPaused = !scanningPaused;
}

function App() {
  const [state, setState] = useState<State>({
    ...(
      isLocalPreview && new URLSearchParams(location.search).get("preview") === "scanning"
        ? {
          status: "scanning",
          mode: "self",
          page: 1,
          searchTerm: "",
          currentTab: "non_whitelisted",
          percentage: 100,
          results: _getPreviewUsers(),
          selectedResults: _getPreviewUsers().filter(u => (u.score ?? 0) >= DEFAULT_REMOVAL_THRESHOLD),
          whitelistedResults: [],
          filter: { minScore: 0 },
          removalThreshold: DEFAULT_REMOVAL_THRESHOLD,
          mutualIds: new Set<string>(),
          isEnriching: false,
        } as State
        : { status: "initial" as const }
    ),
  });

  const [toast, setToast] = useState<{ readonly show: false } | { readonly show: true; readonly text: string }>({
    show: false,
  });

  const [timings, setTimings] = useState<Timings>(() => {
    const storedTimings = loadTimings();
    return storedTimings ?? {
      timeBetweenSearchCycles: DEFAULT_TIME_BETWEEN_SEARCH_CYCLES,
      timeToWaitAfterFiveSearchCycles: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES,
      timeBetweenUnfollows: DEFAULT_TIME_BETWEEN_UNFOLLOWS,
      timeToWaitAfterFiveUnfollows: DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS,
    };
  });

  // Save timings whenever they change
  useEffect(() => {
    saveTimings(timings);
  }, [timings]);

  let isActiveProcess: boolean;
  switch (state.status) {
    case "initial":
      isActiveProcess = false;
      break;
    case "scanning":
    case "unfollowing":
      isActiveProcess = state.percentage < 100;
      break;
    default:
      assertUnreachable(state);
  }

  const onScan = async () => {
    if (state.status !== "initial") {
      return;
    }
    if (isLocalPreview) {
      const previewUsers = _getPreviewUsers();
      setState({
        status: "scanning",
        mode: "self",
        page: 1,
        searchTerm: "",
        currentTab: "non_whitelisted",
        percentage: 100,
        results: previewUsers,
        selectedResults: previewUsers.filter(u => (u.score ?? 0) >= DEFAULT_REMOVAL_THRESHOLD),
        whitelistedResults: [],
        filter: { minScore: 0 },
        removalThreshold: DEFAULT_REMOVAL_THRESHOLD,
        mutualIds: new Set<string>(),
        isEnriching: false,
      });
      return;
    }
    const whitelistedResults = loadWhitelist();
    setState({
      status: "scanning",
      mode: "self",
      page: 1,
      searchTerm: "",
      currentTab: "non_whitelisted",
      percentage: 0,
      results: [],
      selectedResults: [],
      whitelistedResults,
      filter: { minScore: 0 },
      removalThreshold: DEFAULT_REMOVAL_THRESHOLD,
      mutualIds: new Set<string>(),
      isEnriching: false,
    });
  };

  // Display filter: hide results below this bot-score.
  const setMinScore = (minScore: number) => {
    if (state.status !== "scanning") {
      return;
    }
    setState({ ...state, filter: { minScore } });
  };

  // Removal threshold slider: also auto-selects every (non-whitelisted) result at/above it.
  const setRemovalThreshold = (threshold: number) => {
    if (state.status !== "scanning") {
      return;
    }
    const whitelistIds = new Set(state.whitelistedResults.map(u => u.id));
    const selectedResults = state.results.filter(u => (u.score ?? 0) >= threshold && !whitelistIds.has(u.id));
    setState({ ...state, removalThreshold: threshold, selectedResults });
  };

  const onDeepScan = () => {
    if (state.status !== "scanning") {
      return;
    }
    setState({ ...state, isEnriching: true });
  };

  const handleUnfollowFilter = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "unfollowing") {
      return;
    }
    setState({
      ...state,
      filter: {
        ...state.filter,
        [e.currentTarget.name]: e.currentTarget.checked,
      },
    });
  };

  const toggleUser = (newStatus: boolean, user: UserNode) => {
    if (state.status !== "scanning") {
      return;
    }
    if (newStatus) {
      setState({
        ...state,
        selectedResults: [...state.selectedResults, user],
      });
    } else {
      setState({
        ...state,
        selectedResults: state.selectedResults.filter(result => result.id !== user.id),
      });
    }
  };

  const toggleAllUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "scanning") {
      return;
    }
    const displayed = getUsersForDisplay(
      state.results,
      state.whitelistedResults,
      state.currentTab,
      state.searchTerm,
      state.filter,
    );
    if (e.currentTarget.checked) {
      const currentIds = new Set(state.selectedResults.map(u => u.id));
      const toAdd = displayed.filter(u => !currentIds.has(u.id));
      setState({
        ...state,
        selectedResults: [...state.selectedResults, ...toAdd],
      });
    } else {
      const displayedIds = new Set(displayed.map(u => u.id));
      setState({
        ...state,
        selectedResults: state.selectedResults.filter(u => !displayedIds.has(u.id)),
      });
    }
  };

  // it will work the same as toggleAllUsers, but it will select everyone on the current page.
  const toggleCurrentePageUsers = (e: ChangeEvent<HTMLInputElement>) => {
    if (state.status !== "scanning") {
      return;
    }
    const pageUsers = getCurrentPageUnfollowers(
      getUsersForDisplay(
        state.results,
        state.whitelistedResults,
        state.currentTab,
        state.searchTerm,
        state.filter,
      ),
      state.page,
    );
    if (e.currentTarget.checked) {
      const currentIds = new Set(state.selectedResults.map(u => u.id));
      const toAdd = pageUsers.filter(u => !currentIds.has(u.id));
      setState({
        ...state,
        selectedResults: [...state.selectedResults, ...toAdd],
      });
    } else {
      const pageUserIds = new Set(pageUsers.map(u => u.id));
      setState({
        ...state,
        selectedResults: state.selectedResults.filter(u => !pageUserIds.has(u.id)),
      });
    }
  };

  const onWhitelistUpdate = (updatedWhitelist: readonly UserNode[]) => {
    saveWhitelist(updatedWhitelist);
    if (state.status === "scanning") {
      setState({
        ...state,
        whitelistedResults: updatedWhitelist,
      });
    }
  };

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isActiveProcess) {
        return;
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      e = e || window.event;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (e) {
        e.returnValue = "Changes you made may not be saved.";
      }
      return "Changes you made may not be saved.";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isActiveProcess, state]);

  // SCAN: pre-scan following (for mutual detection), then page followers and score each (Tier 1).
  useEffect(() => {
    const scan = async () => {
      if (state.status !== "scanning" || isLocalPreview) {
        return;
      }

      // 1) Pre-scan the account's *following* list (usually small) to build a mutual set.
      const mutualIds = new Set<string>();
      try {
        let followUrl = urlGenerator();
        let followHasNext = true;
        while (followHasNext) {
          const data = (await fetch(followUrl).then(res => res.json())).data.user.edge_follow;
          data.edges.forEach((edge: { node: { id: string } }) => mutualIds.add(edge.node.id));
          followHasNext = data.page_info.has_next_page;
          followUrl = urlGenerator(data.page_info.end_cursor);
          await sleep(800);
        }
      } catch (e) {
        console.error("Following pre-scan failed; mutuals may not be excluded.", e);
      }

      // 2) Page through followers, score Tier 1 on each.
      const results: UserNode[] = [];
      let maxId: string | undefined = undefined;
      let hasNext = true;
      let total = -1;
      let done = 0;
      let scrollCycle = 0;
      const scanTargetId = getCookie("ds_user_id") ?? "";

      while (hasNext) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let json: any;
        try {
          json = await fetch(followersUrlGenerator(scanTargetId, maxId), IG_HEADERS).then(res => res.json());
        } catch (e) {
          console.error(e);
          break;
        }
        if (total === -1) {
          total = json.user_count ?? -1;
        }
        const apiUsers: unknown[] = json.users ?? [];
        for (const apiU of apiUsers) {
          const node = mapApiUserToNode(apiU);
          const r = scoreTier1(node, mutualIds.has(node.id));
          results.push({ ...node, score: r.score, reasons: r.reasons });
        }
        done += apiUsers.length;
        maxId = json.next_max_id;
        hasNext = !!maxId;

        const pct = total > 0
          ? Math.min(99, Math.round((done / total) * 100))
          : Math.min(99, Math.round((done / (done + 100)) * 100));

        setState(prevState => {
          if (prevState.status !== "scanning") {
            return prevState;
          }
          return { ...prevState, percentage: pct, results: [...results], mutualIds };
        });

        while (scanningPaused) {
          await sleep(1000);
          console.info("Scan paused");
        }

        const microPause = Math.floor(Math.random() * 1500) + 500;
        await sleep(microPause);
        await sleep(Math.floor(Math.random() * (timings.timeBetweenSearchCycles - timings.timeBetweenSearchCycles * 0.7)) + timings.timeBetweenSearchCycles);

        scrollCycle++;
        if (scrollCycle > 6) {
          scrollCycle = 0;
          const longSleepVar = Math.max(0, timings.timeToWaitAfterFiveSearchCycles + (Math.random() * 10000 - 5000));
          setToast({ show: true, text: `Sleeping ${Math.round(longSleepVar / 1000)} seconds to prevent getting temp blocked` });
          await sleep(longSleepVar);
        }
        setToast({ show: false });
      }

      setState(prevState => prevState.status !== "scanning" ? prevState : { ...prevState, percentage: 100, results: [...results], mutualIds });
      setToast({ show: true, text: "Scanning completed!" });
    };
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // DEEP SCAN: enrich Tier-1 candidates with a per-profile fetch and recompute Tier-2 score.
  useEffect(() => {
    const deepScan = async () => {
      if (state.status !== "scanning" || !state.isEnriching || isLocalPreview) {
        return;
      }
      const candidates = state.results
        .filter(u => (u.score ?? 0) >= TIER2_CANDIDATE_THRESHOLD && !u.enrichment)
        .slice()
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, DEEP_SCAN_CAP);

      let i = 0;
      for (const cand of candidates) {
        i += 1;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const json: any = await fetch(profileInfoUrlGenerator(cand.username), IG_HEADERS).then(res => res.json());
          const enrichment = parseEnrichment(json?.data?.user);
          const r = scoreTier2(
            { score: cand.score ?? 0, reasons: [...(cand.reasons ?? [])], isCandidate: true },
            enrichment,
          );
          setState(prevState => {
            if (prevState.status !== "scanning") {
              return prevState;
            }
            return {
              ...prevState,
              results: prevState.results.map(u =>
                u.id === cand.id ? { ...u, score: r.score, reasons: r.reasons, enrichment } : u,
              ),
            };
          });
        } catch (e) {
          console.error("Enrichment failed for", cand.username, e);
        }
        setToast({ show: true, text: `Deep-scanning candidates ${i}/${candidates.length}` });
        await sleep(TIME_BETWEEN_ENRICH + Math.floor(Math.random() * 1000));
        if (i % 20 === 0) {
          setToast({ show: true, text: "Pausing to avoid rate limit..." });
          await sleep(TIME_AFTER_TWENTY_ENRICH);
        }
      }

      // Auto-select after deep-scan: every "red" (score >= removal threshold) plus the
      // top "orange" candidates — the orange accounts holding the highest score among oranges.
      setState(prevState => {
        if (prevState.status !== "scanning") {
          return prevState;
        }
        const whitelistIds = new Set(prevState.whitelistedResults.map(u => u.id));
        const eligible = prevState.results.filter(u => !whitelistIds.has(u.id));
        const reds = eligible.filter(u => (u.score ?? 0) >= prevState.removalThreshold);
        const oranges = eligible.filter(u => {
          const s = u.score ?? 0;
          return s >= TIER2_CANDIDATE_THRESHOLD && s < prevState.removalThreshold;
        });
        const maxOrange = oranges.reduce((m, u) => Math.max(m, u.score ?? 0), -1);
        const topOranges = maxOrange >= 0 ? oranges.filter(u => (u.score ?? 0) === maxOrange) : [];
        return { ...prevState, isEnriching: false, selectedResults: [...reds, ...topOranges] };
      });
      setToast({ show: true, text: "Deep-scan complete!" });
    };
    deepScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status === "scanning" && state.isEnriching]);

  // REMOVE: bulk remove_follower on the selected accounts, with anti-block delays.
  useEffect(() => {
    const remove = async () => {
      if (state.status !== "unfollowing" || isLocalPreview) {
        return;
      }

      const csrftoken = getCookie("csrftoken");
      if (csrftoken === null) {
        throw new Error("csrftoken cookie is null");
      }

      let counter = 0;
      for (const user of state.selectedResults) {
        counter += 1;
        const percentage = Math.round((counter / state.selectedResults.length) * 100);
        try {
          const res = await fetch(removeFollowerUrlGenerator(user.id), {
            headers: {
              "content-type": "application/x-www-form-urlencoded",
              "x-csrftoken": csrftoken,
              "x-ig-app-id": IG_APP_ID,
              "x-requested-with": "XMLHttpRequest",
            },
            method: "POST",
            mode: "cors",
            credentials: "include",
          });
          // A non-2xx response does NOT reject the fetch promise, so check it explicitly —
          // otherwise failed removals get logged as successes (the "it doesn't remove" bug).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const body: any = await res.json().catch(() => ({}));
          const removed = res.ok && body?.status === "ok";
          if (!removed) {
            console.error("remove_follower failed:", user.username, "HTTP", res.status, body);
          }
          setState(prevState => {
            if (prevState.status !== "unfollowing") {
              return prevState;
            }
            return {
              ...prevState,
              percentage,
              unfollowLog: [...prevState.unfollowLog, { user, unfollowedSuccessfully: removed }],
            };
          });
        } catch (e) {
          console.error(e);
          setState(prevState => {
            if (prevState.status !== "unfollowing") {
              return prevState;
            }
            return {
              ...prevState,
              percentage,
              unfollowLog: [...prevState.unfollowLog, { user, unfollowedSuccessfully: false }],
            };
          });
        }
        if (user === state.selectedResults[state.selectedResults.length - 1]) {
          break;
        }
        await sleep(Math.floor(Math.random() * (timings.timeBetweenUnfollows * 1.2 - timings.timeBetweenUnfollows)) + timings.timeBetweenUnfollows);

        if (counter % 5 === 0) {
          setToast({ show: true, text: `Sleeping ${timings.timeToWaitAfterFiveUnfollows / 60000} minutes to prevent getting temp blocked` });
          await sleep(timings.timeToWaitAfterFiveUnfollows);
        }
        setToast({ show: false });
      }
    };
    remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  let markup: React.JSX.Element;
  switch (state.status) {
    case "initial":
      markup = <NotSearching onScan={onScan}></NotSearching>;
      break;

    case "scanning": {
      markup = <Searching
        state={state}
        setState={setState}
        scanningPaused={scanningPaused}
        pauseScan={pauseScan}
        setMinScore={setMinScore}
        setRemovalThreshold={setRemovalThreshold}
        onDeepScan={onDeepScan}
        toggleUser={toggleUser}
        UserCheckIcon={UserCheckIcon}
        UserUncheckIcon={UserUncheckIcon}
      ></Searching>;
      break;
    }

    case "unfollowing":
      markup = <Unfollowing
        state={state}
        handleUnfollowFilter={handleUnfollowFilter}
      ></Unfollowing>;
      break;

    default:
      assertUnreachable(state);
  }

  return (
    <main id="main" role="main" className="iu">
      <section className="overlay">
        <Toolbar
          state={state}
          setState={setState}
          isActiveProcess={isActiveProcess}
          toggleAllUsers={toggleAllUsers}
          toggleCurrentePageUsers={toggleCurrentePageUsers}
          setTimings={setTimings}
          currentTimings={timings}
          whitelistedUsers={state.status === "scanning" ? state.whitelistedResults : loadWhitelist()}
          onWhitelistUpdate={onWhitelistUpdate}
        ></Toolbar>

        {markup}

        {toast.show && <Toast show={toast.show} message={toast.text} onClose={() => setToast({ show: false })} />}
      </section>
    </main>
  );
}

if (location.hostname !== INSTAGRAM_HOSTNAME && !isLocalPreview) {
  alert("Can be used only on Instagram routes");
} else {
  document.title = "kura — bot scanner";
  const kuraFont = document.createElement("link");
  kuraFont.rel = "stylesheet";
  kuraFont.href = "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&display=swap";
  document.head.appendChild(kuraFont);
  document.body.innerHTML = "";
  render(<App />, document.body);
}
