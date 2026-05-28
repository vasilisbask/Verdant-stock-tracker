"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export default function PillHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 32);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Determine navigation links based on auth state
  const links = session
    ? ["Dashboard", "Screener", "Watchlist", "Markets"]
    : ["Screener", "Watchlist", "Markets"];

  return (
    <header className={`pill-header ${scrolled ? "scrolled" : ""}`}>
      <div className="pill-header-container">
        {/* Logo */}
        <a href={session ? "/" : "/"} className="logo-area">
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)" }} className="brand-logo-svg">
            <circle cx="8" cy="8" r="7" stroke="rgba(176, 228, 204, 0.25)" strokeWidth="1"/>
            <line x1="8" y1="1" x2="8" y2="15" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
            <line x1="1" y1="8" x2="15" y2="8" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
            <circle cx="8" cy="8" r="2.5" fill="#B0E4CC"/>
          </svg>
          <span className="logo-text">Verdant</span>
        </a>

        {/* Navigation */}
        <nav className="nav-links">
          {links.map(link => (
            <a key={link} href={`/${link.toLowerCase()}`} className="nav-link">
              {link}
            </a>
          ))}

          <span className="nav-divider" />

          {session ? (
            <>
              <span className="user-greeting-pill" style={{ color: "var(--c-txt-muted)", fontSize: "0.85rem", marginRight: "4px" }}>
                {session.user?.name?.split(" ")[0]}
              </span>
              <button onClick={() => signOut({ callbackUrl: "/" })} className="btn-secondary btn-sm" style={{ cursor: "pointer", border: "none", background: "none" }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <a href="/login" className="btn-secondary btn-sm">
                Sign in
              </a>

              <a href="/register" className="btn-primary btn-sm">
                Start tracking →
              </a>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

