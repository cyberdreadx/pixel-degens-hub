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
    const { collectionId, updates } = await req.json();

    if (!collectionId) {
      return new Response(
        JSON.stringify({ error: 'Collection ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[fx-update-collection] Updating collection:', collectionId, updates);

    const pinataJWT = Deno.env.get('PINATA_JWT');

    // First, fetch the existing collection metadata
    const searchUrl = new URL('https://api.pinata.cloud/data/pinList');
    searchUrl.searchParams.set('status', 'pinned');
    searchUrl.searchParams.set('metadata[name]', `collection-${collectionId}`);

    const searchResponse = await fetch(searchUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
      },
    });

    if (!searchResponse.ok) {
      throw new Error('Failed to search Pinata');
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.rows || searchData.rows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Collection not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    const oldIpfsHash = searchData.rows[0].ipfs_pin_hash;

    // Fetch existing metadata
    const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${oldIpfsHash}`);
    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch collection metadata');
    }

    const existingMetadata = await metadataResponse.json();

    // Merge updates
    const updatedMetadata = {
      ...existingMetadata,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // If minted_count is being incremented, add to existing
    if (updates.minted_count !== undefined && existingMetadata.minted_count) {
      updatedMetadata.minted_count = existingMetadata.minted_count + updates.minted_count;
    }

    // Upload new metadata to IPFS
    const metadataBlob = new Blob([JSON.stringify(updatedMetadata)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('file', metadataBlob, `${collectionId}.json`);
    
    const pinataMetadata = JSON.stringify({
      name: `collection-${collectionId}`,
      keyvalues: {
        type: 'collection',
        collection_id: collectionId,
        network: updatedMetadata.network,
        creator: updatedMetadata.creator,
      }
    });
    formData.append('pinataMetadata', pinataMetadata);

    const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`,
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload updated metadata');
    }

    const uploadData = await uploadResponse.json();
    const newIpfsHash = uploadData.IpfsHash;

    // Unpin old version
    try {
      await fetch(`https://api.pinata.cloud/pinning/unpin/${oldIpfsHash}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${pinataJWT}`,
        },
      });
      console.log('[fx-update-collection] Unpinned old version:', oldIpfsHash);
    } catch (unpinError) {
      console.warn('[fx-update-collection] Failed to unpin old version:', unpinError);
    }

    console.log('[fx-update-collection] Updated collection:', newIpfsHash);

    return new Response(
      JSON.stringify({
        success: true,
        ipfsHash: newIpfsHash,
        collection: updatedMetadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[fx-update-collection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to update collection' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
