import { supabase } from "@/integrations/supabase/client";

export async function generateAndDownloadAssets() {
  try {
    console.log('Calling generate-site-assets function...');
    
    const { data, error } = await supabase.functions.invoke('generate-site-assets', {
      body: {}
    });

    if (error) throw error;

    // Convert base64 to blob and download
    const downloadBase64 = (base64Data: string, filename: string) => {
      const base64 = base64Data.split(',')[1];
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'image/png' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    };

    if (data.favicon) {
      downloadBase64(data.favicon, 'favicon.png');
    }

    if (data.ogImage) {
      downloadBase64(data.ogImage, 'og-image.png');
    }

    return data;
  } catch (error) {
    console.error('Error generating assets:', error);
    throw error;
  }
}
