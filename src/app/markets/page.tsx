"use client";

import { useState, useEffect, useMemo } from "react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";
import { getCompanyMeta } from "@/lib/stocks";
import DetailModal from "@/components/layout/DetailModal";


interface Quote {
  sym: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
  vol: string;
  pe?: string;
  mkt?: string;
}

const EXCHANGES = [
  { name: "NYSE",    open: "09:30", close: "16:00", tz: "ET",  flag: "🇺🇸" },
  { name: "NASDAQ",  open: "09:30", close: "16:00", tz: "ET",  flag: "🇺🇸" },
  { name: "LSE",     open: "08:00", close: "16:30", tz: "GMT", flag: "🇬🇧" },
  { name: "TSE",     open: "09:00", close: "15:30", tz: "JST", flag: "🇯🇵" },
  { name: "XETRA",   open: "09:00", close: "17:30", tz: "CET", flag: "🇩🇪" },
];

/* Market session helpers */
function getETDate(): Date {
  const tzString = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  return new Date(tzString);
}

function getETHour(): number {
  const et = getETDate();
  return et.getHours() + et.getMinutes() / 60;
}

function isMarketOpen(): boolean {
  const et = getETDate();
  const day = et.getDay(); // 0=Sun, 6=Sat (New York day!)
  if (day === 0 || day === 6) return false;
  const h = et.getHours() + et.getMinutes() / 60;
  return h >= 9.5 && h < 16;
}

function getSessionLabel(): string {
  const et = getETDate();
  const day = et.getDay();
  if (day === 0 || day === 6) return "Weekend — Market Closed";
  const h = et.getHours() + et.getMinutes() / 60;
  if (h < 4) return "Closed — Pre-market starts 04:00 ET";
  if (h < 9.5) return "Pre-market Trading";
  if (h < 16) return "Regular Session Open";
  if (h < 20) return "After-hours Trading";
  return "Closed — Opens 09:30 ET";
}

/* Skeleton row */
function SkeletonRow() {
  return (
    <div className="mk-mover-row mk-mover-row--skeleton">
      <span className="skeleton-cell pulse" style={{ width: 44, height: 12 }} />
      <span className="skeleton-cell pulse" style={{ width: 110, height: 12 }} />
      <span className="skeleton-cell pulse" style={{ width: 52, height: 12, marginLeft: "auto" }} />
      <span className="skeleton-cell pulse" style={{ width: 48, height: 12 }} />
    </div>
  );
}

