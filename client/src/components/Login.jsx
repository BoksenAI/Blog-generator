
import React, { useState } from "react";
import { supabase } from "../supabase";
import "./Login.css";

const Login = ({ onClose, initialMode = "login" }) => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
    const [msg, setMsg] = useState("");

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
                onClose(); // Close modal on success
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay">
            <div className="login-modal">
                <button className="close-btn" onClick={onClose}>&times;</button>
                <h2>{mode === "login" ? "Welcome Back" : "Create Account"}</h2>

                <form onSubmit={handleAuth}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    {error && <div className="error-text">{error}</div>}
                    {msg && <div className="success-text">{msg}</div>}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? "Loading..." : (mode === "login" ? "Login" : "Sign Up")}
                    </button>
                </form>

                <p className="toggle-mode">
                    {mode === "login" ? "No account? " : "Already have an account? "}
                    <span onClick={() => {
                        setMode(mode === "login" ? "signup" : "login");
                        setError("");
                        setMsg("");
                    }}>
                        {mode === "login" ? "Sign up" : "Login"}
                    </span>
                </p>
            </div>
        </div>
    );
};

export default Login;
