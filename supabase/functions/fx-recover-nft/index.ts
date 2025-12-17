import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RecoverNFTRequest {
  tokenAddress: string;
  recipientAddress: string;
  network: 'test' | 'main';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tokenAddress, recipientAddress, network } = await req.json() as RecoverNFTRequest;

    console.log('[fx-recover-nft] Request:', { tokenAddress, recipientAddress, network });

    // Validate inputs
    if (!tokenAddress || !recipientAddress || !network) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: tokenAddress, recipientAddress, network' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize anchor client
    const anchorSeed = network === 'test'
      ? Deno.env.get('ANCHOR_WALLET_SEED_TESTNET')
      : Deno.env.get('ANCHOR_WALLET_SEED');
      
    if (!anchorSeed) {
      throw new Error(`ANCHOR_WALLET_SEED${network === 'test' ? '_TESTNET' : ''} not configured`);
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-recover-nft] Anchor address:', anchorAddress);
    console.log('[fx-recover-nft] Returning NFT to:', recipientAddress);

    // Verify anchor holds the NFT
    const anchorBalance = await anchorClient.balance(tokenAddress);
    console.log('[fx-recover-nft] Anchor balance for NFT:', anchorBalance.toString());

    if (anchorBalance <= 0n) {
      // NFT not in escrow
      return new Response(
        JSON.stringify({ 
          error: 'NFT not found in escrow wallet',
          anchorAddress,
          tokenAddress,
          balance: '0'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if there's a cancelled listing for this NFT and recipient
    const { data: listings } = await supabaseClient
      .from('nft_listings')
      .select('*')
      .eq('token_address', tokenAddress)
      .eq('seller_address', recipientAddress)
      .eq('network', network)
      .in('status', ['cancelled', 'active'])
      .order('created_at', { ascending: false });

    console.log('[fx-recover-nft] Found listings:', listings?.length || 0);

    if (!listings || listings.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No listing found for this NFT and address combination',
          hint: 'This NFT may not belong to this address, or listing was deleted'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const listing = listings[0];
    console.log('[fx-recover-nft] Recovering listing:', listing.id, 'Status:', listing.status);

    // Build transaction to return NFT
    const recipientAccount = KeetaNet.lib.Account.fromPublicKeyString(recipientAddress);
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);

    console.log('[fx-recover-nft] Building return transaction...');

    const builder = anchorClient.initBuilder();
    builder.send(recipientAccount, 1n, tokenAccount); // Send 1 unit (NFT)

    const { hash } = await builder.publish();

    console.log('[fx-recover-nft] Transaction published! Hash:', hash);

    // Update listing status to recovered
    if (listing.status !== 'cancelled') {
      await supabaseClient
        .from('nft_listings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', listing.id);
    }

    console.log('[fx-recover-nft] ✅ NFT recovered successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionHash: hash,
        message: 'NFT recovered and returned to owner',
        returnedTo: recipientAddress,
        listingId: listing.id,
        listingStatus: listing.status
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[fx-recover-nft] Error:', error);
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
