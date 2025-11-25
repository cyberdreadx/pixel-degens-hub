import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { network } = await req.json();
    
    console.log('[fx-recover-listings] Scanning for orphaned NFTs on network:', network);

    if (!network) {
      return new Response(
        JSON.stringify({ error: 'Network is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Initialize anchor client
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      throw new Error('ANCHOR_WALLET_SEED not configured');
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-recover-listings] Anchor address:', anchorAddress);

    // Get all tokens held by anchor using Keeta API directly
    const apiEndpoint = network === 'test' 
      ? 'https://rep2.test.network.api.keeta.com/api'
      : 'https://rep2.main.network.api.keeta.com/api';
    
    const balanceResponse = await fetch(`${apiEndpoint}/node/ledger/accounts/${anchorAddress}`);
    
    if (!balanceResponse.ok) {
      throw new Error(`Failed to fetch anchor balances: ${balanceResponse.statusText}`);
    }
    
    const rawData = await balanceResponse.json();
    const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
    const allBalances = accountData?.balances || [];
    
    console.log('[fx-recover-listings] Anchor has', allBalances.length, 'token balances');

    // Check each token to see if it's an NFT
    const nftsInEscrow = [];
    for (const balanceEntry of allBalances) {
      const tokenAddress = balanceEntry.token;
      const balance = BigInt(balanceEntry.balance);
      
      if (balance > 0n) {
        try {
          const tokenResponse = await fetch(`${apiEndpoint}/node/ledger/token/${tokenAddress}`);
          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            const tokenInfo = Array.isArray(tokenData) ? tokenData[0] : tokenData;
            
            // Check if it's an NFT (supply = 1, decimals = 0)
            if (tokenInfo?.supply === '1' && tokenInfo?.decimals === 0) {
              nftsInEscrow.push({
                tokenAddress,
                balance: balance.toString(),
                name: tokenInfo.name || 'Unknown NFT',
                symbol: tokenInfo.symbol || 'NFT',
              });
            }
          }
        } catch (err) {
          console.error(`[fx-recover-listings] Error fetching token info for ${tokenAddress}:`, err);
        }
      }
    }

    console.log('[fx-recover-listings] Found', nftsInEscrow.length, 'NFTs in escrow');

    // Get all active listings for this network
    const { data: activeListings } = await supabaseClient
      .from('nft_listings')
      .select('token_address')
      .eq('status', 'active')
      .eq('network', network);

    const listedTokenAddresses = new Set(activeListings?.map(l => l.token_address) || []);

    // Find orphaned NFTs (in escrow but not listed)
    const orphanedNFTs = nftsInEscrow.filter(nft => !listedTokenAddresses.has(nft.tokenAddress));

    console.log('[fx-recover-listings] Found', orphanedNFTs.length, 'orphaned NFTs');

    return new Response(
      JSON.stringify({
        success: true,
        network,
        anchorAddress,
        nftsInEscrow: nftsInEscrow.length,
        activeListings: activeListings?.length || 0,
        orphanedNFTs,
        message: orphanedNFTs.length > 0 
          ? `Found ${orphanedNFTs.length} orphaned NFT(s) in escrow`
          : 'All NFTs in escrow have active listings',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error: any) {
    console.error('[fx-recover-listings] Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        details: error.toString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
