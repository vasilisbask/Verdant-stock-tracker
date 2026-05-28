"use client";

import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";
import { getCompanyMeta } from "@/lib/stocks";
import DetailModal from "@/components/layout/DetailModal";

/* Types─*/
interface Quote {
  sym: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
  vol: string;
  companyName?: string;
  blinkClass?: string;
}

interface WatchItem {
  sym: string;
  target?: string;
}

/* Market session─ */
function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const et = new Date(utc + 3600000 * -4);
  const h = et.getHours() + et.getMinutes() / 60;
  return h >= 9.5 && h < 16;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/* Stat card */
function StatCard({
  label, value, sub, up, loading, statusClass, icon
}: {
  label: string;
  value: string;
  sub?: string;
  up?: boolean;
  loading?: boolean;
  statusClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`db-stat-card ${statusClass || ""}`}>
      <span className="db-stat-label">
        {icon && <span className="db-stat-icon" style={{ display: "inline-flex", color: "var(--brand-light)" }}>{icon}</span>}
        {label}
      </span>
      {loading ? (
        <span className="skeleton-cell pulse" style={{ width: 72, height: 20, borderRadius: 2, marginTop: 4 }} />
      ) : (
        <span className={`db-stat-value ${up === true ? "up" : up === false ? "down" : ""}`}>
          {value}
        </span>
      )}
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  );
}

/* Quick link card */
function QuickLink({ href, label, desc, icon }: { href: string; label: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="db-quick-link">
      <span className="db-quick-icon">{icon}</span>
      <span className="db-quick-label">{label}</span>
      <span className="db-quick-desc">{desc}</span>
    </Link>
  );
}

