import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TokenMarketData {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
}

interface MarketData {
  kta?: TokenMarketData;
  xrge?: TokenMarketData;
}

export function useMarketData() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarketData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase.functions.invoke('fx-market-data');
      if (error) throw error;
      setMarketData(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch market data:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketData();
    
    // Refresh market data every 60 seconds
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  const getUsdValue = (amount: number, token: 'KTA' | 'XRGE'): number => {
    if (!marketData) return 0;
    const tokenData = token === 'KTA' ? marketData.kta : marketData.xrge;
    return tokenData ? amount * tokenData.price : 0;
  };

  const formatUsd = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(amount);
  };

  return {
    marketData,
    isLoading,
    error,
    getUsdValue,
    formatUsd,
    refresh: fetchMarketData,
  };
}
