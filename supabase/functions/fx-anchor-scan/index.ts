import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

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

    // Convert mnemonic to seed if needed
    let actualSeed = anchorSeed;
    const words = anchorSeed.trim().split(/\s+/);
    if (words.length === 24) {
      actualSeed = await KeetaNet.lib.Account.seedFromPassphrase(anchorSeed, { asString: true }) as string;
    }

    console.log('Scanning derivation paths for KTA balance...');
    
    const results = [];
    const KTA_TOKEN = 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';

    for (let index = 0; index < 10; index++) {
      try {
        // Try to create account with this index
        const account = KeetaNet.lib.Account.fromSeed(actualSeed, index);
        const address = account.publicKeyString.get();
        
        console.log(`Checking index ${index}: ${address}`);
        
        // Create client for this account
        const client = KeetaNet.UserClient.fromNetwork('main', account);
        
        // Check KTA balance
        const allBalances = await client.allBalances();
        const ktaBalance = allBalances.find((b: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(b, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          return tokenInfo.token === KTA_TOKEN;
        });
        const balance = ktaBalance 
          ? BigInt(JSON.parse(JSON.stringify(ktaBalance, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v)).balance) / BigInt(10 ** 18)
          : 0n;
          
        results.push({
          index,
          address,
          ktaBalance: balance.toString(),
          hasBalance: balance > 0n
        });

        console.log(`  Balance: ${balance} KTA`);
      } catch (error: any) {
        console.error(`Error checking index ${index}:`, error.message);
        results.push({
          index,
          address: 'error',
          error: error.message
        });
      }
    }

    const withBalance = results.filter(r => r.hasBalance);
    
    return new Response(
      JSON.stringify({ 
        results,
        withBalance,
        recommendation: withBalance.length > 0 
          ? `Use index ${withBalance[0].index} (${withBalance[0].address})`
          : 'No addresses with KTA balance found'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fx-anchor-scan function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
