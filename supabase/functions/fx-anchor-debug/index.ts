import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import * as bip39 from "npm:bip39@3.1.0";
import { Buffer } from "node:buffer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    // Test Method 1: bip39.mnemonicToSeedSync
    if (bip39.validateMnemonic(anchorSeed)) {
      console.log('Testing Method 1: bip39.mnemonicToSeedSync');
      const fullSeed = bip39.mnemonicToSeedSync(anchorSeed);
      const actualSeed1 = Buffer.from(fullSeed.subarray(0, 32)).toString('hex');
      
      for (let index = 0; index < 5; index++) {
        const account = KeetaNet.lib.Account.fromSeed(actualSeed1, index);
        const address = account.publicKeyString.get();
        const match = address === TARGET_ADDRESS;
        
        results.push({
          method: 'bip39',
          index,
          address,
          match,
          seedPreview: actualSeed1.substring(0, 16) + '...'
        });
        
        if (match) {
          console.log(`✅ MATCH FOUND: bip39 method, index ${index}`);
        }
      }
    } else {
      results.push({ method: 'bip39', error: 'Invalid mnemonic for bip39' });
    }

    // Test Method 2: KeetaNet.lib.Account.seedFromPassphrase
    try {
      console.log('Testing Method 2: KeetaNet seedFromPassphrase');
      const actualSeed2 = await KeetaNet.lib.Account.seedFromPassphrase(anchorSeed, { asString: true }) as string;
      
      for (let index = 0; index < 5; index++) {
        const account = KeetaNet.lib.Account.fromSeed(actualSeed2, index);
        const address = account.publicKeyString.get();
        const match = address === TARGET_ADDRESS;
        
        results.push({
          method: 'seedFromPassphrase',
          index,
          address,
          match,
          seedPreview: actualSeed2.substring(0, 16) + '...'
        });
        
        if (match) {
          console.log(`✅ MATCH FOUND: seedFromPassphrase method, index ${index}`);
        }
      }
    } catch (error: any) {
      results.push({ method: 'seedFromPassphrase', error: error.message });
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
        }
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
