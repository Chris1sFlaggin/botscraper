import React from "react";
import { assertUnreachable, getCurrentPageUnfollowers, getMaxPage, getUsersForDisplay } from "../utils/utils";
import { State } from "../model/state";
import { UserNode } from "../model/user";
import { TIER2_CANDIDATE_THRESHOLD, WHITELISTED_RESULTS_STORAGE_KEY } from "../constants/constants";

export interface SearchingProps {
  state: State;
  setState: (state: State) => void;
  scanningPaused: boolean;
  pauseScan: () => void;
  setMinScore: (n: number) => void;
  setRemovalThreshold: (n: number) => void;
  onDeepScan: () => void;
  toggleUser: (checked: boolean, user: UserNode) => void;
  UserCheckIcon: React.FC;
  UserUncheckIcon: React.FC;
}

const scoreColor = (s: number): string => (s >= 60 ? "#b91c1c" : s >= TIER2_CANDIDATE_THRESHOLD ? "#b45309" : "#334155");

export const Searching = ({
  state,
  setState,
  scanningPaused,
  pauseScan,
  setMinScore,
  setRemovalThreshold,
  onDeepScan,
  toggleUser,
  UserCheckIcon,
  UserUncheckIcon,
}: SearchingProps) => {
  if (state.status !== "scanning") {
    return null;
  }

  const usersForDisplay = getUsersForDisplay(
    state.results,
    state.whitelistedResults,
    state.currentTab,
    state.searchTerm,
    state.filter,
  );

  const candidateCount = state.results.filter(u => (u.score ?? 0) >= TIER2_CANDIDATE_THRESHOLD && !u.enrichment).length;
  const botCount = state.results.filter(u => (u.score ?? 0) >= state.removalThreshold).length;

  return (
    <section className="workspace-layout">
      <aside className="app-sidebar">
        <div className="sidebar-content">
          <div className="panel-heading">
            <span>Bot Scanner</span>
            <strong>{state.percentage}%</strong>
          </div>

          <div className="sidebar-filters-grid">
            <label className="badge m-small" style={{ display: "block" }}>
              Removal threshold: <strong>{state.removalThreshold}</strong> (auto-selects ≥)
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={state.removalThreshold}
                disabled={state.percentage < 100}
                onChange={e => setRemovalThreshold(Number(e.currentTarget.value))}
                style={{ width: "100%" }}
              />
            </label>
            <label className="badge m-small" style={{ display: "block" }}>
              Show only score ≥ <strong>{state.filter.minScore}</strong>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={state.filter.minScore}
                onChange={e => setMinScore(Number(e.currentTarget.value))}
                style={{ width: "100%" }}
              />
            </label>
          </div>

          <div className="sidebar-buttons-grid">
            <button
              className="button-secondary"
              onClick={onDeepScan}
              disabled={state.isEnriching || state.percentage < 100 || candidateCount === 0}
              title="Fetch profile info (followers/following, posts, recently-joined) for flagged candidates"
            >
              {state.isEnriching ? "Deep-scanning…" : `Deep-scan candidates (${candidateCount})`}
            </button>
            <button
              className="button-secondary danger-text"
              onClick={() => setState({ ...state, selectedResults: [] })}
            >
              Clear selection
            </button>
          </div>

          <div className="sidebar-stats metric-stack">
            <p><span>Displayed</span><strong>{usersForDisplay.length}</strong></p>
            <p><span>Total scanned</span><strong>{state.results.length}{state.knownTotal && state.knownTotal > 0 ? ` / ${state.knownTotal}` : ""}</strong></p>
            <p><span>Bots ≥ {state.removalThreshold}</span><strong>{botCount}</strong></p>
            <p><span>Selected</span><strong>{state.selectedResults.length}</strong></p>
            <p className="whitelist-counter"><span>Whitelisted</span><strong>★ {state.whitelistedResults.length}</strong></p>
          </div>

          <div className="sidebar-footer-controls">
            <button className="button-control button-pause" onClick={pauseScan}>
              {scanningPaused ? "Resume" : "Pause"}
            </button>
            <div className="sidebar-pagination">
              <div className="pagination-controls">
                <a onClick={() => { if (state.page - 1 > 0) { setState({ ...state, page: state.page - 1 }); } }}>❮</a>
                <span>{state.page}/{getMaxPage(usersForDisplay)}</span>
                <a onClick={() => { if (state.page < getMaxPage(usersForDisplay)) { setState({ ...state, page: state.page + 1 }); } }}>❯</a>
              </div>
            </div>
          </div>
        </div>

        <button
          className="unfollow"
          onClick={() => {
            if (state.selectedResults.length === 0) {
              alert("Select at least one account to remove");
              return;
            }
            if (!confirm(`Remove ${state.selectedResults.length} follower(s) from this account?`)) {
              return;
            }
            const newState: State = {
              status: "unfollowing",
              searchTerm: state.searchTerm,
              percentage: 0,
              selectedResults: state.selectedResults,
              unfollowLog: [],
              filter: { showSucceeded: true, showFailed: true },
            };
            setState(newState);
          }}
        >
          Remove ({state.selectedResults.length})
        </button>
      </aside>

      <article className="results-container">
        <nav className="tabs-container">
          <button
            type="button"
            className={`tab ${state.currentTab === "non_whitelisted" ? "tab-active" : ""}`}
            onClick={() => {
              if (state.currentTab === "non_whitelisted") {
                return;
              }
              setState({ ...state, currentTab: "non_whitelisted", page: 1 });
            }}
          >
            Non-Whitelisted
          </button>
          <button
            type="button"
            className={`tab ${state.currentTab === "whitelisted" ? "tab-active" : ""}`}
            onClick={() => {
              if (state.currentTab === "whitelisted") {
                return;
              }
              setState({ ...state, currentTab: "whitelisted", page: 1 });
            }}
          >
            Whitelisted
          </button>
        </nav>
        {getCurrentPageUnfollowers(usersForDisplay, state.page).map(user => {
          const score = user.score ?? 0;
          return (
            <label className="result-item" key={user.id}>
              <div className="flex grow align-center">
                <div
                  className="avatar-container"
                  onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    let whitelistedResults: readonly UserNode[] = [];
                    switch (state.currentTab) {
                      case "non_whitelisted":
                        whitelistedResults = [...state.whitelistedResults, user];
                        break;
                      case "whitelisted":
                        whitelistedResults = state.whitelistedResults.filter(result => result.id !== user.id);
                        break;
                      default:
                        assertUnreachable(state.currentTab);
                    }
                    localStorage.setItem(WHITELISTED_RESULTS_STORAGE_KEY, JSON.stringify(whitelistedResults));
                    setState({ ...state, whitelistedResults });
                  }}
                >
                  <img className="avatar" alt={user.username} src={user.profile_pic_url} />
                  <span className="avatar-icon-overlay-container">
                    {state.currentTab === "non_whitelisted" ? <UserCheckIcon /> : <UserUncheckIcon />}
                  </span>
                </div>
                <div className="flex column m-medium">
                  <a className="fs-xlarge" target="_blank" href={`/${user.username}`} rel="noreferrer">
                    {user.username}
                  </a>
                  <span className="fs-medium">{user.full_name}</span>
                </div>
                <div
                  title={(user.reasons ?? []).join(", ") || "no flags"}
                  style={{
                    background: scoreColor(score),
                    color: "#fff",
                    borderRadius: "6px",
                    padding: "2px 8px",
                    fontWeight: 700,
                    fontSize: "12px",
                    minWidth: "34px",
                    textAlign: "center",
                  }}
                >
                  {score}
                </div>
                {user.is_verified && <div className="verified-badge">✔</div>}
                {user.is_private && (
                  <div className="flex justify-center">
                    <span className="private-indicator">Private</span>
                  </div>
                )}
              </div>
              <div className="flex align-center gap-small">
                <input
                  className="account-checkbox"
                  type="checkbox"
                  checked={state.selectedResults.some(s => s.id === user.id)}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => toggleUser(e.currentTarget.checked, user)}
                />
              </div>
            </label>
          );
        })}
      </article>
    </section>
  );
};
