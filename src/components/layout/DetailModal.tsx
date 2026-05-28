"use client";

import { useState, useEffect, useRef } from "react";
import { getCachedDetails, setCachedDetails, StockDetailsResponse } from "@/lib/cache";

interface DetailModalProps {
  symbol: string;
  onClose: () => void;
}

export default function DetailModal({ symbol, onClose }: DetailModalProps) {
  const [data, setData] = useState<StockDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Interactive chart hover states
  const [hoveredPoint, setHoveredPoint] = useState<{
    x: number;
    y: number;
    price: number;
    date: string;
    index: number;
  } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!symbol) return;
    
    let active = true;
    const cached = getCachedDetails(symbol);
    
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }

    async function loadDetails() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/stocks/details?symbol=${symbol}`);
        if (!active) return;
        
        if (res.ok) {
          const json: StockDetailsResponse = await res.json();
          setData(json);
          setCachedDetails(symbol, json);
        } else {
          try {
            const errJson = await res.json();
            setError(errJson.error || "Failed to load stock details.");
          } catch {
            setError("Service temporarily unavailable.");
          }
        }
      } catch (err) {
        if (active) {
          setError("Network error fetching stock details.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadDetails();
    return () => { active = false; };
  }, [symbol]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!symbol) return null;

  // Chart scaling calculations
  const history = data?.history || [];
  const minPrice = history.length > 0 ? Math.min(...history.map(h => h.close)) : 0;
  const maxPrice = history.length > 0 ? Math.max(...history.map(h => h.close)) : 0;
  const priceRange = maxPrice - minPrice || 1;

  // Chart viewport bounds
  const svgWidth = 600;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 25;
  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingY * 2;

  // Generate SVG coordinates
  const points = history.map((h, i) => {
    const x = paddingX + (i / (history.length - 1)) * chartWidth;
    const y = svgHeight - paddingY - ((h.close - minPrice) / priceRange) * chartHeight;
    return { x, y, price: h.close, date: h.date };
  });

  // SVG Line path string
  const linePathD = points.reduce((acc, p, i) => {
    return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
  }, "");

  // SVG Area fill path string
  const areaPathD = points.length > 0 
    ? `${linePathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`
    : "";

  // Mouse event handlers for SVG chart interactivity
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current || points.length === 0) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale mouse position to SVG viewbox coords
    const svgMouseX = (mouseX / rect.width) * svgWidth;
    
    // Find the closest point index chronologically
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
      price: closestPoint.price,
      date: closestPoint.date,
      index: closestIndex
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  // Determine standard colors based on price changes
  const isUp = history.length > 1 ? history[history.length - 1].close >= history[0].close : true;
  const priceColorClass = isUp ? "up" : "down";
  const strokeColor = isUp ? "var(--mint)" : "#f26d6d";

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-container scrollbar-hidden" 
        onClick={e => e.stopPropagation()}
        style={{ animation: "modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
      >
        {/* Backdrop Glow */}
        <div className={`modal-glow ${priceColorClass}`} />

        {/* Modal Close Action */}
        <button className="modal-close-btn" onClick={onClose} aria-label="Close details modal">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {loading ? (
          /* Premium Loading Skeleton */
          <div className="modal-skeleton-body">
            <div className="skeleton-cell pulse" style={{ width: "35%", height: 32, borderRadius: 4 }} />
            <div className="skeleton-cell pulse" style={{ width: "20%", height: 18, borderRadius: 4, marginTop: 12 }} />
            
            <div className="skeleton-cell pulse" style={{ width: "100%", height: 180, borderRadius: 8, marginTop: 32 }} />
            
            <div className="modal-skeleton-stats">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton-cell pulse" style={{ height: 48, borderRadius: 4 }} />
              ))}
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="modal-error-container">
            <div className="modal-error-icon">⚠️</div>
            <h3 className="modal-error-title">Failed to load details</h3>
            <p className="modal-error-desc">{error}</p>
            <button className="btn-primary btn-sm" onClick={onClose} style={{ marginTop: 20 }}>
              Go Back
            </button>
          </div>
        ) : data ? (
          /* Loaded Stock Profile view */
          <div className="modal-main-content">
            {/* Header section */}
            <header className="modal-header-block">
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                  <h2 className="modal-symbol-title">{data.symbol}</h2>
                  <span className="modal-sector-badge">{data.summary.sector}</span>
                </div>
                <h3 className="modal-company-name">
                  {data.summary.name}
                  {data.summary.website && (
                    <a 
                      href={data.summary.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="modal-website-link"
                    >
                      ↗
                    </a>
                  )}
                </h3>
                <span className="modal-industry-tag">{data.summary.industry}</span>
              </div>
              
              <div className="modal-price-block">
                {history.length > 0 ? (
                  <>
                    <div className="modal-current-price">
                      ${history[history.length - 1].close.toFixed(2)}
                    </div>
                    <div className={`modal-pct-change ${priceColorClass}`}>
                      {(() => {
                        const first = history[0].close;
                        const last = history[history.length - 1].close;
                        const diff = last - first;
                        const pct = (diff / first) * 100;
                        const sign = diff >= 0 ? "+" : "";
                        return `${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%) 30d`;
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="modal-current-price">—</div>
                )}
              </div>
            </header>

            {/* SVG Historical Price Line Chart */}
            <section className="modal-chart-section">
              <div className="modal-chart-header">
                <span className="modal-chart-label">30-Day Historical Trend</span>
                {hoveredPoint ? (
                  <div className="modal-chart-tooltip">
                    <span className="tooltip-date">{hoveredPoint.date}:</span>
                    <span className="tooltip-price">${hoveredPoint.price.toFixed(2)}</span>
                  </div>
                ) : (
                  <span className="modal-chart-instructions">Hover chart to explore pricing</span>
                )}
              </div>

              {history.length > 1 ? (
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
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
                      <stop offset="100%" stopColor={strokeColor} stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid lines */}
                  {Array.from({ length: 4 }).map((_, i) => {
                    const y = paddingY + (i / 3) * chartHeight;
                    const val = maxPrice - (i / 3) * priceRange;
                    return (
                      <g key={i}>
                        <line 
                          x1={paddingX} 
                          y1={y} 
                          x2={svgWidth - paddingX} 
                          y2={y} 
                          stroke="rgba(255, 255, 255, 0.05)" 
                          strokeWidth="1" 
                          strokeDasharray="2 2"
                        />
                        <text
                          x={paddingX - 8}
                          y={y + 4}
                          fill="rgba(255, 255, 255, 0.3)"
                          fontSize="9"
                          textAnchor="end"
                        >
                          ${val.toFixed(0)}
                        </text>
                      </g>
                    );
                  })}

                  {/* SVG paths */}
                  <path d={areaPathD} fill="url(#areaGradient)" />
                  <path d={linePathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" />

                  {/* Active hover crosshair and tracking dot */}
                  {hoveredPoint && (
                    <>
                      <line
                        x1={hoveredPoint.x}
                        y1={paddingY}
                        x2={hoveredPoint.x}
                        y2={svgHeight - paddingY}
                        stroke="rgba(255, 255, 255, 0.15)"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                      <circle
                        cx={hoveredPoint.x}
                        cy={hoveredPoint.y}
                        r="5.5"
                        fill={strokeColor}
                        stroke="var(--bg-core)"
                        strokeWidth="2.5"
                        style={{ filter: "drop-shadow(0 0 4px rgba(255,255,255,0.3))" }}
                      />
                    </>
                  )}

                  {/* Min and Max X labels */}
                  <text
                    x={paddingX}
                    y={svgHeight - 8}
                    fill="rgba(255, 255, 255, 0.25)"
                    fontSize="9"
                  >
                    {history[0].date}
                  </text>
                  <text
                    x={svgWidth - paddingX}
                    y={svgHeight - 8}
                    fill="rgba(255, 255, 255, 0.25)"
                    fontSize="9"
                    textAnchor="end"
                  >
                    {history[history.length - 1].date}
                  </text>
                </svg>
              ) : (
                <div className="modal-no-chart">Historical charts not available for this symbol.</div>
              )}
            </section>

            {/* Corporate Profile description */}
            <section className="modal-desc-section">
              <h4 className="modal-section-subtitle">Company Overview</h4>
              <p className="modal-desc-text scrollbar-hidden">
                {data.summary.description}
              </p>
            </section>

            {/* Detailed Stats Grid */}
            <section className="modal-stats-section">
              <h4 className="modal-section-subtitle">Key Statistics</h4>
              <div className="modal-stats-grid">
                {[
                  { label: "Market Cap", value: data.stats.marketCap },
                  { label: "P/E Ratio (Trailing)", value: data.stats.trailingPE },
                  { label: "Dividend Yield", value: data.stats.dividendYield },
                  { label: "Volume (Average)", value: data.stats.volume },
                  { label: "Today's Range", value: `${data.stats.dayLow} – ${data.stats.dayHigh}` },
                  { label: "52-Week Range", value: `${data.stats.fiftyTwoWeekLow} – ${data.stats.fiftyTwoWeekHigh}` }
                ].map(item => (
                  <div key={item.label} className="modal-stat-card">
                    <span className="modal-stat-label">{item.label}</span>
                    <span className="modal-stat-value">{item.value || "—"}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
