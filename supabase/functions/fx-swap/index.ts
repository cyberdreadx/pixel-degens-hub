import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import { TOKEN_DECIMALS } from "../_shared/tokenDecimals.ts";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Token addresses on Keeta Network - get based on network parameter
function getTokenAddresses(network: string) {
  return network === 'test' ? {
    KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
    XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
  } : {
    KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
    XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
  };
}

interface SwapRequest {
  fromCurrency: string;
  toCurrency: string;
  amount: string;
  userPublicKey: string;
  swapBlockBytes?: string; // Base64-encoded swap block from user
  expectedRate?: number; // Expected rate from frontend for slippage check
  slippageTolerance?: number; // Slippage tolerance percentage (e.g., 1 for 1%)
  network?: string; // Network: 'main' or 'test'
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

async function getPoolRate(fromCurrency: string, toCurrency: string, anchorAddress: string, network: string): Promise<number> {
  try {
    // Fetch balances directly from API
    const apiEndpoint = network === 'test'
      ? 'https://rep3.test.network.api.keeta.com/api'
      : 'https://rep3.main.network.api.keeta.com/api';
    
    console.log('[fx-swap] Using API endpoint:', apiEndpoint);
    
    const balanceResponse = await fetch(
      `${apiEndpoint}/node/ledger/account/${anchorAddress}/balance`
    );
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
    }
    
    const balanceData = await balanceResponse.json();
    const allBalances = balanceData.balances || [];
    
    const TOKENS = getTokenAddresses(network);
    let ktaBalance = 0;
    let xrgeBalance = 0;

    for (const balance of allBalances) {
      if (balance.token === TOKENS.KTA) {
        ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
      } else if (balance.token === TOKENS.XRGE) {
        xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
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
    const { fromCurrency, toCurrency, amount, userPublicKey, swapBlockBytes, expectedRate, slippageTolerance, network = 'main' }: SwapRequest = await req.json();

    console.log('Swap request:', { 
      fromCurrency, 
      toCurrency, 
      amount, 
      userPublicKey, 
      hasSwapBlock: !!swapBlockBytes,
      expectedRate,
      slippageTolerance,
      network
    });

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

    // Validate amount is positive number
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

    // Validate slippage tolerance if provided
    if (slippageTolerance !== undefined) {
      if (isNaN(slippageTolerance) || slippageTolerance < 0 || slippageTolerance > 100) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Invalid slippage tolerance. Must be between 0 and 100.' 
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Get token addresses based on network
    const TOKENS = getTokenAddresses(network);
    const fromToken = TOKENS[fromCurrency as keyof typeof TOKENS];
    const toToken = TOKENS[toCurrency as keyof typeof TOKENS];

    if (!fromToken || !toToken) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `Invalid token: ${!fromToken ? fromCurrency : toCurrency}. Supported tokens: KTA, XRGE`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get network-specific anchor seed
    const anchorSeed = network === 'test'
      ? Deno.env.get('ANCHOR_WALLET_SEED_TESTNET')
      : Deno.env.get('ANCHOR_WALLET_SEED');
      
    if (!anchorSeed) {
      console.error(`ANCHOR_WALLET_SEED${network === 'test' ? '_TESTNET' : ''} not configured`);
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
    const client = KeetaNet.UserClient.fromNetwork(network as 'main' | 'test', anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor wallet:', anchorAddress);
    console.log('Network:', network);

    // Calculate rate from liquidity pool
    const currentRate = await getPoolRate(fromCurrency, toCurrency, anchorAddress, network);
    
    if (!currentRate || currentRate <= 0) {
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

    // Slippage protection: Check if current rate differs too much from expected rate
    // For atomic swaps (swapBlockBytes provided), enforce strict slippage checks.
    // For trusted two-transaction model, the pool has already been modified by the
    // user's send, so comparing against pre-send rate will always show large drift.
    if (swapBlockBytes && expectedRate && slippageTolerance !== undefined) {
      const rateChange = Math.abs((currentRate - expectedRate) / expectedRate) * 100;
      
      if (rateChange > slippageTolerance) {
        console.log(`Slippage exceeded: ${rateChange.toFixed(2)}% > ${slippageTolerance}%`);
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Price changed by ${rateChange.toFixed(2)}% (max ${slippageTolerance}%). Current rate: 1 ${fromCurrency} = ${currentRate.toFixed(6)} ${toCurrency}. Please try again.`,
            slippageExceeded: true,
            expectedRate,
            currentRate,
            slippage: rateChange
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      console.log(`Slippage check passed: ${rateChange.toFixed(2)}% <= ${slippageTolerance}%`);
    }

    // Calculate output amount using constant product formula (x * y = k)
    // This ensures we never try to give more than what's in the pool
    let outputAmount: number;
    
    try {
      // Fetch current pool balances
      const apiEndpoint = network === 'test'
        ? 'https://rep3.test.network.api.keeta.com/api'
        : 'https://rep3.main.network.api.keeta.com/api';
      const balanceResponse = await fetch(
        `${apiEndpoint}/node/ledger/account/${anchorAddress}/balance`
      );
      
      if (!balanceResponse.ok) {
        throw new Error('Failed to fetch pool balances');
      }
      
      const balanceData = await balanceResponse.json();
      const allBalances = balanceData.balances || [];
      
      let ktaBalance = 0;
      let xrgeBalance = 0;

      for (const balance of allBalances) {
        if (balance.token === TOKENS.KTA) {
          ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
        } else if (balance.token === TOKENS.XRGE) {
          xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
        }
      }

      const fromPoolBalance = fromCurrency === 'KTA' ? ktaBalance : xrgeBalance;
      const toPoolBalance = toCurrency === 'KTA' ? ktaBalance : xrgeBalance;

      console.log('Pool balances:', { ktaBalance, xrgeBalance, fromPoolBalance, toPoolBalance });

      // Constant product formula: k = x * y
      const k = fromPoolBalance * toPoolBalance;
      
      // After adding inputAmount: new_from = from + inputAmount
      const newFromBalance = fromPoolBalance + inputAmount;
      
      // new_to = k / new_from
      const newToBalance = k / newFromBalance;
      
      // Output amount = current_to - new_to
      outputAmount = toPoolBalance - newToBalance;

      console.log('AMM calculation:', {
        k,
        newFromBalance,
        newToBalance,
        outputAmount
      });

      // Verify we have enough liquidity
      if (outputAmount > toPoolBalance) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: `Insufficient pool liquidity. Pool has ${toPoolBalance.toFixed(6)} ${toCurrency}, but swap requires ${outputAmount.toFixed(6)} ${toCurrency}.`
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

    } catch (balanceError: any) {
      console.error('Error calculating swap amount:', balanceError);
      // Fallback to simple rate calculation (legacy behavior)
      outputAmount = inputAmount * currentRate;
    }

    console.log('Swap details:', { 
      from: fromCurrency, 
      to: toCurrency, 
      inputAmount,
      outputAmount,
      expectedRate,
      currentRate,
      slippageTolerance
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
        const toDecimals = toCurrency === 'KTA' ? TOKEN_DECIMALS.KTA : TOKEN_DECIMALS.XRGE;
        const toAmountBigInt = BigInt(Math.floor(outputAmount * Math.pow(10, toDecimals)));
        
        if (toCurrency === 'KTA') {
          builder.send(recipient, toAmountBigInt, client.baseToken);
        } else {
          const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(toToken);
          builder.send(recipient, toAmountBigInt, tokenAccount as any);
        }
        
        // Anchor expects to receive fromCurrency from user
        const fromDecimals = fromCurrency === 'KTA' ? TOKEN_DECIMALS.KTA : TOKEN_DECIMALS.XRGE;
        const fromAmountBigInt = BigInt(Math.floor(inputAmount * Math.pow(10, fromDecimals)));
        
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

        // Record the swap in price history for chart display
        try {
          const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          // Get current pool balances after swap
          const apiEndpoint = network === 'test'
            ? 'https://rep3.test.network.api.keeta.com/api'
            : 'https://rep3.main.network.api.keeta.com/api';
          const balanceResponse = await fetch(
            `${apiEndpoint}/node/ledger/account/${anchorAddress}/balance`
          );
          
          if (balanceResponse.ok) {
            const balanceData = await balanceResponse.json();
            const allBalances = balanceData.balances || [];
            
            let ktaBalance = 0;
            let xrgeBalance = 0;

            for (const balance of allBalances) {
              if (balance.token === TOKENS.KTA) {
                ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
              } else if (balance.token === TOKENS.XRGE) {
                xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
              }
            }

            // Insert swap record into price_history (both directions for chart flexibility)
            const swapRecords = [
              {
                from_token: fromCurrency,
                to_token: toCurrency,
                rate: currentRate,
                kta_balance: ktaBalance,
                xrge_balance: xrgeBalance,
                volume_24h: inputAmount,
                network: network
              },
              {
                from_token: toCurrency,
                to_token: fromCurrency,
                rate: 1 / currentRate,  // Inverted rate
                kta_balance: ktaBalance,
                xrge_balance: xrgeBalance,
                volume_24h: outputAmount, // Use output amount for reverse direction
                network: network
              }
            ];
            
            await supabaseClient.from('price_history').insert(swapRecords);

            console.log('Atomic swap recorded in price history');
          }
        } catch (dbError: any) {
          console.error('Failed to record swap in database:', dbError);
          // Don't fail the swap if logging fails
        }

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
          rate: currentRate,
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
      
      // Calculate amount in smallest units (6 decimals for KTA, 18 for XRGE)
      const toDecimals = toCurrency === 'KTA' ? TOKEN_DECIMALS.KTA : TOKEN_DECIMALS.XRGE;
      const amountBigInt = BigInt(Math.floor(outputAmount * Math.pow(10, toDecimals)));
      
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

      // Record the swap in price history for chart display
      try {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        // Get current pool balances after swap
        const postSwapRate = await getPoolRate(fromCurrency, toCurrency, anchorAddress, network);
        
        const apiEndpoint = network === 'test'
          ? 'https://rep3.test.network.api.keeta.com/api'
          : 'https://rep3.main.network.api.keeta.com/api';
        
        const balanceResponse = await fetch(
          `${apiEndpoint}/node/ledger/account/${anchorAddress}/balance`
        );
        
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          const allBalances = balanceData.balances || [];
          
          let ktaBalance = 0;
          let xrgeBalance = 0;

          for (const balance of allBalances) {
            if (balance.token === TOKENS.KTA) {
              ktaBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA);
            } else if (balance.token === TOKENS.XRGE) {
              xrgeBalance = Number(BigInt(balance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE);
            }
          }

              // Insert swap record into price_history (both directions for chart flexibility)
              const swapRecords = [
                {
                  from_token: fromCurrency,
                  to_token: toCurrency,
                  rate: currentRate,
                  kta_balance: ktaBalance,
                  xrge_balance: xrgeBalance,
                  volume_24h: inputAmount
                },
                {
                  from_token: toCurrency,
                  to_token: fromCurrency,
                  rate: 1 / currentRate,  // Inverted rate
                  kta_balance: ktaBalance,
                  xrge_balance: xrgeBalance,
                  volume_24h: outputAmount // Use output amount for reverse direction
                }
              ];
          
          await supabaseClient.from('price_history').insert(swapRecords);

          console.log('Swap recorded in price history');
        }
      } catch (dbError: any) {
        console.error('Failed to record swap in database:', dbError);
        // Don't fail the swap if logging fails
      }

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
        rate: currentRate,
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
