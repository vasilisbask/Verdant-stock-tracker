"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import DetailModal from "@/components/layout/DetailModal";
import Footer from "@/components/layout/Footer";
import PillHeader from "@/components/layout/PillHeader";
import StockLogo from "@/components/layout/StockLogo";
import { getCompanyMeta } from "@/lib/stocks";

interface Quote {
  sym: string;
  price: string;
  chg: string;
  pct: string;
  up: boolean;
  vol: string;
  companyName?: string;
}

interface PortfolioTransaction {
  id: string;
  sym: string;
  companyName: string;
  quantity: string;
  price: string;
  type: "BUY" | "SELL";
  transactionDate: string;
}

interface Holding {
  sym: string;
  companyName: string;
  quantity: number;
  avgPrice: number;
  invested: number;
  currentPrice: number;
  currentValue: number;
  gainLoss: number;
  gainLossPct: number;
  realizedGainLoss: number;
  lots: number;
  hasLivePrice: boolean;
}

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const sharesFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

function parseQuotePrice(value?: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  sub,
  up,
  loading,
  statusClass,
}: {
  label: string;
  value: string;
  sub?: string;
  up?: boolean;
  loading?: boolean;
  statusClass?: string;
}) {
  return (
    <div className={`db-stat-card ${statusClass || ""}`}>
      <span className="db-stat-label">{label}</span>
      {loading ? (
        <span
          className="skeleton-cell pulse"
          style={{ width: 92, height: 20, borderRadius: 2, marginTop: 4 }}
        />
      ) : (
        <span
          className={`db-stat-value ${
            up === true ? "up" : up === false ? "down" : ""
          }`}
        >
          {value}
        </span>
      )}
      {sub && <span className="db-stat-sub">{sub}</span>}
    </div>
  );
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link href={href} className="db-quick-link">
      <span className="db-quick-label">{label}</span>
      <span className="db-quick-desc">{desc}</span>
    </Link>
  );
}

interface CustomSelectProps {
  label: string;
  value: "BUY" | "SELL";
  onChange: (val: "BUY" | "SELL") => void;
  options: Array<{ value: "BUY" | "SELL"; label: string }>;
}

