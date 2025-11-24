import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('Generating favicon...');
    
    // Generate favicon (512x512 for high quality)
    const faviconResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: "Create a pixelated 8-bit style favicon with neon colors. The design should feature a retro gaming aesthetic with bright cyan and magenta neon glow effects. Include pixel art elements like a stylized 'K' letter or geometric shapes. Square format, bold colors, high contrast, perfect for a DEGEN NFT store. Pure digital art style."
          }
        ],
        modalities: ["image", "text"]
      })
    });

    const faviconData = await faviconResponse.json();
    const faviconBase64 = faviconData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!faviconBase64) {
      throw new Error('Failed to generate favicon');
    }

    console.log('Generating OG image...');

    // Generate OG image (1200x630)
    const ogResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image-preview",
        messages: [
          {
            role: "user",
            content: "Create a 1200x630px social media banner for 'DEGEN NFT STORE' in 8-bit pixel art style. Features: Bold pixelated text 'DEGEN NFT STORE', neon cyan and magenta glow effects, retro gaming aesthetic, geometric pixel patterns, dark background with bright neon accents. Include text 'SWAP • COLLECT • TRADE on KEETA CHAIN' in smaller pixel font. Landscape format, high energy, cyberpunk vibes."
          }
        ],
        modalities: ["image", "text"]
      })
    });

    const ogData = await ogResponse.json();
    const ogBase64 = ogData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (!ogBase64) {
      throw new Error('Failed to generate OG image');
    }

    console.log('Assets generated successfully');

    return new Response(
      JSON.stringify({ 
        favicon: faviconBase64,
        ogImage: ogBase64,
        message: 'Assets generated successfully'
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error generating assets:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
