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

    // DexScreener API endpoint for Keeta Network tokens
    // Note: Replace these addresses with actual DexScreener pair addresses when available
    const KTA_ADDRESS = 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';
    const XRGE_ADDRESS = 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';

    // Fetch data from DexScreener (adjust endpoint when Keeta is listed)
    let ktaData = null;
    let xrgeData = null;

    try {
      // Try to fetch KTA data
      const ktaResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${KTA_ADDRESS}`,
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
      const xrgeResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${XRGE_ADDRESS}`,
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