/* Main page */
export default function DashboardPage() {
  const { data: session } = useSession();

  const [quotes, setQuotes]       = useState<Record<string, Quote>>({});
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [isLoading, setLoading]   = useState(true);
  const [isError, setError]       = useState(false);
  const [now, setNow]             = useState(new Date());
  const [mounted, setMounted]     = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  /* Live clock */
  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* Load watchlist from localStorage */
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("verdant_watchlist_v1") || "[]");
      setWatchlist(stored);
    } catch { setWatchlist([]); }
  }, []);

  /* Fetch live quotes */
  useEffect(() => {
    let active = true;

    async function fetchQuotes() {
      try {
        const watched = watchlist.map(w => w.sym);
        // Fallback: If watchlist is empty, fetch the Top 50 most active stocks dynamically
        const url = watched.length > 0 
          ? `/api/stocks/quotes?symbols=${watched.join(",")}`
          : `/api/stocks/quotes`;
        
        const res = await fetch(url);
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          setError(false);
          const map: Record<string, Quote> = {};
          (json.data as Quote[]).forEach(q => {
            map[q.sym] = q;
          });
          setQuotes(prev => {
            const next = { ...prev };
            Object.entries(map).forEach(([sym, newQ]) => {
              const old = prev[sym];
              if (!old) { next[sym] = newQ; return; }
              const oldP = parseFloat(old.price);
              const newP = parseFloat(newQ.price);
              if (!isNaN(oldP) && !isNaN(newP) && oldP !== newP) {
                const blinkClass = newP > oldP ? "blink-g" : "blink-r";
                next[sym] = { ...newQ, blinkClass };
                setTimeout(() => {
                  setQuotes(cur => ({ ...cur, [sym]: { ...cur[sym], blinkClass: "" } }));
                }, 1000);
              } else {
                next[sym] = newQ;
              }
            });
            return next;
          });
        } else {
          setError(true);
        }
      } catch {
        setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchQuotes();
    const iv = setInterval(fetchQuotes, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [watchlist]);

  /* Derived stats */
  const allQuotes = Object.values(quotes);
  const sorted    = useMemo(() =>
    [...allQuotes].sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct)),
    [allQuotes]
  );
  const bestStock  = sorted[0];
  const worstStock = sorted[sorted.length - 1];

  const watchedQuotes = watchlist
    .map(w => quotes[w.sym])
    .filter(Boolean) as Quote[];

  const portfolioUp   = watchedQuotes.filter(q => q.up).length;
  const portfolioDown = watchedQuotes.filter(q => !q.up).length;

  const open       = isMarketOpen();
  const greeting   = getGreeting();
  const firstName  = session?.user?.name?.split(" ")[0] ?? "Trader";
  const timeStr    = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  return (
    <>
      <PillHeader />

      <main className="db-page">

        {/* Greeting header */}
        <header className="db-header u0">
          <div className="db-header-left">
            <p className="db-greeting">{greeting}, {firstName}</p>
            <h1 className="db-title">Dashboard</h1>
          </div>
          <div className="db-header-right">
            {mounted ? (
              <>
                <div className="db-clock">{timeStr}</div>
                <div className={`mk-session-badge ${open ? "open" : "closed"}`}>
                  <span className={`live-dot ${open ? "mk-dot--open" : "mk-dot--closed"}`} />
                  {open ? "NYSE Open" : "Market Closed"}
                </div>
              </>
            ) : (
              <>
                <div className="db-clock">—</div>
                <div className="mk-session-badge closed">
                  <span className="live-dot mk-dot--closed" />
                  Market Status —
                </div>
              </>
            )}
          </div>
        </header>

        {/* Stat bar */}
        <div className="db-stat-row u1">
          <StatCard
            label="Watchlist"
            value={`${watchlist.length} stock${watchlist.length !== 1 ? "s" : ""}`}
            sub={watchlist.length > 0 ? `${portfolioUp} up · ${portfolioDown} down` : "None added yet"}
            loading={false}
            statusClass="stat-live"
            icon={
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.5 4H13.5M2.5 8H13.5M2.5 12H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            }
          />
          <StatCard
            label="Best Performer"
            value={bestStock ? `${bestStock.sym} +${bestStock.pct}` : "—"}
            sub={bestStock ? bestStock.price : undefined}
            up={true}
            loading={isLoading}
            statusClass={bestStock ? "stat-up" : undefined}
            icon={
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 13L8 8L13 13M3 8L8 3L13 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Worst Performer"
            value={worstStock ? `${worstStock.sym} ${worstStock.pct}` : "—"}
            sub={worstStock ? worstStock.price : undefined}
            up={false}
            loading={isLoading}
            statusClass={worstStock ? "stat-down" : undefined}
            icon={
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3L8 8L13 3M3 8L8 13L13 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            }
          />
          <StatCard
            label="Data Feed"
            value={isError ? "OFFLINE" : isLoading ? "CONNECTING" : "LIVE"}
            sub="Refreshes every 15s"
            up={isError ? false : undefined}
            loading={false}
            statusClass={isError ? "stat-down" : isLoading ? "stat-warn" : "stat-live"}
            icon={
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.8"/>
                <circle cx="8" cy="8" r="2" fill="currentColor"/>
              </svg>
            }
          />
        </div>

        <div className="db-body">

          {/* Watchlist panel */}
          <section className="db-section db-section--wide u2">
            <div className="db-section-header">
              <h2 className="db-section-title">Your Watchlist</h2>
              <Link href="/watchlist" className="db-section-link">Manage →</Link>
            </div>

            {watchlist.length === 0 ? (
              <div className="db-empty">
                <p className="db-empty-text">No stocks in your watchlist yet.</p>
                <Link href="/watchlist" className="btn-primary btn-sm">Add stocks →</Link>
              </div>
            ) : (
              <div className="db-watch-table">
                <div className="db-watch-header">
                  <span>Symbol</span>
                  <span>Company</span>
                  <span className="right">Price</span>
                  <span className="right">Change</span>
                  <span className="right">Target</span>
                </div>
                {watchlist.map((item, i) => {
                  const q = quotes[item.sym];
                  const currentPrice = q ? parseFloat(q.price.replace(/[^0-9.]/g, "")) : 0;
                  const targetPrice = item.target ? parseFloat(item.target) : 0;
                  const pct = targetPrice > 0 && currentPrice > 0
                    ? Math.min(100, Math.round((currentPrice / targetPrice) * 100))
                    : 0;
                  const isNear = pct >= 90;

                  return (
                    <div
                      key={item.sym}
                      className="db-watch-row"
                      style={{ animationDelay: `${i * 0.04}s`, cursor: "pointer" }}
                      onClick={() => setSelectedSymbol(item.sym)}
                    >
                      <span className="db-watch-sym">{item.sym}</span>
                      <span className="db-watch-name">{q?.companyName ?? item.sym}</span>
                      {q ? (
                        <>
                          <span className={`db-watch-price right ${q.blinkClass || ""}`}>{q.price}</span>
                          <span className={`db-watch-chg right ${q.blinkClass || ""} ${q.up ? "up" : "down"}`}>
                            {q.chg} ({q.pct})
                          </span>
                          <span className="db-watch-target right">
                            {item.target ? (
                              <span className="db-target-gauge-wrap" title={`${pct}% of target reached`}>
                                <span>${targetPrice.toFixed(2)}</span>
                                <span className="db-target-gauge-track">
                                  <span 
                                    className={`db-target-gauge-fill ${isNear ? "near" : "far"}`} 
                                    style={{ width: `${pct}%` }} 
                                  />
                                </span>
                              </span>
                            ) : (
                              <span className="db-watch-no-target">—</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="right"><span className="skeleton-cell pulse" style={{ width: 52, height: 11, marginLeft: "auto" }} /></span>
                          <span className="right"><span className="skeleton-cell pulse" style={{ width: 44, height: 11, marginLeft: "auto" }} /></span>
                          <span className="right">—</span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Right column */}
          <div className="db-sidebar">

            {/* Top movers from all stocks */}
            <section className="db-section u3">
              <div className="db-section-header">
                <h2 className="db-section-title">Today's Movers</h2>
                <Link href="/markets" className="db-section-link">Full view →</Link>
              </div>
              <div className="db-movers">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="db-mover-row db-mover-row--skeleton">
                      <span className="skeleton-cell pulse" style={{ width: 12, height: 11 }} />
                      <span className="skeleton-cell pulse" style={{ width: 36, height: 11 }} />
                      <span className="skeleton-cell pulse" style={{ width: 64, height: 11 }} />
                      <span className="skeleton-cell pulse" style={{ width: 40, height: 11, marginLeft: "auto" }} />
                    </div>
                  ))
                ) : sorted.slice(0, 5).map(q => (
                  <div 
                    key={q.sym} 
                    className="db-mover-row"
                    style={{ cursor: "pointer" }}
                    onClick={() => setSelectedSymbol(q.sym)}
                  >
                    <span className={`db-mover-indicator ${q.up ? "up" : "down"}`}>
                      {q.up ? "▲" : "▼"}
                    </span>
                    <span className="db-mover-sym">{q.sym}</span>
                    <span className="db-mover-name">{q?.companyName ?? q.sym}</span>
                    <span className={`db-mover-pct ${q.up ? "up" : "down"}`}>
                      {q.up ? "+" : ""}{q.pct}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Quick links */}
            <section className="db-section u4">
              <div className="db-section-header">
                <h2 className="db-section-title">Quick Access</h2>
              </div>
              <div className="db-quick-links">
                <QuickLink 
                  href="/screener" 
                  label="Screener"  
                  desc="Filter & sort all equities"   
                  icon={
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="1.5" y="1.5" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M1.5 5.5H14.5M5.5 1.5V14.5" stroke="currentColor" strokeWidth="1.8"/>
                    </svg>
                  } 
                />
                <QuickLink 
                  href="/watchlist" 
                  label="Watchlist" 
                  desc="Manage tracked stocks" 
                  icon={
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.8"/>
                      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.8"/>
                      <path d="M8 0.5V2.5M8 13.5V15.5M0.5 8H2.5M13.5 8H15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    </svg>
                  } 
                />
                <QuickLink 
                  href="/markets"   
                  label="Markets"   
                  desc="Overview & daily movers"   
                  icon={
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 14.5H15M2.5 11.5L6.5 6L10 9L14.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  } 
                />
              </div>
            </section>

          </div>
        </div>

        <p className="sc-footnote u4">
          Prices refresh every 15 seconds · Powered by Yahoo Finance · For informational purposes only
        </p>
      </main>

      <Footer />

      {selectedSymbol && (
        <DetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </>
  );
}
