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

    // Store collection in Supabase database
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { error: dbError } = await supabase
      .from('collections')
      .insert({
        id: metadata.collection_id,
        name: metadata.name,
        symbol: metadata.symbol,
        description: metadata.description || null,
        creator_address: metadata.creator,
        network: metadata.network,
        banner_image: metadata.banner_image || null,
        logo_image: metadata.logo_image || null,
        ipfs_hash: ipfsHash,
        collection_metadata: metadata,
        total_supply: metadata.total_supply || null,
        minted_count: 0,
        storage_size_mb: metadata.pricing?.storage_size_mb || 0,
        hosting_fee_kta: metadata.pricing?.hosting_fee_kta || 0,
        paid_status: 'unpaid', // TODO: Implement payment verification
        royalty_percentage: metadata.royalty_percentage || 0,
        website: metadata.social_links?.website || null,
        twitter: metadata.social_links?.twitter || null,
        discord: metadata.social_links?.discord || null,
      });

    if (dbError) {
      console.error('[fx-upload-collection] Database error:', dbError);
      // Don't fail the request if DB insert fails - collection is still on IPFS
    } else {
      console.log('[fx-upload-collection] Collection saved to database');
    }

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
