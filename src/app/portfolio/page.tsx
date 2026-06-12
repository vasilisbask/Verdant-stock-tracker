"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

import DetailModal from "@/components/layout/DetailModal";
import Footer from "@/components/layout/Footer";
import PillHeader from "@/components/layout/PillHeader";
import StockLogo from "@/components/layout/StockLogo";

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
          className={`db-stat-value blur-amount ${
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

interface PerformancePoint {
  date: string;
  value: number;
}

function PortfolioPerformanceChart({ 
  data, 
  activeRange, 
  setActiveRange,
  onOpenTransactions 
}: { 
  data: PerformancePoint[]; 
  activeRange: "1D" | "1W" | "1M" | "1Y";
  setActiveRange: (r: "1D" | "1W" | "1M" | "1Y") => void;
  onOpenTransactions?: () => void;
}) {
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  if (data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "180px", color: "var(--ink-3)", fontSize: "0.85rem" }}>
        No transaction history available.
      </div>
    );
  }

  const values = data.map((d) => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal;
  
  const chartMin = Math.max(0, minVal - (range === 0 ? 100 : range * 0.15));
  const chartMax = maxVal + (range === 0 ? 100 : range * 0.15);

  const width = 600;
  const height = 180;
  const paddingLeft = 55;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 25;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
    const y = paddingTop + (1 - (d.value - chartMin) / (chartMax - chartMin)) * chartHeight;
    return { x, y, date: d.date, value: d.value };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z` 
    : "";

  const gridLevels = 4;
  const gridLines = Array.from({ length: gridLevels }).map((_, i) => {
    const ratio = i / (gridLevels - 1);
    const value = chartMax - ratio * (chartMax - chartMin);
    const y = paddingTop + ratio * chartHeight;
    return { y, value };
  });

  const xLabelCount = 5;
  const xLabels = Array.from({ length: xLabelCount }).map((_, i) => {
    const index = Math.round((i / (xLabelCount - 1)) * (data.length - 1));
    return data[index];
  });

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    const svgRect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const svgWidth = svgRect.width;
    const scaledX = (mouseX / svgWidth) * width;

    let closest = points[0];
    let minDiff = Math.abs(points[0].x - scaledX);
    for (const p of points) {
      const diff = Math.abs(p.x - scaledX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }
    setHoveredPoint(closest);
  };

  const isUp = data.length >= 2 ? data[data.length - 1].value >= data[0].value : true;
  const strokeColor = isUp ? "var(--mint)" : "#f26d6d";
  const valueColor = isUp ? "var(--mint)" : "#f26d6d";

  return (
    <div className="portfolio-performance-card" style={{ position: "relative", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button
            onClick={onOpenTransactions}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              margin: 0,
              cursor: onOpenTransactions ? "pointer" : "default",
              textAlign: "left",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
            className="pf-value-title-btn"
            onMouseEnter={(e) => {
              if (onOpenTransactions) {
                const h2 = e.currentTarget.querySelector("h2");
                if (h2) h2.style.color = "var(--mint)";
              }
            }}
            onMouseLeave={(e) => {
              if (onOpenTransactions) {
                const h2 = e.currentTarget.querySelector("h2");
                if (h2) h2.style.color = "";
              }
            }}
          >
            <h2 
              className="db-section-title" 
              style={{ 
                margin: 0,
                transition: "color 0.2s"
              }}
            >
              PORTFOLIO VALUE
            </h2>
            {onOpenTransactions && (
              <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>↗</span>
            )}
          </button>
          
          <div style={{ display: "flex", gap: "6px" }}>
            {(["1D", "1W", "1M", "1Y"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setActiveRange(r)}
                style={{
                  background: activeRange === r ? "rgba(176, 228, 204, 0.08)" : "none",
                  border: `1px solid ${activeRange === r ? "var(--mint)" : "rgba(255, 255, 255, 0.06)"}`,
                  color: activeRange === r ? "var(--mint)" : "var(--ink-3)",
                  fontSize: "10px",
                  fontWeight: "bold",
                  padding: "3px 8px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  if (activeRange !== r) {
                    e.currentTarget.style.borderColor = "rgba(176, 228, 204, 0.4)";
                    e.currentTarget.style.color = "var(--ink-2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeRange !== r) {
                    e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                    e.currentTarget.style.color = "var(--ink-3)";
                  }
                }}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <span style={{ fontFamily: "var(--f-mono)", fontSize: "0.85rem", color: "var(--ink-2)" }}>
          {hoveredPoint ? (
            <>
              <span style={{ color: "var(--ink-3)", marginRight: "8px" }}>{hoveredPoint.date}:</span>
              <strong className="blur-amount" style={{ color: valueColor }}>${hoveredPoint.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </>
          ) : (
            <>
              <span style={{ color: "var(--ink-3)", marginRight: "8px" }}>Current:</span>
              <strong className="blur-amount" style={{ color: valueColor }}>${data[data.length - 1].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </>
          )}
        </span>
      </div>

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        width="100%" 
        height="100%" 
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
        style={{ overflow: "visible", cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {gridLines.map((line, idx) => (
          <g key={idx}>
            <line 
              x1={paddingLeft} 
              y1={line.y} 
              x2={width - paddingRight} 
              y2={line.y} 
              stroke="var(--rule)" 
              strokeWidth="1" 
              strokeDasharray="4 4"
            />
            <text 
              x={paddingLeft - 8} 
              y={line.y + 3} 
              textAnchor="end" 
              fill="var(--ink-3)" 
              className="blur-amount"
              style={{ fontFamily: "var(--f-mono)", fontSize: "9px" }}
            >
              ${line.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </text>
          </g>
        ))}

        {areaPath && (
          <path d={areaPath} fill="url(#chartGradient)" />
        )}
        {linePath && (
          <path 
            d={linePath} 
            fill="none" 
            stroke={strokeColor} 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
        )}

        {hoveredPoint && (
          <g>
            <line 
              x1={hoveredPoint.x} 
              y1={paddingTop} 
              x2={hoveredPoint.x} 
              y2={height - paddingBottom} 
              stroke="var(--brand-light)" 
              strokeWidth="1" 
              strokeDasharray="2 2"
            />
            <circle 
              cx={hoveredPoint.x} 
              cy={hoveredPoint.y} 
              r="4.5" 
              fill="var(--bg-card)" 
              stroke={strokeColor} 
              strokeWidth="1.5" 
            />
          </g>
        )}

        {xLabels.map((label, idx) => {
          if (!label) return null;
          const index = data.findIndex(x => x.date === label.date);
          const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
          return (
            <text
              key={idx}
              x={x}
              y={height - paddingBottom + 14}
              textAnchor="middle"
              fill="var(--ink-3)"
              style={{ fontFamily: "var(--f-mono)", fontSize: "8px" }}
            >
              {label.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function PerformanceChartSkeleton() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
        <span className="skeleton-cell pulse" style={{ width: "140px", height: "14px", borderRadius: "4px" }} />
        <span className="skeleton-cell pulse" style={{ width: "100px", height: "14px", borderRadius: "4px" }} />
      </div>
      <div className="skeleton-cell pulse" style={{ width: "100%", height: "180px", opacity: 0.1, borderRadius: "6px" }} />
    </div>
  );
}

function AllTransactionsModal({
  transactions,
  onClose,
  performanceData,
  isLoadingPerformance,
  totals,
  activeHoldings,
}: {
  transactions: PortfolioTransaction[];
  onClose: () => void;
  performanceData: any;
  isLoadingPerformance: boolean;
  totals: {
    invested: number;
    currentValue: number;
    gainLoss: number;
    gainLossPct: number;
    liveCount: number;
    realizedGainLoss: number;
  };
  activeHoldings: Holding[];
}) {
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    value: number;
    date: string;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [activeRange, setActiveRange] = useState<"1D" | "1W" | "1M" | "1Y">("1D");

  const history = useMemo(() => {
    if (!performanceData) return [];
    
    // Handle legacy/fallback array format if any
    const rawHistory = performanceData as unknown;
    if (Array.isArray(rawHistory)) {
      if (rawHistory.length === 0) return [];
      switch (activeRange) {
        case "1D": return rawHistory.slice(-2);
        case "1W": return rawHistory.slice(-5);
        case "1M": return rawHistory.slice(-21);
        case "1Y":
        default: return rawHistory;
      }
    }
    
    return (performanceData[activeRange] || []) as PerformancePoint[];
  }, [performanceData, activeRange]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const isUp = totals.gainLoss >= 0;
  const priceColorClass = isUp ? "up" : "down";
  const strokeColor = isUp ? "var(--mint)" : "#f26d6d";

  // Chart calculations
  const values = history.map((d) => d.value);
  const maxVal = values.length > 0 ? Math.max(...values) : 0;
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const range = maxVal - minVal;

  const chartMin = Math.max(0, minVal - (range === 0 ? 100 : range * 0.15));
  const chartMax = maxVal + (range === 0 ? 100 : range * 0.15);
  const priceRange = chartMax - chartMin || 1;

  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  const points = history.map((d, index) => {
    const x = paddingX + (index / (history.length - 1)) * chartWidth;
    const y = svgHeight - paddingY - ((d.value - chartMin) / priceRange) * chartHeight;
    return { x, y, value: d.value, date: d.date };
  });

  const linePathD = points.reduce((acc, p, i) => {
    return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, "");

  const areaPathD = points.length > 0 
    ? `${linePathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : "";

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || points.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgMouseX = (mouseX / rect.width) * svgWidth;

    let closestIndex = 0;
    let minDistance = Infinity;

    points.forEach((p, idx) => {
      const dist = Math.abs(p.x - svgMouseX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    const closestPoint = points[closestIndex];
    setHoveredPoint({
      x: closestPoint.x,
      y: closestPoint.y,
      value: closestPoint.value,
      date: closestPoint.date,
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container" 
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: "680px" }}
      >
        {/* Backdrop Glow */}
        <div className={`modal-glow ${priceColorClass}`} />

        {/* Modal Close Action */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close transactions modal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <div className="modal-main-content">
          <header className="modal-header-block">
            <div>
              <div className="modal-title-row">
                <h2 className="modal-symbol-title">Portfolio</h2>
                <span className="modal-sector-badge">Active</span>
              </div>
              <h3 className="modal-company-name">Overview & Transaction History</h3>
            </div>

            <div className="modal-price-block">
              <div className="modal-current-price">
                {currency.format(totals.currentValue)}
              </div>
              <div className={`modal-pct-change ${priceColorClass}`}>
                {totals.gainLoss >= 0 ? "+" : ""}{currency.format(totals.gainLoss)} ({totals.gainLossPct >= 0 ? "+" : ""}{totals.gainLossPct.toFixed(2)}%)
              </div>
            </div>
          </header>

          <nav className="modal-tabs-nav">
            {[
              { id: "overview", label: "Overview" },
              { id: "transactions", label: `All Transactions (${transactions.length})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`modal-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && (
            <>
              <section className="modal-chart-section">
                <div className="modal-chart-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <span className="modal-chart-label">Value Trend</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["1D", "1W", "1M", "1Y"] as const).map((r) => (
                        <button
                          key={r}
                          onClick={() => setActiveRange(r)}
                          style={{
                            background: activeRange === r ? "rgba(176, 228, 204, 0.08)" : "none",
                            border: `1px solid ${activeRange === r ? "var(--mint)" : "rgba(255, 255, 255, 0.06)"}`,
                            color: activeRange === r ? "var(--mint)" : "var(--ink-3)",
                            fontSize: "10px",
                            fontWeight: "bold",
                            padding: "3px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            transition: "all 0.2s"
                          }}
                          onMouseEnter={(e) => {
                            if (activeRange !== r) {
                              e.currentTarget.style.borderColor = "rgba(176, 228, 204, 0.4)";
                              e.currentTarget.style.color = "var(--ink-2)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeRange !== r) {
                              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.06)";
                              e.currentTarget.style.color = "var(--ink-3)";
                            }
                          }}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                  {hoveredPoint ? (
                    <div className="modal-chart-tooltip">
                      <span className="tooltip-date">{hoveredPoint.date}:</span>
                      <span className="tooltip-price blur-amount">${hoveredPoint.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ) : (
                    <span className="modal-chart-instructions">Hover chart to explore valuation</span>
                  )}
                </div>

                {isLoadingPerformance ? (
                  <div style={{ height: "220px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span className="skeleton-cell pulse" style={{ width: "80px", height: "16px", borderRadius: "2px" }} />
                  </div>
                ) : history.length > 1 ? (
                  <svg
                    ref={svgRef}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    width="100%"
                    height="100%"
                    className="modal-svg-canvas"
                    onMouseMove={handleMouseMove}
                    onMouseLeave={handleMouseLeave}
                  >
                    <defs>
                      <linearGradient id="modalAreaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.00" />
                      </linearGradient>
                    </defs>

                    {Array.from({ length: 4 }).map((_, i) => {
                      const y = paddingY + (i / 3) * chartHeight;
                      const val = chartMax - (i / 3) * (chartMax - chartMin);
                      return (
                        <g key={i}>
                          <line 
                            x1={paddingX} 
                            y1={y} 
                            x2={svgWidth - paddingX} 
                            y2={y} 
                            className="modal-chart-grid-line"
                          />
                          <text
                            x={paddingX - 8}
                            y={y + 4}
                            className="modal-chart-axis-text blur-amount"
                            textAnchor="end"
                          >
                            ${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </text>
                        </g>
                      );
                    })}

                    <path d={areaPathD} fill="url(#modalAreaGradient)" />
                    <path d={linePathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

                    {/* Active hover crosshair and tracking dot */}
                    {hoveredPoint && (
                      <>
                        <line
                          x1={hoveredPoint.x}
                          y1={paddingY}
                          x2={hoveredPoint.x}
                          y2={svgHeight - paddingY}
                          className="modal-chart-crosshair"
                        />
                        <circle
                          cx={hoveredPoint.x}
                          cy={hoveredPoint.y}
                          r="5.5"
                          fill={strokeColor}
                          stroke="var(--bg-core)"
                          strokeWidth="2.5"
                          className="modal-chart-interactive-dot"
                        />
                      </>
                    )}

                    {/* Min and Max X labels */}
                    <text
                      x={paddingX}
                      y={svgHeight - 8}
                      className="modal-chart-axis-text"
                    >
                      {history[0]?.date || ""}
                    </text>
                    <text
                      x={svgWidth - paddingX}
                      y={svgHeight - 8}
                      className="modal-chart-axis-text"
                      textAnchor="end"
                    >
                      {history[history.length - 1]?.date || ""}
                    </text>
                  </svg>
                ) : (
                  <div className="modal-no-chart">Historical trend data not available.</div>
                )}
              </section>

              {/* Portfolio Description */}
              <section className="modal-desc-section">
                <h4 className="modal-section-subtitle">Portfolio Summary</h4>
                <p className="modal-desc-text">
                  Your investment portfolio consists of {activeHoldings.length} active positions. 
                  The total invested capital is <span className="blur-amount">{currency.format(totals.invested)}</span>, which currently holds a market valuation of <span className="blur-amount">{currency.format(totals.currentValue)}</span>. 
                  Your net performance stands at an unrealized profit/loss of <span className="blur-amount">{currency.format(totals.gainLoss)} ({totals.gainLossPct >= 0 ? "+" : ""}{totals.gainLossPct.toFixed(2)}%)</span>, 
                  with a total of {transactions.length} transactions recorded since inception.
                </p>
              </section>

              {/* Stats Grid */}
              <section className="modal-stats-section">
                <h4 className="modal-section-subtitle">Portfolio Statistics</h4>
                <div className="modal-stats-grid">
                  {[
                    { label: "Current Value", value: currency.format(totals.currentValue) },
                    { label: "Invested Capital", value: currency.format(totals.invested) },
                    { label: "Unrealized P/L", value: `${totals.gainLoss >= 0 ? "+" : ""}${currency.format(totals.gainLoss)} (${totals.gainLossPct >= 0 ? "+" : ""}${totals.gainLossPct.toFixed(2)}%)` },
                    { label: "Realized P/L", value: `${totals.realizedGainLoss >= 0 ? "+" : ""}${currency.format(totals.realizedGainLoss)}` },
                    { label: "Active Holdings", value: `${activeHoldings.length} position${activeHoldings.length !== 1 ? 's' : ''}` },
                    { label: "Total Transactions", value: `${transactions.length} record${transactions.length !== 1 ? 's' : ''}` }
                  ].map(item => (
                    <div key={item.label} className="modal-stat-card">
                      <span className="modal-stat-label">{item.label}</span>
                      <span className={`modal-stat-value ${item.label !== "Active Holdings" && item.label !== "Total Transactions" ? "blur-amount" : ""}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {activeTab === "transactions" && (
            <section className="modal-tx-section" style={{ marginTop: 0 }}>
              {transactions.length === 0 ? (
                <div className="modal-restricted-card">
                  <span className="modal-icon-wrapper">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="modal-restricted-empty-icon">
                      <path d="M12 20V10M18 20V4M6 20v-6"/>
                    </svg>
                  </span>
                  <h5 className="modal-restricted-title">No Transactions Yet</h5>
                  <p className="modal-restricted-desc">
                    Record your first buy or sell transaction to populate the log.
                  </p>
                </div>
              ) : (
                <div className="modal-tx-table-container" style={{ maxHeight: "380px", overflowY: "auto" }}>
                  <table className="modal-tx-table">
                    <thead>
                      <tr className="modal-tx-tr">
                        <th className="modal-tx-th">TYPE</th>
                        <th className="modal-tx-th">DATE</th>
                        <th className="modal-tx-th">STOCK</th>
                        <th className="modal-tx-th right">QUANTITY</th>
                        <th className="modal-tx-th right">PRICE</th>
                        <th className="modal-tx-th right">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((tx) => {
                        const qty = parseFloat(tx.quantity) || 0;
                        const prc = parseFloat(tx.price) || 0;
                        const total = qty * prc;
                        return (
                          <tr key={tx.id} className="modal-tx-tr">
                            <td className="modal-tx-td highlight">
                              <span style={{
                                fontSize: "9px",
                                fontWeight: "bold",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: tx.type === "SELL" ? "rgba(242, 109, 109, 0.12)" : "rgba(176, 228, 204, 0.12)",
                                color: tx.type === "SELL" ? "#f26d6d" : "var(--mint)"
                              }}>
                                {tx.type}
                              </span>
                            </td>
                            <td className="modal-tx-td highlight">{new Date(tx.transactionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                            <td className="modal-tx-td highlight-bold">{tx.sym}</td>
                            <td className="modal-tx-td highlight-bold right blur-amount">{qty}</td>
                            <td className="modal-tx-td right blur-amount">${prc.toFixed(2)}</td>
                            <td className="modal-tx-td mint-bold right blur-amount">${total.toFixed(2)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PortfolioPage() {
  const { data: session, status } = useSession();
  const [amountsBlurred, setAmountsBlurred] = useState(false);

  useEffect(() => {
    const initialVal = localStorage.getItem("amounts_blurred") === "true";
    console.log("[Portfolio] Initialized amountsBlurred state. value:", initialVal);
    setAmountsBlurred(initialVal);

    const handleVisibilityChange = () => {
      const newVal = localStorage.getItem("amounts_blurred") === "true";
      console.log("[Portfolio] handleVisibilityChange triggered. newVal:", newVal);
      setAmountsBlurred(newVal);
    };

    window.addEventListener("amounts-visibility-change", handleVisibilityChange);
    return () => {
      window.removeEventListener("amounts-visibility-change", handleVisibilityChange);
    };
  }, []);

  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(true);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [isError, setIsError] = useState(false);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const [performanceData, setPerformanceData] = useState<any>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [activeRange, setActiveRange] = useState<"1D" | "1W" | "1M" | "1Y">("1D");

  const activePerformancePoints = useMemo(() => {
    if (!performanceData) return [];
    
    // Support both the new object format and any legacy array format
    if (Array.isArray(performanceData)) {
      if (performanceData.length === 0) return [];
      switch (activeRange) {
        case "1D": return performanceData.slice(-2);
        case "1W": return performanceData.slice(-5);
        case "1M": return performanceData.slice(-21);
        case "1Y":
        default: return performanceData;
      }
    }
    
    return performanceData[activeRange] || [];
  }, [performanceData, activeRange]);

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

  const loadPerformance = useCallback(async () => {
    if (status !== "authenticated") return;
    setIsLoadingPerformance(true);
    try {
      const res = await fetch("/api/portfolio/performance");
      if (res.ok) {
        const json = await res.json();
        setPerformanceData(json.data || null);
      }
    } catch (err) {
      console.error("Failed to load portfolio performance:", err);
    } finally {
      setIsLoadingPerformance(false);
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      loadPerformance();
    }
  }, [status, transactions.length, loadPerformance]);

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
    <div className={amountsBlurred ? "amounts-blurred" : ""}>
      {amountsBlurred && (
        <style dangerouslySetInnerHTML={{ __html: `
          .blur-amount {
            filter: blur(6px) !important;
            user-select: none !important;
            pointer-events: none !important;
            transition: filter 0.15s ease-out;
          }
        `}} />
      )}
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
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", minWidth: 0 }}>
                {/* Performance History Chart */}
                <section className="db-section u2.5" style={{ padding: "20px 24px" }}>
                  {isLoadingPerformance ? (
                    <PerformanceChartSkeleton />
                  ) : (
                    <PortfolioPerformanceChart 
                      data={activePerformancePoints} 
                      activeRange={activeRange}
                      setActiveRange={setActiveRange}
                      onOpenTransactions={() => setShowAllTransactions(true)}
                    />
                  )}
                </section>

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
                            <span className="right blur-amount">
                              {sharesFormatter.format(holding.quantity)}
                            </span>
                            <span className="right blur-amount">
                              {currency.format(holding.avgPrice)}
                            </span>
                            <span className="right blur-amount">
                              {holding.hasLivePrice
                                ? currency.format(holding.currentPrice)
                                : "Pending"}
                            </span>
                            <span className="right blur-amount">
                              {currency.format(holding.invested)}
                            </span>
                            <span className="right blur-amount">
                              {currency.format(holding.currentValue)}
                            </span>
                            <span
                              className={`right pf-pl blur-amount ${
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
                                <span className="pf-mobile-card-value blur-amount">{sharesFormatter.format(holding.quantity)}</span>
                              </div>
                              <div className="pf-mobile-card-stat">
                                <span className="pf-mobile-card-label">Avg Cost</span>
                                <span className="pf-mobile-card-value blur-amount">{currency.format(holding.avgPrice)}</span>
                              </div>
                              <div className="pf-mobile-card-stat">
                                <span className="pf-mobile-card-label">Current</span>
                                <span className="pf-mobile-card-value blur-amount">
                                  {holding.hasLivePrice ? currency.format(holding.currentPrice) : "Pending"}
                                </span>
                              </div>
                              <div className="pf-mobile-card-stat">
                                <span className="pf-mobile-card-label">Invested</span>
                                <span className="pf-mobile-card-value blur-amount">{currency.format(holding.invested)}</span>
                              </div>
                              <div className="pf-mobile-card-stat">
                                <span className="pf-mobile-card-label">Value</span>
                                <span className="pf-mobile-card-value blur-amount">{currency.format(holding.currentValue)}</span>
                              </div>
                              <div className="pf-mobile-card-stat">
                                <span className="pf-mobile-card-label">P/L</span>
                                <span className={`pf-mobile-card-value pf-pl blur-amount ${holding.gainLoss >= 0 ? "up" : "down"}`}>
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
              </div>

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
                              <strong className="blur-amount">
                                {compactCurrency.format(holding.currentValue)} ({width.toFixed(1)}%)
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
                  <div className="db-section-header" style={{ cursor: "pointer" }} onClick={() => setShowAllTransactions(true)}>
                    <h2 className="db-section-title" style={{ transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--mint)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--ink-2)"}>
                      Transactions ↗
                    </h2>
                    <span className="pf-panel-note">View all</span>
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
                            <span className="blur-amount">{sharesFormatter.format(Number(tx.quantity))}</span>
                            <strong className="blur-amount">{currency.format(Number(tx.price))}</strong>
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

      {showAllTransactions && (
        <AllTransactionsModal
          transactions={transactions}
          onClose={() => setShowAllTransactions(false)}
          performanceData={performanceData}
          isLoadingPerformance={isLoadingPerformance}
          totals={totals}
          activeHoldings={activeHoldings}
        />
      )}
    </div>
  );
}