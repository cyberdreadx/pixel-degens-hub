import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

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

    // Convert mnemonic to seed using CLI-compatible method (seedFromPassphrase)
    const seedHex = await KeetaNet.lib.Account.seedFromPassphrase(anchorSeed.trim(), { asString: true });
    
    console.log('Scanning derivation paths for KTA balance...');
    console.log('Seed conversion method: seedFromPassphrase (CLI-compatible)');
    console.log('Looking for target address:', 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq');
    
    const results = [];
    const KTA_TOKEN = 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';
    const XRGE_TOKEN = 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
    const TARGET_ADDRESS = 'keeta_aabky6l7q6znyl4mqougwr63pecljbq7zdb7xqvwqd3sftvxzzkdxstiect4eaq';

    // First, test indices 0-9 quickly
    for (let index = 0; index < 10; index++) {
      try {
        // Try to create account with secp256k1 at this index
        const account = KeetaNet.lib.Account.fromSeed(seedHex, index, AccountKeyAlgorithm.ECDSA_SECP256K1);
        const address = account.publicKeyString.toString();
        
        console.log(`Checking secp256k1 index ${index}: ${address}`);
        
        // Create client for this account
        const client = KeetaNet.UserClient.fromNetwork('main', account);
        
        // Check if this is the target address
        const isTarget = address === TARGET_ADDRESS;
        
        // Check KTA and XRGE balances
        const allBalances = await client.allBalances();
        
        const ktaBalanceData = allBalances.find((b: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(b, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          return tokenInfo.token === KTA_TOKEN;
        });
        const ktaBalance = ktaBalanceData 
          ? BigInt(JSON.parse(JSON.stringify(ktaBalanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v)).balance) / BigInt(10 ** 18)
          : 0n;

        const xrgeBalanceData = allBalances.find((b: any) => {
          const tokenInfo = JSON.parse(JSON.stringify(b, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v));
          return tokenInfo.token === XRGE_TOKEN;
        });
        const xrgeBalance = xrgeBalanceData 
          ? BigInt(JSON.parse(JSON.stringify(xrgeBalanceData, (k: string, v: any) => typeof v === 'bigint' ? v.toString() : v)).balance) / BigInt(10 ** 18)
          : 0n;
        
        results.push({
          index,
          address,
          ktaBalance: ktaBalance.toString(),
          xrgeBalance: xrgeBalance.toString(),
          hasBalance: ktaBalance > 0n || xrgeBalance > 0n,
          isTarget
        });

        if (isTarget) {
          console.log(`  ✅ TARGET FOUND at index ${index}: ${ktaBalance} KTA, ${xrgeBalance} XRGE`);
        } else {
          console.log(`  Balance: ${ktaBalance} KTA, ${xrgeBalance} XRGE`);
        }
      } catch (error: any) {
        console.error(`Error checking index ${index}:`, error.message);
        results.push({
          index,
          address: 'error',
          error: error.message
        });
      }
    }

    const targetFound = results.find(r => r.isTarget);
    const withBalance = results.filter(r => r.hasBalance);
    
    return new Response(
      JSON.stringify({ 
        results,
        withBalance,
        targetFound,
        recommendation: targetFound
          ? `✅ Target anchor found at index ${targetFound.index} with ${targetFound.ktaBalance} KTA and ${targetFound.xrgeBalance} XRGE`
          : withBalance.length > 0 
            ? `Use index ${withBalance[0].index} (${withBalance[0].address})`
            : 'Target anchor not found in first 100 indices'
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
