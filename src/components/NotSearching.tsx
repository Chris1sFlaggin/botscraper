import React, { useState, useRef } from 'react';

interface NotSearchingProps {
  onScan?: () => void;
  onScanTarget?: (username: string, cap?: number) => void;
  onImportList?: (file: File) => void;
}

export const NotSearching = ({ onScan, onScanTarget, onImportList }: NotSearchingProps) => {
  const [username, setUsername] = useState("");
  const [cap, setCap] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const startTargetScan = () => {
    const n = cap.trim() === "" ? undefined : Math.max(0, Math.floor(Number(cap)) || 0);
    onScanTarget?.(username, n && n > 0 ? n : undefined);
  };

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
            onKeyDown={e => { if (e.key === "Enter") startTargetScan(); }}
          />
          <input
            type="number"
            min={0}
            className="search-bar"
            placeholder="max followers (vuoto = ∞)"
            title="Stop after N followers. Leave empty for unlimited (scan all followers)."
            value={cap}
            onChange={e => setCap(e.currentTarget.value)}
            onKeyDown={e => { if (e.key === "Enter") startTargetScan(); }}
            style={{ maxWidth: 220 }}
          />
          <button className="button-secondary" onClick={startTargetScan}>
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
