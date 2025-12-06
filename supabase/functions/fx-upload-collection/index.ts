import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.84.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders });
  }

  try {
    const { metadata } = await req.json();

    if (!metadata || !metadata.collection_id) {
      return new Response(
        JSON.stringify({ error: 'Collection metadata is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[fx-upload-collection] Uploading collection metadata:', metadata.name);

    // Upload metadata as JSON to Pinata
    const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', metadataBlob, `${metadata.collection_id}.json`);
    
    // Add pinata metadata
    const pinataMetadata = JSON.stringify({
      name: `collection-${metadata.collection_id}`,
      keyvalues: {
        type: 'collection',
        collection_id: metadata.collection_id,
        network: metadata.network,
        creator: metadata.creator,
      }
    });
    formData.append('pinataMetadata', pinataMetadata);

    const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('PINATA_JWT')}`,
      },
      body: formData,
    });

    if (!pinataResponse.ok) {
      const errorText = await pinataResponse.text();
      console.error('[fx-upload-collection] Pinata error:', errorText);
      throw new Error(`Failed to upload to IPFS: ${errorText}`);
    }

    const pinataData = await pinataResponse.json();
    const ipfsHash = pinataData.IpfsHash;

    console.log('[fx-upload-collection] Collection uploaded to IPFS:', ipfsHash);

    // Store collection reference in Supabase for indexing
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // We'll create a collections index table if needed
    // For now, just return the IPFS hash - the collection can be discovered via its ID

    return new Response(
      JSON.stringify({
        success: true,
        ipfsHash,
        ipfsUrl: `ipfs://${ipfsHash}`,
        gatewayUrl: `https://gateway.pinata.cloud/ipfs/${ipfsHash}`,
        collectionId: metadata.collection_id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[fx-upload-collection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create collection' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
