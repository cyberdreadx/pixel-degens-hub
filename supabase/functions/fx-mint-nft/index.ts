import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MintRequest {
  name: string;
  ticker: string;
  description?: string;
  imageUrl: string;
  attributes?: Array<{ trait_type: string; value: string }>;
  externalUrl?: string;
  recipientAddress: string;
  network: 'main' | 'test';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: MintRequest = await req.json();
    const { name, ticker, description, imageUrl, attributes, externalUrl, recipientAddress, network } = body;

    console.log('[fx-mint-nft] Request:', { name, ticker, recipientAddress, network });

    // Validate required fields
    if (!name || !ticker || !imageUrl || !recipientAddress) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: name, ticker, imageUrl, recipientAddress' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get anchor wallet seed based on network
    const anchorSeed = network === 'test' 
      ? Deno.env.get('ANCHOR_WALLET_SEED_TESTNET') 
      : Deno.env.get('ANCHOR_WALLET_SEED');
    
    if (!anchorSeed) {
      console.error('[fx-mint-nft] Missing anchor wallet seed for network:', network);
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error: missing anchor wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[fx-mint-nft] Initializing Keeta client for network:', network);

    // Initialize anchor account and client using the correct pattern
    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const client = KeetaNet.UserClient.fromNetwork(network, anchorAccount);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('[fx-mint-nft] Anchor address:', anchorAddress);

    // Generate unique NFT identifier
    const nftId = Date.now();
    const identifier = `NFT_KTA_ANCHOR_${nftId}`;

    // Create metadata
    const metadata = {
      platform: "degen8bit",
      version: "1.0",
      identifier: identifier,
      nft_id: nftId,
      name,
      description: description || '',
      image: imageUrl,
      attributes: attributes || [],
      ...(externalUrl && { external_url: externalUrl }),
    };

    const metadataJson = JSON.stringify(metadata);
    const metadataBase64 = btoa(metadataJson);

    console.log('[fx-mint-nft] Creating token with metadata:', { identifier, name, ticker });

    // Build minting transaction
    const builder = client.initBuilder();

    // Generate new token account
    const pendingTokenAccount = builder.generateIdentifier(AccountKeyAlgorithm.TOKEN);
    await builder.computeBlocks();
    const tokenAccount = pendingTokenAccount.account;

    // Format ticker (A-Z only, max 4 chars)
    const formattedSymbol = ticker.trim().toUpperCase().replace(/[^A-Z]/g, '').substring(0, 4);

    // Set token info
    builder.setInfo(
      {
        name: formattedSymbol,
        description: name, // Use name as description field
        metadata: metadataBase64,
        defaultPermission: new KeetaNet.lib.Permissions(['ACCESS'], []),
      },
      { account: tokenAccount }
    );

    // Mint supply of 1 (NFT)
    builder.modifyTokenSupply(1n, { account: tokenAccount });
    await builder.computeBlocks();

    // Send the minted token to the recipient
    const recipientAccount = KeetaNet.lib.Account.fromPublicKeyString(recipientAddress);
    
    builder.updateAccounts({
      account: tokenAccount,
      signer: anchorAccount // Anchor signs as the creator
    });

    builder.send(recipientAccount, 1n, tokenAccount);

    // Publish transaction
    console.log('[fx-mint-nft] Publishing transaction...');
    await builder.computeBlocks();
    const result = await builder.publish();

    const tokenAddress = tokenAccount.publicKeyString.toString();
    console.log('[fx-mint-nft] Token minted successfully:', tokenAddress);

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        message: 'NFT minted and transferred successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fx-mint-nft] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