/* Main page */
export default function MarketsPage() {
  const [quotes, setQuotes]     = useState<Quote[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [isError, setError]     = useState(false);
  const [now, setNow]           = useState(new Date());
  const [mounted, setMounted]   = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  /* Clock tick */
  useEffect(() => {
    setMounted(true);
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  /* Fetch quotes */
  useEffect(() => {
    let active = true;

    async function fetchQuotes() {
      try {
        const res = await fetch("/api/stocks/quotes");
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          setError(false);
          setQuotes(json.data ?? []);
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
  }, []);

  /* Derived: top gainers / losers */
  const sorted = useMemo(() =>
    [...quotes].sort((a, b) => parseFloat(b.pct) - parseFloat(a.pct)),
    [quotes]
  );
  const gainers = sorted.slice(0, 5);
  const losers  = [...sorted].reverse().slice(0, 5);

  /* Derived: sector averages */
  const sectorData = useMemo(() => {
    const map: Record<string, number[]> = {};
    quotes.forEach(q => {
      const s = getCompanyMeta(q.sym).sector || "Other";
      if (!map[s]) map[s] = [];
      map[s].push(parseFloat(q.pct) || 0);
    });
    return Object.entries(map).map(([sector, vals]) => ({
      sector,
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
    })).sort((a, b) => b.avg - a.avg);
  }, [quotes]);

  /* Time display (New York / ET) */
  const timeStr = now.toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateStr = now.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const localTimeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });
  const open = isMarketOpen();
  const sessionLabel = getSessionLabel();

  return (
    <>
      <PillHeader />

      <main className="mk-page">

        {/* Hero banner */}
        <header className="mk-hero u0">
          <div className="mk-hero-left">
            <p className="mk-tag">Markets Overview</p>
            <h1 className="mk-title">The market,<br /><em>right now.</em></h1>
          </div>
          <div className="mk-hero-right">
            {mounted ? (
              <>
                <div className="mk-clock">{timeStr}</div>
                <div className="mk-date">{dateStr} <span className="mk-date-tz">(New York Time)</span></div>
                <div className="mk-local-time">
                  Your time: <span className="mk-local-time-val">{localTimeStr}</span>
                </div>
                <div className={`mk-session-badge ${open ? "open" : "closed"}`}>
                  <span className={`live-dot ${open ? "mk-dot--open" : "mk-dot--closed"}`} />
                  {sessionLabel}
                </div>
              </>
            ) : (
              <>
                <div className="mk-clock">—</div>
                <div className="mk-date">—</div>
                <div className="mk-session-badge closed">
                  <span className="live-dot mk-dot--closed" />
                  Exchange Status —
                </div>
              </>
            )}
          </div>
        </header>

        {/* Status bar */}
        <div className="mk-status-bar u1">
          <div className="mk-status-item">
            <span className="mk-status-label">Data Source</span>
            <span className="mk-status-val">Yahoo Finance</span>
          </div>
          <div className="mk-status-divider" />
          <div className="mk-status-item">
            <span className="mk-status-label">Coverage</span>
            <span className="mk-status-val">{quotes.length} symbols</span>
          </div>
          <div className="mk-status-divider" />
          <div className="mk-status-item">
            <span className="mk-status-label">Refresh</span>
            <span className="mk-status-val">15 s</span>
          </div>
          <div className="mk-status-divider" />
          <div className="mk-status-item">
            <span className="mk-status-label">Feed</span>
            <span className={`mk-status-val mk-feed-status ${isError ? "offline" : isLoading ? "connecting" : "live"}`}>
              {isError ? "● OFFLINE" : isLoading ? "● CONNECTING" : "● LIVE"}
            </span>
          </div>
        </div>

        {isError ? (
          /* Offline state */
          <div className="mk-offline u2">
            <div className="mk-offline-icon">⚠</div>
            <h2 className="mk-offline-title">Market Feed Offline</h2>
            <p className="mk-offline-desc">Real-time data is temporarily unavailable. Check your internet connection or server logs.</p>
          </div>
        ) : (
          <div className="mk-body">

            {/* Sector snapshot─ */}
            <section className="mk-section u2">
              <h2 className="mk-section-title">Sector Performance</h2>
              <div className="mk-sectors">
                {isLoading ? (
                  [1,2,3,4].map(i => (
                    <div key={i} className="mk-sector-card mk-sector-card--skeleton">
                      <span className="skeleton-cell pulse" style={{ width: 90, height: 12 }} />
                      <span className="skeleton-cell pulse" style={{ width: 44, height: 20, marginTop: 12 }} />
                      <span className="skeleton-cell pulse" style={{ width: "100%", height: 3, marginTop: 16, borderRadius: 2 }} />
                    </div>
                  ))
                ) : sectorData.map(s => (
                  <div key={s.sector} className="mk-sector-card">
                    <div className="mk-sector-name">{s.sector}</div>
                    <div className={`mk-sector-pct ${s.avg >= 0 ? "up" : "down"}`}>
                      {s.avg >= 0 ? "+" : ""}{s.avg.toFixed(2)}%
                    </div>
                    <div className="mk-sector-meta">{s.count} stock{s.count !== 1 ? "s" : ""} tracked</div>
                    <div className="mk-sector-bar-track">
                      <div
                        className={`mk-sector-bar-fill ${s.avg >= 0 ? "up" : "down"}`}
                        style={{ width: `${Math.min(Math.abs(s.avg) * 15, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Movers grid */}
            <div className="mk-movers-grid u3">

              {/* Gainers */}
              <section className="mk-section">
                <h2 className="mk-section-title">
                  <span className="mk-section-dot up" />
                  Top Gainers
                </h2>
                <div className="mk-mover-list">
                  <div className="mk-mover-header">
                    <span>Symbol</span>
                    <span>Company</span>
                    <span className="right">Price</span>
                    <span className="right">% Chg</span>
                  </div>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    : gainers.map(q => (
                    <div 
                      key={q.sym} 
                      className="mk-mover-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedSymbol(q.sym)}
                    >
                      <span className="mk-mover-sym">{q.sym}</span>
                      <span className="mk-mover-name">{getCompanyMeta(q.sym).name || q.sym}</span>
                      <span className="mk-mover-price right">{q.price}</span>
                      <span className={`mk-mover-pct right up`}>{q.pct}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Losers */}
              <section className="mk-section">
                <h2 className="mk-section-title">
                  <span className="mk-section-dot down" />
                  Top Losers
                </h2>
                <div className="mk-mover-list">
                  <div className="mk-mover-header">
                    <span>Symbol</span>
                    <span>Company</span>
                    <span className="right">Price</span>
                    <span className="right">% Chg</span>
                  </div>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
                    : losers.map(q => (
                    <div 
                      key={q.sym} 
                      className="mk-mover-row"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedSymbol(q.sym)}
                    >
                      <span className="mk-mover-sym">{q.sym}</span>
                      <span className="mk-mover-name">{getCompanyMeta(q.sym).name || q.sym}</span>
                      <span className="mk-mover-price right">{q.price}</span>
                      <span className={`mk-mover-pct right down`}>{q.pct}</span>
                    </div>
                  ))}
                </div>
              </section>

            </div>

            {/* Exchange hours */}
            <section className="mk-section u4">
              <h2 className="mk-section-title">Global Exchange Hours</h2>
              <div className="mk-exchanges">
                {EXCHANGES.map(ex => (
                  <div key={ex.name} className="mk-exchange-row">
                    <span className="mk-exchange-flag">{ex.flag}</span>
                    <span className="mk-exchange-name">{ex.name}</span>
                    <span className="mk-exchange-hours">{ex.open} – {ex.close} {ex.tz}</span>
                  </div>
                ))}
              </div>
              <p className="mk-exchange-note">
                Hours shown for regular trading sessions. Pre-market and after-hours vary by exchange.
              </p>
            </section>

          </div>
        )}

        <p className="sc-footnote u4">
          All data from Yahoo Finance · Refreshes every 15 seconds · For informational purposes only
        </p>
      </main>

      <Footer />

      {selectedSymbol && (
        <DetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </>
  );
}
