import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SwapRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  userPublicKey: string;
}

interface SwapResponse {
  success: boolean;
  fromAmount: string;
  toAmount: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  transactionHash?: string;
  error?: string;
}

// Static exchange rates (matches fx-rates function)
const EXCHANGE_RATES: Record<string, number> = {
  'KTA_XRGE': 0.85,
  'XRGE_KTA': 1.18,
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromCurrency, toCurrency, amount, userPublicKey }: SwapRequest = await req.json();

    console.log('Swap request:', { fromCurrency, toCurrency, amount, userPublicKey });

    // Validate input
    if (!fromCurrency || !toCurrency || !amount || !userPublicKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: fromCurrency, toCurrency, amount, userPublicKey' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const rateKey = `${fromCurrency}_${toCurrency}`;
    const rate = EXCHANGE_RATES[rateKey];

    if (!rate) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Exchange pair ${rateKey} not supported`,
          availablePairs: Object.keys(EXCHANGE_RATES)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate output amount
    const inputAmount = parseFloat(amount);
    const outputAmount = inputAmount * rate;

    // In production, this would:
    // 1. Verify user has sufficient balance
    // 2. Execute the swap transaction on Keeta Network
    // 3. Return the transaction hash
    
    // For now, we simulate a successful swap
    const response: SwapResponse = {
      success: true,
      fromAmount: inputAmount.toFixed(6),
      toAmount: outputAmount.toFixed(6),
      fromCurrency,
      toCurrency,
      rate,
      transactionHash: `0x${Math.random().toString(16).substring(2, 66)}`, // Simulated tx hash
    };

    console.log('Swap executed:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in fx-swap function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
