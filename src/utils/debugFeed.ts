// Debug utility to check feed data
import { supabase } from "@/integrations/supabase/client";

export async function debugFeedData(network: "main" | "test" = "test") {
  console.log('🔍 [DEBUG] Starting feed data check...');
  console.log('🔍 [DEBUG] Network:', network);
  
  // Check NFT listings
  const { data: listings, error: listingsError } = await supabase
    .from('nft_listings')
    .select('*')
    .eq('network', network);
    
  console.log('🔍 [DEBUG] NFT Listings Query Result:');
  console.log('  - Error:', listingsError);
  console.log('  - Count:', listings?.length || 0);
  console.log('  - Data:', listings);
  
  // Check all listings (no network filter)
  const { data: allListings, error: allError } = await supabase
    .from('nft_listings')
    .select('*');
    
  console.log('🔍 [DEBUG] All NFT Listings (no network filter):');
  console.log('  - Error:', allError);
  console.log('  - Count:', allListings?.length || 0);
  console.log('  - Networks:', [...new Set(allListings?.map(l => l.network))]);
  
  // Check price history
  const { data: swaps, error: swapsError } = await supabase
    .from('price_history')
    .select('*')
    .gt('volume_24h', 0);
    
  console.log('🔍 [DEBUG] Swaps Query Result:');
  console.log('  - Error:', swapsError);
  console.log('  - Count:', swaps?.length || 0);
  
  return {
    listings,
    allListings,
    swaps,
    network
  };
}

// Make it available in console
if (typeof window !== 'undefined') {
  (window as any).debugFeedData = debugFeedData;
}

