import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CancelListingRequest {
  listingId: string;
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

    const { listingId, network } = await req.json() as CancelListingRequest;

    console.log('[fx-cancel-listing] Request:', { listingId, network });

    // Validate inputs
    if (!listingId || !network) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: listingId, network' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the listing from database
    const { data: listing, error: fetchError } = await supabaseClient
      .from('nft_listings')
      .select('*')
      .eq('id', listingId)
      .single();

    if (fetchError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-cancel-listing] Listing found:', listing);

    // Validate listing can be cancelled
    if (listing.status !== 'active') {
      return new Response(
        JSON.stringify({ error: `Cannot cancel listing with status: ${listing.status}` }),
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

    console.log('[fx-cancel-listing] Anchor address:', anchorAddress);
    console.log('[fx-cancel-listing] Returning NFT to seller:', listing.seller_address);

    // Verify anchor still holds the NFT
    const anchorBalance = await anchorClient.balance(listing.token_address);
    console.log('[fx-cancel-listing] Anchor balance for NFT:', anchorBalance.toString());

    if (anchorBalance <= 0n) {
      // NFT not in escrow anymore
      console.error('[fx-cancel-listing] NFT not found in escrow!');
      
      // Update listing status anyway
      await supabaseClient
        .from('nft_listings')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', listingId);

      return new Response(
        JSON.stringify({ 
          error: 'NFT not found in escrow wallet. Listing marked as cancelled.',
          warning: 'NFT may have already been transferred or is missing.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build transaction to return NFT to seller
    const recipientAccount = KeetaNet.lib.Account.fromPublicKeyString(listing.seller_address);
    const tokenAccount = KeetaNet.lib.Account.fromPublicKeyString(listing.token_address) as any;

    console.log('[fx-cancel-listing] Building return transaction...');

    const builder = anchorClient.initBuilder();
    builder.send(recipientAccount, 1n, tokenAccount); // Send 1 unit (NFT)

    await builder.computeBlocks();
    const result = await builder.publish();

    console.log('[fx-cancel-listing] Transaction published:', result);
    
    const txHash = JSON.stringify(result) || 'transaction_complete';

    // Update listing status in database
    const { error: updateError } = await supabaseClient
      .from('nft_listings')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', listingId);

    if (updateError) {
      console.error('[fx-cancel-listing] Failed to update database:', updateError);
      return new Response(
        JSON.stringify({ 
          warning: 'NFT returned but database update failed',
          transactionHash: txHash,
          error: updateError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-cancel-listing] ✅ Listing cancelled successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactionHash: txHash,
        message: 'Listing cancelled and NFT returned to seller',
        returnedTo: listing.seller_address
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[fx-cancel-listing] Error:', error);
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

