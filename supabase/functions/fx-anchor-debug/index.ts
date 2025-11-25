import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      return new Response(
        JSON.stringify({ error: 'Anchor wallet not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const TARGET_ADDRESS = 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq';
    const results: any[] = [];

    // Test Keeta CLI method: Account.seedFromPassphrase with secp256k1
    try {
      console.log('Testing Keeta CLI method: Account.seedFromPassphrase + secp256k1');
      const actualSeed = await KeetaNet.lib.Account.seedFromPassphrase(anchorSeed, { asString: true }) as string;
      
      for (let index = 0; index < 5; index++) {
        const account = KeetaNet.lib.Account.fromSeed(actualSeed, index, AccountKeyAlgorithm.ECDSA_SECP256K1);
        const address = account.publicKeyString.toString();
        const match = address === TARGET_ADDRESS;
        
        results.push({
          method: 'seedFromPassphrase+secp256k1',
          index,
          address,
          match,
          seedPreview: actualSeed.substring(0, 16) + '...'
        });
        
        if (match) {
          console.log(`✅ MATCH FOUND: Keeta CLI method, secp256k1, index ${index}`);
        }
      }
    } catch (error: any) {
      results.push({ method: 'seedFromPassphrase+secp256k1', error: error.message });
    }

    const matchFound = results.find(r => r.match);

    return new Response(
      JSON.stringify({ 
        targetAddress: TARGET_ADDRESS,
        results,
        matchFound: matchFound || null,
        recommendation: matchFound 
          ? `Use ${matchFound.method} with index ${matchFound.index}`
          : 'No match found. Verify mnemonic is correct.',
        mnemonicInfo: {
          wordCount: anchorSeed.trim().split(/\s+/).length,
          firstWord: anchorSeed.trim().split(/\s+/)[0],
          lastWord: anchorSeed.trim().split(/\s+/).slice(-1)[0]
        },
        note: 'Now using Account.seedFromPassphrase (Keeta CLI method) instead of bip39'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fx-anchor-debug function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
