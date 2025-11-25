import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import { TOKEN_DECIMALS } from "../_shared/tokenDecimals.ts";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ListNFTRequest {
  tokenAddress: string;
  sellerAddress: string;
  price: number;
  currency: 'KTA' | 'XRGE';
  network: 'test' | 'main';
  swapBlockBytes: string; // Base64-encoded swap block from seller
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

    const { tokenAddress, sellerAddress, price, currency, network, swapBlockBytes } = await req.json() as ListNFTRequest;

    console.log('[fx-list-nft] Request:', { tokenAddress, sellerAddress, price, currency, network });

    // Validate inputs
    if (!tokenAddress || !sellerAddress || !price || !currency || !network || !swapBlockBytes) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (price <= 0) {
      return new Response(
        JSON.stringify({ error: 'Price must be greater than 0' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize anchor client
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      throw new Error('ANCHOR_WALLET_SEED not configured');
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-list-nft] Anchor address:', anchorAddress);

    // Verify seller owns the NFT by checking balance
    const sellerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(sellerAddress);
    const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(tokenAddress);
    
    const sellerBalance = await anchorClient.balance(tokenAccountObj, { account: sellerAccountObj });
    
    if (sellerBalance <= 0n) {
      return new Response(
        JSON.stringify({ error: 'Seller does not own this NFT' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-list-nft] Seller balance verified:', sellerBalance.toString());

    // Decode and verify the swap block from seller
    const swapBlockBuffer = Uint8Array.from(atob(swapBlockBytes), c => c.charCodeAt(0));
    const swapBlock = KeetaNet.lib.Block.fromBytes(swapBlockBuffer);

    console.log('[fx-list-nft] Swap block received:', swapBlock.hash);

    // Build anchor's side of the atomic swap
    const builder = anchorClient.initBuilder();

    // Anchor receives the NFT from seller (1 token, since it's an NFT)
    builder.receive(sellerAccountObj, 1n, tokenAccountObj, true);

    console.log('[fx-list-nft] Building anchor receive operation');

    // Compute and publish the atomic swap
    await builder.computeBlocks();
    
    // Add the seller's block to create atomic swap
    builder.addForeignBlock(swapBlock);
    
    const result = await builder.publish();
    console.log('[fx-list-nft] Atomic swap published:', result);

    // Store the listing in database
    const { data: listing, error: dbError } = await supabaseClient
      .from('nft_listings')
      .insert({
        token_address: tokenAddress,
        seller_address: sellerAddress,
        price_kta: currency === 'KTA' ? price : null,
        price_xrge: currency === 'XRGE' ? price : null,
        currency: currency,
        status: 'active',
        network: network,
      })
      .select()
      .single();

    if (dbError) {
      console.error('[fx-list-nft] Database error:', dbError);
      throw new Error(`Failed to create listing: ${dbError.message}`);
    }

    console.log('[fx-list-nft] Listing created:', listing.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        listing,
        message: 'NFT listed successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('[fx-list-nft] Error:', error);
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
