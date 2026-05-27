"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";

import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        return;
      }

      window.location.href = "/";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <PillHeader />

      <div className="layout-content-wrapper" style={{ flexDirection: "column" }}>
        <div className="terminal-card" style={{ maxWidth: 420, width: "100%", margin: "0 auto" }}>
          <Link href="/" className="back-home-link">
            ← Back to Home
          </Link>

          <h1 className="auth-heading">Sign In</h1>
          <p className="auth-subheading">
            Enter your credentials to access your watchlist and real-time dashboard.
          </p>

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

            {error && (
              <p className="text-sm text-red-400" style={{ marginTop: 12 }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              className="btn-primary btn-lg btn-full"
              style={{ marginTop: 12 }}
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="auth-footer">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="auth-link">
              Create an account →
            </Link>
          </p>
        </div>
      </div>

      <Footer />
    </>
  );
}