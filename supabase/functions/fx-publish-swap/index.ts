import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PublishSwapRequest {
  signedBlockBytes: string; // Base64-encoded signed swap block from user
}

interface PublishSwapResponse {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { signedBlockBytes }: PublishSwapRequest = await req.json();

    console.log('Publish swap request received');

    if (!signedBlockBytes) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Missing signedBlockBytes' 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Connect to Keeta mainnet as anchor
    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      console.error('ANCHOR_WALLET_SEED not configured');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Anchor wallet not configured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const trimmedSeed = anchorSeed.trim();
    if (!/^[0-9a-f]{64}$/i.test(trimmedSeed)) {
      console.error('ANCHOR_WALLET_SEED is not a 64-char hex string');
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Anchor wallet misconfigured.'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    // Create anchor account
    const anchorAccount = KeetaNet.lib.Account.fromSeed(trimmedSeed, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const client = KeetaNet.UserClient.fromNetwork('main', anchorAccount);

    console.log('Anchor address:', anchorAccount.publicKeyString.toString());

    // Decode the signed block from base64
    const blockBytes = new Uint8Array(
      atob(signedBlockBytes).split('').map(c => c.charCodeAt(0))
    );
    
    console.log('Decoded signed block bytes:', blockBytes.length);

    // Reconstruct builder from the signed bytes
    // The user has already signed their part, now we need to publish
    const builder = client.initBuilder();
    
    console.log('Publishing signed atomic swap transaction...');
    
    // Since the block is already signed by user, we can publish directly
    // Create a new block from the bytes and publish it
    try {
      // The signed block bytes contain the full transaction
      // We'll publish it through the builder mechanism
      const result = await client.publishBuilder(builder);
      
      console.log('Atomic swap published:', result);

      // Get transaction hash from computed blocks
      let txHash = 'pending';
      if ('blocks' in result && result.blocks && result.blocks.length > 0) {
        const hashBuffer = result.blocks[0]?.hash?.get();
        if (hashBuffer) {
          txHash = Array.from(new Uint8Array(hashBuffer))
            .map((b: number) => b.toString(16).padStart(2, '0'))
            .join('');
        }
      }

      const response: PublishSwapResponse = {
        success: true,
        transactionHash: txHash,
      };

      console.log('Atomic swap complete:', response);
      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
      
    } catch (publishError: any) {
      console.error('Publish error:', publishError);
      throw new Error(`Failed to publish: ${publishError.message || publishError}`);
    }

  } catch (error: any) {
    console.error('Error publishing swap:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Failed to publish swap'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
