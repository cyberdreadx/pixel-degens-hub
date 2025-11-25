import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PINATA_JWT = Deno.env.get('PINATA_JWT');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    if (!PINATA_JWT) {
      throw new Error('PINATA_JWT not configured');
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const oldIpfsHash = formData.get('oldIpfsHash') as string | null;

    if (!file) {
      throw new Error('No file provided');
    }

    // Upload new avatar to Pinata
    console.log('Uploading avatar to IPFS...');
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);
    
    const pinataMetadata = JSON.stringify({
      name: `avatar-${Date.now()}-${file.name}`,
    });
    pinataFormData.append('pinataMetadata', pinataMetadata);

    const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      },
      body: pinataFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('Pinata upload error:', errorText);
      throw new Error(`Failed to upload to Pinata: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    const ipfsHash = uploadResult.IpfsHash;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log('Avatar uploaded to IPFS:', ipfsHash);

    // Unpin old avatar if exists
    if (oldIpfsHash) {
      try {
        console.log('Unpinning old avatar:', oldIpfsHash);
        const unpinResponse = await fetch(`https://api.pinata.cloud/pinning/unpin/${oldIpfsHash}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${PINATA_JWT}`,
          },
        });

        if (unpinResponse.ok) {
          console.log('Successfully unpinned old avatar');
        } else {
          console.warn('Failed to unpin old avatar:', await unpinResponse.text());
        }
      } catch (unpinError) {
        console.error('Error unpinning old avatar:', unpinError);
      }
    }

    return new Response(
      JSON.stringify({ ipfsHash, ipfsUrl }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in fx-upload-avatar:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
