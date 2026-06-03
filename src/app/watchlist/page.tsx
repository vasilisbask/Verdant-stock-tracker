"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";
import { getCompanyMeta } from "@/lib/stocks";
import DetailModal from "@/components/layout/DetailModal";
import StockLogo from "@/components/layout/StockLogo";
import { useFinnhubWS } from "@/lib/useFinnhubWS";

/* ─── Types ───────────────────────────────────────────────── */
interface WatchItem {
  sym: string;
  target?: string; // price target, stored as string for input binding
}

interface Quote {
  sym: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
  companyName?: string;
  blinkClass?: string;
}


const STORAGE_KEY = "verdant_watchlist_v1";

/* ─── Helpers ─────────────────────────────────────────────── */
function loadWatchlist(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveWatchlist(list: WatchItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function pctToTarget(price: string, target: string): { dist: string; above: boolean } | null {
  const p = parseFloat(price);
  const t = parseFloat(target);
  if (isNaN(p) || isNaN(t) || p === 0) return null;
  const diff = ((t - p) / p) * 100;
  return { dist: Math.abs(diff).toFixed(1), above: diff >= 0 };
}

/* ─── Empty state ─────────────────────────────────────────── */
function EmptyState({ onExampleAdd }: { onExampleAdd: (sym: string) => void }) {
  const examples = ["AAPL", "NVDA", "MSFT", "TSLA"];
  return (
    <div className="wl-empty">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="wl-empty-icon">
        <rect x="1" y="1" width="46" height="46" rx="6" stroke="rgba(176,228,204,0.15)" strokeWidth="1"/>
        <circle cx="24" cy="24" r="14" stroke="rgba(176,228,204,0.15)" strokeWidth="1" strokeDasharray="3 3"/>
        <line x1="24" y1="10" x2="24" y2="38" stroke="rgba(176,228,204,0.1)" strokeWidth="1"/>
        <line x1="10" y1="24" x2="38" y2="24" stroke="rgba(176,228,204,0.1)" strokeWidth="1"/>
        <circle cx="24" cy="24" r="4" fill="rgba(176,228,204,0.2)" stroke="var(--brand-light)" strokeWidth="1"/>
        <line x1="31" y1="31" x2="38" y2="38" stroke="var(--brand-light)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <h2 className="wl-empty-title">Your watchlist is empty</h2>
      <p className="wl-empty-desc">
        Add any ticker symbol above to start tracking prices in real time.
        Your list is saved locally to this device.
      </p>
      <div className="wl-empty-suggestions">
        <span className="wl-empty-hint">Try adding:</span>
        <div className="wl-suggestion-pills">
          {examples.map(sym => (
            <button key={sym} className="wl-suggestion-pill" onClick={() => onExampleAdd(sym)}>
              {sym}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stock card ──────────────────────────────────────────── */
function StockCard({
  item,
  quote,
  onRemove,
  onTargetChange,
  onSelectSymbol,
  onAddAlert,
  isAuthenticated,
}: {
  item: WatchItem;
  quote: Quote | undefined;
  onRemove: (sym: string) => void;
  onTargetChange: (sym: string, val: string) => void;
  onSelectSymbol: (sym: string) => void;
  onAddAlert: (sym: string) => void;
  isAuthenticated: boolean;
}) {
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(item.target ?? "");
  const targetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTarget) targetRef.current?.focus();
  }, [editingTarget]);

  const targetInfo = quote && item.target
    ? pctToTarget(quote.price, item.target)
    : null;

  return (
    <div className="wl-card">
      {/* Top row: symbol + remove */}
      <div className="wl-card-top" style={{ cursor: "pointer" }} onClick={() => onSelectSymbol(item.sym)}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <StockLogo symbol={item.sym} companyName={quote?.companyName} size={30} />
          <div>
            <div className="wl-sym">{item.sym}</div>
            <div className="wl-name">{quote?.companyName ?? item.sym}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }} onClick={e => e.stopPropagation()}>
          {isAuthenticated && (
            <button 
              className="wl-alert-btn" 
              onClick={() => onAddAlert(item.sym)}
              aria-label={`Set price alert for ${item.sym}`}
              style={{
                background: "none",
                border: "none",
                color: "var(--ink-2)",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
          )}
          <button 
            className="wl-remove" 
            onClick={() => onRemove(item.sym)} 
            aria-label={`Remove ${item.sym}`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Price block */}
      <div className="wl-price-block">
        {quote ? (
          <>
            <span className={`wl-price ${quote.blinkClass || ""}`}>{quote.price}</span>
            <span className={`wl-change ${quote.up ? "up" : "down"} ${quote.blinkClass || ""}`}>
              {quote.chg} <span className="wl-pct">({quote.pct})</span>
            </span>
          </>
        ) : (
          <>
            <span className="skeleton-cell pulse" style={{ width: 80, height: 24, borderRadius: 2 }} />
            <span className="skeleton-cell pulse" style={{ width: 60, height: 12, borderRadius: 2, marginTop: 8 }} />
          </>
        )}
      </div>

      {/* Target price */}
      <div className="wl-target-row">
        <span className="wl-target-label">Target</span>
        {editingTarget ? (
          <input
            ref={targetRef}
            className="wl-target-input"
            type="number"
            placeholder="e.g. 200.00"
            value={targetInput}
            onChange={e => setTargetInput(e.target.value)}
            onBlur={() => {
              onTargetChange(item.sym, targetInput);
              setEditingTarget(false);
            }}
            onKeyDown={e => {
              if (e.key === "Enter" || e.key === "Escape") {
                onTargetChange(item.sym, targetInput);
                setEditingTarget(false);
              }
            }}
          />
        ) : (
          <button className="wl-target-value" onClick={() => setEditingTarget(true)}>
            {item.target ? `$${parseFloat(item.target).toFixed(2)}` : <span className="wl-target-placeholder">Set target →</span>}
          </button>
        )}
      </div>

      {/* Target distance bar */}
      {targetInfo && quote && (
        <div className="wl-target-dist">
          <div className={`wl-dist-badge ${targetInfo.above ? "above" : "below"}`}>
            {targetInfo.above ? "▲" : "▼"} {targetInfo.dist}% {targetInfo.above ? "to target" : "past target"}
          </div>
          <div className="wl-dist-bar-track">
            <div
              className={`wl-dist-bar-fill ${targetInfo.above ? "above" : "below"}`}
              style={{ width: `${Math.min(parseFloat(targetInfo.dist), 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────── */
export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [quotes, setQuotes]       = useState<Record<string, Quote>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError]     = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [alertSymbol, setAlertSymbol] = useState<string | null>(null);

  const [addInput, setAddInput]   = useState("");
  const [addError, setAddError]   = useState("");
  const [isAdding, setIsAdding]   = useState(false);
  const addRef                    = useRef<HTMLInputElement>(null);

  const { data: session, status } = useSession();

  const activeSymbols = useMemo(() => watchlist.map(w => w.sym), [watchlist]);

  useFinnhubWS(
    activeSymbols,
    useCallback(({ symbol, price }) => {
      setQuotes(prev => {
        const old = prev[symbol];
        const oldPrice = old ? parseFloat(old.price) : NaN;
        const newPrice = price;
        if (!isNaN(oldPrice) && oldPrice === newPrice) return prev;

        const blinkClass = !isNaN(oldPrice) && newPrice > oldPrice ? "blink-g" : "blink-r";

        setTimeout(() => {
          setQuotes(current => {
            const cur = current[symbol];
            if (cur) return { ...current, [symbol]: { ...cur, blinkClass: "" } };
            return current;
          });
        }, 1000);

        return {
          ...prev,
          [symbol]: {
            sym: symbol,
            price: newPrice.toFixed(2),
            chg: old ? old.chg : "—",
            pct: old ? old.pct : "—",
            up: old ? old.up : true,
            companyName: old?.companyName,
            blinkClass
          }
        };
      });
    }, [])
  );

  /* Load watchlist on mount or session change */
  useEffect(() => {
    if (status === "loading") return;

    if (status === "authenticated") {
      async function loadDbWatchlist() {
        try {
          const res = await fetch("/api/watchlist");
          if (res.ok) {
            const json = await res.json();
            setWatchlist(json.data || []);
          }
        } catch (err) {
          console.error("Failed to load DB watchlist:", err);
        }
      }
      loadDbWatchlist();
    } else {
      setWatchlist(loadWatchlist());
    }
  }, [status]);

  /* Fetch quotes for all watched symbols */
  useEffect(() => {
    let active = true;

    async function fetchQuotes() {
      if (watchlist.length === 0) {
        setIsLoading(false);
        return;
      }
      try {
        const symList = watchlist.map(w => w.sym).join(",");
        const res = await fetch(`/api/stocks/quotes?symbols=${symList}`);
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          setIsError(false);
          const bySymbol: Record<string, Quote> = {};
          (json.data as Quote[]).forEach(q => { bySymbol[q.sym] = q; });
          setQuotes(prev => {
            const next = { ...prev };
            Object.entries(bySymbol).forEach(([sym, newQ]) => {
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
          setIsError(true);
        }
      } catch {
        setIsError(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    setIsLoading(true);
    fetchQuotes();
    const iv = setInterval(fetchQuotes, 15000);
    return () => { active = false; clearInterval(iv); };
  }, [watchlist.length]);

  /* Add ticker */
  async function addTicker(sym: string) {
    const s = sym.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!s) return;
    if (watchlist.some(w => w.sym === s)) {
      setAddError(`${s} is already in your watchlist.`);
      return;
    }
    
    setIsAdding(true);
    setAddError("");
    try {
      if (status === "authenticated") {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: s })
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to add ticker");
        }
        const json = await res.json();
        const qRes = await fetch(`/api/stocks/quotes?symbols=${s}`);
        if (qRes.ok) {
          const qJson = await qRes.json();
          if (qJson.data?.[0]) {
            setQuotes(prev => ({ ...prev, [s]: qJson.data[0] }));
          }
        }
        setWatchlist(prev => [...prev, json.data]);
      } else {
        const res = await fetch(`/api/stocks/quotes?symbols=${s}`);
        if (!res.ok) {
          throw new Error("Verification failed");
        }
        const json = await res.json();
        const quote = json.data?.[0];
        
        if (!quote || quote.price === "—") {
          setAddError(`Ticker symbol '${s}' does not exist or is delisted.`);
          return;
        }

        setQuotes(prev => ({ ...prev, [s]: quote }));

        const updated = [...watchlist, { sym: s }];
        setWatchlist(updated);
        saveWatchlist(updated);
      }
      setAddInput("");
      setAddError("");
    } catch (err: any) {
      setAddError(err.message || `Ticker symbol '${s}' does not exist or is delisted.`);
    } finally {
      setIsAdding(false);
    }
  }

  /* Remove ticker */
  async function removeTicker(sym: string) {
    if (status === "authenticated") {
      try {
        await fetch(`/api/watchlist?symbol=${sym}`, { method: "DELETE" });
        setWatchlist(prev => prev.filter(w => w.sym !== sym));
      } catch (err) {
        console.error("Failed to remove from watchlist:", err);
      }
    } else {
      const updated = watchlist.filter(w => w.sym !== sym);
      setWatchlist(updated);
      saveWatchlist(updated);
    }
  }

  /* Update target */
  async function updateTarget(sym: string, val: string) {
    if (status === "authenticated") {
      try {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: sym, target: val || null })
        });
        setWatchlist(prev => prev.map(w => w.sym === sym ? { ...w, target: val } : w));
      } catch (err) {
        console.error("Failed to update target price:", err);
      }
    } else {
      const updated = watchlist.map(w => w.sym === sym ? { ...w, target: val } : w);
      setWatchlist(updated);
      saveWatchlist(updated);
    }
  }

  const hasItems = watchlist.length > 0;

  return (
    <>
      <PillHeader />

      <main className="wl-page">

        {/* ── Header ─────────────────────────────────── */}
        <header className="wl-header u0">
          <div>
            <p className="wl-tag">My Watchlist</p>
            <h1 className="wl-title">
              {hasItems ? `${watchlist.length} stock${watchlist.length !== 1 ? "s" : ""} tracked` : "Start tracking"}
            </h1>
          </div>
          {isError && hasItems && (
            <div className="wl-offline-badge">
              <span className="sc-dot sc-dot--offline" />
              <span className="sc-live-label">FEED OFFLINE</span>
            </div>
          )}
        </header>

        {/* ── Add ticker input ────────────────────────── */}
        <div className="wl-add-row u1">
          <div className="wl-add-wrapper">
            <input
              ref={addRef}
              className={`wl-add-input ${addError ? "error" : ""}`}
              type="text"
              placeholder={isAdding ? "Verifying ticker..." : "Enter a ticker — AAPL, NVDA, MSFT…"}
              value={addInput}
              onChange={e => { setAddInput(e.target.value.toUpperCase()); setAddError(""); }}
              onKeyDown={e => { if (e.key === "Enter" && !isAdding) addTicker(addInput); }}
              maxLength={6}
              disabled={isAdding}
            />
            <button className="wl-add-btn" onClick={() => addTicker(addInput)} disabled={isAdding}>
              {isAdding ? "..." : "Add +"}
            </button>
          </div>
          {addError && <p className="wl-add-error">{addError}</p>}
          <p className="wl-add-hint">Press Enter or click Add · Watchlist is saved {status === "authenticated" ? "under your account" : "locally to this device"}</p>
        </div>

        {/* ── Cards grid or empty state ───────────────── */}
        {!hasItems ? (
          <EmptyState onExampleAdd={sym => addTicker(sym)} />
        ) : (
          <div className="wl-grid u2">
            {watchlist.map((item, i) => (
              <div key={item.sym} style={{ animationDelay: `${i * 0.05}s` }}>
                <StockCard
                  item={item}
                  quote={quotes[item.sym]}
                  onRemove={removeTicker}
                  onTargetChange={updateTarget}
                  onSelectSymbol={setSelectedSymbol}
                  onAddAlert={setAlertSymbol}
                  isAuthenticated={status === "authenticated"}
                />
              </div>
            ))}
          </div>
        )}

        {/* ── Footer note ─────────────────────────────── */}
        {hasItems && !isLoading && !isError && (
          <p className="sc-footnote u3">
            Prices refresh every 15 seconds · Powered by Yahoo Finance · Targets stored {status === "authenticated" ? "in database" : "locally"}
          </p>
        )}
      </main>

      <Footer />

      {selectedSymbol && (
        <DetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}

      {alertSymbol && (
        <AlertModal
          symbol={alertSymbol}
          currentPrice={quotes[alertSymbol]?.price || "—"}
          onClose={() => setAlertSymbol(null)}
        />
      )}
    </>
  );
}

/* ─── Alert Modal ─────────────────────────────────────────── */
function AlertModal({
  symbol,
  currentPrice,
  onClose,
}: {
  symbol: string;
  currentPrice: string;
  onClose: () => void;
}) {
  const [targetPrice, setTargetPrice] = useState(currentPrice !== "—" ? currentPrice : "");
  const [direction, setDirection] = useState<"ABOVE" | "BELOW">("ABOVE");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice || isNaN(parseFloat(targetPrice))) {
      setError("Please enter a valid target price.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          targetPrice: parseFloat(targetPrice),
          direction,
          channel: "in_app"
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to set alert.");
      }

      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to create alert.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0, 0, 0, 0.75)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 10000,
      backdropFilter: "blur(4px)"
    }}>
      <div className="modal-container" onClick={e => e.stopPropagation()} style={{
        background: "rgba(17, 31, 28, 0.98)", border: "1px solid var(--rule-light)",
        borderRadius: "8px", padding: "24px", width: "100%", maxWidth: "380px",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.03)", position: "relative",
        animation: "slideDown 0.2s ease-out"
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: "16px", right: "16px",
          background: "none", border: "none", color: "var(--ink-2)",
          cursor: "pointer", fontSize: "1.25rem", lineHeight: 1
        }}>&times;</button>

        <h3 style={{ margin: "0 0 6px 0", fontSize: "1.2rem", fontWeight: "600", color: "var(--ink)" }}>Set Price Alert</h3>
        <p style={{ margin: "0 0 20px 0", fontSize: "0.85rem", color: "var(--ink-2)" }}>
          Alert me when <strong>{symbol}</strong> goes:
        </p>

        {success ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <span style={{ color: "var(--mint)", fontSize: "2rem" }}>✓</span>
            <p style={{ margin: "8px 0 0 0", color: "var(--mint)", fontWeight: "500", fontSize: "0.9rem" }}>Alert set successfully!</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setDirection("ABOVE")}
                style={{
                  flex: 1, padding: "10px", borderRadius: "6px",
                  border: direction === "ABOVE" ? "1px solid var(--mint)" : "1px solid var(--rule-light)",
                  background: direction === "ABOVE" ? "rgba(176, 228, 204, 0.05)" : "transparent",
                  color: direction === "ABOVE" ? "var(--mint)" : "var(--ink-2)",
                  fontWeight: "600", cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s"
                }}
              >
                ▲ ABOVE
              </button>
              <button
                type="button"
                onClick={() => setDirection("BELOW")}
                style={{
                  flex: 1, padding: "10px", borderRadius: "6px",
                  border: direction === "BELOW" ? "1px solid var(--mint)" : "1px solid var(--rule-light)",
                  background: direction === "BELOW" ? "rgba(176, 228, 204, 0.05)" : "transparent",
                  color: direction === "BELOW" ? "var(--mint)" : "var(--ink-2)",
                  fontWeight: "600", cursor: "pointer", fontSize: "0.8rem", transition: "all 0.2s"
                }}
              >
                ▼ BELOW
              </button>
            </div>

            <div className="pf-field" style={{ marginBottom: "20px" }}>
              <span className="pf-field-label" style={{ display: "block", fontSize: "0.75rem", color: "var(--ink-2)", marginBottom: "6px" }}>Target Price ($)</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input-text"
                style={{
                  width: "100%", padding: "10px", background: "rgba(9, 20, 19, 0.6)",
                  border: "1px solid var(--rule-light)", borderRadius: "6px",
                  color: "var(--ink)", outline: "none", boxSizing: "border-box"
                }}
                value={targetPrice}
                onChange={e => setTargetPrice(e.target.value)}
                placeholder="e.g. 200.00"
                required
              />
            </div>

            {error && <p style={{ color: "#f26d6d", fontSize: "0.8rem", margin: "0 0 16px 0" }}>{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary"
              style={{ width: "100%", padding: "12px", borderRadius: "6px", cursor: "pointer", fontWeight: "600" }}
            >
              {isSubmitting ? "Saving..." : "Set Price Alert"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
