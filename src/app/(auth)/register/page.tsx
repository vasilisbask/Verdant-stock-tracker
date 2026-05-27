"use client";

import { useState } from "react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";


export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    console.log("Registration submission:", { name, email, password });
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
          <h1 className="auth-heading">Create Account</h1>
          <p className="auth-subheading">
            Sign up to start tracking equities, building watchlists, and screening the market.
          </p>

          {/* Main credentials form */}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="name">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                className="input-text"
                placeholder="Alexander Hamilton"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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

            <div className="form-group">
              <label className="form-label" htmlFor="confirm-password">
                Confirm Password
              </label>
              <div className="password-input-wrapper">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  className="input-text"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? "[HIDE]" : "[SHOW]"}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary btn-lg btn-full" style={{ marginTop: 12 }}>
              Create Account
            </button>
          </form>



          {/* Registration link footer */}
          <p className="auth-footer">
            Already have an account?{" "}
            <a href="/login" className="auth-link">
              Sign in →
            </a>
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}
