import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function helps recover NFTs that are in anchor escrow but don't have database listings
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { network } = await req.json();
    
    console.log('[fx-recover-listings] Checking for NFTs in anchor for network:', network);

    // Initialize anchor client
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      throw new Error('ANCHOR_WALLET_SEED not configured');
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-recover-listings] Anchor address:', anchorAddress);

    // Get all tokens held by anchor
    const tokensWithInfo = await anchorClient.listACLsByPrincipalWithInfo({ account: anchorAccount });
    
    const nftsInEscrow = [];
    
    for (const tokenInfo of tokensWithInfo) {
      if (!tokenInfo.entity.isToken()) continue;
      
      const balance = tokenInfo.balances?.[0]?.balance || 0n;
      if (balance <= 0n) continue;
      
      const supply = BigInt(tokenInfo.info.supply || '0');
      const isNFT = supply === 1n;
      
      if (!isNFT) continue;
      
      const tokenAddress = tokenInfo.entity.publicKeyString.toString();
      
      nftsInEscrow.push({
        tokenAddress,
        name: tokenInfo.info.name,
        balance: balance.toString(),
        metadata: tokenInfo.info.metadata
      });
    }

    console.log('[fx-recover-listings] Found', nftsInEscrow.length, 'NFTs in escrow');

    // Check which ones have listings in database
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: existingListings } = await supabaseClient
      .from('nft_listings')
      .select('token_address')
      .eq('network', network)
      .eq('status', 'active');

    const listedTokens = new Set(existingListings?.map(l => l.token_address) || []);
    
    const orphanedNFTs = nftsInEscrow.filter(nft => !listedTokens.has(nft.tokenAddress));
    
    console.log('[fx-recover-listings] Orphaned NFTs (in escrow but no listing):', orphanedNFTs.length);

    return new Response(
      JSON.stringify({ 
        success: true,
        nftsInEscrow: nftsInEscrow.length,
        orphanedNFTs,
        message: orphanedNFTs.length > 0 
          ? `Found ${orphanedNFTs.length} NFT(s) in escrow without listings` 
          : 'All NFTs in escrow have listings'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[fx-recover-listings] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

