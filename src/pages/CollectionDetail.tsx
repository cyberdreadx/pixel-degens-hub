import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import NFTCard from "@/components/NFTCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { supabase } from "@/integrations/supabase/client";
import { 
  Globe, 
  Twitter, 
  MessageCircle, 
  ExternalLink, 
  Upload, 
  Users,
  Sparkles,
  LayoutGrid,
  Rocket
} from "lucide-react";

interface CollectionMetadata {
  collection_id: string;
  name: string;
  symbol: string;
  description: string;
  banner_image: string;
  logo_image: string;
  creator: string;
  royalty_percentage: number;
  social_links: {
    website?: string;
    twitter?: string;
    discord?: string;
  };
  total_supply: number | null;
  minted_count: number;
  mint_price_kta?: number;
  mint_enabled?: boolean;
  network: string;
  created_at: string;
  ipfs_hash: string;
}

interface NFTItem {
  tokenAddress: string;
  name: string;
  image: string;
  price?: string;
  currency?: string;
}

const CollectionDetail = () => {
  const { collectionId } = useParams<{ collectionId: string }>();
  const { publicKey: address, network } = useWallet();
  const [collection, setCollection] = useState<CollectionMetadata | null>(null);
  const [nfts, setNfts] = useState<NFTItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingNFTs, setIsLoadingNFTs] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (collectionId) {
      loadCollection();
    }
  }, [collectionId, network]);

  const loadCollection = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch collection metadata from IPFS via edge function
      const { data, error } = await supabase.functions.invoke('fx-get-collection', {
        body: { collectionId, network },
      });

      if (error) throw error;
      
      if (!data?.collection) {
        setError("Collection not found");
        return;
      }

      setCollection(data.collection);
      
      // Load NFTs for this collection
      await loadCollectionNFTs(data.collection.collection_id);
      
    } catch (err: any) {
      console.error("Error loading collection:", err);
      setError(err.message || "Failed to load collection");
    } finally {
      setIsLoading(false);
    }
  };

  const loadCollectionNFTs = async (colId: string) => {
    setIsLoadingNFTs(true);
    
    try {
      // Fetch NFTs that belong to this collection from marketplace listings
      const { data: listings, error } = await supabase
        .from('nft_listings')
        .select('*')
        .eq('network', network)
        .eq('status', 'active');

      if (error) throw error;

      // For each listing, check if it belongs to this collection by fetching token info
      const collectionNFTs: NFTItem[] = [];
      
      for (const listing of listings || []) {
        try {
          const apiBase = network === 'test' 
            ? 'https://rep2.test.network.api.keeta.com/api'
            : 'https://rep2.main.network.api.keeta.com/api';
          
          const response = await fetch(`${apiBase}/node/ledger/accounts/${listing.token_address}`);
          if (!response.ok) continue;
          
          const rawData = await response.json();
          const accountData = Array.isArray(rawData) ? rawData[0] : rawData;
          const tokenInfo = accountData?.info || {};
          
          if (tokenInfo.metadata) {
            try {
              const metadata = JSON.parse(atob(tokenInfo.metadata));
              
              // Check if NFT belongs to this collection
              if (metadata.collection_id === colId) {
                collectionNFTs.push({
                  tokenAddress: listing.token_address,
                  name: metadata.name || tokenInfo.description || 'Unknown NFT',
                  image: metadata.image ? ipfsToHttp(metadata.image) : '',
                  price: listing.price_kta?.toString() || listing.price_xrge?.toString(),
                  currency: listing.currency,
                });
              }
            } catch {
              // Skip if metadata parsing fails
            }
          }
        } catch {
          // Skip if API call fails
        }
      }
      
      setNfts(collectionNFTs);
    } catch (err: any) {
      console.error("Error loading collection NFTs:", err);
    } finally {
      setIsLoadingNFTs(false);
    }
  };

  if (isLoading) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4">
          <Skeleton className="w-full h-48 mb-8" />
          <Skeleton className="w-64 h-8 mb-4" />
          <Skeleton className="w-full max-w-xl h-20" />
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="relative min-h-screen pt-24 pb-16">
        <div className="container mx-auto px-4 text-center py-20">
          <div className="text-6xl mb-4">😕</div>
          <h2 className="text-2xl font-bold mb-2">Collection Not Found</h2>
          <p className="text-muted-foreground mb-4">{error || "This collection doesn't exist"}</p>
          <Link to="/collection">
            <Button className="pixel-border">BROWSE MARKETPLACE</Button>
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = address?.toLowerCase() === collection.creator.toLowerCase();

  return (
    <div className="relative min-h-screen pt-20 pb-16">
      {/* Banner */}
      <div className="relative w-full h-48 md:h-64 overflow-hidden">
        {collection.banner_image ? (
          <img
            src={ipfsToHttp(collection.banner_image)}
            alt={`${collection.name} banner`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 -mt-16 relative z-10">
        {/* Collection Header */}
        <div className="flex flex-col md:flex-row gap-6 mb-8">
          {/* Logo */}
          <div className="w-32 h-32 rounded-xl overflow-hidden border-4 border-background shadow-xl flex-shrink-0">
            {collection.logo_image ? (
              <img
                src={ipfsToHttp(collection.logo_image)}
                alt={`${collection.name} logo`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-4 md:pt-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl md:text-4xl font-bold neon-glow">{collection.name}</h1>
                <p className="text-muted-foreground text-sm">by {collection.creator.slice(0, 12)}...{collection.creator.slice(-8)}</p>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                {/* Public Mint Button - show if minting is enabled */}
                {collection.mint_enabled && (
                  <Link to={`/collection/${collectionId}/mint`}>
                    <Button className="pixel-border gap-2 bg-primary">
                      <Rocket className="h-4 w-4" />
                      MINT {collection.mint_price_kta ? `${collection.mint_price_kta} KTA` : 'FREE'}
                    </Button>
                  </Link>
                )}
                
                {/* Owner batch mint button */}
                {isOwner && (
                  <Link to={`/collection/${collectionId}/batch-mint`}>
                    <Button variant="outline" className="pixel-border gap-2">
                      <Upload className="h-4 w-4" />
                      BATCH MINT
                    </Button>
                  </Link>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <span className="text-muted-foreground">Items: </span>
                <span className="font-bold">{collection.minted_count}</span>
                {collection.total_supply && (
                  <span className="text-muted-foreground"> / {collection.total_supply}</span>
                )}
              </div>
              <div>
                <span className="text-muted-foreground">Royalty: </span>
                <span className="font-bold">{collection.royalty_percentage}%</span>
              </div>
              <div>
                <span className="text-muted-foreground">Listed: </span>
                <span className="font-bold">{nfts.length}</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-3 mt-4">
              {collection.social_links?.website && (
                <a 
                  href={collection.social_links.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded bg-muted hover:bg-primary/20 transition-colors"
                >
                  <Globe className="h-4 w-4" />
                </a>
              )}
              {collection.social_links?.twitter && (
                <a 
                  href={collection.social_links.twitter} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded bg-muted hover:bg-primary/20 transition-colors"
                >
                  <Twitter className="h-4 w-4" />
                </a>
              )}
              {collection.social_links?.discord && (
                <a 
                  href={collection.social_links.discord} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded bg-muted hover:bg-primary/20 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {collection.description && (
          <div className="mb-8 p-4 bg-card rounded-lg pixel-border">
            <p className="text-sm text-muted-foreground">{collection.description}</p>
          </div>
        )}

        {/* NFTs Grid */}
        <div className="mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-5 w-5" />
            ITEMS
          </h2>
        </div>

        {isLoadingNFTs ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : nfts.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🎨</div>
            <h2 className="text-xl font-bold">NO ITEMS LISTED YET</h2>
            <p className="text-sm text-muted-foreground">
              {isOwner 
                ? "Batch mint NFTs for this collection to get started!"
                : "Check back later for items in this collection."
              }
            </p>
            {isOwner && (
              <Link to={`/collection/${collectionId}/batch-mint`}>
                <Button className="pixel-border gap-2 mt-4">
                  <Upload className="h-4 w-4" />
                  BATCH MINT
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {nfts.map((nft) => (
              <NFTCard
                key={nft.tokenAddress}
                id={nft.tokenAddress}
                title={nft.name}
                creator={collection.name}
                price={nft.price ? `${nft.price} ${nft.currency}` : undefined}
                image={nft.image}
                likes={0}
                comments={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionDetail;
