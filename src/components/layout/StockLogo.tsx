"use client";

import { useState, useEffect } from "react";

// Explicit brand overrides where the parent corporate name differs heavily from the iconic product brand
const BRAND_OVERRIDES: Record<string, string> = {
  GOOGL: "google.com",
  GOOG: "google.com",
};

interface StockLogoProps {
  symbol: string;
  companyName?: string;
  size?: number;
  className?: string;
}

export default function StockLogo({ symbol, companyName, size = 20, className = "" }: StockLogoProps) {
  const [error, setError] = useState(false);
  const cleanSym = symbol.trim().toUpperCase();

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    if (typeof window === "undefined" || !cleanSym) return null;
    try {
      // Uses the v6 cache namespace to trigger a clean, fresh resolution for all tickers
      const cached = localStorage.getItem(`vdt_logo_v6_${cleanSym}`);
      if (cached === "fallback") return null;
      if (cached) return cached;
      
      // Instant load for specific brand overrides (Google)
      if (BRAND_OVERRIDES[cleanSym]) {
        return `https://logos.hunter.io/${BRAND_OVERRIDES[cleanSym]}`;
      }
    } catch {}
    return null;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !cleanSym) return;

    // If it is a brand override (like Google), do not query in the background
    if (BRAND_OVERRIDES[cleanSym]) {
      setError(false);
      return;
    }

    // Check local storage cache first
    try {
      const cached = localStorage.getItem(`vdt_logo_v6_${cleanSym}`);
      if (cached) {
        if (cached === "fallback") {
          setError(true);
        } else {
          setLogoUrl(cached);
          setError(false);
        }
        return;
      }
    } catch {}

    let active = true;

    async function resolveLogo() {
      // Try querying by Company Name first (highest brand accuracy)
      if (companyName) {
        try {
          // Remove common corporate suffixes to maximize autocomplete hits
          const cleanName = companyName
            .replace(/(Inc\.|Ltd\.|Corp\.|Group|Co\.|Global|International|Holdings|Class\s+[A-Z])/gi, "")
            .trim();
          const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(cleanName)}`);
          if (!active) return;
          if (res.ok) {
            const json = await res.json();
            if (json && json.length > 0 && json[0].domain) {
              const domain = json[0].domain;
              const url = `https://logos.hunter.io/${domain}`;
              setLogoUrl(url);
              setError(false);
              try { localStorage.setItem(`vdt_logo_v6_${cleanSym}`, url); } catch {}
              return;
            }
          }
        } catch (err) {
          console.warn(`[StockLogo] Company name lookup failed for ${companyName}:`, err);
        }
      }

      // Fallback: Try querying by Ticker Symbol directly
      try {
        const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${cleanSym}`);
        if (!active) return;
        if (res.ok) {
          const json = await res.json();
          if (json && json.length > 0 && json[0].domain) {
            const domain = json[0].domain;
            const url = `https://logos.hunter.io/${domain}`;
            setLogoUrl(url);
            setError(false);
            try { localStorage.setItem(`vdt_logo_v6_${cleanSym}`, url); } catch {}
            return;
          }
        }
      } catch (err) {
        console.warn(`[StockLogo] Symbol lookup failed for ${cleanSym}:`, err);
      }

      // Complete Fallback: Cache as fallback and render letters badge
      if (active) {
        setError(true);
        try { localStorage.setItem(`vdt_logo_v6_${cleanSym}`, "fallback"); } catch {}
      }
    }

    resolveLogo();

    return () => {
      active = false;
    };
  }, [symbol, companyName, cleanSym]);

  // Generate dynamic fallback dark mode background color
  const getFallbackColor = (sym: string) => {
    let hash = 0;
    for (let i = 0; i < sym.length; i++) {
      hash = sym.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 40%, 30%)`;
  };

  if (error || !logoUrl || !cleanSym) {
    const char = cleanSym ? cleanSym.slice(0, 2) : "—";
    return (
      <div
        className={`stock-logo-fallback ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: getFallbackColor(cleanSym),
          color: "rgba(176, 228, 204, 0.95)",
          fontWeight: 700,
          fontSize: size * 0.45,
          letterSpacing: "-0.5px",
          fontFamily: "var(--font-mono, monospace)",
          textTransform: "uppercase",
          border: "1px solid rgba(176, 228, 204, 0.15)",
        }}
      >
        {char}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      onError={() => {
        setError(true);
        try { localStorage.setItem(`vdt_logo_v6_${cleanSym}`, "fallback"); } catch {}
      }}
      alt=""
      className={`stock-logo-img ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: "50%",
        objectFit: "contain",
        backgroundColor: "transparent", // Transparent dark-mode compatibility
      }}
    />
  );
}
