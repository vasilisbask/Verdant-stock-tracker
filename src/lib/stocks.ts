export interface StockDetails {
  name: string;
  sector: string;
}

export const SECTORS = [
  "All",
  "Technology",
  "Comm. Services",
  "Consumer Disc.",
  "Financials",
  "Healthcare",
  "Energy",
  "Industrials",
  "Consumer Staples",
  "Utilities",
  "Materials",
  "Real Estate"
];

// Helper to map Yahoo Finance sector strings to our UI GICS sectors
export function mapYahooSector(yahooSector: string | undefined): string {
  if (!yahooSector) return "Other";
  const sec = yahooSector.trim().toLowerCase();
  
  if (sec.includes("technology")) return "Technology";
  if (sec.includes("communication")) return "Comm. Services";
  if (sec.includes("cyclical") || sec.includes("discretionary")) return "Consumer Disc.";
  if (sec.includes("financial")) return "Financials";
  if (sec.includes("healthcare") || sec.includes("health")) return "Healthcare";
  if (sec.includes("energy")) return "Energy";
  if (sec.includes("industrial")) return "Industrials";
  if (sec.includes("defensive") || sec.includes("staples")) return "Consumer Staples";
  if (sec.includes("utility") || sec.includes("utilities")) return "Utilities";
  if (sec.includes("materials")) return "Materials";
  if (sec.includes("real estate")) return "Real Estate";
  
  return "Other";
}

// Static helper map to resolve GICS sectors for active global equities instantly
const COMMON_SECTOR_MAP: Record<string, string> = {
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", AVGO: "Technology", AMD: "Technology",
  CSCO: "Technology", ORCL: "Technology", CRM: "Technology", ADBE: "Technology", INTC: "Technology",
  QCOM: "Technology", IBM: "Technology", PLTR: "Technology", TSM: "Technology", ASML: "Technology",
  GOOGL: "Comm. Services", GOOG: "Comm. Services", META: "Comm. Services", NFLX: "Comm. Services",
  DIS: "Comm. Services", TMUS: "Comm. Services", VZ: "Comm. Services", T: "Comm. Services",
  AMZN: "Consumer Disc.", TSLA: "Consumer Disc.", HD: "Consumer Disc.", MCD: "Consumer Disc.",
  NKE: "Consumer Disc.", SBUX: "Consumer Disc.", UBER: "Consumer Disc.", BABA: "Consumer Disc.",
  JPM: "Financials", V: "Financials", MA: "Financials", BAC: "Financials", WFC: "Financials",
  MS: "Financials", GS: "Financials", AXP: "Financials", PYPL: "Financials",
  LLY: "Healthcare", UNH: "Healthcare", JNJ: "Healthcare", MRK: "Healthcare", ABBV: "Healthcare",
  PFE: "Healthcare", TMO: "Healthcare", CVS: "Healthcare", MDT: "Healthcare",
  XOM: "Energy", CVX: "Energy", COP: "Energy", SLB: "Energy", BP: "Energy", SHEL: "Energy",
  GE: "Industrials", CAT: "Industrials", HON: "Industrials", UNP: "Industrials", UPS: "Industrials",
  WMT: "Consumer Staples", PG: "Consumer Staples", KO: "Consumer Staples", PEP: "Consumer Staples", COST: "Consumer Staples",
  NEE: "Utilities", DUK: "Utilities", SO: "Utilities",
  LIN: "Materials", BHP: "Materials", RIO: "Materials",
  PLD: "Real Estate", AMT: "Real Estate", EQIX: "Real Estate"
};

// in-memory cache to store dynamically looked-up company profiles
interface DynamicCacheEntry {
  name: string;
  sector: string;
  timestamp: number;
}

const dynamicProfileCache = new Map<string, DynamicCacheEntry>();

export function getCompanyMeta(symbol: string): StockDetails {
  const sym = symbol.toUpperCase();
  const cached = dynamicProfileCache.get(sym);
  if (cached) {
    return { name: cached.name, sector: cached.sector };
  }
  return { name: sym, sector: COMMON_SECTOR_MAP[sym] || "Other" };
}

export function cacheCompanyMeta(symbol: string, name: string, sector: string) {
  const sym = symbol.toUpperCase();
  dynamicProfileCache.set(sym, {
    name,
    sector: sector || "Other",
    timestamp: Date.now(),
  });
}
