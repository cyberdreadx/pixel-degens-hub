import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log('[fx-anchor-info] Function invoked, method:', req.method);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('[fx-anchor-info] Handling CORS preflight');
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fx-anchor-info] Loading environment variables');
    const anchorAddress = Deno.env.get('ANCHOR_WALLET_ADDRESS');
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    
    if (!anchorAddress) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_ADDRESS not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!anchorSeed) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedAddress = anchorAddress.trim();
    const trimmedSeed = anchorSeed.trim();

    if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED must be 64-character hex.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create anchor account from seed (for transaction signing)
    const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const backendDerivedAddress = anchorAccount.publicKeyString.toString();

    console.log('Intended address (ANCHOR_WALLET_ADDRESS):', trimmedAddress);
    console.log('Backend-derived address (from seed):', backendDerivedAddress);
    console.log('Addresses match:', trimmedAddress === backendDerivedAddress);
    
    // Fetch balances for the backend-derived address (the one that can actually be used)
    const apiEndpoint = 'https://rep3.main.network.api.keeta.com/api';
    const balanceResponse = await fetch(
      `${apiEndpoint}/node/ledger/account/${backendDerivedAddress}/balance`
    );
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
    }
    
    const balanceData = await balanceResponse.json();
    const allBalances = balanceData.balances || [];
    
    console.log('Raw balance data:', JSON.stringify(balanceData));
    
    // KTA is the native token - look for it with the KTA token address
    const ktaBalance = allBalances.find((b: any) => {
      return b.token === 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg';
    });
    
    // XRGE is a custom token
    const xrgeBalance = allBalances.find((b: any) => {
      return b.token === 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6';
    });
    
    console.log('Found KTA balance:', ktaBalance);
    console.log('Found XRGE balance:', xrgeBalance);
    
    const kta = ktaBalance 
      ? (Number(BigInt(ktaBalance.balance)) / Math.pow(10, 18)).toFixed(6)
      : '0';
    
    const xrge = xrgeBalance 
      ? (Number(BigInt(xrgeBalance.balance)) / Math.pow(10, 18)).toFixed(6)
      : '0';

    console.log('Backend-derived address balances:', { kta, xrge });

    return new Response(
      JSON.stringify({ 
        // Display the backend-derived address and its balances
        address: backendDerivedAddress,
        ktaBalance: kta,
        xrgeBalance: xrge,
        method: 'Backend-derived from ANCHOR_WALLET_SEED',
        // Extra debug fields
        intendedAddress: trimmedAddress,
        backendAddress: backendDerivedAddress,
        addressMatch: trimmedAddress === backendDerivedAddress,
        note: 'Balances are from backend-derived address. Fund this address for swaps to work.'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fx-anchor-info function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
