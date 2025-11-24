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

// Contract addresses for market price fetching
const KTA_CONTRACT = '0xc0634090F2Fe6c6d75e61Be2b949464aBB498973';
const XRGE_CONTRACT = '0x147120faEC9277ec02d957584CFCD92B56A24317';

// Fallback exchange rates if DexScreener unavailable
const FALLBACK_RATES: Record<string, number> = {
  'KTA_XRGE': 0.85,
  'XRGE_KTA': 1.18,
};

async function fetchRealRate(fromCurrency: string, toCurrency: string): Promise<number> {
  try {
    // Fetch prices from DexScreener
    const ktaResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${KTA_CONTRACT}`,
      { headers: { 'Accept': 'application/json' } }
    );
    const xrgeResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${XRGE_CONTRACT}`,
      { headers: { 'Accept': 'application/json' } }
    );

    let ktaPrice = null;
    let xrgePrice = null;

    if (ktaResponse.ok) {
      const ktaData = await ktaResponse.json();
      if (ktaData.pairs && ktaData.pairs.length > 0) {
        const basePair = ktaData.pairs.find((p: any) => p.chainId === 'base') || ktaData.pairs[0];
        ktaPrice = parseFloat(basePair.priceUsd || '0');
      }
    }

    if (xrgeResponse.ok) {
      const xrgeData = await xrgeResponse.json();
      if (xrgeData.pairs && xrgeData.pairs.length > 0) {
        const basePair = xrgeData.pairs.find((p: any) => p.chainId === 'base') || xrgeData.pairs[0];
        xrgePrice = parseFloat(basePair.priceUsd || '0');
      }
    }

    // Calculate rate from real prices
    if (ktaPrice && ktaPrice > 0 && xrgePrice && xrgePrice > 0) {
      if (fromCurrency === 'KTA' && toCurrency === 'XRGE') {
        return ktaPrice / xrgePrice;
      } else if (fromCurrency === 'XRGE' && toCurrency === 'KTA') {
        return xrgePrice / ktaPrice;
      }
    }

    // Fallback to static rate
    const rateKey = `${fromCurrency}_${toCurrency}`;
    return FALLBACK_RATES[rateKey] || 0;
  } catch (error) {
    console.error('Error fetching real rate:', error);
    const rateKey = `${fromCurrency}_${toCurrency}`;
    return FALLBACK_RATES[rateKey] || 0;
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

    // Fetch real exchange rate
    const rate = await fetchRealRate(fromCurrency, toCurrency);
    
    if (!rate || rate <= 0) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Exchange rate not available for ${fromCurrency}_${toCurrency}`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Using rate: 1 ${fromCurrency} = ${rate} ${toCurrency}`);

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

    // Calculate output amount
    const outputAmount = inputAmount * rate;

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
