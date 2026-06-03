import { useEffect, useRef, useState } from "react";

export interface TickUpdate {
  symbol: string;
  price: number;
}

export function useFinnhubWS(symbols: string[], onUpdate: (update: TickUpdate) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const activeSymbolsRef = useRef<string[]>([]);
  const onUpdateRef = useRef(onUpdate);
  const reconnectAttemptsRef = useRef(0);

  // Keep callback fresh
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  // Fetch token
  useEffect(() => {
    async function fetchToken() {
      try {
        const res = await fetch("/api/stocks/ws-token");
        if (res.ok) {
          const json = await res.json();
          setToken(json.token);
        }
      } catch (err) {
        console.warn("[useFinnhubWS] Failed to fetch WS token:", err);
      }
    }
    fetchToken();
  }, []);

  // Manage connection and subscriptions
  useEffect(() => {
    if (!token || symbols.length === 0) return;

    // Reset attempts on fresh dependency change (e.g. changing tabs, adding ticker)
    reconnectAttemptsRef.current = 0;

    const wsUrl = `wss://ws.finnhub.io?token=${token}`;
    let ws = wsRef.current;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      if (reconnectAttemptsRef.current >= 3) {
        console.warn("[useFinnhubWS] Max reconnection attempts reached. Falling back to REST API polling.");
        return;
      }

      console.log("[useFinnhubWS] Connecting to Finnhub WS...");
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[useFinnhubWS] WebSocket connected.");
        reconnectAttemptsRef.current = 0; // Reset on success
        symbols.forEach(sym => {
          ws?.send(JSON.stringify({ type: "subscribe", symbol: sym }));
        });
        activeSymbolsRef.current = [...symbols];
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "trade" && Array.isArray(msg.data)) {
            msg.data.forEach((trade: any) => {
              if (trade.s && typeof trade.p === "number") {
                onUpdateRef.current({ symbol: trade.s, price: trade.p });
              }
            });
          }
        } catch (err) {
          // Parse error
        }
      };

      ws.onerror = (err) => {
        if (reconnectAttemptsRef.current < 3) {
          console.warn("[useFinnhubWS] WebSocket error:", err);
        }
      };

      ws.onclose = () => {
        reconnectAttemptsRef.current += 1;
        if (reconnectAttemptsRef.current < 3) {
          console.log(`[useFinnhubWS] WebSocket disconnected. Retrying (${reconnectAttemptsRef.current}/3) in 5s...`);
          reconnectTimeout = setTimeout(connect, 5000);
        } else {
          console.warn("[useFinnhubWS] WebSocket connection failed permanently. Falling back to REST API polling.");
        }
      };
    }

    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      connect();
    } else if (ws.readyState === WebSocket.OPEN) {
      const prevSymbols = activeSymbolsRef.current;
      
      // Unsubscribe removed symbols
      prevSymbols.forEach(sym => {
        if (!symbols.includes(sym)) {
          ws?.send(JSON.stringify({ type: "unsubscribe", symbol: sym }));
        }
      });

      // Subscribe new symbols
      symbols.forEach(sym => {
        if (!prevSymbols.includes(sym)) {
          ws?.send(JSON.stringify({ type: "subscribe", symbol: sym }));
        }
      });

      activeSymbolsRef.current = [...symbols];
    }

    return () => {
      clearTimeout(reconnectTimeout);
    };
  }, [token, symbols.join(",")]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        console.log("[useFinnhubWS] Cleaned up WebSocket.");
      }
    };
  }, []);
}
