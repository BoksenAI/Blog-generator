import { useEffect, useState } from "react";
import { supabase } from "../supabase";
import "./ResetPassword.css";

export default function ResetPassword({ onDone }) {
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendMessage, setSendMessage] = useState("");
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [recoveryError, setRecoveryError] = useState("");

  const [session, setSession] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      try {
        setCheckingRecovery(true);
        setRecoveryError("");

        // 1) If Supabase sent a PKCE code (?code=...), exchange it for a session
        const hasCode = window.location.search.includes("code=");
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) {
            console.error("exchangeCodeForSession error:", error);
            if (isMounted)
              setRecoveryError(error.message || "Invalid reset link.");
          }
        }

        // 2) Then read session (after exchange)
        const { data, error } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (error) {
          console.error("getSession error:", error);
          setSession(null);
          return;
        }

        setSession(data?.session ?? null);
      } finally {
        if (isMounted) setCheckingRecovery(false);
      }
    }

    initSession();

    const { data } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession ?? null);
      }
    );

    return () => {
      isMounted = false;
      data?.subscription?.unsubscribe();
    };
  }, []);

  const handleSendResetEmail = async (e) => {
    e.preventDefault();
    setSendMessage("");

    if (!email) {
      setSendMessage("Please enter your email.");
      return;
    }

    try {
      setIsSending(true);

      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        console.error("resetPasswordForEmail error:", error);
        setSendMessage(error.message || "Failed to send reset email.");
        return;
      }

      setSendMessage(
        "Reset link sent. Please check your email and open the link to set a new password."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setUpdateMessage("");

    if (!newPassword || !confirmPassword) {
      setUpdateMessage("Please enter and confirm your new password.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setUpdateMessage("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setUpdateMessage("Password must be at least 8 characters.");
      return;
    }

    try {
      setIsUpdating(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        console.error("updateUser error:", error);
        setUpdateMessage(error.message || "Failed to update password.");
        return;
      }

      setUpdateMessage("Password updated successfully. You can now log in.");

      // Optional: log out after reset to force fresh login
      await supabase.auth.signOut();

      // Go back to login/main screen
      if (onDone) onDone();
      else window.location.href = "/";
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="reset-page">
      <div className="reset-card">
        <h2>Reset Password</h2>

        {checkingRecovery ? (
          <p className="reset-subtitle">Validating reset link...</p>
        ) : recoveryError ? (
          <>
            <div className="reset-message">{recoveryError}</div>
            <button
              className="reset-secondary"
              onClick={() => (onDone ? onDone() : (window.location.href = "/"))}
            >
              Back
            </button>
          </>
        ) : !session ? (
          <>
            <p className="reset-subtitle">
              Enter your email and we’ll send you a reset link.
            </p>

            <form onSubmit={handleSendResetEmail} className="reset-form">
              <label>Email</label>
              <input
                type="email"
                value={email}
                placeholder="you@example.com"
                onChange={(e) => setEmail(e.target.value)}
              />

              <button type="submit" disabled={isSending}>
                {isSending ? "Sending..." : "Send reset link"}
              </button>

              {sendMessage ? (
                <div className="reset-message">{sendMessage}</div>
              ) : null}
            </form>

            <button
              className="reset-secondary"
              onClick={() => (onDone ? onDone() : (window.location.href = "/"))}
            >
              Back
            </button>
          </>
        ) : (
          <>
            <p className="reset-subtitle">
              Set a new password for your account.
            </p>

            <form onSubmit={handleUpdatePassword} className="reset-form">
              <label>New password</label>
              <input
                type="password"
                value={newPassword}
                placeholder="New password"
                onChange={(e) => setNewPassword(e.target.value)}
              />

              <label>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                placeholder="Confirm password"
                onChange={(e) => setConfirmPassword(e.target.value)}
              />

              <button type="submit" disabled={isUpdating}>
                {isUpdating ? "Updating..." : "Update password"}
              </button>

              {updateMessage ? (
                <div className="reset-message">{updateMessage}</div>
              ) : null}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
