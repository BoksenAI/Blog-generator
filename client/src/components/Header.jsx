
import React, { useState } from "react";
import "./Header.css";

const Header = ({ session, onLogout, showHistory, setShowHistory, onLoginClick, onSignUpClick }) => {
    return (
        <header className="app-header">
            <div className="logo" onClick={() => setShowHistory(false)} style={{ cursor: "pointer" }}>
                <h1>Blog Generator</h1>
            </div>
            <nav className="nav-links">
                {session ? (
                    <>
                        <button
                            className={`nav-btn ${!showHistory ? "active" : ""}`}
                            onClick={() => setShowHistory(false)}
                        >
                            Generator
                        </button>
                        <button
                            className={`nav-btn ${showHistory ? "active" : ""}`}
                            onClick={() => setShowHistory(true)}
                        >
                            My History
                        </button>
                        <button className="nav-btn logout-btn" onClick={onLogout}>
                            Logout
                        </button>
                    </>
                ) : (
                    <>
                        <button className="nav-btn login-btn" onClick={onLoginClick}>
                            Login
                        </button>
                        <button className="nav-btn signup-btn" onClick={onSignUpClick}>
                            Sign Up
                        </button>
                    </>
                )}
            </nav>
        </header>
    );
};

export default Header;
