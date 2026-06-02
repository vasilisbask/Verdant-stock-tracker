"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import PillHeader from "@/components/layout/PillHeader";
import Footer from "@/components/layout/Footer";
import { SECTORS, getCompanyMeta } from "@/lib/stocks";
import DetailModal from "@/components/layout/DetailModal";
import StockLogo from "@/components/layout/StockLogo";

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

interface SavedFilter {
  id: string;
  name: string;
  search: string;
  sector: string;
  peFilter: string;
  mktFilter: string;
  volFilter: string;
}

type SortKey = "sym" | "price" | "chg" | "pct" | "vol" | "pe" | "mkt";
type SortDir = "asc" | "desc";

/* Helper functions for robust numeric parsing of custom string fields */
function parseMarketCap(mktStr?: string): number {
  if (!mktStr || mktStr === "—") return 0;
  const num = parseFloat(mktStr);
  if (isNaN(num)) return 0;
  if (mktStr.toUpperCase().endsWith("T")) return num * 1e12;
  if (mktStr.toUpperCase().endsWith("B")) return num * 1e9;
  if (mktStr.toUpperCase().endsWith("M")) return num * 1e6;
  return num;
}

function parseVolume(volStr?: string): number {
  if (!volStr || volStr === "—") return 0;
  const num = parseFloat(volStr.replace(/,/g, ""));
  return isNaN(num) ? 0 : num;
}

interface CustomSelectProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: Array<{ value: string; label: string }>;
}

