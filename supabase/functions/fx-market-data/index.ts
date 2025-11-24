import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MarketDataResponse {
  success: boolean;
  kta?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    liquidity: number;
  };
  xrge?: {
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    liquidity: number;
  };
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Fetching market data from DexScreener...');

    // Contract addresses on BASE chain
    const KTA_CONTRACT = '0xc0634090F2Fe6c6d75e61Be2b949464aBB498973';
    const XRGE_CONTRACT = '0x147120faEC9277ec02d957584CFCD92B56A24317';
    const CHAIN = 'base'; // BASE chain identifier for DexScreener

    // Fetch data from DexScreener (adjust endpoint when Keeta is listed)
    let ktaData = null;
    let xrgeData = null;

    try {
      // Try to fetch KTA data from BASE chain
      const ktaResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${CHAIN}/${KTA_CONTRACT}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      if (ktaResponse.ok) {
        const data = await ktaResponse.json();
        if (data.pairs && data.pairs.length > 0) {
          const pair = data.pairs[0];
          ktaData = {
            price: parseFloat(pair.priceUsd || '0'),
            priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
            volume24h: parseFloat(pair.volume?.h24 || '0'),
            marketCap: parseFloat(pair.fdv || '0'),
            liquidity: parseFloat(pair.liquidity?.usd || '0'),
          };
        }
      }
    } catch (error) {
      console.error('Error fetching KTA data from DexScreener:', error);
    }

    try {
      // Try to fetch XRGE data
      if (XRGE_CONTRACT) {
        const xrgeResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${CHAIN}/${XRGE_CONTRACT}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );
        
        if (xrgeResponse.ok) {
          const data = await xrgeResponse.json();
          if (data.pairs && data.pairs.length > 0) {
            const pair = data.pairs[0];
            xrgeData = {
              price: parseFloat(pair.priceUsd || '0'),
              priceChange24h: parseFloat(pair.priceChange?.h24 || '0'),
              volume24h: parseFloat(pair.volume?.h24 || '0'),
              marketCap: parseFloat(pair.fdv || '0'),
              liquidity: parseFloat(pair.liquidity?.usd || '0'),
            };
          }
        }
      }
    } catch (error) {
      console.error('Error fetching XRGE data from DexScreener:', error);
    }

    // If no data found, return mock data for development
    if (!ktaData && !xrgeData) {
      console.log('No DexScreener data available, returning mock data');
      
      const response: MarketDataResponse = {
        success: true,
        kta: {
          price: 0.0,
          priceChange24h: 0.0,
          volume24h: 0.0,
          marketCap: 0.0,
          liquidity: 0.0,
        },
        xrge: {
          price: 0.0,
          priceChange24h: 0.0,
          volume24h: 0.0,
          marketCap: 0.0,
          liquidity: 0.0,
        },
        error: 'Tokens not yet listed on DexScreener'
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response: MarketDataResponse = {
      success: true,
      kta: ktaData || undefined,
      xrge: xrgeData || undefined,
    };

    console.log('Market data fetched successfully:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error fetching market data:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to fetch market data'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
