import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Uploading file to IPFS via Pinata:', file.name, file.size);

    // Upload to Pinata
    const pinataFormData = new FormData();
    pinataFormData.append('file', file);

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PINATA_JWT')}`,
      },
      body: pinataFormData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('Pinata error:', errorText);
      throw new Error(`Pinata upload failed: ${errorText}`);
    }

    const pinataData = await pinataResponse.json();
    const ipfsHash = pinataData.IpfsHash;
    const ipfsUrl = `ipfs://${ipfsHash}`;
    const gatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    console.log('File uploaded to IPFS:', ipfsUrl);

    return new Response(
      JSON.stringify({ 
        ipfsUrl,
        gatewayUrl,
        hash: ipfsHash
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error uploading to IPFS:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to upload to IPFS' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});