function CustomSelect({ label, value, onChange, options }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeOption = options.find((o) => o.value === value) || options[0];

  return (
    <div
      className={`pf-field sc-filter-group ${isOpen ? "open" : ""}`}
      ref={dropdownRef}
      style={{ position: "relative" }}
    >
      <span className="pf-field-label">{label}</span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`sc-select-btn ${isOpen ? "active" : ""}`}
        style={{ height: "40px", width: "100%", minWidth: "unset" }}
      >
        <span className="sc-select-btn-content">
          <span>{activeOption.label}</span>
        </span>
        <span className="sc-select-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="sc-select-dropdown scrollbar-hidden" style={{ minWidth: "100%", width: "100%", background: "#111f1c" }}>
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`sc-select-option ${isSelected ? "selected" : ""}`}
              >
                <span>{opt.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();

  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isError, setIsError] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [type, setType] = useState<"BUY" | "SELL">("BUY");

  const loadPortfolio = useCallback(async () => {
    if (status !== "authenticated") return;

    setIsLoadingPortfolio(true);
    try {
      const res = await fetch("/api/portfolio");
      if (!res.ok) {
        throw new Error("Could not load portfolio");
      }

      const json = await res.json();
      setTransactions(json.data ?? []);
      setIsError(false);
    } catch {
      setIsError(true);
    } finally {
      setIsLoadingPortfolio(false);
    }
  }, [status]);

  useEffect(() => {
    let active = true;

    async function fetchInitialPortfolio() {
      if (status !== "authenticated") return;

      try {
        const res = await fetch("/api/portfolio");
        if (!active) return;

        if (!res.ok) {
          throw new Error("Could not load portfolio");
        }

        const json = await res.json();
        setTransactions(json.data ?? []);
        setIsError(false);
      } catch {
        if (active) setIsError(true);
      } finally {
        if (active) setIsLoadingPortfolio(false);
      }
    }

    fetchInitialPortfolio();

    return () => {
      active = false;
    };
  }, [status]);

  const symbolsKey = useMemo(() => {
    return Array.from(new Set(transactions.map((tx) => tx.sym)))
      .sort()
      .join(",");
  }, [transactions]);

  useEffect(() => {
    let active = true;

    async function fetchQuotes() {
      if (!symbolsKey) {
        setQuotes({});
        setIsLoadingQuotes(false);
        return;
      }

      setIsLoadingQuotes(true);
      try {
        const res = await fetch(`/api/stocks/quotes?symbols=${symbolsKey}`);
        if (!active) return;

        if (!res.ok) {
          throw new Error("Quote feed unavailable");
        }

        const json = await res.json();
        const bySymbol: Record<string, Quote> = {};
        (json.data as Quote[]).forEach((quote) => {
          bySymbol[quote.sym] = quote;
        });
        setQuotes(bySymbol);
        setIsError(false);
      } catch {
        if (active) setIsError(true);
      } finally {
        if (active) setIsLoadingQuotes(false);
      }
    }

    fetchQuotes();
    const interval = setInterval(fetchQuotes, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [symbolsKey]);

  const holdings = useMemo<Holding[]>(() => {
    const map = new Map<
      string,
      {
        sym: string;
        companyName: string;
        quantity: number;
        invested: number;
        realizedGainLoss: number;
        lots: number;
      }
    >();

    const sortedTransactions = [...transactions].sort(
      (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime()
    );

    sortedTransactions.forEach((tx) => {
      const txQuantity = Number(tx.quantity);
      const txPrice = Number(tx.price);
      if (!Number.isFinite(txQuantity) || !Number.isFinite(txPrice)) return;

      const existing = map.get(tx.sym) ?? {
        sym: tx.sym,
        companyName: tx.companyName || tx.sym,
        quantity: 0,
        invested: 0,
        realizedGainLoss: 0,
        lots: 0,
      };

      if (tx.type === "SELL") {
        const avgCost = existing.quantity > 0 ? existing.invested / existing.quantity : 0;
        const saleRealized = txQuantity * (txPrice - avgCost);
        existing.realizedGainLoss += saleRealized;
        existing.quantity -= txQuantity;
        existing.invested -= txQuantity * avgCost;
      } else {
        existing.quantity += txQuantity;
        existing.invested += txQuantity * txPrice;
      }
      existing.lots += 1;
      map.set(tx.sym, existing);
    });

    return Array.from(map.values())
      .map((item) => {
        const quotePrice = parseQuotePrice(quotes[item.sym]?.price);
        const avgPrice = item.quantity > 0 ? item.invested / item.quantity : 0;
        const currentPrice = quotePrice ?? avgPrice;
        const currentValue = item.quantity * currentPrice;
        const gainLoss = currentValue - item.invested;
        const gainLossPct =
          item.invested > 0 ? (gainLoss / item.invested) * 100 : 0;

        return {
          ...item,
          companyName: quotes[item.sym]?.companyName ?? item.companyName,
          avgPrice,
          currentPrice,
          currentValue,
          gainLoss,
          gainLossPct,
          hasLivePrice: quotePrice !== null,
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [transactions, quotes]);

  const activeHoldings = useMemo(() => {
    return holdings.filter(h => h.quantity > 0);
  }, [holdings]);

  const totals = useMemo(() => {
    const invested = activeHoldings.reduce((sum, item) => sum + item.invested, 0);
    const currentValue = activeHoldings.reduce(
      (sum, item) => sum + item.currentValue,
      0
    );
    const gainLoss = currentValue - invested;
    const gainLossPct = invested > 0 ? (gainLoss / invested) * 100 : 0;
    const liveCount = activeHoldings.filter((item) => item.hasLivePrice).length;
    const realizedGainLoss = holdings.reduce((sum, item) => sum + item.realizedGainLoss, 0);

    return {
      invested,
      currentValue,
      gainLoss,
      gainLossPct,
      liveCount,
      realizedGainLoss,
    };
  }, [holdings, activeHoldings]);

  const bestHolding = activeHoldings.reduce<Holding | null>((best, item) => {
    if (!best) return item;
    return item.gainLossPct > best.gainLossPct ? item : best;
  }, null);

  const recentTransactions = transactions.slice(0, 5);
  const firstName = session?.user?.name?.split(" ")[0] ?? "Trader";
  const isAuthenticated = status === "authenticated";
  const hasHoldings = activeHoldings.length > 0;

  async function fillCurrentPrice() {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) {
      setFormError("Enter a ticker first.");
      return;
    }

    try {
      const res = await fetch(`/api/stocks/quotes?symbols=${cleanSymbol}`);
      if (!res.ok) throw new Error("Quote not found");
      const json = await res.json();
      const quote = (json.data as Quote[])[0];
      const quotePrice = parseQuotePrice(quote?.price);

      if (!quotePrice) throw new Error("Quote not found");

      setQuotes((current) => ({
        ...current,
        [quote.sym]: quote,
      }));
      setSymbol(quote.sym);
      setPrice(quotePrice.toFixed(2));
      setFormError("");
    } catch {
      setFormError("Could not fetch the latest price for that ticker.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanSymbol = symbol.trim().toUpperCase();
    const numericQuantity = Number(quantity);
    const numericPrice = Number(price);

    if (!cleanSymbol || !numericQuantity || !numericPrice) {
      setFormError(`Fill symbol, quantity, and ${type === "BUY" ? "buy" : "sell"} price.`);
      return;
    }

    if (numericQuantity <= 0 || numericPrice <= 0) {
      setFormError(`Quantity and ${type === "BUY" ? "buy" : "sell"} price must be greater than zero.`);
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          symbol: cleanSymbol,
          quantity: numericQuantity,
          price: numericPrice,
          companyName: quotes[cleanSymbol]?.companyName,
          type,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Could not add ${type.toLowerCase()}`);
      }

      setSymbol("");
      setQuantity("");
      setPrice("");
      setType("BUY");
      await loadPortfolio();
    } catch (err: any) {
      setFormError(err.message || `Could not save this ${type.toLowerCase()}. Try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function removeHolding(sym: string) {
    try {
      const res = await fetch(`/api/portfolio?symbol=${sym}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Could not remove holding");
      }

      await loadPortfolio();
    } catch {
      setFormError(`Could not remove ${sym}.`);
    }
  }

  return (
    <>
      <PillHeader />

      <main className="db-page pf-page">
        <header className="db-header pf-header u0">
          <div className="db-header-left">
            <p className="db-greeting">{getGreeting()}, {firstName}</p>
            <h1 className="db-title">Portfolio</h1>
          </div>
          <div className="db-header-right">
            <div className={`mk-session-badge ${isError ? "closed" : "open"}`}>
              <span
                className={`live-dot ${
                  isError ? "mk-dot--closed" : "mk-dot--open"
                }`}
              />
              {isError ? "Feed Offline" : "Live Pricing"}
            </div>
          </div>
        </header>

        {status === "loading" ? (
          <section className="db-section pf-auth-card u1" style={{ borderTopColor: "var(--rule-light)", opacity: 0.7 }}>
            <div className="pf-loading" style={{ padding: 0 }}>
              <span className="skeleton-cell pulse" style={{ width: "120px", height: "14px", marginBottom: "16px", borderRadius: "4px" }} />
              <span className="skeleton-cell pulse" style={{ width: "280px", height: "32px", marginBottom: "20px", borderRadius: "4px" }} />
              <span className="skeleton-cell pulse" style={{ width: "100%", height: "80px", marginBottom: "24px", borderRadius: "4px" }} />
              <div style={{ display: "flex", gap: "12px" }}>
                <span className="skeleton-cell pulse" style={{ width: "100px", height: "40px", borderRadius: "100px" }} />
                <span className="skeleton-cell pulse" style={{ width: "120px", height: "40px", borderRadius: "100px" }} />
              </div>
            </div>
          </section>
        ) : !isAuthenticated ? (
          <section className="db-section pf-auth-card u1">
            <span className="pf-auth-kicker">Portfolio access</span>
            <h2 className="pf-auth-title">Sign in to track your holdings</h2>
            <p className="pf-auth-copy">
              Your purchases, quantities, cost basis, and unrealized P/L are
              stored under your account.
            </p>
            <div className="pf-auth-actions">
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
              <Link href="/register" className="btn-secondary">
                Create account
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="db-stat-row pf-stat-row u1">
              <StatCard
                label="Invested"
                value={currency.format(totals.invested)}
                sub="Total cost basis"
                loading={isLoadingPortfolio}
                statusClass="stat-live"
              />
              <StatCard
                label="Current Value"
                value={currency.format(totals.currentValue)}
                sub={`${totals.liveCount}/${activeHoldings.length} live priced`}
                loading={isLoadingPortfolio || isLoadingQuotes}
                statusClass="stat-live"
              />
              <StatCard
                label="Unrealized P/L"
                value={currency.format(totals.gainLoss)}
                sub={formatPercent(totals.gainLossPct)}
                up={totals.gainLoss >= 0}
                loading={isLoadingPortfolio || isLoadingQuotes}
                statusClass={totals.gainLoss >= 0 ? "stat-up" : "stat-down"}
              />
              <StatCard
                label="Realized P/L"
                value={currency.format(totals.realizedGainLoss)}
                sub={`${activeHoldings.length} active position${activeHoldings.length !== 1 ? 's' : ''}`}
                up={totals.realizedGainLoss >= 0}
                loading={isLoadingPortfolio}
                statusClass={totals.realizedGainLoss >= 0 ? "stat-up" : "stat-down"}
              />
            </div>

            <section className="db-section pf-trade-panel u2">
              <div className="db-section-header">
                <h2 className="db-section-title">Add Transaction</h2>
                <span className="pf-panel-note">Buy or sell logs</span>
              </div>
              <form className="pf-trade-form" onSubmit={handleSubmit}>
                <CustomSelect
                  label="Type"
                  value={type}
                  onChange={(val) => {
                    setType(val);
                    setFormError("");
                  }}
                  options={[
                    { value: "BUY", label: "BUY" },
                    { value: "SELL", label: "SELL" },
                  ]}
                />
                <label className="pf-field">
                  <span className="pf-field-label">Ticker</span>
                  <input
                    className="input-text pf-input"
                    value={symbol}
                    onChange={(event) => {
                      setSymbol(event.target.value.toUpperCase());
                      setFormError("");
                    }}
                    placeholder="AAPL"
                    maxLength={12}
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-field-label">Quantity</span>
                  <input
                    className="input-text pf-input"
                    type="number"
                    min="0"
                    step="any"
                    value={quantity}
                    onChange={(event) => {
                      setQuantity(event.target.value);
                      setFormError("");
                    }}
                    placeholder="10"
                  />
                </label>
                <label className="pf-field">
                  <span className="pf-field-label">{type === "BUY" ? "Buy Price" : "Sell Price"}</span>
                  <input
                    className="input-text pf-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(event) => {
                      setPrice(event.target.value);
                      setFormError("");
                    }}
                    placeholder="185.25"
                  />
                </label>
                <div className="pf-form-actions">
                  <button
                    type="button"
                    className="btn-secondary pf-live-btn"
                    onClick={fillCurrentPrice}
                    style={{ paddingLeft: "0" }}
                  >
                    Use live price
                  </button>
                  <button
                    type="submit"
                    className="btn-primary pf-submit-btn"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Adding..." : type === "BUY" ? "Add buy" : "Add sell"}
                  </button>
                </div>
              </form>
              {formError && <p className="pf-form-error">{formError}</p>}
            </section>

            <div className="db-body pf-body">
              <section className="db-section db-section--wide u3">
                <div className="db-section-header">
                  <h2 className="db-section-title">Holdings</h2>
                  <span className="pf-panel-note">
                    Prices refresh every 15s
                  </span>
                </div>

                {isLoadingPortfolio ? (
                  <div className="pf-loading">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <span key={index} className="skeleton-cell pulse" />
                    ))}
                  </div>
                ) : !hasHoldings ? (
                  <div className="db-empty pf-empty">
                    <p className="db-empty-text">
                      Add your first purchase to see cost basis, market value,
                      and unrealized P/L.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Desktop Holdings Table */}
                    <div className="pf-holdings-table">
                      <div className="pf-holdings-header">
                        <span>Stock</span>
                        <span className="right">Qty</span>
                        <span className="right">Avg Cost</span>
                        <span className="right">Current</span>
                        <span className="right">Invested</span>
                        <span className="right">Value</span>
                        <span className="right">P/L</span>
                        <span className="right">Actions</span>
                      </div>

                      {activeHoldings.map((holding, index) => (
                        <div
                          key={holding.sym}
                          className="pf-holdings-row"
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          <button
                            className="pf-stock-cell"
                            onClick={() => setSelectedSymbol(holding.sym)}
                          >
                            <StockLogo symbol={holding.sym} companyName={holding.companyName} size={24} />
                            <div className="pf-stock-cell-meta">
                              <span className="pf-stock-symbol">
                                {holding.sym}
                              </span>
                              <span className="pf-stock-name">
                                {holding.companyName}
                              </span>
                            </div>
                          </button>
                          <span className="right">
                            {sharesFormatter.format(holding.quantity)}
                          </span>
                          <span className="right">
                            {currency.format(holding.avgPrice)}
                          </span>
                          <span className="right">
                            {holding.hasLivePrice
                              ? currency.format(holding.currentPrice)
                              : "Pending"}
                          </span>
                          <span className="right">
                            {currency.format(holding.invested)}
                          </span>
                          <span className="right">
                            {currency.format(holding.currentValue)}
                          </span>
                          <span
                            className={`right pf-pl ${
                              holding.gainLoss >= 0 ? "up" : "down"
                            }`}
                          >
                            {currency.format(holding.gainLoss)}
                            <small>{formatPercent(holding.gainLossPct)}</small>
                          </span>
                          <span className="right">
                            <button
                              className="pf-remove-btn"
                              onClick={() => removeHolding(holding.sym)}
                              aria-label={`Remove ${holding.sym}`}
                            >
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Mobile/Tablet Holdings Card Grid */}
                    <div className="pf-holdings-mobile-grid">
                      {activeHoldings.map((holding, index) => (
                        <div
                          key={holding.sym}
                          className="pf-mobile-card"
                          onClick={() => setSelectedSymbol(holding.sym)}
                          style={{ animationDelay: `${index * 0.03}s` }}
                        >
                          <div className="pf-mobile-card-header">
                            <div className="pf-mobile-card-stock">
                              <StockLogo symbol={holding.sym} companyName={holding.companyName} size={32} />
                              <div className="pf-mobile-card-stock-meta">
                                <span className="pf-mobile-card-symbol">{holding.sym}</span>
                                <span className="pf-mobile-card-name">{holding.companyName}</span>
                              </div>
                            </div>
                            <button
                              className="pf-mobile-card-remove"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeHolding(holding.sym);
                              }}
                              aria-label={`Remove ${holding.sym}`}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>

                          <div className="pf-mobile-card-divider" />

                          <div className="pf-mobile-card-grid">
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">Qty</span>
                              <span className="pf-mobile-card-value">{sharesFormatter.format(holding.quantity)}</span>
                            </div>
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">Avg Cost</span>
                              <span className="pf-mobile-card-value">{currency.format(holding.avgPrice)}</span>
                            </div>
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">Current</span>
                              <span className="pf-mobile-card-value">
                                {holding.hasLivePrice ? currency.format(holding.currentPrice) : "Pending"}
                              </span>
                            </div>
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">Invested</span>
                              <span className="pf-mobile-card-value">{currency.format(holding.invested)}</span>
                            </div>
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">Value</span>
                              <span className="pf-mobile-card-value">{currency.format(holding.currentValue)}</span>
                            </div>
                            <div className="pf-mobile-card-stat">
                              <span className="pf-mobile-card-label">P/L</span>
                              <span className={`pf-mobile-card-value pf-pl ${holding.gainLoss >= 0 ? "up" : "down"}`}>
                                {currency.format(holding.gainLoss)}
                                <small className="pf-mobile-card-pct">{formatPercent(holding.gainLossPct)}</small>
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <div className="db-sidebar">
                <section className="db-section u3">
                  <div className="db-section-header">
                    <h2 className="db-section-title">Allocation</h2>
                  </div>
                  <div className="pf-allocation-list">
                    {activeHoldings.length === 0 ? (
                      <p className="pf-sidebar-empty">No positions yet.</p>
                    ) : (
                      activeHoldings.map((holding) => {
                        const width =
                          totals.currentValue > 0
                            ? (holding.currentValue / totals.currentValue) * 100
                            : 0;
                        return (
                          <div key={holding.sym} className="pf-allocation-row">
                            <div className="pf-allocation-meta">
                              <span>{holding.sym}</span>
                              <strong>
                                {compactCurrency.format(holding.currentValue)}
                              </strong>
                            </div>
                            <div className="pf-allocation-track">
                              <span
                                className="pf-allocation-fill"
                                style={{ width: `${Math.max(width, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="db-section u4">
                  <div className="db-section-header">
                    <h2 className="db-section-title">Recent Transactions</h2>
                  </div>
                  <div className="pf-lots-list">
                    {recentTransactions.length === 0 ? (
                      <p className="pf-sidebar-empty">No transactions yet.</p>
                    ) : (
                      recentTransactions.map((tx) => (
                        <div key={tx.id} className="pf-lot-row">
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{
                              fontSize: "0.65rem",
                              fontWeight: "bold",
                              padding: "2px 5px",
                              borderRadius: "4px",
                              background: tx.type === "SELL" ? "rgba(242, 109, 109, 0.15)" : "rgba(176, 228, 204, 0.15)",
                              color: tx.type === "SELL" ? "#f26d6d" : "var(--mint)"
                            }}>
                              {tx.type}
                            </span>
                            <div>
                              <span className="pf-lot-symbol">{tx.sym}</span>
                              <span className="pf-lot-date">
                                {new Date(tx.transactionDate).toLocaleDateString(
                                  "en-US",
                                  {
                                    month: "short",
                                    day: "numeric",
                                  }
                                )}
                              </span>
                            </div>
                          </div>
                          <div className="pf-lot-values">
                            <span>{sharesFormatter.format(Number(tx.quantity))}</span>
                            <strong>{currency.format(Number(tx.price))}</strong>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="db-section u4">
                  <div className="db-section-header">
                    <h2 className="db-section-title">Quick Access</h2>
                  </div>
                  <div className="db-quick-links pf-quick-links">
                    <QuickLink
                      href="/screener"
                      label="Screener"
                      desc="Find new ideas"
                    />
                    <QuickLink
                      href="/watchlist"
                      label="Watchlist"
                      desc="Track tickers"
                    />
                    <QuickLink
                      href="/markets"
                      label="Markets"
                      desc="Daily overview"
                    />
                  </div>
                </section>
              </div>
            </div>

            <p className="sc-footnote u4">
              Portfolio figures are informational only. Current values use the
              latest available Yahoo Finance quote.
            </p>
          </>
        )}
      </main>

      <Footer />

      {selectedSymbol && (
        <DetailModal
          symbol={selectedSymbol}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </>
  );
}