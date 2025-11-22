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
}

// Static exchange rates for demo purposes
// In production, these would come from a real exchange rate API or liquidity pool
const EXCHANGE_RATES: Record<string, number> = {
  'KTA_XRGE': 0.85,  // 1 KTA = 0.85 XRGE
  'XRGE_KTA': 1.18,  // 1 XRGE = 1.18 KTA
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || 'KTA';
    const to = url.searchParams.get('to') || 'XRGE';
    
    const rateKey = `${from}_${to}`;
    const rate = EXCHANGE_RATES[rateKey];

    if (!rate) {
      return new Response(
        JSON.stringify({ 
          error: 'Exchange rate not available',
          availablePairs: Object.keys(EXCHANGE_RATES)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response: ExchangeRate = {
      from,
      to,
      rate,
      timestamp: Date.now(),
    };

    console.log('Exchange rate requested:', response);

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
