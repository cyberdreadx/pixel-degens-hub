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
    const { collectionId, network = 'main', creatorAddress } = await req.json();

    const pinataJWT = Deno.env.get('PINATA_JWT');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // If creatorAddress is provided, fetch all collections by this creator from DB
    if (creatorAddress) {
      console.log('[fx-get-collection] Fetching collections for creator:', creatorAddress);
      
      const { data: collections, error } = await supabase
        .from('collections')
        .select('*')
        .eq('creator_address', creatorAddress)
        .eq('network', network)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[fx-get-collection] DB error:', error);
        throw new Error('Failed to fetch collections');
      }

      // Transform DB format to match expected format
      const formattedCollections = (collections || []).map(col => ({
        platform: "degenswap",
        version: "1.0",
        type: "collection",
        collection_id: col.id,
        name: col.name,
        symbol: col.symbol,
        description: col.description,
        banner_image: col.banner_image,
        logo_image: col.logo_image,
        creator: col.creator_address,
        royalty_percentage: 5,
        social_links: {},
        total_supply: col.total_supply,
        minted_count: col.minted_count,
        network: col.network,
        created_at: col.created_at,
        mint_price_kta: col.mint_price_kta,
        mint_price_xrge: col.mint_price_xrge,
        max_per_wallet: col.max_per_wallet,
        mint_enabled: col.mint_enabled,
        ipfs_hash: col.ipfs_hash,
        floor_price: col.floor_price,
        volume_traded: col.volume_traded,
        listed_count: col.listed_count,
      }));

      return new Response(
        JSON.stringify({
          success: true,
          collections: formattedCollections,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single collection lookup by ID - fetch from DB first
    if (collectionId) {
      console.log('[fx-get-collection] Fetching collection:', collectionId);

      // Get live data from database
      const { data: dbCollection, error: dbError } = await supabase
        .from('collections')
        .select('*')
        .eq('id', collectionId)
        .maybeSingle();

      if (dbError) {
        console.error('[fx-get-collection] DB error:', dbError);
      }

      // If found in DB, use that data (it's more up-to-date)
      if (dbCollection) {
        console.log('[fx-get-collection] Found collection in DB:', dbCollection.name);
        
        const collectionMetadata = {
          platform: "degenswap",
          version: "1.0",
          type: "collection",
          collection_id: dbCollection.id,
          name: dbCollection.name,
          symbol: dbCollection.symbol,
          description: dbCollection.description,
          banner_image: dbCollection.banner_image,
          logo_image: dbCollection.logo_image,
          creator: dbCollection.creator_address,
          royalty_percentage: 5,
          social_links: {},
          total_supply: dbCollection.total_supply,
          minted_count: dbCollection.minted_count,
          network: dbCollection.network,
          created_at: dbCollection.created_at,
          mint_price_kta: dbCollection.mint_price_kta,
          mint_price_xrge: dbCollection.mint_price_xrge,
          max_per_wallet: dbCollection.max_per_wallet,
          mint_enabled: dbCollection.mint_enabled,
          ipfs_hash: dbCollection.ipfs_hash,
          floor_price: dbCollection.floor_price,
          volume_traded: dbCollection.volume_traded,
          listed_count: dbCollection.listed_count,
        };

        return new Response(
          JSON.stringify({
            success: true,
            collection: collectionMetadata,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fallback to IPFS if not in DB (legacy collections)
      console.log('[fx-get-collection] Not in DB, trying IPFS...');
      
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

      const ipfsHash = searchData.rows[0].ipfs_pin_hash;
      const metadataResponse = await fetch(`https://gateway.pinata.cloud/ipfs/${ipfsHash}`);
      
      if (!metadataResponse.ok) {
        throw new Error('Failed to fetch collection metadata from IPFS');
      }

      const collectionMetadata = await metadataResponse.json();
      collectionMetadata.ipfs_hash = ipfsHash;

      console.log('[fx-get-collection] Found collection in IPFS:', collectionMetadata.name);

      return new Response(
        JSON.stringify({
          success: true,
          collection: collectionMetadata,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Either collectionId or creatorAddress is required' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: any) {
    console.error('[fx-get-collection] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to fetch collection' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