// Helper to parse labels like "Technology (8)" into Name and Count parts for badge styling
function parseOptionLabel(label: string) {
  const match = label.match(/^(.*?)\s*\(([^)]+)\)$/);
  if (match) {
    return { name: match[1], count: match[2] };
  }
  return { name: label, count: "" };
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

  const activeOption = options.find(o => o.value === value) || options[0];
  const btnParts = parseOptionLabel(activeOption.label);

  return (
    <div className={`sc-filter-group ${isOpen ? "open" : ""}`} ref={dropdownRef}>
      <span className="sc-filter-label">{label}</span>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`sc-select-btn ${isOpen ? "active" : ""}`}
      >
        <span className="sc-select-btn-content">
          <span>{btnParts.name}</span>
          {btnParts.count && (
            <span className="sc-select-badge">
              {btnParts.count}
            </span>
          )}
        </span>
        <span className="sc-select-arrow">▼</span>
      </button>

      {isOpen && (
        <div className="sc-select-dropdown scrollbar-hidden">
          {options.map(opt => {
            const optParts = parseOptionLabel(opt.label);
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
                <span>{optParts.name}</span>
                {optParts.count && (
                  <span className="sc-select-badge">
                    {optParts.count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}



/* Sort icon */
function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className="sc-sort-icon" aria-hidden>
      {active ? (dir === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );
}

export default function ScreenerPage() {
  const [ticks, setTicks]         = useState<Tick[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError]     = useState(false);
  const [errorMsg, setErrorMsg]   = useState("");

  const [search, setSearch]       = useState("");
  const [sector, setSector]       = useState("All");
  const [sortKey, setSortKey]     = useState<SortKey>("sym");
  const [sortDir, setSortDir]     = useState<SortDir>("asc");

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

  // Advanced Filters
  const [peFilter, setPeFilter]   = useState("all");
  const [mktFilter, setMktFilter] = useState("all");
  const [volFilter, setVolFilter] = useState("all");

  // Saved presets state
  const [savedFilters, setSavedFilters]   = useState<SavedFilter[]>([]);
  const [newFilterName, setNewFilterName] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Load presets from LocalStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("vdt_screener_filters");
        if (saved) setSavedFilters(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to load saved filters:", err);
      }
    }
  }, []);

  const saveCurrentFilter = (name: string) => {
    if (!name.trim()) return;
    const newFilter: SavedFilter = {
      id: Date.now().toString(),
      name: name.trim(),
      search,
      sector,
      peFilter,
      mktFilter,
      volFilter,
    };
    const next = [...savedFilters, newFilter];
    setSavedFilters(next);
    localStorage.setItem("vdt_screener_filters", JSON.stringify(next));
    setNewFilterName("");
    setShowSaveModal(false);
  };

  const loadFilterPreset = (preset: SavedFilter) => {
    setSearch(preset.search);
    setSector(preset.sector);
    setPeFilter(preset.peFilter);
    setMktFilter(preset.mktFilter);
    setVolFilter(preset.volFilter);
  };

  const deleteFilterPreset = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = savedFilters.filter(f => f.id !== id);
    setSavedFilters(next);
    localStorage.setItem("vdt_screener_filters", JSON.stringify(next));
  };

  // Compute dynamic counts for each filter option based on current matching of OTHER filters
  const peCounts = useMemo(() => {
    const sourceTicks = searchResults !== null ? searchResults : ticks;
    let list = sourceTicks.map(t => ({
      ...t,
      sector: getCompanyMeta(t.sym).sector ?? "Other",
    }));

    if (sector !== "All") {
      list = list.filter(r => r.sector === sector);
    }
    if (mktFilter !== "all") {
      list = list.filter(r => {
        const val = parseMarketCap(r.mkt);
        if (mktFilter === "mega") return val >= 200e9;
        if (mktFilter === "large") return val >= 10e9 && val < 200e9;
        if (mktFilter === "mid_small") return val > 0 && val < 10e9;
        return true;
      });
    }
    if (volFilter !== "all") {
      list = list.filter(r => {
        const val = parseVolume(r.vol);
        if (volFilter === "high") return val >= 1000000;
        if (volFilter === "ultra") return val >= 5000000;
        return true;
      });
    }

    let all = list.length;
    let value = 0;
    let balanced = 0;
    let growth = 0;

    list.forEach(r => {
      const val = parseFloat(r.pe || "");
      if (isNaN(val)) return;
      if (val < 15) value++;
      else if (val >= 15 && val <= 30) balanced++;
      else if (val > 30) growth++;
    });

    return { all, value, balanced, growth };
  }, [ticks, searchResults, sector, mktFilter, volFilter]);

  const mktCounts = useMemo(() => {
    const sourceTicks = searchResults !== null ? searchResults : ticks;
    let list = sourceTicks.map(t => ({
      ...t,
      sector: getCompanyMeta(t.sym).sector ?? "Other",
    }));

    if (sector !== "All") {
      list = list.filter(r => r.sector === sector);
    }
    if (peFilter !== "all") {
      list = list.filter(r => {
        const val = parseFloat(r.pe || "");
        if (isNaN(val)) return false;
        if (peFilter === "value") return val < 15;
        if (peFilter === "balanced") return val >= 15 && val <= 30;
        if (peFilter === "growth") return val > 30;
        return true;
      });
    }
    if (volFilter !== "all") {
      list = list.filter(r => {
        const val = parseVolume(r.vol);
        if (volFilter === "high") return val >= 1000000;
        if (volFilter === "ultra") return val >= 5000000;
        return true;
      });
    }

    let all = list.length;
    let mega = 0;
    let large = 0;
    let mid_small = 0;

    list.forEach(r => {
      const val = parseMarketCap(r.mkt);
      if (val >= 200e9) mega++;
      else if (val >= 10e9 && val < 200e9) large++;
      else if (val > 0 && val < 10e9) mid_small++;
    });

    return { all, mega, large, mid_small };
  }, [ticks, searchResults, sector, peFilter, volFilter]);

  const volCounts = useMemo(() => {
    const sourceTicks = searchResults !== null ? searchResults : ticks;
    let list = sourceTicks.map(t => ({
      ...t,
      sector: getCompanyMeta(t.sym).sector ?? "Other",
    }));

    if (sector !== "All") {
      list = list.filter(r => r.sector === sector);
    }
    if (peFilter !== "all") {
      list = list.filter(r => {
        const val = parseFloat(r.pe || "");
        if (isNaN(val)) return false;
        if (peFilter === "value") return val < 15;
        if (peFilter === "balanced") return val >= 15 && val <= 30;
        if (peFilter === "growth") return val > 30;
        return true;
      });
    }
    if (mktFilter !== "all") {
      list = list.filter(r => {
        const val = parseMarketCap(r.mkt);
        if (mktFilter === "mega") return val >= 200e9;
        if (mktFilter === "large") return val >= 10e9 && val < 200e9;
        if (mktFilter === "mid_small") return val > 0 && val < 10e9;
        return true;
      });
    }

    let all = list.length;
    let high = 0;
    let ultra = 0;

    list.forEach(r => {
      const val = parseVolume(r.vol);
      if (val >= 1000000) high++;
      if (val >= 5000000) ultra++;
    });

    return { all, high, ultra };
  }, [ticks, searchResults, sector, peFilter, mktFilter]);

  const sectorCounts = useMemo(() => {
    const sourceTicks = searchResults !== null ? searchResults : ticks;
    let list = sourceTicks.map(t => ({
      ...t,
      sector: getCompanyMeta(t.sym).sector ?? "Other",
    }));

    if (peFilter !== "all") {
      list = list.filter(r => {
        const val = parseFloat(r.pe || "");
        if (isNaN(val)) return false;
        if (peFilter === "value") return val < 15;
        if (peFilter === "balanced") return val >= 15 && val <= 30;
        if (peFilter === "growth") return val > 30;
        return true;
      });
    }
    if (mktFilter !== "all") {
      list = list.filter(r => {
        const val = parseMarketCap(r.mkt);
        if (mktFilter === "mega") return val >= 200e9;
        if (mktFilter === "large") return val >= 10e9 && val < 200e9;
        if (mktFilter === "mid_small") return val > 0 && val < 10e9;
        return true;
      });
    }
    if (volFilter !== "all") {
      list = list.filter(r => {
        const val = parseVolume(r.vol);
        if (volFilter === "high") return val >= 1000000;
        if (volFilter === "ultra") return val >= 5000000;
        return true;
      });
    }

    const counts: Record<string, number> = {};
    SECTORS.forEach(s => { counts[s] = 0; });

    list.forEach(r => {
      const sec = r.sector;
      if (counts[sec] !== undefined) {
        counts[sec]++;
      }
    });

    counts["All"] = list.length;
    return counts;
  }, [ticks, searchResults, peFilter, mktFilter, volFilter]);

  const isFiltered = peFilter !== "all" || mktFilter !== "all" || volFilter !== "all" || sector !== "All" || search !== "";

  const clearAllFilters = () => {
    setSearch("");
    setSector("All");
    setPeFilter("all");
    setMktFilter("all");
    setVolFilter("all");
  };



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

    // Filter by P/E ratio
    if (peFilter !== "all") {
      list = list.filter(r => {
        const val = parseFloat(r.pe || "");
        if (isNaN(val)) return false;
        if (peFilter === "value") return val < 15;
        if (peFilter === "balanced") return val >= 15 && val <= 30;
        if (peFilter === "growth") return val > 30;
        return true;
      });
    }

    // Filter by Market Cap
    if (mktFilter !== "all") {
      list = list.filter(r => {
        const val = parseMarketCap(r.mkt);
        if (mktFilter === "mega") return val >= 200e9;
        if (mktFilter === "large") return val >= 10e9 && val < 200e9;
        if (mktFilter === "mid_small") return val > 0 && val < 10e9;
        return true;
      });
    }

    // Filter by Volume
    if (volFilter !== "all") {
      list = list.filter(r => {
        const val = parseVolume(r.vol);
        if (volFilter === "high") return val >= 1000000;
        if (volFilter === "ultra") return val >= 5000000;
        return true;
      });
    }

    list.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === "sym") { av = a.sym; bv = b.sym; }
      else if (sortKey === "price") { av = parseFloat(a.price) || 0; bv = parseFloat(b.price) || 0; }
      else if (sortKey === "chg")   { av = parseFloat(a.chg)   || 0; bv = parseFloat(b.chg)   || 0; }
      else if (sortKey === "pct")   { av = parseFloat(a.pct)   || 0; bv = parseFloat(b.pct)   || 0; }
      else if (sortKey === "vol")   { av = parseVolume(a.vol); bv = parseVolume(b.vol); }
      else if (sortKey === "pe")    { av = parseFloat(a.pe || "") || 0; bv = parseFloat(b.pe || "") || 0; }
      else if (sortKey === "mkt")   { av = parseMarketCap(a.mkt); bv = parseMarketCap(b.mkt); }

      if (typeof av === "string") {
        return sortDir === "asc" ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      }
      return sortDir === "asc" ? av - (bv as number) : (bv as number) - av;
    });

    return list;
  }, [ticks, searchResults, sector, sortKey, sortDir, peFilter, mktFilter, volFilter]);

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
    { label: "P/E",     key: "pe",    align: "right" },
    { label: "MKT CAP", key: "mkt",   align: "right" },
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

          {/* Result count */}
          <span className="sc-count">
            {isLoading ? "—" : `${rows.length} result${rows.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Advanced Filters Block */}
        <div className="sc-filters-bar u1">
          {/* Sector Dropdown */}
          <CustomSelect
            label="Sector"
            value={sector}
            onChange={setSector}
            options={SECTORS
              .filter(s => s === "All" || (sectorCounts[s] ?? 0) > 0)
              .map(s => ({ value: s, label: `${s} (${sectorCounts[s] ?? 0})` }))
            }
          />

          {/* P/E Ratio Dropdown */}
          <CustomSelect
            label="P/E Ratio"
            value={peFilter}
            onChange={setPeFilter}
            options={[
              { value: "all", label: `Any P/E (${peCounts.all})` },
              { value: "value", label: `Value < 15 (${peCounts.value})` },
              { value: "balanced", label: `Balanced 15-30 (${peCounts.balanced})` },
              { value: "growth", label: `Growth > 30 (${peCounts.growth})` }
            ]}
          />

          {/* Market Cap Dropdown */}
          <CustomSelect
            label="Market Cap"
            value={mktFilter}
            onChange={setMktFilter}
            options={[
              { value: "all", label: `Any Cap (${mktCounts.all})` },
              { value: "mega", label: `Mega Cap $200B+ (${mktCounts.mega})` },
              { value: "large", label: `Large Cap $10B-$200B (${mktCounts.large})` },
              { value: "mid_small", label: `Mid/Small Cap <$10B (${mktCounts.mid_small})` }
            ]}
          />

          {/* Volume Dropdown */}
          <CustomSelect
            label="Volume"
            value={volFilter}
            onChange={setVolFilter}
            options={[
              { value: "all", label: `Any Volume (${volCounts.all})` },
              { value: "high", label: `High > 1M (${volCounts.high})` },
              { value: "ultra", label: `Ultra High > 5M (${volCounts.ultra})` }
            ]}
          />

          {/* Save & Clear Actions */}
          <div className="sc-filters-actions">
            {isFiltered && (
              <button
                onClick={clearAllFilters}
                className="sc-clear-btn"
              >
                Clear Filters
              </button>
            )}

            {showSaveModal ? (
              <div className="sc-save-preset-container">
                <input
                  type="text"
                  placeholder="Preset name..."
                  value={newFilterName}
                  onChange={e => setNewFilterName(e.target.value)}
                  className="sc-save-preset-input"
                  onKeyDown={e => {
                    if (e.key === "Enter") saveCurrentFilter(newFilterName);
                  }}
                />
                <button
                  onClick={() => saveCurrentFilter(newFilterName)}
                  className="sc-save-preset-btn"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSaveModal(false)}
                  className="sc-cancel-preset-btn"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSaveModal(true)}
                className="sc-save-trigger-btn"
              >
                Save Preset +
              </button>
            )}
          </div>
        </div>

        {/* Saved Presets Ribbon */}
        {savedFilters.length > 0 && (
          <div className="sc-presets-bar u1">
            <span className="sc-presets-label">Saved Presets:</span>
            {savedFilters.map(preset => (
              <button
                key={preset.id}
                onClick={() => loadFilterPreset(preset)}
                className="sc-preset-pill"
              >
                <span>{preset.name}</span>
                <span
                  onClick={(e) => deleteFilterPreset(preset.id, e)}
                  className="sc-preset-delete"
                  title="Delete Preset"
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="sc-table-wrap u2">
          {isError ? (
            /* Offline state */
            <div className="sc-offline">
              <div className="sc-offline-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
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
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 30, height: 12, marginLeft: "auto" }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 40, height: 12, marginLeft: "auto" }} /></td>
                      <td className="right"><span className="skeleton-cell pulse" style={{ width: 40, height: 12, marginLeft: "auto" }} /></td>
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="sc-empty">
                      No results for <strong>"{search}"</strong>{sector !== "All" ? ` in ${sector}` : ""}.
                    </td>
                  </tr>
                 ) : (
                  paginatedRows.map((t, i) => (
                    <tr
                      key={t.sym}
                      className="sc-tr"
                      style={{ animationDelay: `${i * 0.03}s` }}
                      onClick={() => setSelectedSymbol(t.sym)}
                    >
                      <td className="sc-td sc-sym">
                        <div className="sc-sym-cell">
                          <StockLogo symbol={t.sym} companyName={t.name} size={20} />
                          <span>{t.sym}</span>
                        </div>
                      </td>
                      <td className="sc-td sc-name">{t.name}</td>
                      <td className="sc-td sc-sector">
                        <span className="sc-sector-badge">{t.sector}</span>
                      </td>
                      <td className={`sc-td sc-price right ${t.blinkClass || ""}`}>{t.price}</td>
                      <td className={`sc-td right ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.chg}</td>
                      <td className={`sc-td right ${t.blinkClass || ""} ${t.up ? "up" : "down"}`}>{t.pct}</td>
                      <td className="sc-td right">{t.pe || "—"}</td>
                      <td className="sc-td right">{t.mkt || "—"}</td>
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
                        if (pageNum === 2 && currentPage > 4) return <span key="ellipsis-start" className="sc-pagination-page ellipsis">...</span>;
                        if (pageNum === totalPages - 1 && currentPage < totalPages - 3) return <span key="ellipsis-end" className="sc-pagination-page ellipsis">...</span>;
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
