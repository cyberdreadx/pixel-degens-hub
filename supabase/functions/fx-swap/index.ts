import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import * as bip39 from "npm:bip39@3.1.0";
import { Buffer } from "node:buffer";

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
  userSignedTx?: string; // Pre-signed transaction from user
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

// Static exchange rates (matches fx-rates function)
const EXCHANGE_RATES: Record<string, number> = {
  'KTA_XRGE': 0.85,
  'XRGE_KTA': 1.18,
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fromCurrency, toCurrency, amount, userPublicKey }: SwapRequest = await req.json();

    console.log('Swap request:', { fromCurrency, toCurrency, amount, userPublicKey });

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

    const rateKey = `${fromCurrency}_${toCurrency}`;
    const rate = EXCHANGE_RATES[rateKey];

    if (!rate) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Exchange pair ${rateKey} not supported`,
          availablePairs: Object.keys(EXCHANGE_RATES)
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

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

    // Convert mnemonic to seed using bip39 (same as WalletContext)
    let actualSeed = anchorSeed;
    if (bip39.validateMnemonic(anchorSeed)) {
      // Get 64-byte seed from mnemonic and take first 32 bytes for Keeta
      const fullSeed = bip39.mnemonicToSeedSync(anchorSeed);
      actualSeed = Buffer.from(fullSeed.subarray(0, 32)).toString('hex');
    }

    // Create anchor account and client
    const anchorAccount = KeetaNet.lib.Account.fromSeed(actualSeed, 0);
    const client = KeetaNet.UserClient.fromNetwork('main', anchorAccount);

    console.log('Anchor wallet:', anchorAccount.publicKeyString.get());
    console.log('Swap details:', { 
      from: fromCurrency, 
      to: toCurrency, 
      amount: inputAmount,
      calculated: outputAmount,
      fromToken,
      toToken
    });

    // Build swap transaction
    // User sends fromToken to anchor (done separately by user)
    // Anchor sends toToken to user
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

      console.log('Swap executed:', response);
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
