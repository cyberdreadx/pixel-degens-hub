import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address, network = 'main' } = await req.json();
    
    if (!address) {
      throw new Error('Address is required');
    }

    // Select API endpoint based on network
    const KEETA_API = network === 'test' 
      ? 'https://rep3.test.network.api.keeta.com/api'
      : 'https://rep3.main.network.api.keeta.com/api';

    console.log(`[fx-keeta-proxy] Fetching balances for ${address} on ${network} network using ${KEETA_API}`);

    // Fetch balances from Keeta API
    const response = await fetch(`${KEETA_API}/account-balances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account: address }),
    });

    if (!response.ok) {
      throw new Error(`Keeta API error: ${response.status}`);
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Keeta proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
