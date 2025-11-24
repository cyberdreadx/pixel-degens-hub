import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExchangeRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
  source?: string;
}

// Token addresses on Keeta Network
const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

async function getAnchorBalances() {
  try {
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      console.error('ANCHOR_WALLET_SEED not configured');
      return { ktaBalance: null, xrgeBalance: null };
    }

    const trimmedSeed = anchorSeed.trim();
    if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      console.error('ANCHOR_WALLET_SEED is not a 64-char hex string');
      return { ktaBalance: null, xrgeBalance: null };
    }

    // Import KeetaNet SDK
    const KeetaNet = await import("npm:@keetanetwork/keetanet-client@0.14.12");
    const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

    // Create anchor account using secp256k1 at index 0
    const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Fetching balances for anchor:', anchorAddress);

    // Fetch balances directly from API
    const apiEndpoint = 'https://rep3.main.network.api.keeta.com/api';
    const balanceResponse = await fetch(
      `${apiEndpoint}/node/ledger/account/${anchorAddress}/balance`
    );
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
    }
    
    const balanceData = await balanceResponse.json();
    const allBalances = balanceData.balances || [];
    
    let ktaBalance = 0;
    let xrgeBalance = 0;

    for (const balance of allBalances) {
      if (balance.token === TOKENS.KTA) {
        ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, 18);
      } else if (balance.token === TOKENS.XRGE) {
        xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, 18);
      }
    }

    console.log(`Anchor liquidity pool: ${ktaBalance} KTA, ${xrgeBalance} XRGE`);
    return { ktaBalance, xrgeBalance };
  } catch (error) {
    console.error('Error fetching anchor balances:', error);
    return { ktaBalance: null, xrgeBalance: null };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { from, to } = await req.json().catch(() => ({ from: 'KTA', to: 'XRGE' }));
    
    console.log(`Fetching exchange rate: ${from} -> ${to}`);

    // Fetch anchor liquidity pool balances
    const { ktaBalance, xrgeBalance } = await getAnchorBalances();

    let rate: number;
    let source: string;

    // Calculate rate from liquidity pool if available
    if (ktaBalance && ktaBalance > 0 && xrgeBalance && xrgeBalance > 0) {
      if (from === 'KTA' && to === 'XRGE') {
        // Rate based on pool ratio: how much XRGE you get per KTA
        rate = xrgeBalance / ktaBalance;
      } else if (from === 'XRGE' && to === 'KTA') {
        // Rate based on pool ratio: how much KTA you get per XRGE
        rate = ktaBalance / xrgeBalance;
      } else {
        throw new Error(`Unsupported pair: ${from}_${to}`);
      }
      source = 'Liquidity Pool';
      console.log(`Pool-based rate calculated: 1 ${from} = ${rate} ${to} (Pool: ${ktaBalance} KTA, ${xrgeBalance} XRGE)`);
    } else {
      return new Response(
        JSON.stringify({ 
          error: 'Liquidity pool not available. Please fund the anchor wallet with KTA and XRGE.',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response: ExchangeRate = {
      from,
      to,
      rate,
      timestamp: Date.now(),
      source,
    };

    console.log('Exchange rate response:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error in fx-rates function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
