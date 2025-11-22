import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import * as bip39 from "npm:bip39@3.1.0";
import { Buffer } from "node:buffer";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      return new Response(
        JSON.stringify({ 
          error: 'Anchor wallet not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Convert mnemonic to seed using bip39 (same as WalletContext)
    let actualSeed = anchorSeed;
    if (bip39.validateMnemonic(anchorSeed)) {
      // Get 64-byte seed from mnemonic and take first 32 bytes for Keeta
      const fullSeed = bip39.mnemonicToSeedSync(anchorSeed);
      actualSeed = Buffer.from(fullSeed.subarray(0, 32)).toString('hex');
    }

    // Create anchor account
    const anchorAccount = KeetaNet.lib.Account.fromSeed(actualSeed, 0);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    return new Response(
      JSON.stringify({ 
        address: anchorAddress
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fx-anchor-info function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
