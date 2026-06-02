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
  // Technology
  AAPL: "Technology", MSFT: "Technology", NVDA: "Technology", AVGO: "Technology", AMD: "Technology",
  CSCO: "Technology", ORCL: "Technology", CRM: "Technology", ADBE: "Technology", INTC: "Technology",
  QCOM: "Technology", IBM: "Technology", PLTR: "Technology", TSM: "Technology", ASML: "Technology",
  MARA: "Technology", RIOT: "Technology", SOXL: "Technology", MSTR: "Technology", MU: "Technology",
  TXN: "Technology", AMAT: "Technology", LRCX: "Technology", SMCI: "Technology", SOUN: "Technology",
  
  // Communication Services
  GOOGL: "Comm. Services", GOOG: "Comm. Services", META: "Comm. Services", NFLX: "Comm. Services",
  DIS: "Comm. Services", TMUS: "Comm. Services", VZ: "Comm. Services", T: "Comm. Services",
  SNAP: "Comm. Services", PINS: "Comm. Services", WBD: "Comm. Services", PARA: "Comm. Services",
  CMCSA: "Comm. Services", ROKU: "Comm. Services", DJT: "Comm. Services",
  
  // Consumer Discretionary
  AMZN: "Consumer Disc.", TSLA: "Consumer Disc.", HD: "Consumer Disc.", MCD: "Consumer Disc.",
  NKE: "Consumer Disc.", SBUX: "Consumer Disc.", UBER: "Consumer Disc.", BABA: "Consumer Disc.",
  F: "Consumer Disc.", LCID: "Consumer Disc.", CCL: "Consumer Disc.", NIO: "Consumer Disc.",
  XPEV: "Consumer Disc.", LI: "Consumer Disc.", JD: "Consumer Disc.", PDD: "Consumer Disc.",
  DKNG: "Consumer Disc.", LYFT: "Consumer Disc.", GM: "Consumer Disc.", RIVN: "Consumer Disc.",
  GME: "Consumer Disc.", AMC: "Consumer Disc.", GRAB: "Consumer Disc.", SE: "Consumer Disc.",
  
  // Financials
  JPM: "Financials", V: "Financials", MA: "Financials", BAC: "Financials", WFC: "Financials",
  MS: "Financials", GS: "Financials", AXP: "Financials", PYPL: "Financials",
  SOFI: "Financials", COIN: "Financials", SQ: "Financials", HOOD: "Financials",
  KEY: "Financials", NYCB: "Financials", HBAN: "Financials", C: "Financials", SCHW: "Financials",
  NU: "Financials", BBD: "Financials", ITUB: "Financials",
  
  // Healthcare
  LLY: "Healthcare", UNH: "Healthcare", JNJ: "Healthcare", MRK: "Healthcare", ABBV: "Healthcare",
  PFE: "Healthcare", TMO: "Healthcare", CVS: "Healthcare", MDT: "Healthcare", BMY: "Healthcare",
  AMGN: "Healthcare", GILD: "Healthcare", ISRG: "Healthcare", KVUE: "Healthcare", DNA: "Healthcare",
  
  // Energy
  XOM: "Energy", CVX: "Energy", COP: "Energy", SLB: "Energy", BP: "Energy", SHEL: "Energy",
  PBR: "Energy", ET: "Energy", OXY: "Energy", HAL: "Energy", MPC: "Energy", CPG: "Energy",
  
  // Industrials
  GE: "Industrials", CAT: "Industrials", HON: "Industrials", UNP: "Industrials", UPS: "Industrials",
  AAL: "Industrials", DAL: "Industrials", UAL: "Industrials", LUV: "Industrials", RTX: "Industrials",
  BA: "Industrials", FDX: "Industrials", PLUG: "Industrials", ACHR: "Industrials", LUNR: "Industrials",
  
  // Consumer Staples
  WMT: "Consumer Staples", PG: "Consumer Staples", KO: "Consumer Staples", PEP: "Consumer Staples",
  COST: "Consumer Staples", TGT: "Consumer Staples", ABEV: "Consumer Staples", BUD: "Consumer Staples",
  MO: "Consumer Staples", PM: "Consumer Staples", MDLZ: "Consumer Staples", EL: "Consumer Staples",
  BTI: "Consumer Staples",
  
  // Utilities
  NEE: "Utilities", DUK: "Utilities", SO: "Utilities", PCG: "Utilities", D: "Utilities",
  
  // Materials
  LIN: "Materials", BHP: "Materials", RIO: "Materials", VALE: "Materials", FCX: "Materials",
  CLF: "Materials", X: "Materials", NUE: "Materials", BTG: "Materials", AUY: "Materials",
  KGC: "Materials", GOLD: "Materials", AEM: "Materials", HMY: "Materials", HL: "Materials",
  CDE: "Materials", IAG: "Materials", HBM: "Materials",
  
  // Real Estate
  PLD: "Real Estate", AMT: "Real Estate", EQIX: "Real Estate", MPW: "Real Estate", O: "Real Estate",
  SPG: "Real Estate"
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
  const existingSector = COMMON_SECTOR_MAP[sym];
  const resolvedSector = (sector && sector !== "Other")
    ? sector
    : (existingSector || "Other");

  dynamicProfileCache.set(sym, {
    name,
    sector: resolvedSector,
    timestamp: Date.now(),
  });
}
