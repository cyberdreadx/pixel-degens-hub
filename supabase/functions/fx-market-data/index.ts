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
  console.log('[fx-market-data] Function invoked, method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[fx-market-data] Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fx-market-data] Fetching market data from DexScreener...');

    // Contract addresses on BASE chain
    const KTA_CONTRACT = '0xc0634090F2Fe6c6d75e61Be2b949464aBB498973';
    const XRGE_CONTRACT = '0x147120faEC9277ec02d957584CFCD92B56A24317';
    const CHAIN = 'base'; // BASE chain identifier for DexScreener

    // Fetch data from DexScreener (adjust endpoint when Keeta is listed)
    let ktaData = null;
    let xrgeData = null;

    try {
      // Try to fetch KTA data from BASE chain
      // DexScreener API: search by token address on specific chain
      const ktaResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/search?q=${KTA_CONTRACT}`,
        {
          headers: {
            'Accept': 'application/json',
          }
        }
      );
      
      console.log('KTA API response status:', ktaResponse.status);
      
      if (ktaResponse.ok) {
        const data = await ktaResponse.json();
        console.log('KTA API response:', JSON.stringify(data, null, 2));
        
        // Find the pair on BASE chain
        if (data.pairs && data.pairs.length > 0) {
          const basePair = data.pairs.find((p: any) => p.chainId === 'base') || data.pairs[0];
          
          if (basePair) {
            ktaData = {
              price: parseFloat(basePair.priceUsd || '0'),
              priceChange24h: parseFloat(basePair.priceChange?.h24 || '0'),
              volume24h: parseFloat(basePair.volume?.h24 || '0'),
              marketCap: parseFloat(basePair.fdv || '0'),
              liquidity: parseFloat(basePair.liquidity?.usd || '0'),
            };
            console.log('KTA data parsed:', ktaData);
          }
        }
      } else {
        const errorText = await ktaResponse.text();
        console.error('KTA API error:', errorText);
      }
    } catch (error) {
      console.error('Error fetching KTA data from DexScreener:', error);
    }

    try {
      // Try to fetch XRGE data
      if (XRGE_CONTRACT) {
        const xrgeResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/search?q=${XRGE_CONTRACT}`,
          {
            headers: {
              'Accept': 'application/json',
            }
          }
        );
        
        console.log('XRGE API response status:', xrgeResponse.status);
        
        if (xrgeResponse.ok) {
          const data = await xrgeResponse.json();
          console.log('XRGE API response:', JSON.stringify(data, null, 2));
          
          // Find the pair on BASE chain
          if (data.pairs && data.pairs.length > 0) {
            const basePair = data.pairs.find((p: any) => p.chainId === 'base') || data.pairs[0];
            
            if (basePair) {
              xrgeData = {
                price: parseFloat(basePair.priceUsd || '0'),
                priceChange24h: parseFloat(basePair.priceChange?.h24 || '0'),
                volume24h: parseFloat(basePair.volume?.h24 || '0'),
                marketCap: parseFloat(basePair.fdv || '0'),
                liquidity: parseFloat(basePair.liquidity?.usd || '0'),
              };
              console.log('XRGE data parsed:', xrgeData);
            }
          }
        } else {
          const errorText = await xrgeResponse.text();
          console.error('XRGE API error:', errorText);
        }
      }
    } catch (error) {
      console.error('Error fetching XRGE data from DexScreener:', error);
    }

    // If no data found, return an informative error without fake zero values
    if (!ktaData && !xrgeData) {
      console.log('No DexScreener data available for provided contracts');
      
      const response: MarketDataResponse = {
        success: false,
        error: 'No market data returned from DexScreener for these contracts (check chain & address configuration).'
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
