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

    const { tokenAddress, sellerAddress, price, currency, network } = await req.json() as ListNFTRequest;

    console.log('[fx-list-nft] Request:', { tokenAddress, sellerAddress, price, currency, network });

    // Validate inputs
    if (!tokenAddress || !sellerAddress || !price || !currency || !network) {
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

    console.log('[fx-list-nft] Anchor address:', anchorAddress);

    // Verify anchor received the NFT (it should have been transferred by seller already)
    const anchorAccountObj = KeetaNet.lib.Account.fromPublicKeyString(anchorAddress);
    
    const anchorBalance = await anchorClient.balance(tokenAddress, { account: anchorAccountObj });
    
    console.log('[fx-list-nft] Checking anchor balance for token:', tokenAddress);
    console.log('[fx-list-nft] Anchor balance:', anchorBalance.toString());
    
    if (anchorBalance <= 0n) {
      // Check if seller still owns it
      const sellerAccountObj = KeetaNet.lib.Account.fromPublicKeyString(sellerAddress);
      const sellerBalance = await anchorClient.balance(tokenAddress, { account: sellerAccountObj });
      
      console.log('[fx-list-nft] Seller balance:', sellerBalance.toString());
      
      return new Response(
        JSON.stringify({ 
          error: 'NFT not yet received by anchor. Transfer may still be processing.',
          details: {
            anchorBalance: anchorBalance.toString(),
            sellerBalance: sellerBalance.toString(),
            message: 'Please wait a few seconds and try listing again.'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-list-nft] ✅ Anchor holds NFT, balance:', anchorBalance.toString());

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
