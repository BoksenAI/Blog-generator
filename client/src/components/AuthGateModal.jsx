import React from "react";
import "./AuthGateModal.css";

export default function AuthGateModal({
  isOpen,
  reason = "generate",
  onClose,
  onSignUp,
  onSignIn,
  onContinueAsGuest,
}) {
  if (!isOpen) return null;

  const title =
    reason === "download"
      ? "Sign in to keep your drafts"
      : "Sign in to save your work";

  const message =
    reason === "download"
      ? "If you sign in, your drafts and images are saved to your history so you can revisit them later."
      : "If you sign in, your generated blogs and images will be saved to your history so you can access them later.";

  return (
    <div className="authgate-overlay" onClick={onClose}>
      <div className="authgate-modal" onClick={(e) => e.stopPropagation()}>
        <div className="authgate-header">
          <h3>{title}</h3>
          <button
            className="authgate-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p className="authgate-message">{message}</p>

        <div className="authgate-actions">
          <button className="authgate-primary" onClick={onSignUp}>
            Sign up
          </button>
          <button className="authgate-secondary" onClick={onSignIn}>
            Sign in
          </button>
          <button className="authgate-tertiary" onClick={onContinueAsGuest}>
            Continue as guest
          </button>
        </div>

        <div className="authgate-footnote">
          <small>
            Tip: Signing in makes it easier to find previous drafts and reduces
            repeated work.
          </small>
        </div>
      </div>
    </div>
  );
}
