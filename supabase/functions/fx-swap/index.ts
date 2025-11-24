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

interface SwapRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  userPublicKey: string;
  swapBlockBytes?: string; // Base64-encoded swap block from user
}

interface SwapResponse {
  success: boolean;
  fromAmount: string;
  toAmount: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  transactionHash?: string;
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
    const { fromCurrency, toCurrency, amount, userPublicKey, swapBlockBytes }: SwapRequest = await req.json();

    console.log('Swap request:', { fromCurrency, toCurrency, amount, userPublicKey, hasSwapBlock: !!swapBlockBytes });

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

    // Calculate output amount
    const inputAmount = parseFloat(amount);
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

    // Connect to Keeta mainnet
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      console.error('ANCHOR_WALLET_SEED not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Anchor wallet not configured. Please set up anchor liquidity.'
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
          error: 'ANCHOR_WALLET_SEED must be a 64-character hex seed. Use "COPY SEED HEX" from the wallet dialog.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const seedHex = trimmedSeed;
    
    // Create anchor account using secp256k1 at index 0
    const anchorAccount = KeetaNet.lib.Account.fromSeed(seedHex, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const client = KeetaNet.UserClient.fromNetwork('main', anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor wallet:', anchorAddress);
    console.log('Swap details:', { 
      from: fromCurrency, 
      to: toCurrency, 
      inputAmount,
      outputAmount,
      rate
    });

    // ATOMIC SWAP IMPLEMENTATION
    // If user provided swap block bytes, complete the atomic swap
    if (swapBlockBytes) {
      try {
        console.log('Processing atomic swap block from user');
        
        // Decode the swap block from base64
        const blockBytes = new Uint8Array(
          atob(swapBlockBytes).split('').map(c => c.charCodeAt(0))
        );
        
        console.log('Decoded block bytes length:', blockBytes.length);

        // Create a builder to add anchor's side of the swap
        const builder = client.initBuilder();
        
        // Anchor sends toCurrency to user
        const recipient = KeetaNet.lib.Account.fromPublicKeyString(userPublicKey);
        const toAmountBigInt = BigInt(Math.floor(outputAmount * Math.pow(10, 18)));
        
        if (toCurrency === 'KTA') {
          builder.send(recipient, toAmountBigInt, client.baseToken);
        } else {
          const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(toToken);
          builder.send(recipient, toAmountBigInt, tokenAccount as any);
        }
        
        // Anchor expects to receive fromCurrency from user
        const fromAmountBigInt = BigInt(Math.floor(inputAmount * Math.pow(10, 18)));
        
        if (fromCurrency === 'KTA') {
          builder.receive(recipient, fromAmountBigInt, client.baseToken, true);
        } else {
          const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(fromToken);
          builder.receive(recipient, fromAmountBigInt, tokenAccount as any, true);
        }

        console.log('Anchor swap operations added to builder');

        // Compute and publish the atomic swap
        const computed = await client.computeBuilderBlocks(builder);
        console.log('Swap blocks computed:', computed.blocks?.length);
        
        const result = await client.publishBuilder(builder);
        console.log('Atomic swap published:', result);

        // Get transaction hash
        const hashBuffer = computed.blocks?.[0]?.hash?.get();
        const txHash = hashBuffer 
          ? Array.from(new Uint8Array(hashBuffer))
              .map(b => b.toString(16).padStart(2, '0'))
              .join('')
          : 'pending';

        const response: SwapResponse = {
          success: true,
          fromAmount: inputAmount.toFixed(6),
          toAmount: outputAmount.toFixed(6),
          fromCurrency,
          toCurrency,
          rate,
          transactionHash: txHash,
        };

        console.log('Atomic swap complete:', response);
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (atomicError: any) {
        console.error('Atomic swap error:', atomicError);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Atomic swap failed: ${atomicError.message}`
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // FALLBACK: Two-transaction swap (trusted anchor model)
    // User sends first, then anchor sends back
    // This is how the current system works and will continue to work for backward compatibility
    console.log('Using trusted anchor model (two transactions)');
    
    try {
      const builder = client.initBuilder();
      
      // Create recipient account from user's public key
      const recipient = KeetaNet.lib.Account.fromPublicKeyString(userPublicKey);
      
      // Calculate amount in smallest units (18 decimals for KTA and XRGE)
      const amountBigInt = BigInt(Math.floor(outputAmount * Math.pow(10, 18)));
      
      // For KTA (base token), use client.baseToken
      // For other tokens, use the token account
      if (toCurrency === 'KTA') {
        builder.send(recipient, amountBigInt, client.baseToken);
      } else {
        // Create token account from address for custom tokens
        const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(toToken);
        builder.send(recipient, amountBigInt, tokenAccount as any);
      }
      
      // Compute transaction blocks
      const computed = await client.computeBuilderBlocks(builder);
      console.log('Computed blocks:', computed.blocks);
      
      // Publish transaction
      const result = await client.publishBuilder(builder);
      
      console.log('Transaction published:', result);

      // Convert hash ArrayBuffer to hex string
      const hashBuffer = computed.blocks?.[0]?.hash?.get();
      const txHash = hashBuffer 
        ? Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('')
        : 'pending';

      const response: SwapResponse = {
        success: true,
        fromAmount: inputAmount.toFixed(6),
        toAmount: outputAmount.toFixed(6),
        fromCurrency,
        toCurrency,
        rate,
        transactionHash: txHash,
      };

      console.log('Trusted swap executed:', response);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (txError: any) {
      console.error('Transaction error:', txError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Transaction failed: ${txError.message}. Make sure anchor has sufficient ${toCurrency} balance.`
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

  } catch (error: any) {
    console.error('Error in fx-swap function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
