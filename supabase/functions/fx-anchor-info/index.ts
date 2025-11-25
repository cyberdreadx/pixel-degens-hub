import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import { TOKEN_DECIMALS } from "../_shared/tokenDecimals.ts";

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
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { network } = await req.json().catch(() => ({ network: 'main' }));
    
    console.log('[fx-anchor-info] Loading environment variables');
    console.log('[fx-anchor-info] Network:', network);
    
    // Get network-specific anchor configuration
    const anchorAddress = network === 'test' 
      ? Deno.env.get('ANCHOR_WALLET_ADDRESS_TESTNET')
      : Deno.env.get('ANCHOR_WALLET_ADDRESS');
      
    const anchorSeed = network === 'test'
      ? Deno.env.get('ANCHOR_WALLET_SEED_TESTNET')
      : Deno.env.get('ANCHOR_WALLET_SEED');
    
    // Token addresses based on network
    const TOKEN_ADDRS = network === 'test' ? {
      KTA: 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52',
      XRGE: 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s',
    } : {
      KTA: 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg',
      XRGE: 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6',
    };
    
    if (!anchorAddress) {
      return new Response(
        JSON.stringify({ 
          error: `ANCHOR_WALLET_ADDRESS${network === 'test' ? '_TESTNET' : ''} not configured.`
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
          error: `ANCHOR_WALLET_SEED${network === 'test' ? '_TESTNET' : ''} not configured.`
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
    const apiEndpoint = network === 'test' 
      ? 'https://rep2.test.network.api.keeta.com/api'
      : 'https://rep2.main.network.api.keeta.com/api';
    
    console.log('[fx-anchor-info] Using API endpoint:', apiEndpoint);
    
    const balanceResponse = await fetch(
      `${apiEndpoint}/node/ledger/accounts/${backendDerivedAddress}`
    );
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch balance: ${balanceResponse.statusText}`);
    }
    
    const rawData = await balanceResponse.json();
    
    // The API returns an array with account info
    const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
    const allBalances = accountData?.balances || [];
    
    console.log('Raw balance data:', JSON.stringify(balanceData));
    
    // Find KTA and XRGE balances using network-specific token addresses
    const ktaBalance = allBalances.find((b: any) => b.token === TOKEN_ADDRS.KTA);
    const xrgeBalance = allBalances.find((b: any) => b.token === TOKEN_ADDRS.XRGE);
    
    console.log('Found KTA balance:', ktaBalance);
    console.log('Found XRGE balance:', xrgeBalance);
    
    const kta = ktaBalance 
      ? (Number(BigInt(ktaBalance.balance)) / Math.pow(10, TOKEN_DECIMALS.KTA)).toFixed(6)
      : '0';
    
    const xrge = xrgeBalance 
      ? (Number(BigInt(xrgeBalance.balance)) / Math.pow(10, TOKEN_DECIMALS.XRGE)).toFixed(6)
      : '0';

    console.log('Backend-derived address balances:', { kta, xrge });

    return new Response(
      JSON.stringify({ 
        // Display the backend-derived address and its balances
        address: backendDerivedAddress,
        ktaBalance: kta,
        xrgeBalance: xrge,
        method: 'Backend-derived from ANCHOR_WALLET_SEED',
        network,
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
