"use client";

import { useState } from "react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";


export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Login submission:", { email, password });
    alert("Auth logic will be connected soon! This is a placeholder.");
  };

  return (
    <>
      <PillHeader />
      
      <div className="layout-content-wrapper" style={{ flexDirection: "column" }}>
        <div className="terminal-card" style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          {/* Back to Home Link */}
          <a href="/" className="back-home-link">
            ← Back to Home
          </a>

          {/* Title & Description */}
          <h1 className="auth-heading">Sign In</h1>
          <p className="auth-subheading">
            Enter your credentials to access your watchlist and real-time dashboard.
          </p>

          {/* Main credentials form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                className="input-text"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className="input-text"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "[HIDE]" : "[SHOW]"}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary btn-lg btn-full" style={{ marginTop: 12 }}>
              Sign In
            </button>
          </form>



          {/* Registration link footer */}
          <p className="auth-footer">
            Don't have an account?{" "}
            <a href="/register" className="auth-link">
              Create an account →
            </a>
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
