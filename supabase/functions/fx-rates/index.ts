import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
  source?: string;
}

// Contract addresses on BASE chain
const KTA_CONTRACT = '0xc0634090F2Fe6c6d75e61Be2b949464aBB498973';
const XRGE_CONTRACT = '0x147120faEC9277ec02d957584CFCD92B56A24317';

// Fallback static rates if DexScreener is unavailable
const FALLBACK_RATES: Record<string, number> = {
  'KTA_XRGE': 0.85,
  'XRGE_KTA': 1.18,
};

async function fetchMarketPrices() {
  try {
    // Fetch KTA price
    const ktaResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${KTA_CONTRACT}`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    // Fetch XRGE price
    const xrgeResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${XRGE_CONTRACT}`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    let ktaPrice = null;
    let xrgePrice = null;

    if (ktaResponse.ok) {
      const ktaData = await ktaResponse.json();
      if (ktaData.pairs && ktaData.pairs.length > 0) {
        const basePair = ktaData.pairs.find((p: any) => p.chainId === 'base') || ktaData.pairs[0];
        ktaPrice = parseFloat(basePair.priceUsd || '0');
      }
    }

    if (xrgeResponse.ok) {
      const xrgeData = await xrgeResponse.json();
      if (xrgeData.pairs && xrgeData.pairs.length > 0) {
        const basePair = xrgeData.pairs.find((p: any) => p.chainId === 'base') || xrgeData.pairs[0];
        xrgePrice = parseFloat(basePair.priceUsd || '0');
      }
    }

    return { ktaPrice, xrgePrice };
  } catch (error) {
    console.error('Error fetching market prices:', error);
    return { ktaPrice: null, xrgePrice: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from, to } = await req.json().catch(() => ({ from: 'KTA', to: 'XRGE' }));
    
    console.log(`Fetching exchange rate: ${from} -> ${to}`);

    // Fetch real market prices
    const { ktaPrice, xrgePrice } = await fetchMarketPrices();

    let rate: number;
    let source: string;

    // Calculate rate from real prices if available
    if (ktaPrice && ktaPrice > 0 && xrgePrice && xrgePrice > 0) {
      if (from === 'KTA' && to === 'XRGE') {
        rate = ktaPrice / xrgePrice; // How much XRGE per KTA
      } else if (from === 'XRGE' && to === 'KTA') {
        rate = xrgePrice / ktaPrice; // How much KTA per XRGE
      } else {
        throw new Error(`Unsupported pair: ${from}_${to}`);
      }
      source = 'DexScreener';
      console.log(`Real market rate calculated: 1 ${from} = ${rate} ${to} (KTA: $${ktaPrice}, XRGE: $${xrgePrice})`);
    } else {
      // Fallback to static rates
      const rateKey = `${from}_${to}`;
      rate = FALLBACK_RATES[rateKey];
      
      if (!rate) {
        return new Response(
          JSON.stringify({ 
            error: 'Exchange rate not available',
            availablePairs: Object.keys(FALLBACK_RATES)
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      source = 'Fallback';
      console.log(`Using fallback rate: 1 ${from} = ${rate} ${to}`);
    }

    const response: ExchangeRate = {
      from,
      to,
      rate,
      timestamp: Date.now(),
      source,
    };

    console.log('Exchange rate response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in fx-rates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
