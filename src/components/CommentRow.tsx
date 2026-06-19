import React from "react";
import { CommentNode } from "../model/comment";
import { UserNode } from "../model/user";

interface CommentRowProps {
  readonly comment: CommentNode;
  readonly isSelected: boolean;
  readonly isWhitelisted: boolean;
  readonly onToggle: (checked: boolean, comment: CommentNode) => void;
  readonly onWhitelist: (author: UserNode) => void;
}

export const CommentRow = ({ comment, isSelected, isWhitelisted, onToggle, onWhitelist }: CommentRowProps) => {
  const a = comment.author;
  return (
    <div className="result-item">
      <img
        src={a.profile_pic_url}
        alt={a.username}
        title={isWhitelisted ? "Whitelisted — click to remove" : "Click to whitelist author"}
        onClick={() => onWhitelist(a)}
        style={{ width: 40, height: 40, borderRadius: "50%", cursor: "pointer", opacity: isWhitelisted ? 0.5 : 1 }}
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <a href={`https://www.instagram.com/${a.username}/`} target="_blank" rel="noreferrer">@{a.username}</a>
        {" · "}
        <a href={`https://www.instagram.com/p/${comment.mediaCode}/`} target="_blank" rel="noreferrer">post</a>
        <p style={{ margin: "4px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{comment.text}</p>
        <small>{comment.reasons.join(" · ")}</small>
      </div>
      <span className="badge" title="bot/spam score">{comment.score}</span>
      <input
        type="checkbox"
        checked={isSelected}
        disabled={isWhitelisted}
        onChange={e => onToggle(e.currentTarget.checked, comment)}
      />
    </div>
  );
};
