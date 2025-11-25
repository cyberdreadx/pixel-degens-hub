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
  paymentBlockBytes: string; // Base64-encoded payment block from buyer
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { listingId, buyerAddress, network, paymentBlockBytes } = await req.json() as BuyNFTRequest;

    console.log('[fx-buy-nft] Request:', { listingId, buyerAddress, network });

    // Validate inputs
    if (!listingId || !buyerAddress || !network || !paymentBlockBytes) {
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

    // Initialize anchor client
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      throw new Error('ANCHOR_WALLET_SEED not configured');
    }

    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorClient = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-buy-nft] Anchor address:', anchorAddress);

    // Verify anchor holds the NFT
    const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(listing.token_address);
    const anchorBalance = await anchorClient.balance(tokenAccountObj);
    
    if (anchorBalance <= 0n) {
      return new Response(
        JSON.stringify({ error: 'NFT not in escrow' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-buy-nft] Anchor holds NFT:', anchorBalance.toString());

    // Decode the payment block from buyer
    const paymentBlockBuffer = Uint8Array.from(atob(paymentBlockBytes), c => c.charCodeAt(0));
    const paymentBlock = KeetaNet.lib.Block.fromBytes(paymentBlockBuffer);

    console.log('[fx-buy-nft] Payment block received:', paymentBlock.hash);

    // Build anchor's side of the atomic swap
    const builder = anchorClient.initBuilder();

    const buyerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(buyerAddress);
    const sellerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(listing.seller_address);

    // Anchor sends NFT to buyer
    builder.send(buyerAccountObj, 1n, tokenAccountObj);

    // Anchor expects to receive payment from buyer (which goes to seller)
    const price = listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge;
    const decimals = listing.currency === 'KTA' ? TOKEN_DECIMALS.KTA : TOKEN_DECIMALS.XRGE;
    const priceInBaseUnits = BigInt(Math.floor(price * Math.pow(10, decimals)));

    // The payment block from buyer should send to seller directly,
    // but we use receive to enforce the constraint in the atomic swap
    const paymentToken = listing.currency === 'KTA' ? anchorClient.baseToken : KeetaNet.lib.Account.fromPublicKeyString(
      network === 'test' 
        ? 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s' 
        : 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6'
    );

    builder.receive(buyerAccountObj, priceInBaseUnits, paymentToken, true);

    console.log('[fx-buy-nft] Building atomic swap for price:', price, listing.currency);

    // Compute and publish the atomic swap
    await builder.computeBlocks();
    
    // Add the buyer's payment block to create atomic swap
    builder.addForeignBlock(paymentBlock);
    
    const result = await builder.publish();
    console.log('[fx-buy-nft] Atomic swap published:', result);

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
        message: 'NFT purchased successfully',
        transaction: result
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
