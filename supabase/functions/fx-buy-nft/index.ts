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
  paymentTxHash?: string; // Optional for backward compatibility
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

    const { listingId, buyerAddress, network, paymentTxHash } = await req.json() as BuyNFTRequest;

    console.log('[fx-buy-nft] Request:', { listingId, buyerAddress, network, hasPaymentTx: !!paymentTxHash });

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

    // CRITICAL: Verify buyer sent payment to anchor BEFORE transferring NFT
    console.log('[fx-buy-nft] Verifying buyer payment...');
    
    const paymentTokenAddress = listing.currency === 'KTA' 
      ? (network === 'test' 
          ? 'keeta_anyiff4v34alvumupagmdyosydeq24lc4def5mrpmmyhx3j6vj2uucckeqn52'
          : 'keeta_anqdilpazdekdu4acw65fj7smltcp26wbrildkqtszqvverljpwpezmd44ssg')
      : (network === 'test'
          ? 'keeta_annmywuiz2pourjmkyuaznxyg6cmv356dda3hpuiqfpwry5m2tlybothdb33s'
          : 'keeta_aolgxwrcepccr5ycg5ctp3ezhhp6vnpitzm7grymm63hzbaqk6lcsbtccgur6');
    
    const expectedAmount = listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge;
    const TOKEN_DECIMALS_VALUE = listing.currency === 'KTA' ? 9 : 18;
    const expectedAmountInSmallestUnit = BigInt(Math.floor(expectedAmount * Math.pow(10, TOKEN_DECIMALS_VALUE)));
    
    // Get buyer's payment token account to check recent transactions
    // For now, we'll verify the anchor received the payment by checking recent balance increase
    // Note: This is a simplified check. A production system would track transaction hashes.
    console.log('[fx-buy-nft] Expected payment:', expectedAmountInSmallestUnit.toString(), listing.currency);
    
    // Verify anchor holds the NFT
    const tokenAccountObj = KeetaNet.lib.Account.fromPublicKeyString(listing.token_address);
    const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
    const anchorBalance = await anchorClient.balance(tokenAccountObj, { account: anchorAccountObj });
    
    if (anchorBalance <= 0n) {
      console.error('[fx-buy-nft] NFT not in escrow, balance:', anchorBalance.toString());
      return new Response(
        JSON.stringify({ error: 'NFT not in escrow - listing may be invalid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-buy-nft] Anchor holds NFT:', anchorBalance.toString());
    
    // TODO: Add transaction verification to check buyer actually sent payment
    // For now, we trust that frontend sent payment before calling this function
    console.log('[fx-buy-nft] WARNING: Payment verification not yet implemented. Trusting frontend payment.');

    // TRUSTED ANCHOR MODEL (2 transactions):
    // Transaction 1: Buyer already sent payment to anchor (handled by frontend)
    // Transaction 2: Anchor sends NFT to buyer
    
    console.log('[fx-buy-nft] Sending NFT to buyer and payment to seller...');
    
    const builder = anchorClient.initBuilder();
    const buyerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(buyerAddress);
    const sellerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(listing.seller_address);
    const paymentTokenObj = KeetaNet.lib.Account.fromPublicKeyString(paymentTokenAddress);
    
    // Send NFT to buyer
    builder.send(buyerAccountObj, 1n, tokenAccountObj);
    
    // Send payment to seller
    console.log('[fx-buy-nft] Sending payment to seller:', expectedAmountInSmallestUnit.toString(), listing.currency);
    builder.send(sellerAccountObj, expectedAmountInSmallestUnit, paymentTokenObj);
    
    await builder.computeBlocks();
    const result = await builder.publish();
    
    console.log('[fx-buy-nft] NFT sent to buyer and payment sent to seller:', result);

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
