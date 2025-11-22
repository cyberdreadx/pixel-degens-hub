import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import * as bip39 from "npm:bip39@3.1.0";
import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";

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

    // Convert mnemonic to seed using standard BIP39 (matches CLI)
    // BIP39 returns 64 bytes, but Keeta needs 32 bytes (first half)
    const seedBuffer = bip39.mnemonicToSeedSync(anchorSeed.trim());
    const actualSeed = seedBuffer.slice(0, 32).buffer;

    // Create anchor account using secp256k1 at index 0
    const anchorAccount = KeetaNet.lib.Account.fromSeed(actualSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor address (secp256k1, index 0):', anchorAddress);
    console.log('Seed conversion: BIP39 mnemonicToSeedSync (standard method)');
    
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
        method: 'BIP39 mnemonicToSeedSync + secp256k1 index 0 (standard method)'
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
