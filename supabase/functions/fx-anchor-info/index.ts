import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

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
    const anchorAddress = Deno.env.get('ANCHOR_WALLET_ADDRESS');
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    
    if (!anchorAddress) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_ADDRESS not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!anchorSeed) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedAddress = anchorAddress.trim();
    const trimmedSeed = anchorSeed.trim();

    if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED must be 64-character hex.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create anchor account from seed (this is what backend can actually use for transactions)
    const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const backendDerivedAddress = anchorAccount.publicKeyString.toString();

    console.log('Intended address (ANCHOR_WALLET_ADDRESS):', trimmedAddress);
    console.log('Backend-derived address (from seed):', backendDerivedAddress);
    console.log('Addresses match:', trimmedAddress === backendDerivedAddress);
    
    // Get balances of the backend-derived address (the one we can actually transact with)
    const client = KeetaNet.UserClient.fromNetwork('main', anchorAccount);
    const allBalances = await client.allBalances();
    
    const ktaBalance = allBalances.find((b: any) => {
      const tokenInfo = JSON.parse(JSON.stringify(b, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
      return tokenInfo.token === 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';
    });
    
    const xrgeBalance = allBalances.find((b: any) => {
      const tokenInfo = JSON.parse(JSON.stringify(b, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
      return tokenInfo.token === 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
    });
    
    const kta = ktaBalance 
      ? (BigInt(JSON.parse(JSON.stringify(ktaBalance, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v)).balance) / BigInt(10 ** 18)).toString()
      : '0';
    
    const xrge = xrgeBalance 
      ? (BigInt(JSON.parse(JSON.stringify(xrgeBalance, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v)).balance) / BigInt(10 ** 18)).toString()
      : '0';

    console.log('Backend address balances:', { kta, xrge });

    return new Response(
      JSON.stringify({ 
        intendedAddress: trimmedAddress,
        backendAddress: backendDerivedAddress,
        addressMatch: trimmedAddress === backendDerivedAddress,
        ktaBalance: kta,
        xrgeBalance: xrge,
        note: 'Due to SDK incompatibility, backend derives a different address. Transfer funds to backendAddress for swaps to work.'
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
