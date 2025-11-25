import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchTokenInfo } from '@/utils/keetaBlockchain';

export interface MarketplaceNFT {
  id: string;
  tokenAddress: string;
  sellerAddress: string;
  price: number;
  currency: string;
  status: string;
  network: string;
  createdAt: string;
  metadata?: any;
  tokenInfo?: any;
}

export function useMarketplaceNFTs(network: "main" | "test" = "test") {
  const [nfts, setNfts] = useState<MarketplaceNFT[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadNFTs = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch all active listings from database
        const { data: listings, error: listingsError } = await supabase
          .from('nft_listings')
          .select('*')
          .eq('network', network)
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (listingsError) {
          throw listingsError;
        }

        console.log(`[useMarketplaceNFTs] Fetched ${listings?.length || 0} active listings`);

        // Fetch metadata for each NFT
        const nftsWithMetadata: MarketplaceNFT[] = [];

        for (const listing of listings || []) {
          try {
            const tokenInfo = await fetchTokenInfo(listing.token_address, network);
            
            nftsWithMetadata.push({
              id: listing.id,
              tokenAddress: listing.token_address,
              sellerAddress: listing.seller_address,
              price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
              currency: listing.currency,
              status: listing.status,
              network: listing.network,
              createdAt: listing.created_at,
              tokenInfo,
              metadata: tokenInfo?.metadata,
            });
          } catch (err) {
            console.error(`[useMarketplaceNFTs] Failed to load token info for ${listing.token_address}:`, err);
            // Still include the listing even if metadata fails
            nftsWithMetadata.push({
              id: listing.id,
              tokenAddress: listing.token_address,
              sellerAddress: listing.seller_address,
              price: listing.currency === 'KTA' ? listing.price_kta : listing.price_xrge,
              currency: listing.currency,
              status: listing.status,
              network: listing.network,
              createdAt: listing.created_at,
            });
          }
        }

        setNfts(nftsWithMetadata);
      } catch (err: any) {
        console.error('[useMarketplaceNFTs] Error loading NFTs:', err);
        setError(err.message || 'Failed to load NFTs');
      } finally {
        setIsLoading(false);
      }
    };

    loadNFTs();
  }, [network]);

  return { nfts, isLoading, error };
}

