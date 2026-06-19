import React from "react";
import { CommentNode, AuthorAction } from "../model/comment";
import { UserNode } from "../model/user";
import { CommentRow } from "./CommentRow";
import { getCommentsForDisplay } from "../utils/comment-score";

interface CommentReviewProps {
  readonly results: readonly CommentNode[];
  readonly selectedIds: ReadonlySet<string>;
  readonly whitelistIds: ReadonlySet<string>;
  readonly removalThreshold: number;
  readonly percentage: number;
  readonly isOwner: boolean;
  readonly authorAction: AuthorAction;
  readonly searchTerm: string;
  readonly isEnriching: boolean;
  readonly onSearch: (t: string) => void;
  readonly onThreshold: (n: number) => void;
  readonly onDeepScan: () => void;
  readonly onToggle: (checked: boolean, c: CommentNode) => void;
  readonly onWhitelist: (a: UserNode) => void;
  readonly onAuthorAction: (a: AuthorAction) => void;
  readonly onApply: () => void;
  readonly onExportJSON: () => void;
  readonly onExportCSV: () => void;
}

export const CommentReview = (p: CommentReviewProps) => {
  const display = getCommentsForDisplay(p.results, p.whitelistIds, p.searchTerm);
  const done = p.percentage >= 100;
  return (
    <section className="results-container column">
      {!done && <div className="badge">Scanning… {p.percentage}%</div>}

      <div className="tabs-container align-center">
        <input className="search-bar grow" placeholder="filter by text or @author"
          value={p.searchTerm} onChange={e => p.onSearch(e.currentTarget.value)} />
        <label className="p-small">
          Action threshold: {p.removalThreshold}
          <input type="range" min={0} max={100} value={p.removalThreshold}
            onChange={e => p.onThreshold(Number(e.currentTarget.value))} />
        </label>
        {done && <button className="button-secondary" disabled={p.isEnriching} onClick={p.onDeepScan}>
          {p.isEnriching ? "Deep-scanning…" : "Deep-scan authors"}
        </button>}
      </div>

      {done && (
        <div className="tabs-container align-center">
          {p.isOwner ? (
            <>
              <select value={p.authorAction} onChange={e => p.onAuthorAction(e.currentTarget.value as AuthorAction)}>
                <option value="none">Delete comment only</option>
                <option value="restrict">Delete + Restrict author</option>
                <option value="block">Delete + Block author</option>
                <option value="remove">Delete + Remove follower</option>
              </select>
              <button className="run-scan" onClick={p.onApply}>Apply ({p.selectedIds.size})</button>
            </>
          ) : (
            <span className="badge">Not your account — export only</span>
          )}
          <button className="button-secondary" onClick={p.onExportJSON}>Export JSON</button>
          <button className="button-secondary" onClick={p.onExportCSV}>Export CSV</button>
        </div>
      )}

      <div className="grow">
        {display.map(c => (
          <CommentRow key={c.id} comment={c}
            isSelected={p.selectedIds.has(c.id)}
            isWhitelisted={p.whitelistIds.has(c.author.id)}
            onToggle={p.onToggle} onWhitelist={p.onWhitelist} />
        ))}
        {display.length === 0 && done && <p className="p-medium">No comments to review.</p>}
      </div>
    </section>
  );
};
