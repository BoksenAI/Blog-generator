import React, { useState } from "react";
import { supabase } from "../supabase";
import "./Login.css";

const Login = ({ onClose, initialMode = "login" }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [msg, setMsg] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [showForgot, setShowForgot] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMsg("");

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        setMsg("Check your email for the confirmation link!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        onClose();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      setForgotMessage("Please enter your email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setForgotMessage(error.message);
    } else {
      setForgotMessage("Password reset email sent. Check your inbox.");
    }
  };

  const switchMode = () => {
    setMode(mode === "login" ? "signup" : "login");
    setError("");
    setMsg("");
    setEmail("");
    setPassword("");
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-card" onClick={(e) => e.stopPropagation()}>
        <button
          className="auth-close"
          onClick={onClose}
          aria-label="Close"
          type="button"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="auth-header">
          <h1 className="auth-title">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to continue to your account"
              : "Get started with your free account"}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleAuth}>
          <div className="form-field">
            <label htmlFor="email" className="form-label">
              Email address
            </label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {error && (
            <div className="auth-message auth-message-error" role="alert">
              {error}
            </div>
          )}

          {msg && (
            <div className="auth-message auth-message-success" role="status">
              {msg}
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <span className="auth-submit-loading">
                <span className="auth-spinner"></span>
                {mode === "login" ? "Signing in..." : "Creating account..."}
              </span>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        {/* Forgot password (only show on login mode) */}
        {mode === "login" && (
          <div className="forgot-wrap">
            <button
              type="button"
              className="forgot-link"
              onClick={() => {
                setShowForgot((prev) => !prev);
                setForgotMessage("");
                setForgotEmail(email || "");
              }}
              disabled={loading}
            >
              Forgot your password?
            </button>

            {showForgot && (
              <div className="forgot-panel">
                <input
                  type="email"
                  className="form-input"
                  placeholder="Enter your email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  disabled={loading}
                  autoComplete="email"
                />

                <button
                  type="button"
                  className="auth-submit"
                  onClick={handleForgotPassword}
                  disabled={loading}
                >
                  Send reset link
                </button>

                {forgotMessage && (
                  <div
                    className="auth-message auth-message-success"
                    role="status"
                  >
                    {forgotMessage}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="auth-footer">
          <span className="auth-footer-text">
            {mode === "login"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="auth-footer-link"
            onClick={switchMode}
            disabled={loading}
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
