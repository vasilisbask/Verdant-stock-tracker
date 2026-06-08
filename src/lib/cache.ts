export interface StockDetailsResponse {
  success: boolean;
  symbol: string;
  summary: {
    description: string;
    sector: string;
    industry: string;
    website: string;
    name: string;
  };
  stats: {
    dividendYield: string;
    marketCap: string;
    volume: string;
    trailingPE: string;
    dayLow: string;
    dayHigh: string;
    open: string;
    fiftyTwoWeekHigh: string;
    fiftyTwoWeekLow: string;
  };
  history: {
    "1D": Array<{ date: string; close: number }>;
    "1W": Array<{ date: string; close: number }>;
    "1M": Array<{ date: string; close: number }>;
    "1Y": Array<{ date: string; close: number }>;
  };
  news?: Array<{
    uuid: string;
    title: string;
    publisher: string;
    link: string;
    time: string;
    thumbnail: string | null;
  }>;
  daily?: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
  };
}

interface CacheEntry {
  data: StockDetailsResponse;
  timestamp: number;
}

const clientCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export function getCachedDetails(symbol: string): StockDetailsResponse | null {
  if (typeof window === "undefined") return null;
  const sym = symbol.toUpperCase();
  const cached = clientCache.get(sym);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    return cached.data;
  }
  return null;
}

export function setCachedDetails(symbol: string, data: StockDetailsResponse) {
  if (typeof window === "undefined") return;
  const sym = symbol.toUpperCase();
  clientCache.set(sym, {
    data,
    timestamp: Date.now()
  });
}
