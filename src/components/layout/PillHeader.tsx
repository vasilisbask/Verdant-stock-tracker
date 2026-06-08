"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";

export default function PillHeader() {
  const [scrolled, setScrolled] = useState(false);
  const { data: session, status } = useSession();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; title: string; message: string } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 32);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Poll notifications
  useEffect(() => {
    if (!session) return;

    let active = true;
    let lastCount = 0;

    async function fetchUnread() {
      try {
        const res = await fetch("/api/alerts/unread");
        if (res.ok && active) {
          const json = await res.json();
          setUnreadCount(json.unreadCount);
          setNotifications(json.notifications || []);
          
          if (json.unreadCount > lastCount) {
            // A new alert has triggered! Show the most recent one as toast
            const latest = json.notifications?.[0];
            if (latest && !latest.read) {
              setToast({ id: latest.id, title: latest.title, message: latest.message });
              setTimeout(() => setToast(null), 5000);
            }
          }
          lastCount = json.unreadCount;
        }
      } catch (err) {
        console.error("Failed to fetch unread alerts:", err);
      }
    }

    fetchUnread();
    const iv = setInterval(fetchUnread, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [session]);

  // Handle clicking outside dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("Failed to mark notifications as read:", err);
    }
  };

  const links = session
    ? [
        { label: "Portfolio", href: "/portfolio" },
        { label: "Screener", href: "/screener" },
        { label: "Watchlist", href: "/watchlist" },
        { label: "Markets", href: "/markets" },
      ]
    : [
        { label: "Screener", href: "/screener" },
        { label: "Watchlist", href: "/watchlist" },
        { label: "Markets", href: "/markets" },
      ];

  return (
    <>
      <header className={`pill-header ${scrolled ? "scrolled" : ""}`}>
        <div className="pill-header-container">
          {/* Logo */}
          <a href="/" className="logo-area">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)" }} className="brand-logo-svg">
              <circle cx="8" cy="8" r="7" stroke="rgba(176, 228, 204, 0.25)" strokeWidth="1"/>
              <line x1="8" y1="1" x2="8" y2="15" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
              <line x1="1" y1="8" x2="15" y2="8" stroke="rgba(176, 228, 204, 0.4)" strokeWidth="1"/>
              <circle cx="8" cy="8" r="2.5" fill="#B0E4CC"/>
            </svg>
            <span className="logo-text">Verdant</span>
          </a>

          {/* Navigation */}
          <nav className="nav-links" style={{ display: "flex", alignItems: "center" }}>
            {status === "loading" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 14px" }}>
                <span className="skeleton-cell pulse" style={{ width: "55px", height: "14px", borderRadius: "4px" }} />
                <span className="skeleton-cell pulse" style={{ width: "55px", height: "14px", borderRadius: "4px" }} />
                <span className="skeleton-cell pulse" style={{ width: "55px", height: "14px", borderRadius: "4px" }} />
                <span className="skeleton-cell pulse" style={{ width: "55px", height: "14px", borderRadius: "4px" }} />
              </div>
            ) : (
              links.map(link => (
                <a key={link.href} href={link.href} className="nav-link">
                  {link.label}
                </a>
              ))
            )}

            <span className="nav-divider" />

            {status === "loading" ? (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingLeft: "10px", paddingRight: "6px" }}>
                <span className="skeleton-cell pulse" style={{ width: "50px", height: "28px", borderRadius: "100px" }} />
                <span className="skeleton-cell pulse" style={{ width: "100px", height: "28px", borderRadius: "100px" }} />
              </div>
            ) : session ? (
              <>
                {/* Notification Bell Icon */}
                <div ref={dropdownRef} className="bell-container" style={{ position: "relative", marginRight: "12px", display: "flex", alignItems: "center" }}>
                  <button 
                    onClick={() => setDropdownOpen(!dropdownOpen)} 
                    className={`bell-btn ${dropdownOpen ? "active" : ""}`}
                    aria-label="Toggle notifications"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-2)",
                      cursor: "pointer",
                      padding: "6px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s"
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                    </svg>
                    {unreadCount > 0 && (
                      <span className="bell-badge" style={{
                        position: "absolute",
                        top: "2px",
                        right: "2px",
                        background: "var(--mint)",
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        boxShadow: "0 0 0 2px var(--bg-raised)"
                      }} />
                    )}
                  </button>
 
                  {/* Dropdown panel */}
                  {dropdownOpen && (
                    <div className="notifications-dropdown" style={{
                      position: "absolute",
                      top: "calc(100% + 8px)",
                      right: "-10px",
                      width: "320px",
                      background: "rgba(17, 31, 28, 0.98)",
                      backdropFilter: "blur(20px)",
                      WebkitBackdropFilter: "blur(20px)",
                      border: "1px solid var(--rule-light)",
                      borderRadius: "8px",
                      boxShadow: "0 12px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
                      zIndex: 1000,
                      overflow: "hidden",
                      animation: "slideDown 0.2s ease-out"
                    }}>
                      <div className="dropdown-header" style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 16px",
                        background: "rgba(176, 228, 204, 0.04)"
                      }}>
                        <span style={{ fontWeight: "600", fontSize: "0.9rem", color: "var(--ink)" }}>Alerts</span>
                        {unreadCount > 0 && (
                          <button 
                            onClick={handleMarkAllAsRead} 
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--mint)",
                              fontSize: "0.8rem",
                              cursor: "pointer",
                              padding: 0,
                              fontWeight: "500"
                            }}
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div style={{ height: "1px", background: "var(--rule-light)" }} />
                      <div className="dropdown-list" style={{ maxHeight: "280px", overflowY: "auto" }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--ink-2)", fontSize: "0.85rem" }}>
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={`dropdown-item ${!n.read ? 'unread' : ''}`}
                              style={{
                                padding: "12px 16px",
                                borderBottom: "1px solid var(--rule-light)",
                                background: n.read ? "transparent" : "rgba(176, 228, 204, 0.03)",
                                transition: "background 0.2s"
                              }}
                            >
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                                <span style={{ fontWeight: "600", fontSize: "0.85rem", color: n.read ? "var(--ink)" : "var(--brand-light)" }}>
                                  {n.title}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "var(--ink-2)" }}>
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: "1.4" }}>
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

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

      {/* Floating In-App Toast Alert */}
      {toast && (
        <div 
          className="in-app-toast"
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "rgba(18, 24, 22, 0.95)",
            border: "1px solid var(--mint)",
            borderRadius: "8px",
            padding: "16px 20px",
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
            zIndex: 10000,
            maxWidth: "360px",
            backdropFilter: "blur(8px)",
            animation: "slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ color: "var(--mint)", display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              </span>
              <strong style={{ fontSize: "0.85rem", color: "var(--ink)" }}>{toast.title}</strong>
            </div>
            <button 
              onClick={() => setToast(null)}
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                padding: 0,
                fontSize: "1rem",
                lineHeight: 1
              }}
            >
              &times;
            </button>
          </div>
          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: "1.4" }}>
            {toast.message}
          </p>
        </div>
      )}

      {/* Embedded Animations */}
      <style jsx global>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(50px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .bell-btn:hover {
          color: var(--mint) !important;
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .bell-btn.active {
          color: var(--mint) !important;
        }
        .dropdown-item:hover {
          background: rgba(255, 255, 255, 0.01) !important;
        }
      `}</style>
    </>
  );
}

