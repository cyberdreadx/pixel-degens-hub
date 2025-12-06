import { useState } from "react";
import NFTCard from "@/components/NFTCard";
import { Button } from "@/components/ui/button";
import { Filter, Search, Sparkles, Tag, ShoppingBag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Link } from "react-router-dom";
import ListNFTDialog from "@/components/ListNFTDialog";
import { useMarketplaceNFTs } from "@/hooks/useMarketplaceNFTs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

const Collection = () => {
  const { tokens, isConnected, network } = useWallet();
  const { nfts: marketplaceNFTs, isLoading: isLoadingMarketplace, error: marketplaceError } = useMarketplaceNFTs(network);
  const [listingToken, setListingToken] = useState<{
    address: string;
    name: string;
    image: string;
  } | null>(null);
  
  // Filter for NFTs only from user's wallet
  const userNfts = tokens.filter(token => token.isNFT && token.metadata);
  
  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 space-y-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-5xl font-bold neon-glow">NFT MARKETPLACE</h1>
            <p className="text-xs md:text-sm text-muted-foreground">
              {marketplaceNFTs.length} DEGEN 8BIT NFTS FOR SALE
            </p>
          </div>
          <div className="flex gap-2">
            {isConnected && (
              <Link to="/profile">
                <Button variant="outline" className="pixel-border-thick gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  MY NFTS
                </Button>
              </Link>
            )}
            <Link to="/collection/create">
              <Button variant="outline" className="pixel-border-thick gap-2">
                <Sparkles className="w-4 h-4" />
                CREATE COLLECTION
              </Button>
            </Link>
            <Link to="/mint">
              <Button className="pixel-border-thick gap-2">
                <Tag className="w-4 h-4" />
                MINT NFT
              </Button>
            </Link>
          </div>
        </div>

        {/* Content */}
        {isLoadingMarketplace ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        ) : marketplaceNFTs.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <div className="text-6xl">🏪</div>
            <h2 className="text-2xl font-bold">NO LISTINGS YET</h2>
            <p className="text-sm text-muted-foreground">
              Be the first to mint and list an NFT on the marketplace!
            </p>
            <Link to="/mint">
              <Button className="pixel-border-thick gap-2 mt-4">
                <Sparkles className="w-4 h-4" />
                MINT YOUR FIRST NFT
              </Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketplaceNFTs.map((nft) => (
                <NFTCard 
                  key={nft.tokenAddress}
                  id={nft.tokenAddress}
                  title={nft.metadata?.name || nft.tokenInfo?.name || 'Unknown NFT'}
                  creator={nft.sellerUsername || `${nft.sellerAddress.slice(0, 12)}...${nft.sellerAddress.slice(-8)}`}
                  price={`${nft.price} ${nft.currency}`}
                  image={nft.metadata?.image ? ipfsToHttp(nft.metadata.image) : ''}
                  likes={0}
                  comments={0}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* List NFT Dialog */}
      {listingToken && (
        <ListNFTDialog
          open={!!listingToken}
          onOpenChange={(open) => !open && setListingToken(null)}
          tokenAddress={listingToken.address}
          tokenName={listingToken.name}
          tokenImage={listingToken.image}
        />
      )}
    </div>
  );
};

export default Collection;
