"use client";

import { useState, useEffect, useRef } from "react";

const CACHE_NS = "vdt_logo_v10";

interface StockLogoProps {
  symbol: string;
  companyName?: string;
  size?: number;
  className?: string;
}

const inFlight = new Set<string>();

export default function StockLogo({ symbol, size = 20, className = "" }: StockLogoProps) {
  const cleanSym = symbol.trim().toUpperCase();
  const mountedRef = useRef(true);

  const [logoUrl, setLogoUrl] = useState<string | null>(() => {
    if (typeof window === "undefined" || !cleanSym) return null;
    try {
      const cached = localStorage.getItem(`${CACHE_NS}_${cleanSym}`);
      if (cached === "fallback") return null;
      if (cached) return cached;
    } catch {}
    return null;
  });

  const [error, setError] = useState(() => {
    if (typeof window === "undefined" || !cleanSym) return false;
    try {
      return localStorage.getItem(`${CACHE_NS}_${cleanSym}`) === "fallback";
    } catch {}
    return false;
  });

  useEffect(() => {
    mountedRef.current = true;
    if (!cleanSym) return;

    try {
      const cached = localStorage.getItem(`${CACHE_NS}_${cleanSym}`);
      if (cached && cached !== "fallback") {
        if (logoUrl !== cached) {
          setLogoUrl(cached);
          setError(false);
        }
        return;
      }
      if (cached === "fallback") {
        setError(true);
        return;
      }
    } catch {}

    if (inFlight.has(cleanSym)) return;
    inFlight.add(cleanSym);

    const fmpUrl = `https://financialmodelingprep.com/image-stock/${cleanSym}.png`;
    setLogoUrl(fmpUrl);
    setError(false);
    inFlight.delete(cleanSym);

    return () => { mountedRef.current = false; };
  }, [cleanSym]);

  const handleImgError = () => {
    setError(true);
    setLogoUrl(null);
    try { localStorage.setItem(`${CACHE_NS}_${cleanSym}`, "fallback"); } catch {}
  };

  const handleImgLoad = () => {
    if (logoUrl) {
      try { localStorage.setItem(`${CACHE_NS}_${cleanSym}`, logoUrl); } catch {}
    }
  };

  const getFallbackColor = (sym: string) => {
    let hash = 0;
    for (let i = 0; i < sym.length; i++) {
      hash = sym.charCodeAt(i) + ((hash << 5) - hash);
    }
    return `hsl(${Math.abs(hash) % 360}, 40%, 30%)`;
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
          backgroundColor: getFallbackColor(cleanSym),
          fontSize: size * 0.45,
        }}
      >
        {char}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      onError={handleImgError}
      onLoad={handleImgLoad}
      alt=""
      className={`stock-logo-img ${className}`}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
      }}
    />
  );
}
