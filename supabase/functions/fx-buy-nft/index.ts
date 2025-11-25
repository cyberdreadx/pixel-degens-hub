import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import { TOKEN_DECIMALS } from "../_shared/tokenDecimals.ts";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BuyNFTRequest {
  listingId: string;
  buyerAddress: string;
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

    const { listingId, buyerAddress, network } = await req.json() as BuyNFTRequest;

    console.log('[fx-buy-nft] Request:', { listingId, buyerAddress, network });

    // Validate inputs
    if (!listingId || !buyerAddress || !network) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the listing
    const { data: listing, error: listingError } = await supabaseClient
      .from('nft_listings')
      .select('*')
      .eq('id', listingId)
      .eq('status', 'active')
      .eq('network', network)
      .single();

    if (listingError || !listing) {
      return new Response(
        JSON.stringify({ error: 'Listing not found or no longer active' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-buy-nft] Listing found:', listing);

    // Initialize anchor client - use network-specific seed
    const anchorSeed = network === 'test'
      ? Deno.env.get('ANCHOR_WALLET_SEED_TESTNET')
      : Deno.env.get('ANCHOR_WALLET_SEED');
      
    if (!anchorSeed) {
      throw new Error(`ANCHOR_WALLET_SEED${network === 'test' ? '_TESTNET' : ''} not configured`);
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-buy-nft] Anchor address:', anchorAddress);

    // Verify anchor holds the NFT
    const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(listing.token_address);
    const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
    const anchorBalance = await anchorClient.balance(tokenAccountObj, { account: anchorAccountObj });
    
    if (anchorBalance <= 0n) {
      return new Response(
        JSON.stringify({ error: 'NFT not in escrow' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-buy-nft] Anchor holds NFT:', anchorBalance.toString());

    // TRUSTED ANCHOR MODEL (2 transactions):
    // Transaction 1: Buyer already sent payment to anchor (handled by frontend)
    // Transaction 2: Anchor sends NFT to buyer
    
    console.log('[fx-buy-nft] Sending NFT to buyer...');
    
    const builder = anchorClient.initBuilder();
    const buyerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(buyerAddress);
    
    // Send NFT to buyer
    builder.send(buyerAccountObj, 1n, tokenAccountObj);
    
    await builder.computeBlocks();
    const result = await builder.publish();
    
    console.log('[fx-buy-nft] NFT sent to buyer:', result);

    // Update the listing status
    const { error: updateError } = await supabaseClient
      .from('nft_listings')
      .update({
        status: 'sold',
        sold_at: new Date().toISOString(),
        buyer_address: buyerAddress,
      })
      .eq('id', listingId);

    if (updateError) {
      console.error('[fx-buy-nft] Failed to update listing:', updateError);
      // Don't fail the request since the swap succeeded
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'NFT purchased successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[fx-buy-nft] Error:', error);
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
