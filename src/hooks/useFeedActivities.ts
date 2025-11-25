import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchTokenInfo } from "@/utils/keetaBlockchain";

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
      // Fetch recent NFT listings
      const { data: listings, error: listingsError } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('network', network)
        .order('created_at', { ascending: false })
        .limit(10);

      if (listingsError) throw listingsError;

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

      if (swapsError) throw swapsError;

      // Process NFT listings
      const listingActivities: FeedActivity[] = await Promise.all(
        (listings || []).map(async (listing) => {
          let tokenName = 'Unknown NFT';
          let tokenImage = '';
          
          try {
            const tokenInfo = await fetchTokenInfo(listing.token_address, network);
            tokenName = tokenInfo.metadata?.name || tokenInfo.name;
            tokenImage = tokenInfo.metadata?.image || '';
          } catch (e) {
            console.error('Failed to fetch token info:', e);
          }

          return {
            id: listing.id,
            type: listing.status === 'sold' ? 'sale' : 'listing',
            userAddress: listing.status === 'sold' ? listing.buyer_address : listing.seller_address,
            timestamp: listing.status === 'sold' ? listing.sold_at : listing.created_at,
            tokenAddress: listing.token_address,
            tokenName,
            tokenImage,
            price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
            currency: listing.currency,
          };
        })
      );

      // Process swaps
      const swapActivities: FeedActivity[] = (swaps || []).map((swap) => ({
        id: swap.id,
        type: 'swap',
        userAddress: 'Anonymous Trader', // Swaps don't have user addresses in price_history
        timestamp: swap.timestamp,
        fromToken: swap.from_token,
        toToken: swap.to_token,
        rate: parseFloat(swap.rate),
        volume: parseFloat(swap.volume_24h),
      }));

      // Combine and sort all activities by timestamp
      const allActivities = [...listingActivities, ...swapActivities]
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 20); // Limit to 20 most recent

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

