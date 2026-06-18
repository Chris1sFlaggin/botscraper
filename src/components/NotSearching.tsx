import React, { useState, useRef } from 'react';

interface NotSearchingProps {
  onScan?: () => void;
  onScanTarget?: (username: string) => void;
  onImportList?: (file: File) => void;
}

export const NotSearching = ({ onScan, onScanTarget, onImportList }: NotSearchingProps) => {
  const [username, setUsername] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <section className="launch-screen">
      <div className="launch-copy">
        <span className="eyebrow">Bot follower cleanup</span>
        <h1>Find and remove bot followers.</h1>
        <p>
          Scan this account's followers, or analyze any public profile and export a bot list to
          import later on the target account. Review the flagged list and remove only what you select.
        </p>
        <div className="launch-actions">
          <button className="run-scan" onClick={onScan}>
            Scan Followers
          </button>
          <span className="launch-note">Runs in this browser session only</span>
        </div>

        <div className="launch-actions" style={{ marginTop: 16 }}>
          <input
            type="text"
            className="search-bar"
            placeholder="@public_profile"
            value={username}
            onChange={e => setUsername(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === "Enter" && onScanTarget) onScanTarget(username); }}
          />
          <button className="button-secondary" onClick={() => onScanTarget?.(username)}>
            Scan public profile
          </button>
        </div>

        <div className="launch-actions" style={{ marginTop: 8 }}>
          <button className="button-secondary" onClick={() => fileRef.current?.click()}>
            Import removal list
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={e => {
              const f = e.currentTarget.files?.[0];
              if (f && onImportList) onImportList(f);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
      <div className="launch-panel" aria-hidden="true">
        <div className="scan-orbit"><span /><span /><span /></div>
        <div className="signal-card primary"><span>Ready</span><strong>0%</strong></div>
        <div className="signal-card"><span>Protected</span><strong>Whitelist</strong></div>
        <div className="signal-card accent"><span>Review</span><strong>Select first</strong></div>
      </div>
    </section>
  );
};
