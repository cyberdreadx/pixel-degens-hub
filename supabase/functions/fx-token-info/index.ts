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
    const { tokenAddress, network = 'main' } = await req.json();
    
    if (!tokenAddress) {
      throw new Error('Token address is required');
    }

    const apiEndpoint = network === "test"
      ? 'https://rep3.test.network.api.keeta.com/api'
      : 'https://rep3.main.network.api.keeta.com/api';

    console.log(`[fx-token-info] Fetching token info for ${tokenAddress} on ${network} network`);

    // Fetch token info from API
    const infoResponse = await fetch(
      `${apiEndpoint}/node/ledger/account/${tokenAddress}/info`
    );
    
    if (!infoResponse.ok) {
      throw new Error(`Failed to fetch token info: ${infoResponse.statusText}`);
    }
    
    const tokenInfo = await infoResponse.json();
    
    console.log('[fx-token-info] Raw token info:', tokenInfo);
    
    let metadata = null;
    if (tokenInfo.metadata) {
      try {
        const metadataJson = atob(tokenInfo.metadata);
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }

    const result = {
      address: tokenAddress,
      name: tokenInfo.name || 'Unknown',
      symbol: tokenInfo.symbol || tokenInfo.name || 'UNKNOWN',
      description: tokenInfo.description || '',
      supply: tokenInfo.supply?.toString() || '0',
      decimals: metadata?.decimalPlaces || metadata?.decimals || 0,
      metadata,
      isNFT: metadata?.platform === 'degen8bit' || 
             (tokenInfo.supply?.toString() === '1' && 
              (metadata?.decimalPlaces === 0 || !metadata?.decimalPlaces))
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[fx-token-info] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

