import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { address, network = 'main' } = await req.json();
    
    if (!address) {
      throw new Error('Address is required');
    }

    // Select API endpoint based on network
    const KEETA_API = network === 'test' 
      ? 'https://rep2.test.network.api.keeta.com/api'
      : 'https://rep2.main.network.api.keeta.com/api';

    console.log(`[fx-keeta-proxy] Fetching balances for ${address} on ${network} network using ${KEETA_API}`);

    // Fetch balances from Keeta API
    const response = await fetch(`${KEETA_API}/node/ledger/accounts/${address}`);

    if (!response.ok) {
      throw new Error(`Keeta API error: ${response.status}`);
    }

    const rawData = await response.json();
    
    // The API returns an array with account info
    const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
    const data = { balances: accountData?.balances || [] };

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
