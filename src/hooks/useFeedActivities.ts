import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTokenInfo } from "@/utils/keetaBlockchain";
import * as KeetaNet from "@keetanetwork/keetanet-client";

export interface FeedActivity {
  id: string;
  type: 'listing' | 'sale' | 'swap';
  userAddress: string;
  username?: string;
  timestamp: string;
  
  // For NFT activities
  tokenAddress?: string;
  tokenName?: string;
  tokenImage?: string;
  price?: number;
  currency?: 'KTA' | 'XRGE';
  
  // For swap activities
  fromToken?: string;
  toToken?: string;
  rate?: number;
  volume?: number;
}

export const useFeedActivities = (network: "main" | "test" = "test") => {
  const [activities, setActivities] = useState<FeedActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch recent NFT listings (prioritize these in feed)
      const { data: listings, error: listingsError } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('network', network)
        .order('created_at', { ascending: false })
        .limit(20); // Fetch more NFTs since they're prioritized

      if (listingsError) {
        console.error('[useFeedActivities] Error fetching listings:', listingsError);
        throw listingsError;
      }

      console.log(`[useFeedActivities] Fetched ${listings?.length || 0} NFT listings from database`);

      // Fetch recent swaps (price history with volume)
      // Note: price_history table might not have network column yet
      let swapsQuery = supabase
        .from('price_history')
        .select('*')
        .gt('volume_24h', 0)
        .order('timestamp', { ascending: false })
        .limit(10);
      
      // Try to filter by network if column exists
      try {
        swapsQuery = swapsQuery.eq('network', network);
      } catch (e) {
        // Network column doesn't exist yet, skip filter
        console.log('price_history.network column not found, showing all networks');
      }
      
      const { data: swaps, error: swapsError } = await swapsQuery;

      if (swapsError) {
        console.error('[useFeedActivities] Error fetching swaps:', swapsError);
        throw swapsError;
      }

      console.log(`[useFeedActivities] Fetched ${swaps?.length || 0} swaps from database`);

      // Process NFT listings
      const listingActivities: FeedActivity[] = [];
      
      for (const listing of listings || []) {
        let tokenName = 'Unknown NFT';
        let tokenImage = '';
        
        console.log(`[useFeedActivities] Processing NFT: ${listing.token_address}`);
        
        try {
          const tokenInfo = await fetchTokenInfo(listing.token_address, network);
          tokenName = tokenInfo.metadata?.name || tokenInfo.name;
          tokenImage = tokenInfo.metadata?.image || '';
          console.log(`[useFeedActivities] ✅ Loaded token: ${tokenName}`);
        } catch (e) {
          console.error(`[useFeedActivities] ❌ Failed to fetch token info for ${listing.token_address}:`, e);
          // Continue anyway, we'll show it with "Unknown NFT"
        }

        listingActivities.push({
          id: listing.id,
          type: listing.status === 'sold' ? 'sale' : 'listing',
          userAddress: listing.status === 'sold' ? listing.buyer_address : listing.seller_address,
          timestamp: listing.status === 'sold' ? listing.sold_at : listing.created_at,
          tokenAddress: listing.token_address,
          tokenName,
          tokenImage,
          price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
          currency: listing.currency as 'KTA' | 'XRGE',
        });
      }
      
      console.log(`[useFeedActivities] Processed ${listingActivities.length} NFT activities`);

      // Process swaps
      const swapActivities: FeedActivity[] = (swaps || []).map((swap) => ({
        id: swap.id,
        type: 'swap',
        userAddress: 'Anonymous Trader', // Swaps don't have user addresses in price_history
        timestamp: swap.timestamp,
        fromToken: swap.from_token,
        toToken: swap.to_token,
        rate: typeof swap.rate === 'string' ? parseFloat(swap.rate) : swap.rate,
        volume: typeof swap.volume_24h === 'string' ? parseFloat(swap.volume_24h) : (swap.volume_24h || 0),
      }));

      // Sort activities with NFT activities prioritized
      // 1. NFT activities (listings/sales) sorted by timestamp
      // 2. Then swap activities sorted by timestamp
      const sortedNFTs = listingActivities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const sortedSwaps = swapActivities.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Combine with NFTs first, limit total to 25
      const allActivities = [...sortedNFTs, ...sortedSwaps].slice(0, 25);

      console.log('[useFeedActivities] Loaded activities:', {
        nfts: sortedNFTs.length,
        swaps: sortedSwaps.length,
        total: allActivities.length
      });

      setActivities(allActivities);
    } catch (err: any) {
      console.error('Error fetching feed activities:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [network]);

  return { activities, isLoading, error, refetch: fetchActivities };
};

