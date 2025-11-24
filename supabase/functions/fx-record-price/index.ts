import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import { TOKEN_DECIMALS } from "../_shared/tokenDecimals.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PriceSnapshot {
  from_token: string;
  to_token: string;
  rate: number;
  kta_balance: number;
  xrge_balance: number;
  network: string;
}

// Token addresses by network
const MAINNET_TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

const TESTNET_TOKENS = {
  KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
  XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
};

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

async function getAnchorBalances(network: string) {
  const seedHex = Deno.env.get('ANCHOR_WALLET_SEED');
  if (!seedHex || seedHex.length !== 64) {
    throw new Error('Invalid ANCHOR_WALLET_SEED: must be 64-character hex string');
  }

  const trimmedSeed = seedHex.trim();
  if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
    throw new Error('ANCHOR_WALLET_SEED must be 64-character hex.');
  }

  // Create account from seed
  const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
  const address = anchorAccount.publicKeyString.toString();

  // Select API endpoint based on network
  const apiEndpoint = network === 'test' 
    ? 'https://rep3.test.network.api.keeta.com/api'
    : 'https://rep3.main.network.api.keeta.com/api';

  // Select token addresses based on network
  const TOKENS = network === 'test' ? TESTNET_TOKENS : MAINNET_TOKENS;

  console.log(`[fx-record-price] Fetching balances for ${network} from ${apiEndpoint}`);

  // Fetch balances
  const balanceResponse = await fetch(
    `${apiEndpoint}/node/ledger/account/${address}/balance`
  );
  
  if (!balanceResponse.ok) {
    throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
  }
  
  const balanceData = await balanceResponse.json();
  const allBalances = balanceData.balances || [];
  
  const ktaBalance = allBalances.find((b: any) => b.token === TOKENS.KTA);
  const xrgeBalance = allBalances.find((b: any) => b.token === TOKENS.XRGE);

  return {
    ktaBalance: ktaBalance ? Number(BigInt(ktaBalance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA) : 0,
    xrgeBalance: xrgeBalance ? Number(BigInt(xrgeBalance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE) : 0,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get network from request body or default to 'main'
    let network = 'main';
    try {
      const body = await req.json();
      network = body.network || 'main';
    } catch {
      // If no body, use default
    }

    console.log(`[fx-record-price] Recording price for network: ${network}`);

    // Get current anchor balances for the specified network
    const { ktaBalance, xrgeBalance } = await getAnchorBalances(network);

    console.log(`[fx-record-price] Balances - KTA: ${ktaBalance}, XRGE: ${xrgeBalance}`);

    if (ktaBalance === 0 || xrgeBalance === 0) {
      console.warn(`[fx-record-price] Insufficient liquidity on ${network}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Insufficient liquidity on ${network}`,
          ktaBalance,
          xrgeBalance,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate rate (KTA to XRGE)
    const rate = xrgeBalance / ktaBalance;

    // Record both directions
    const snapshots: PriceSnapshot[] = [
      {
        from_token: 'KTA',
        to_token: 'XRGE',
        rate: rate,
        kta_balance: ktaBalance,
        xrge_balance: xrgeBalance,
        network: network,
      },
      {
        from_token: 'XRGE',
        to_token: 'KTA',
        rate: 1 / rate,
        kta_balance: ktaBalance,
        xrge_balance: xrgeBalance,
        network: network,
      }
    ];

    const { error } = await supabaseClient
      .from('price_history')
      .insert(snapshots);

    if (error) throw error;

    console.log(`[fx-record-price] Price snapshot recorded for ${network}:`, snapshots);

    return new Response(
      JSON.stringify({ 
        success: true, 
        snapshots,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fx-record-price] Error recording price:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
