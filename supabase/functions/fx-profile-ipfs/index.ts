import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PINATA_JWT = Deno.env.get('PINATA_JWT');
const PINATA_API_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';
const PINATA_UNPIN_URL = 'https://api.pinata.cloud/pinning/unpin';

interface ProfileData {
  wallet_address: string;
  username?: string;
  avatar_url?: string;
  bio?: string;
}

interface UploadRequest {
  profileData: ProfileData;
  oldIpfsHash?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    if (!PINATA_JWT) {
      throw new Error('PINATA_JWT not configured');
    }

    const { profileData, oldIpfsHash }: UploadRequest = await req.json();

    if (!profileData || !profileData.wallet_address) {
      throw new Error('Invalid profile data');
    }

    console.log('[fx-profile-ipfs] Uploading profile to IPFS:', profileData.wallet_address);

    // Prepare metadata for Pinata
    const pinataMetadata = {
      name: `profile-${profileData.wallet_address}`,
      keyvalues: {
        wallet_address: profileData.wallet_address,
        type: 'profile',
        timestamp: new Date().toISOString(),
      }
    };

    // Upload to IPFS via Pinata
    const uploadResponse = await fetch(PINATA_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: JSON.stringify({
        pinataContent: profileData,
        pinataMetadata,
        pinataOptions: {
          cidVersion: 1,
        }
      }),
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('[fx-profile-ipfs] Pinata upload failed:', errorText);
      throw new Error(`Failed to upload to IPFS: ${uploadResponse.statusText}`);
    }

    const uploadResult = await uploadResponse.json();
    const ipfsHash = uploadResult.IpfsHash;

    console.log('[fx-profile-ipfs] Successfully uploaded to IPFS:', ipfsHash);

    // Delete old IPFS pin if exists
    if (oldIpfsHash && oldIpfsHash !== ipfsHash) {
      console.log('[fx-profile-ipfs] Unpinning old profile:', oldIpfsHash);
      
      try {
        const unpinResponse = await fetch(`${PINATA_UNPIN_URL}/${oldIpfsHash}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${PINATA_JWT}`,
          },
        });

        if (unpinResponse.ok) {
          console.log('[fx-profile-ipfs] Successfully unpinned old profile');
        } else {
          console.warn('[fx-profile-ipfs] Failed to unpin old profile:', await unpinResponse.text());
        }
      } catch (unpinError) {
        console.error('[fx-profile-ipfs] Error unpinning old profile:', unpinError);
        // Don't fail the request if unpinning fails
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        ipfsHash,
        ipfsUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fx-profile-ipfs] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
