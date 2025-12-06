import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { decompress } from "https://deno.land/x/zip@v1.2.5/mod.ts";
import { ensureDir } from "https://deno.land/std@0.168.0/fs/mod.ts";

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
    const csvFile = formData.get('csv') as File;
    const zipFile = formData.get('zip') as File;
    const collectionId = formData.get('collectionId') as string;
    const network = formData.get('network') as string || 'main';

    if (!csvFile || !zipFile) {
      return new Response(
        JSON.stringify({ error: 'CSV and ZIP files are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[fx-batch-upload] Processing batch upload for collection:', collectionId);
    console.log('[fx-batch-upload] CSV file:', csvFile.name, csvFile.size);
    console.log('[fx-batch-upload] ZIP file:', zipFile.name, zipFile.size);

    const pinataJWT = Deno.env.get('PINATA_JWT');
    if (!pinataJWT) {
      throw new Error('PINATA_JWT not configured');
    }

    // Parse CSV to get list of required images
    const csvText = await csvFile.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const imageFilenameIndex = headers.indexOf('image_filename');

    if (imageFilenameIndex === -1) {
      throw new Error('CSV must have image_filename column');
    }

    const requiredImages = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const filename = values[imageFilenameIndex];
      if (filename) {
        requiredImages.add(filename);
      }
    }

    console.log('[fx-batch-upload] Required images:', Array.from(requiredImages));

    // Create temp directory for extraction
    const tempDir = `/tmp/batch-${Date.now()}`;
    await ensureDir(tempDir);

    // Write ZIP to temp file
    const zipPath = `${tempDir}/images.zip`;
    const zipBuffer = await zipFile.arrayBuffer();
    await Deno.writeFile(zipPath, new Uint8Array(zipBuffer));

    // Extract ZIP
    const extractDir = `${tempDir}/extracted`;
    await ensureDir(extractDir);
    
    try {
      await decompress(zipPath, extractDir);
    } catch (err) {
      console.error('[fx-batch-upload] ZIP extraction error:', err);
      throw new Error('Failed to extract ZIP file');
    }

    // Upload each image to IPFS
    const imageHashes: Record<string, string> = {};
    let uploadedCount = 0;

    for (const filename of requiredImages) {
      try {
        // Find the file (might be in a subdirectory)
        let imagePath = `${extractDir}/${filename}`;
        
        // Try to read the file
        let imageData: Uint8Array;
        try {
          imageData = await Deno.readFile(imagePath);
        } catch {
          // Try without subdirectory prefix if filename includes path
          const baseName = filename.split('/').pop() || filename;
          imagePath = `${extractDir}/${baseName}`;
          imageData = await Deno.readFile(imagePath);
        }

        // Determine content type
        const ext = filename.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
        };
        const contentType = contentTypes[ext || 'png'] || 'image/png';

        // Upload to Pinata
        const blob = new Blob([new Uint8Array(imageData)], { type: contentType });
        const uploadForm = new FormData();
        uploadForm.append('file', blob, filename);

        const pinataResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pinataJWT}`,
          },
          body: uploadForm,
        });

        if (!pinataResponse.ok) {
          const errorText = await pinataResponse.text();
          console.error(`[fx-batch-upload] Failed to upload ${filename}:`, errorText);
          continue;
        }

        const pinataData = await pinataResponse.json();
        imageHashes[filename] = pinataData.IpfsHash;
        uploadedCount++;

        console.log(`[fx-batch-upload] Uploaded ${filename}: ${pinataData.IpfsHash}`);

      } catch (err) {
        console.error(`[fx-batch-upload] Error processing ${filename}:`, err);
      }
    }

    // Cleanup temp directory
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }

    console.log(`[fx-batch-upload] Uploaded ${uploadedCount}/${requiredImages.size} images`);

    return new Response(
      JSON.stringify({
        success: true,
        images: imageHashes,
        uploaded: uploadedCount,
        total: requiredImages.size,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[fx-batch-upload] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Batch upload failed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
