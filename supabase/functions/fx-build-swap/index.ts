import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token addresses on Keeta Network
const TOKENS = {
  KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
  XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
};

interface BuildSwapRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  userPublicKey: string;
}

interface BuildSwapResponse {
  success: boolean;
  fromAmount: string;
  toAmount: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  anchorAddress: string;
  unsignedBlockBase64?: string;
  error?: string;
}

async function getPoolRate(fromCurrency: string, toCurrency: string, anchorAddress: string): Promise<number> {
  try {
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

    console.log(`Pool liquidity: ${ktaBalance} KTA, ${xrgeBalance} XRGE`);

    // Calculate rate from pool ratio
    if (ktaBalance > 0 && xrgeBalance > 0) {
      if (fromCurrency === 'KTA' && toCurrency === 'XRGE') {
        return xrgeBalance / ktaBalance;
      } else if (fromCurrency === 'XRGE' && toCurrency === 'KTA') {
        return ktaBalance / xrgeBalance;
      }
    }

    return 0;
  } catch (error) {
    console.error('Error calculating pool rate:', error);
    return 0;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromCurrency, toCurrency, amount, userPublicKey }: BuildSwapRequest = await req.json();

    console.log('Build swap request:', { fromCurrency, toCurrency, amount, userPublicKey });

    // Validate input
    if (!fromCurrency || !toCurrency || !amount || !userPublicKey) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing required fields: fromCurrency, toCurrency, amount, userPublicKey' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate amount
    const inputAmount = parseFloat(amount);
    if (isNaN(inputAmount) || inputAmount <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid amount. Must be a positive number.' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get token addresses
    const fromToken = TOKENS[fromCurrency as keyof typeof TOKENS];
    const toToken = TOKENS[toCurrency as keyof typeof TOKENS];

    if (!fromToken || !toToken) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Invalid token: ${!fromToken ? fromCurrency : toCurrency}. Supported tokens: ${Object.keys(TOKENS).join(', ')}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Connect to Keeta mainnet as anchor
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      console.error('ANCHOR_WALLET_SEED not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Anchor wallet not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedSeed = anchorSeed.trim();
    if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      console.error('ANCHOR_WALLET_SEED is not a 64-char hex string');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Anchor wallet misconfigured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Create anchor account
    const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const client = KeetaNet.UserClient.fromNetwork('main', anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor wallet:', anchorAddress);

    // Calculate rate from liquidity pool
    const rate = await getPoolRate(fromCurrency, toCurrency, anchorAddress);
    
    if (!rate || rate <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Insufficient liquidity in pool for ${fromCurrency}_${toCurrency}. Please fund the anchor wallet.`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Calculate output amount
    const outputAmount = inputAmount * rate;

    console.log('Building atomic swap:', {
      anchor: anchorAddress,
      user: userPublicKey,
      from: fromCurrency,
      to: toCurrency,
      inputAmount,
      outputAmount,
      rate
    });

    // Build the atomic swap transaction
    const builder = client.initBuilder();
    
    // Create user account
    const userAccount = KeetaNet.lib.Account.fromPublicKeyString(userPublicKey);
    
    // Convert amounts to smallest units (18 decimals)
    const fromAmountBigInt = BigInt(Math.floor(inputAmount * Math.pow(10, 18)));
    const toAmountBigInt = BigInt(Math.floor(outputAmount * Math.pow(10, 18)));
    
    // ATOMIC SWAP OPERATIONS (both in same block):
    
    // 1. RECEIVE: Anchor expects to receive fromCurrency from user
    if (fromCurrency === 'KTA') {
      builder.receive(userAccount, fromAmountBigInt, client.baseToken, false);
    } else {
      const fromTokenAccount = KeetaNet.lib.Account.fromPublicKeyString(fromToken);
      builder.receive(userAccount, fromAmountBigInt, fromTokenAccount as any, false);
    }
    
    // 2. SEND: Anchor sends toCurrency to user
    if (toCurrency === 'KTA') {
      builder.send(userAccount, toAmountBigInt, client.baseToken);
    } else {
      const toTokenAccount = KeetaNet.lib.Account.fromPublicKeyString(toToken);
      builder.send(userAccount, toAmountBigInt, toTokenAccount as any);
    }

    console.log('Atomic swap operations added to builder');

    // Compute the unsigned atomic swap block
    const computed = await client.computeBuilderBlocks(builder);
    
    if (!computed.blocks || computed.blocks.length === 0) {
      throw new Error('Failed to compute swap blocks');
    }

    console.log('Swap blocks computed:', computed.blocks.length);
    
    // Get the unsigned block bytes for user signing
    const unsignedBytes = computed.blocks[0].toBytes();
    const unsignedBlockBase64 = btoa(String.fromCharCode(...new Uint8Array(unsignedBytes)));

    const response: BuildSwapResponse = {
      success: true,
      fromAmount: inputAmount.toFixed(6),
      toAmount: outputAmount.toFixed(6),
      fromCurrency,
      toCurrency,
      rate,
      anchorAddress,
      unsignedBlockBase64,
    };

    console.log('Unsigned atomic swap block ready for signing');
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error building swap:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to build swap'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
