import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

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

    // Convert mnemonic to seed if needed (24 words separated by spaces)
    let actualSeed = anchorSeed;
    const words = anchorSeed.trim().split(/\s+/);
    if (words.length === 24) {
      actualSeed = await KeetaNet.lib.Account.seedFromPassphrase(anchorSeed, { asString: true }) as string;
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
