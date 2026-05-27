"use client";

import { useState, useEffect } from "react";
import PillHeader from "../components/layout/PillHeader";
import Footer from "../components/layout/Footer";

/* Types */
interface Tick { 
  sym: string; 
  price: string; 
  chg: string; 
  pct: string; 
  up: boolean; 
  vol: string; 
  pe?: string; 
  mkt?: string; 
  blinkClass?: string;
}

function TickerTape({ tape }: { tape: Tick[] }) {
  const items = tape.length > 0 ? [...tape, ...tape] : []; // doubled for seamless loop
  return (
    <div className="ticker-tape-wrapper">
      <div className="tape" style={{ padding: "9px 0" }}>
        {items.length > 0 ? (
          items.map((t, i) => (
            <span key={i} className="ticker-tape-item">
              <span className="ticker-tape-sym">{t.sym}</span>
              <span className={`ticker-tape-price ${t.blinkClass || ""}`}>{t.price}</span>
              <span className={`ticker-tape-chg ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>
                {t.chg} ({t.pct})
              </span>
            </span>
          ))
        ) : (
          Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="ticker-tape-item" style={{ opacity: 0.25 }}>
              <span className="skeleton-cell pulse" style={{ width: 45, height: 10 }} />
              <span className="skeleton-cell pulse" style={{ width: 40, height: 10 }} />
              <span className="skeleton-cell pulse" style={{ width: 50, height: 10 }} />
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function Hero({ 
  tape, 
  isMock, 
  isLoading,
  isError,
  errorMessage
}: { 
  tape: Tick[]; 
  isMock: boolean; 
  isLoading: boolean; 
  isError: boolean;
  errorMessage: string;
}) {
  const [dateStr, setDateStr] = useState("27 May 2026 · 14:32 ET");
  useEffect(() => {
    const d = new Date();
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const pad = (n: number) => n.toString().padStart(2, '0');
    setDateStr(`${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())} Local`);
  }, []);

  return (
    <section className="hero-section">
      {/* LEFT: editorial typographic statement */}
      <div className="hero-left">
        <div className="market-status-indicator u0">
          <span className="live-dot footer-logo-dot" />
          Markets open · NYSE · NASDAQ
        </div>

        <h1 className="hero-heading u1">
          Track
          <br />
          <em>every</em>
          <br />
          tick.
        </h1>

        <p className="hero-paragraph u2">
          Real-time quotes, a multi-factor screener, and a watchlist built for people who care about the details. No noise. Just data.
        </p>

        <div className="hero-actions u3">
          <a href="/register" className="btn-primary btn-lg">
            Start tracking →
          </a>
          <a href="#how" className="link-subtle">
            How it works ↓
          </a>
        </div>

        <div className="trust-row u4">
          {[
            { n: "10+", l: "markets covered" },
            { n: "< 60s", l: "quote latency" },
            { n: "∞", l: "watchlist capacity" },
          ].map(s => (
            <div key={s.l}>
              <div className="trust-item-value">{s.n}</div>
              <div className="trust-item-label">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="hero-divider" />

      {/* Dense stock data table */}
      <div className="hero-right u2">
        <div className="quotes-header-row">
          <div className="quotes-header-badge">
            <span className={`live-dot quotes-header-badge-dot ${isError ? "offline" : (isLoading ? "connecting" : (isMock ? "mock" : "live"))}`} />
            <span className="quotes-header-title">
              {isError ? "SERVICE OFFLINE" : (isLoading ? "CONNECTING..." : (isMock ? "DEMO MARKET DATA" : "LIVE MARKET QUOTES"))}
            </span>
          </div>
          <span className="quotes-header-time">
            {dateStr}
          </span>
        </div>

        {/* Column headers */}
        <div className="quotes-grid-headers">
          {["SYMBOL", "PRICE", "CHG", "% CHG", "VOL"].map(h => (
            <span key={h} className={`quotes-grid-header ${["PRICE", "CHG", "% CHG", "VOL"].includes(h) ? "align-right" : ""}`}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {isError ? (
          <div className="quotes-offline-card">
            <div className="quotes-offline-icon">⚠️</div>
            <h3 className="quotes-offline-title">Telemetry Offline</h3>
            <p className="quotes-offline-desc">
              {errorMessage || "Real-time stock feeds are currently unavailable."}
            </p>
            <div className="quotes-offline-instructions">
              Ensure that <code>FINNHUB_API_KEY</code> is correctly set in <code>.env.local</code> and check server logs.
            </div>
          </div>
        ) : tape.length > 0 ? (
          tape.map((t, i) => (
            <div
              key={t.sym}
              className="quotes-row"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <span className="quotes-cell symbol">{t.sym}</span>
              <span className={`quotes-cell price ${t.blinkClass || ""}`}>{t.price}</span>
              <span className={`quotes-cell change ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.chg}</span>
              <span className={`quotes-cell pct ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.pct}</span>
              <span className="quotes-cell vol">{t.vol}</span>
            </div>
          ))
        ) : (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="quotes-row" style={{ opacity: 0.25 }}>
              <span className="skeleton-cell pulse" style={{ width: 40, height: 12 }} />
              <span className="skeleton-cell pulse" style={{ width: 50, height: 12, marginLeft: "auto" }} />
              <span className="skeleton-cell pulse" style={{ width: 40, height: 12, marginLeft: "auto" }} />
              <span className="skeleton-cell pulse" style={{ width: 45, height: 12, marginLeft: "auto" }} />
              <span className="skeleton-cell pulse" style={{ width: 35, height: 12, marginLeft: "auto" }} />
            </div>
          ))
        )}

        <div className="screener-link-container">
          <a href="/screener" className="screener-link">
            Full screener →
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      title: "Build your watchlist.",
      body: "Search any ticker and add it. Prices stream live as the market moves. Set target prices and track distance to them in real time.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="how-step-icon">
          <rect x="2" y="2" width="36" height="36" rx="4" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <path d="M8 28 L16 18 L24 24 L32 10" stroke="var(--mint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="32" cy="10" r="3" fill="var(--mint)" className="glow-pulse"/>
          <line x1="8" y1="32" x2="32" y2="32" stroke="var(--rule)" strokeWidth="1" strokeDasharray="2 2"/>
        </svg>
      )
    },
    {
      n: "02",
      title: "Screen the market.",
      body: "Filter thousands of equities by P/E ratio, dividend yield, sector, market cap, and volume. Save your filters for instant recall.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="how-step-icon">
          <rect x="2" y="2" width="36" height="36" rx="4" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <line x1="14" y1="2" x2="14" y2="38" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <line x1="26" y1="2" x2="26" y2="38" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <line x1="2" y1="14" x2="38" y2="14" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <line x1="2" y1="26" x2="38" y2="26" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <circle cx="26" cy="14" r="3.5" fill="var(--mint)"/>
          <circle cx="14" cy="26" r="2.5" fill="rgba(176, 228, 204, 0.4)"/>
        </svg>
      )
    },
    {
      n: "03",
      title: "Go deep on any stock.",
      body: "Click any ticker for a full profile — historical price chart, key fundamentals, recent headlines, and your own transaction log.",
      icon: (
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="how-step-icon">
          <rect x="2" y="2" width="36" height="36" rx="4" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <circle cx="20" cy="20" r="12" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1" strokeDasharray="3 3"/>
          <circle cx="20" cy="20" r="6" stroke="var(--brand-light)" strokeWidth="1"/>
          <line x1="20" y1="4" x2="20" y2="36" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <line x1="4" y1="20" x2="36" y2="20" stroke="rgba(176, 228, 204, 0.15)" strokeWidth="1"/>
          <circle cx="20" cy="20" r="2.5" fill="var(--mint)"/>
        </svg>
      )
    },
  ];

  return (
    <section id="how" className="how-section">
      <div className="how-header-row">
        <h2 className="how-heading">Designed for the way you actually trade.</h2>
        <div className="how-header-divider" />
      </div>

      <div className="how-grid">
        {steps.map((s, i) => (
          <div
            key={s.n}
            className={`how-column ${i < 2 ? "has-divider" : ""} ${i > 0 ? "offset-left" : ""}`}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              {s.icon}
              <div className="how-num" style={{ marginBottom: 0 }}>{s.n}</div>
            </div>
            <h3 className="how-step-title">{s.title}</h3>
            <p className="how-step-desc">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScreenerPreview({ tape }: { tape: Tick[] }) {
  const rows = tape.filter(t => t.pe).slice(0, 7);
  return (
    <section className="screener-section">
      <div className="screener-container">
        <div className="screener-header-row">
          <div>
            <div className="screener-tag">Screener preview</div>
            <h2 className="screener-heading">Filter. Sort. Discover.</h2>
          </div>
          <a href="/screener" className="screener-header-link">
            Open screener →
          </a>
        </div>

        <div className="screener-table-card">
          {/* Table header */}
          <div className="screener-table-header">
            {["SYMBOL", "COMPANY", "PRICE", "CHANGE", "P/E", "MKT CAP"].map(h => (
              <span key={h} className={`screener-table-header-cell ${["PRICE", "CHANGE", "P/E", "MKT CAP"].includes(h) ? "align-right" : ""}`}>
                {h}
              </span>
            ))}
          </div>

          {rows.length > 0 ? (
            rows.map((t, i) => (
              <div
                key={t.sym}
                className={`screener-table-row ${i === rows.length - 1 ? "last" : ""}`}
              >
                <span className="screener-cell symbol">{t.sym}</span>
                <span className="screener-cell company">
                  {({ AAPL:"Apple Inc.",NVDA:"NVIDIA Corp.",MSFT:"Microsoft Corp.",TSLA:"Tesla Inc.",AMZN:"Amazon.com Inc.",GOOGL:"Alphabet Inc.",META:"Meta Platforms",JPM:"JPMorgan Chase" } as Record<string,string>)[t.sym] ?? t.sym}
                </span>
                <span className={`screener-cell price ${t.blinkClass || ""}`}>{t.price}</span>
                <span className={`screener-cell change ${t.up ? "up" : "down"} ${t.blinkClass || ""}`}>{t.pct}</span>
                <span className="screener-cell pe">{t.pe}</span>
                <span className="screener-cell mkt">{t.mkt}</span>
              </div>
            ))
          ) : (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={`screener-table-row ${i === 6 ? "last" : ""}`} style={{ opacity: 0.25 }}>
                <span className="skeleton-cell pulse" style={{ width: 45, height: 12 }} />
                <span className="skeleton-cell pulse" style={{ width: 100, height: 12 }} />
                <span className="skeleton-cell pulse" style={{ width: 50, height: 12, marginLeft: "auto" }} />
                <span className="skeleton-cell pulse" style={{ width: 45, height: 12, marginLeft: "auto" }} />
                <span className="skeleton-cell pulse" style={{ width: 30, height: 12, marginLeft: "auto" }} />
                <span className="skeleton-cell pulse" style={{ width: 40, height: 12, marginLeft: "auto" }} />
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="cta-section">
      <div className="cta-container">
        <div>
          <h2 className="cta-heading">
            The market doesn't wait.
            <br />
            <em>Neither should you.</em>
          </h2>
          <p className="cta-desc">
            Free to start. No credit card. Full screener from day one.
          </p>
        </div>
        <a href="/register" className="btn-primary btn-cta-large">
          Create free account →
        </a>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [tape, setTape] = useState<Tick[]>([]);
  const [isMock, setIsMock] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchLiveMarketData() {
      try {
        const quotesRes = await fetch("/api/stocks/quotes");

        if (!active) return;

        if (quotesRes.ok) {
          const quotesJson = await quotesRes.json();
          setIsMock(quotesJson.isMock);
          setIsError(false);
          
          setTape(prevTape => {
            if (prevTape.length === 0) return quotesJson.data;
            return quotesJson.data.map((newTick: Tick) => {
              const oldTick = prevTape.find(x => x.sym === newTick.sym);
              if (!oldTick) return newTick;

              const oldPrice = parseFloat(oldTick.price);
              const newPrice = parseFloat(newTick.price);

              if (isNaN(oldPrice) || isNaN(newPrice) || oldPrice === newPrice) {
                return newTick;
              }

              // Trigger blink flash animation
              const blinkClass = newPrice > oldPrice ? "blink-g" : "blink-r";

              setTimeout(() => {
                setTape(currentTape =>
                  currentTape.map(x => x.sym === newTick.sym ? { ...x, blinkClass: "" } : x)
                );
              }, 1000);

              return {
                ...newTick,
                blinkClass
              };
            });
          });
        } else {
          setIsError(true);
          try {
            const errJson = await quotesRes.json();
            setErrorMessage(errJson.error || "Service unavailable.");
          } catch {
            setErrorMessage("Failed to load real-time market data.");
          }
        }
      } catch (err) {
        console.error("[LandingPage] Live data fetch failed:", err);
        setIsError(true);
        setErrorMessage("Network error connecting to market feed.");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    fetchLiveMarketData();

    const interval = setInterval(fetchLiveMarketData, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <PillHeader />
      <TickerTape tape={tape} />
      <Hero 
        tape={tape} 
        isMock={isMock} 
        isLoading={isLoading} 
        isError={isError} 
        errorMessage={errorMessage} 
      />
      <HowItWorks />
      <ScreenerPreview tape={tape} />
      <CTA />
      <Footer />
    </>
  );
}