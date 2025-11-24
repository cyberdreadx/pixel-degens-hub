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
}

// Token addresses
const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

async function getAnchorBalances() {
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

  // Fetch balances
  const apiEndpoint = 'https://rep3.main.network.api.keeta.com/api';
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

    // Get current anchor balances
    const { ktaBalance, xrgeBalance } = await getAnchorBalances();

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
      },
      {
        from_token: 'XRGE',
        to_token: 'KTA',
        rate: 1 / rate,
        kta_balance: ktaBalance,
        xrge_balance: xrgeBalance,
      }
    ];

    const { error } = await supabaseClient
      .from('price_history')
      .insert(snapshots);

    if (error) throw error;

    console.log('Price snapshot recorded:', snapshots);

    return new Response(
      JSON.stringify({ 
        success: true, 
        snapshots,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error recording price:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});