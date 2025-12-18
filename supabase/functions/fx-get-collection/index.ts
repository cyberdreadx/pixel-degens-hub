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
    const { collectionId, network = 'main', creatorAddress } = await req.json();

    const pinataJWT = Deno.env.get('PINATA_JWT');

    // If creatorAddress is provided, fetch all collections by this creator
    if (creatorAddress) {
      console.log('[fx-get-collection] Fetching collections for creator:', creatorAddress);
      
      const searchUrl = new URL('https://api.pinata.cloud/data/pinList');
      searchUrl.searchParams.set('status', 'pinned');
      searchUrl.searchParams.set('metadata[keyvalues]', JSON.stringify({
        type: { value: 'collection', op: 'eq' },
        creator: { value: creatorAddress, op: 'eq' },
        network: { value: network, op: 'eq' }
      }));

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
      console.log('[fx-get-collection] Found pins:', searchData.rows?.length || 0);
      
      // Fetch metadata for each collection
      const collections = [];
      for (const pin of searchData.rows || []) {
        try {
          const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${pin.ipfs_pin_hash}`);
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            metadata.ipfs_hash = pin.ipfs_pin_hash;
            collections.push(metadata);
          }
        } catch (e) {
          console.error('[fx-get-collection] Error fetching collection metadata:', e);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          collections,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single collection lookup by ID
    if (!collectionId) {
      return new Response(
        JSON.stringify({ error: 'Collection ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[fx-get-collection] Fetching collection:', collectionId);

    // Search for collection metadata on Pinata
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

    // Get the IPFS hash of the collection metadata
    const ipfsHash = searchData.rows[0].ipfs_pin_hash;

    // Fetch the actual metadata from IPFS gateway
    const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
    
    if (!metadataResponse.ok) {
      throw new Error('Failed to fetch collection metadata from IPFS');
    }

    const collectionMetadata = await metadataResponse.json();

    // Add the IPFS hash to the response
    collectionMetadata.ipfs_hash = ipfsHash;

    console.log('[fx-get-collection] Found collection:', collectionMetadata.name);

    return new Response(
      JSON.stringify({
        success: true,
        collection: collectionMetadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[fx-get-collection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch collection' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
