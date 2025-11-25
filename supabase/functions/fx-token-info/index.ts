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
    const { tokenAddress, network = 'main' } = await req.json();
    
    if (!tokenAddress) {
      throw new Error('Token address is required');
    }

    const apiEndpoint = network === "test"
      ? 'https://rep2.test.network.api.keeta.com/api'
      : 'https://rep2.main.network.api.keeta.com/api';

    console.log(`[fx-token-info] Fetching token info for ${tokenAddress} on ${network} network`);

    // Fetch token info from API
    const infoResponse = await fetch(
      `${apiEndpoint}/node/ledger/accounts/${tokenAddress}`
    );
    
    if (!infoResponse.ok) {
      throw new Error(`Failed to fetch token info: ${infoResponse.statusText}`);
    }
    
    const data = await infoResponse.json();
    
    console.log('[fx-token-info] Raw data:', data);
    
    // The API returns an array with account info
    const accountData = Array.isArray(data) ? data[0] : data;
    const tokenInfo = accountData?.info || {};
    
    let metadata = null;
    if (tokenInfo.metadata) {
      try {
        const metadataJson = atob(tokenInfo.metadata);
        metadata = JSON.parse(metadataJson);
      } catch (e) {
        console.error('Error parsing metadata:', e);
      }
    }

    // Convert hex supply to decimal string
    const supplyHex = tokenInfo.supply || '0x0';
    const supply = BigInt(supplyHex).toString();

    const result = {
      address: tokenAddress,
      name: tokenInfo.name || 'Unknown',
      symbol: tokenInfo.symbol || tokenInfo.name || 'UNKNOWN',
      description: tokenInfo.description || '',
      supply,
      decimals: metadata?.decimalPlaces || metadata?.decimals || 0,
      metadata,
      isNFT: metadata?.platform === 'degen8bit' || 
             (supply === '1' && 
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

