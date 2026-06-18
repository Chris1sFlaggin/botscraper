import React from 'react';

interface NotSearchingProps {
  onScan?: () => void;
  onScanTarget?: (username: string) => void;
  onImportList?: (file: File) => void;
}

export const NotSearching = ({onScan}: NotSearchingProps) => (
  <section className="launch-screen">
    <div className="launch-copy">
      <span className="eyebrow">Bot follower cleanup</span>
      <h1>Find and remove bot followers.</h1>
      <p>
        Scan this account's followers, score each for bot signals, protect whitelisted accounts,
        review the flagged list, and remove only the followers you select.
      </p>
      <div className="launch-actions">
        <button className="run-scan" onClick={onScan}>
          Scan Followers
        </button>
        <span className="launch-note">Runs in this browser session only</span>
      </div>
    </div>
    <div className="launch-panel" aria-hidden="true">
      <div className="scan-orbit">
        <span />
        <span />
        <span />
      </div>
      <div className="signal-card primary">
        <span>Ready</span>
        <strong>0%</strong>
      </div>
      <div className="signal-card">
        <span>Protected</span>
        <strong>Whitelist</strong>
      </div>
      <div className="signal-card accent">
        <span>Review</span>
        <strong>Select first</strong>
      </div>
    </div>
  </section>
);
