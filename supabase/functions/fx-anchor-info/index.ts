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

    // Auto-detect if ANCHOR_WALLET_SEED is a mnemonic or hex seed
    const trimmedSeed = anchorSeed.trim();
    let seedHex: string;
    let seedSource: string;
    
    // Check if it's a hex string (64 chars) or mnemonic (multiple words)
    if (/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      // It's already a hex seed (64 hex chars = 32 bytes)
      seedHex = trimmedSeed;
      seedSource = 'Direct HEX (browser-derived)';
      console.log('Using direct hex seed from ANCHOR_WALLET_SEED');
    } else if (trimmedSeed.split(/\s+/).length >= 12) {
      // It's a mnemonic phrase (12+ words)
      seedSource = 'Mnemonic converted via seedFromPassphrase (may differ from browser!)';
      console.log('WARNING: Using mnemonic in ANCHOR_WALLET_SEED - address may not match browser wallet!');
      console.log('Recommendation: Click "COPY SEED HEX" in wallet and update ANCHOR_WALLET_SEED with that value');
      seedHex = await KeetaNet.lib.Account.seedFromPassphrase(trimmedSeed, { asString: true });
    } else {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED format invalid. Expected either: 64-char hex string OR 12-24 word mnemonic phrase'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Create anchor account using secp256k1 at index 0
    const anchorAccount = KeetaNet.lib.Account.fromSeed(seedHex, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor address (secp256k1, index 0):', anchorAddress);
    console.log('Seed source:', seedSource);
    
    // Get balances to verify
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

    console.log('Balances:', { kta, xrge });

    return new Response(
      JSON.stringify({ 
        address: anchorAddress,
        ktaBalance: kta,
        xrgeBalance: xrge,
        method: 'seedFromPassphrase + secp256k1 index 0 (CLI-compatible)'
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
