import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFTMetadataItem {
  name: string;
  description?: string;
  image: string; // filename in ZIP
  attributes?: Array<{ trait_type: string; value: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    
    const collectionId = formData.get('collectionId') as string;
    const network = formData.get('network') as string || 'main';
    const metadataFile = formData.get('metadata') as File;
    const metadataType = formData.get('metadataType') as string || 'csv';
    const zipFile = formData.get('zip') as File;

    console.log('[fx-upload-nft-pool] Request:', { collectionId, network, metadataType });

    if (!collectionId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Collection ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!metadataFile) {
      return new Response(
        JSON.stringify({ success: false, error: 'Metadata file is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!zipFile) {
      return new Response(
        JSON.stringify({ success: false, error: 'ZIP file with images is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse metadata
    const metadataText = await metadataFile.text();
    let nftItems: NFTMetadataItem[] = [];

    if (metadataType === 'csv') {
      const lines = metadataText.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        
        if (row.name && (row.image || row.image_filename)) {
          nftItems.push({
            name: row.name,
            description: row.description || '',
            image: row.image || row.image_filename,
            attributes: row.attributes ? JSON.parse(row.attributes) : [],
          });
        }
      }
    } else {
      // JSON format
      const json = JSON.parse(metadataText);
      const items = Array.isArray(json) ? json : [json];
      
      for (const item of items) {
        if (item.name && item.image) {
          nftItems.push({
            name: item.name,
            description: item.description || '',
            image: item.image,
            attributes: item.attributes || [],
          });
        }
      }
    }

    console.log(`[fx-upload-nft-pool] Parsed ${nftItems.length} NFT items from metadata`);

    if (nftItems.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No valid NFT items found in metadata' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract ZIP file
    const zipBuffer = await zipFile.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);
    
    // Get Pinata JWT
    const pinataJwt = Deno.env.get('PINATA_JWT');
    if (!pinataJwt) {
      return new Response(
        JSON.stringify({ success: false, error: 'PINATA_JWT not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upload each image to IPFS and build pool records
    const poolRecords: Array<{
      collection_id: string;
      nft_index: number;
      name: string;
      description: string | null;
      image_ipfs: string;
      attributes: any;
    }> = [];

    const imageHashes: Map<string, string> = new Map();

    for (let i = 0; i < nftItems.length; i++) {
      const nft = nftItems[i];
      const imageFilename = nft.image.replace(/^.*[\\/]/, ''); // Get just filename
      
      console.log(`[fx-upload-nft-pool] Processing ${i + 1}/${nftItems.length}: ${nft.name} - ${imageFilename}`);

      // Find image in ZIP (case-insensitive search)
      let imageFile: JSZip.JSZipObject | null = null;
      let foundFilename = '';
      
      for (const [relativePath, file] of Object.entries(zip.files)) {
        if (!file.dir) {
          const filename = relativePath.split('/').pop() || relativePath;
          if (filename.toLowerCase() === imageFilename.toLowerCase()) {
            imageFile = file;
            foundFilename = filename;
            break;
          }
        }
      }

      if (!imageFile) {
        console.warn(`[fx-upload-nft-pool] Image not found in ZIP: ${imageFilename}`);
        continue;
      }

      // Check if we've already uploaded this image
      let ipfsHash = imageHashes.get(foundFilename.toLowerCase());
      
      if (!ipfsHash) {
        // Get image data
        const imageData = await imageFile.async('blob');
        
        // Determine content type
        const ext = foundFilename.split('.').pop()?.toLowerCase() || 'png';
        const contentTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        const contentType = contentTypes[ext] || 'image/png';

        // Upload to Pinata
        const pinataFormData = new FormData();
        pinataFormData.append('file', new Blob([imageData], { type: contentType }), foundFilename);
        pinataFormData.append('pinataMetadata', JSON.stringify({
          name: `${collectionId}_${foundFilename}`,
          keyvalues: { collection: collectionId, type: 'nft-image' }
        }));

        const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pinataJwt}`,
          },
          body: pinataFormData,
        });

        if (!pinataResponse.ok) {
          const errorText = await pinataResponse.text();
          console.error(`[fx-upload-nft-pool] Pinata upload failed for ${foundFilename}:`, errorText);
          continue;
        }

        const pinataResult = await pinataResponse.json();
        ipfsHash = pinataResult.IpfsHash as string;
        imageHashes.set(foundFilename.toLowerCase(), ipfsHash!);
        
        console.log(`[fx-upload-nft-pool] Uploaded ${foundFilename} -> ipfs://${ipfsHash}`);
      }

      // Add to pool records
      poolRecords.push({
        collection_id: collectionId,
        nft_index: i,
        name: nft.name,
        description: nft.description || null,
        image_ipfs: `ipfs://${ipfsHash}`,
        attributes: nft.attributes || [],
      });
    }

    console.log(`[fx-upload-nft-pool] Successfully processed ${poolRecords.length} NFTs`);

    if (poolRecords.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No images were successfully uploaded' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert pool records into Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: insertError } = await supabase
      .from('collection_nfts')
      .insert(poolRecords);

    if (insertError) {
      console.error('[fx-upload-nft-pool] Database insert error:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: `Database error: ${insertError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fx-upload-nft-pool] Inserted ${poolRecords.length} records into database`);

    return new Response(
      JSON.stringify({
        success: true,
        uploaded: poolRecords.length,
        total: nftItems.length,
        message: `Successfully uploaded ${poolRecords.length} NFTs to the pool`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fx-upload-nft-pool] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
