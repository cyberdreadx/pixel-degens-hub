import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as KeetaNet from "npm:@keetanetwork/keetanet-client@0.14.12";
import * as bip39 from "npm:bip39@3.1.0";
import { Buffer } from "https://deno.land/std@0.177.0/node/buffer.ts";

const { AccountKeyAlgorithm } = KeetaNet.lib.Account;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userMnemonic } = await req.json();

    if (!userMnemonic) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing userMnemonic in request body'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const anchorSeed = Deno.env.get('ANCHOR_WALLET_SEED');
    if (!anchorSeed) {
      return new Response(
        JSON.stringify({ 
          error: 'ANCHOR_WALLET_SEED not configured'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('=== COMPARE REQUEST ===');
    console.log('User mnemonic word count:', userMnemonic.trim().split(/\s+/).length);
    console.log('User mnemonic first word:', userMnemonic.trim().split(/\s+/)[0]);
    console.log('User mnemonic last word:', userMnemonic.trim().split(/\s+/).slice(-1)[0]);
    
    console.log('ANCHOR_WALLET_SEED word count:', anchorSeed.trim().split(/\s+/).length);
    console.log('ANCHOR_WALLET_SEED first word:', anchorSeed.trim().split(/\s+/)[0]);
    console.log('ANCHOR_WALLET_SEED last word:', anchorSeed.trim().split(/\s+/).slice(-1)[0]);

    // Derive from user mnemonic using standard BIP39
    // BIP39 returns 64 bytes, but Keeta needs 32 bytes (first half)
    const userSeedBuffer = bip39.mnemonicToSeedSync(userMnemonic.trim());
    const userSeedConverted = Buffer.from(userSeedBuffer.slice(0, 32)).toString('hex');
    const userAccount = KeetaNet.lib.Account.fromSeed(userSeedConverted, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const userAddress = userAccount.publicKeyString.toString();

    console.log('User derived address:', userAddress);

    // Derive from ANCHOR_WALLET_SEED using standard BIP39
    const anchorSeedBuffer = bip39.mnemonicToSeedSync(anchorSeed.trim());
    const anchorSeedConverted = Buffer.from(anchorSeedBuffer.slice(0, 32)).toString('hex');
    const anchorAccount = KeetaNet.lib.Account.fromSeed(anchorSeedConverted, 0, AccountKeyAlgorithm.ECDSA_SECP256K1);
    const anchorAddress = anchorAccount.publicKeyString.toString();

    console.log('Anchor derived address:', anchorAddress);

    // Compare intermediate seeds (first 16 chars only for security)
    const seedsMatch = userSeedConverted === anchorSeedConverted;
    const addressesMatch = userAddress === anchorAddress;

    console.log('Seeds match:', seedsMatch);
    console.log('Addresses match:', addressesMatch);

    return new Response(
      JSON.stringify({ 
        match: addressesMatch && seedsMatch,
        userAddress,
        anchorAddress,
        seedsMatch,
        addressesMatch,
        userMnemonicWordCount: userMnemonic.trim().split(/\s+/).length,
        anchorMnemonicWordCount: anchorSeed.trim().split(/\s+/).length,
        userFirstWord: userMnemonic.trim().split(/\s+/)[0],
        anchorFirstWord: anchorSeed.trim().split(/\s+/)[0],
        userLastWord: userMnemonic.trim().split(/\s+/).slice(-1)[0],
        anchorLastWord: anchorSeed.trim().split(/\s+/).slice(-1)[0],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fx-anchor-compare function:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
