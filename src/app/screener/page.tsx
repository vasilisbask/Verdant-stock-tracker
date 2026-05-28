"use client";

import { useState, useEffect, useMemo } from "react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";
import { SECTORS, getCompanyMeta } from "@/lib/stocks";
import DetailModal from "@/components/layout/DetailModal";

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
  companyName?: string;
  blinkClass?: string;
}

type SortKey = "sym" | "price" | "chg" | "pct" | "vol";
type SortDir = "asc" | "desc";


/* Sort icon */
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="sc-sort-icon" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

/* Main Page */
export default function ScreenerPage() {
  const [ticks, setTicks]         = useState<Tick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");

  const [search, setSearch]       = useState("");
  const [sector, setSector]       = useState("All");
  const [sortKey, setSortKey]     = useState<SortKey>("sym");
  const [sortDir, setSortDir]     = useState<SortDir>("asc");

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Dynamic server-side search states
  const [searchResults, setSearchResults] = useState<Tick[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Dynamic server-side search effect with debounce
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setIsSearching(true);
        const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(search.trim())}`);
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        console.error("[Screener Search] failed:", err);
        if (active) setSearchResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, sector]);

  /* Fetch live quotes */
  useEffect(() => {
    let active = true;

    async function fetchQuotes() {
      try {
        const res = await fetch("/api/stocks/quotes");
        if (!active) return;

        if (res.ok) {
          const json = await res.json();
          setIsError(false);
          setTicks(prev => {
            if (prev.length === 0) return json.data;
            return json.data.map((newTick: Tick) => {
              const old = prev.find(x => x.sym === newTick.sym);
              if (!old) return newTick;
              const oldP = parseFloat(old.price);
              const newP = parseFloat(newTick.price);
              if (isNaN(oldP) || isNaN(newP) || oldP === newP) return newTick;
              const blinkClass = newP > oldP ? "blink-g" : "blink-r";
              setTimeout(() => {
                setTicks(cur => cur.map(x => x.sym === newTick.sym ? { ...x, blinkClass: "" } : x));
              }, 1000);
              return { ...newTick, blinkClass };
            });
          });
        } else {
          setIsError(true);
          try {
            const e = await res.json();
            setErrorMsg(e.error || "Service unavailable.");
          } catch { setErrorMsg("Failed to load market data."); }
        }
      } catch {
        setIsError(true);
        setErrorMsg("Network error connecting to market feed.");
      } finally {
        if (active) setIsLoading(false);
      }
    }

    fetchQuotes();
    const iv = setInterval(fetchQuotes, 15000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  /* Sort handler */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  /* Filtered + sorted rows */
  const rows = useMemo(() => {
    const sourceTicks = searchResults !== null ? searchResults : ticks;
    let list = sourceTicks.map(t => ({
      ...t,
      name: t.companyName ?? getCompanyMeta(t.sym).name ?? t.sym,
      sector: getCompanyMeta(t.sym).sector ?? "Other",
    }));

    if (sector !== "All") {
      list = list.filter(r => r.sector === sector);
    }

    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "sym") { av = a.sym; bv = b.sym; }
      else if (sortKey === "price") { av = parseFloat(a.price) || 0; bv = parseFloat(b.price) || 0; }
      else if (sortKey === "chg")   { av = parseFloat(a.chg)   || 0; bv = parseFloat(b.chg)   || 0; }
      else if (sortKey === "pct")   { av = parseFloat(a.pct)   || 0; bv = parseFloat(b.pct)   || 0; }
      else if (sortKey === "vol")   { av = a.vol; bv = b.vol; }

      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });

    return list;
  }, [ticks, searchResults, sector, sortKey, sortDir]);

  const totalPages = Math.ceil(rows.length / ITEMS_PER_PAGE) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return rows.slice(start, start + ITEMS_PER_PAGE);
  }, [rows, currentPage]);

  const COLS: { label: string; key: SortKey | null; align: "left" | "right" }[] = [
    { label: "SYMBOL",  key: "sym",   align: "left"  },
    { label: "COMPANY", key: null,    align: "left"  },
    { label: "SECTOR",  key: null,    align: "left"  },
    { label: "PRICE",   key: "price", align: "right" },
    { label: "CHG",     key: "chg",   align: "right" },
    { label: "% CHG",   key: "pct",   align: "right" },
    { label: "VOLUME",  key: "vol",   align: "right" },
  ];

  return (
    <>
      <PillHeader />

      <main className="sc-page">

        {/*  Page header─ */}
        <header className="sc-header u0">
          <div>
            <p className="sc-tag">Market Screener</p>
            <h1 className="sc-title">Filter. Sort. Discover.</h1>
          </div>
          <div className="sc-live-badge">
            <span className={`live-dot sc-dot ${isError ? "sc-dot--offline" : isLoading ? "sc-dot--connecting" : "sc-dot--live"}`} />
            <span className="sc-live-label">
              {isError ? "OFFLINE" : isLoading ? "CONNECTING" : "LIVE"}
            </span>
          </div>
        </header>

        {/*  Toolbar─ */}
        <div className="sc-toolbar u1">
          {/* Search */}
          <div className="sc-search-wrapper">
            <svg className="sc-search-icon" width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10.5" y1="10.5" x2="14" y2="14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <input
              className="sc-search"
              type="text"
              placeholder="Search symbol or company…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="sc-search-clear" onClick={() => setSearch("")} aria-label="Clear search">×</button>
            )}
          </div>

          {/* Sector filter pills */}
          <div className="sc-filter-pills">
            {SECTORS.map(s => (
              <button
                key={s}
                className={`sc-pill ${sector === s ? "active" : ""}`}
                onClick={() => setSector(s)}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Result count */}
          <span className="sc-count">
            {isLoading ? "—" : `${rows.length} result${rows.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Table */}
        <div className="sc-table-wrap u2">
          {isError ? (
            /* Offline state */
            <div className="sc-offline">
              <div className="sc-offline-icon">⚠</div>
              <h2 className="sc-offline-title">Feed Offline</h2>
              <p className="sc-offline-desc">{errorMsg || "Real-time market data is currently unavailable."}</p>
              <code className="sc-offline-code">Yahoo Finance Feed</code>
            </div>
          ) : (
            <>
              <table className="sc-table">
              <thead>
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.label}
                      className={`sc-th ${col.align === "right" ? "right" : ""} ${col.key ? "sortable" : ""}`}
                      onClick={col.key ? () => handleSort(col.key!) : undefined}
                    >
                      {col.label}
                      {col.key && <SortIcon active={sortKey === col.key} dir={sortDir} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading || isSearching ? (
                  /* Skeleton rows */
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="sc-tr sc-tr--skeleton">
                      <td><span className="skeleton-cell pulse" style={{ width: 44, height: 12 }} /></td>
                      <td><span className="skeleton-cell pulse" style={{ width: 120, height: 12 }} /></td>
                      <td><span className="skeleton-cell pulse" style={{ width: 80,  height: 12 }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 56, height: 12, marginLeft: "auto" }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 44, height: 12, marginLeft: "auto" }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 48, height: 12, marginLeft: "auto" }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 40, height: 12, marginLeft: "auto" }} /></td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="sc-empty">
                      No results for <strong>"{search}"</strong>{sector !== "All" ? ` in ${sector}` : ""}.
                    </td>
                  </tr>
                 ) : (
                  paginatedRows.map((t, i) => (
                    <tr
                      key={t.sym}
                      className="sc-tr"
                      style={{ animationDelay: `${i * 0.03}s`, cursor: "pointer" }}
                      onClick={() => setSelectedSymbol(t.sym)}
                    >
                      <td className="sc-td sc-sym">{t.sym}</td>
                      <td className="sc-td sc-name">{t.name}</td>
                      <td className="sc-td sc-sector">
                        <span className="sc-sector-badge">{t.sector}</span>
                      </td>
                      <td className={`sc-td sc-price right ${t.blinkClass || ""}`}>{t.price}</td>
                      <td className={`sc-td right ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.chg}</td>
                      <td className={`sc-td right ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.pct}</td>
                      <td className="sc-td sc-vol right">{t.vol}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Premium Pagination Controls */}
            {!isLoading && rows.length > 0 && (
              <div className="sc-pagination">
                <div className="sc-pagination-info">
                  Showing <strong>{Math.min(rows.length, (currentPage - 1) * ITEMS_PER_PAGE + 1)}</strong>–
                  <strong>{Math.min(rows.length, currentPage * ITEMS_PER_PAGE)}</strong> of <strong>{rows.length}</strong> stocks
                </div>
                <div className="sc-pagination-controls">
                  <button
                    className="sc-pagination-btn"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  >
                    ← Prev
                  </button>
                  <div className="sc-pagination-pages">
                    {Array.from({ length: totalPages }).map((_, idx) => {
                      const pageNum = idx + 1;
                      // Display dynamic slice of page numbers if there are too many (e.g. max 5 pages centered around active page)
                      if (totalPages > 5 && Math.abs(currentPage - pageNum) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                        if (pageNum === 2 && currentPage > 4) return <span key="ellipsis-start" className="sc-pagination-page" style={{ cursor: "default" }}>...</span>;
                        if (pageNum === totalPages - 1 && currentPage < totalPages - 3) return <span key="ellipsis-end" className="sc-pagination-page" style={{ cursor: "default" }}>...</span>;
                        return null;
                      }
                      return (
                        <button
                          key={pageNum}
                          className={`sc-pagination-page ${currentPage === pageNum ? "active" : ""}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    className="sc-pagination-btn"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
            </>
          )}
        </div>

        {/*  Footer note */}
        {!isLoading && !isError && (
          <p className="sc-footnote u3">
            Prices refresh every 15 seconds · Powered by Yahoo Finance · For informational purposes only
          </p>
        )}
      </main>

      <Footer />

      {selectedSymbol && (
        <DetailModal symbol={selectedSymbol} onClose={() => setSelectedSymbol(null)} />
      )}
    </>
  );
}
