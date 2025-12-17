import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/contexts/WalletContext";
import { 
  Search, 
  Sparkles, 
  TrendingUp, 
  Users, 
  Image as ImageIcon,
  Filter,
  Crown,
  BadgeCheck
} from "lucide-react";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Collection {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  creator_address: string;
  logo_image: string | null;
  banner_image: string | null;
  total_supply: number | null;
  minted_count: number;
  floor_price: number | null;
  volume_traded: number;
  listed_count: number;
  is_verified: boolean;
  is_featured: boolean;
  network: string;
  created_at: string;
}

type SortBy = 'newest' | 'volume' | 'floor' | 'items';

const Collections = () => {
  const { network } = useWallet();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [filterTab, setFilterTab] = useState<'all' | 'verified' | 'featured'>('all');

  useEffect(() => {
    loadCollections();
  }, [network]);

  useEffect(() => {
    filterAndSortCollections();
  }, [collections, searchQuery, sortBy, filterTab]);

  const loadCollections = async () => {
    setIsLoading(true);
    try {
      // Collections table doesn't exist in the current schema
      // Using edge function to fetch collections from IPFS
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fx-get-collection?network=${network}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      } else {
        console.log('No collections found or service unavailable');
        setCollections([]);
      }
    } catch (error: any) {
      console.error('Error loading collections:', error);
      setCollections([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortCollections = () => {
    let filtered = [...collections];

    // Filter by tab
    if (filterTab === 'verified') {
      filtered = filtered.filter(c => c.is_verified);
    } else if (filterTab === 'featured') {
      filtered = filtered.filter(c => c.is_featured);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.symbol.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'volume':
          return (b.volume_traded || 0) - (a.volume_traded || 0);
        case 'floor':
          return (b.floor_price || 0) - (a.floor_price || 0);
        case 'items':
          return (b.minted_count || 0) - (a.minted_count || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredCollections(filtered);
  };

  return (
    <div className="relative min-h-screen pt-20 sm:pt-24 pb-12 sm:pb-16 px-2 sm:px-4">
      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-6 sm:mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold neon-glow">COLLECTIONS</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                Explore NFT collections on Keeta {network === 'main' ? 'Mainnet' : 'Testnet'}
              </p>
            </div>
            <Link to="/collection/create">
              <Button className="pixel-border-thick gap-2 w-full sm:w-auto text-xs sm:text-sm h-9 sm:h-10">
                <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                CREATE COLLECTION
              </Button>
            </Link>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search collections..."
                className="pixel-border pl-10 text-xs sm:text-sm h-9 sm:h-10"
              />
            </div>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="pixel-border bg-background text-xs sm:text-sm px-3 py-2 h-9 sm:h-10 min-w-[120px] sm:min-w-[140px]"
            >
              <option value="newest">Newest</option>
              <option value="volume">Volume</option>
              <option value="floor">Floor Price</option>
              <option value="items">Items</option>
            </select>
          </div>

          {/* Tabs */}
          <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-9 sm:h-10">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs">All</TabsTrigger>
              <TabsTrigger value="verified" className="text-[10px] sm:text-xs flex items-center gap-1">
                <BadgeCheck className="w-3 h-3" />
                <span className="hidden xs:inline">Verified</span>
              </TabsTrigger>
              <TabsTrigger value="featured" className="text-[10px] sm:text-xs flex items-center gap-1">
                <Crown className="w-3 h-3" />
                <span className="hidden xs:inline">Featured</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Collections Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Card key={i} className="pixel-border overflow-hidden">
                <Skeleton className="w-full h-32 sm:h-40" />
                <CardContent className="p-3 sm:p-4 space-y-2 sm:space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="flex gap-2">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredCollections.length === 0 ? (
          <div className="text-center py-16 sm:py-20 space-y-4">
            <div className="text-4xl sm:text-6xl">🎨</div>
            <h2 className="text-xl sm:text-2xl font-bold">No Collections Found</h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {searchQuery 
                ? "Try adjusting your search" 
                : "Be the first to create a collection!"
              }
            </p>
            {!searchQuery && (
              <Link to="/collection/create">
                <Button className="pixel-border-thick gap-2 mt-4 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4" />
                  CREATE FIRST COLLECTION
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredCollections.map((collection) => (
              <Link key={collection.id} to={`/collection/${collection.id}`}>
                <Card className="pixel-border-thick hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/30 cursor-pointer overflow-hidden bg-card group">
                  {/* Banner */}
                  <div className="relative w-full h-32 sm:h-40 overflow-hidden bg-muted">
                    {collection.banner_image ? (
                      <img
                        src={ipfsToHttp(collection.banner_image)}
                        alt={`${collection.name} banner`}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary/20 via-accent/20 to-secondary/20" />
                    )}
                    
                    {/* Badges */}
                    <div className="absolute top-2 right-2 flex gap-1">
                      {collection.is_verified && (
                        <div className="bg-primary/90 backdrop-blur-sm pixel-border px-1.5 py-0.5 sm:px-2 sm:py-1">
                          <BadgeCheck className="w-3 h-3 text-background" />
                        </div>
                      )}
                      {collection.is_featured && (
                        <div className="bg-accent/90 backdrop-blur-sm pixel-border px-1.5 py-0.5 sm:px-2 sm:py-1">
                          <Crown className="w-3 h-3 text-background" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Logo Overlap */}
                  <div className="relative px-3 sm:px-4 -mt-8 sm:-mt-10">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl border-4 border-background overflow-hidden bg-muted shadow-xl">
                      {collection.logo_image ? (
                        <img
                          src={ipfsToHttp(collection.logo_image)}
                          alt={`${collection.name} logo`}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-3 sm:p-4 pt-2 sm:pt-3 space-y-2 sm:space-y-3">
                    {/* Name & Symbol */}
                    <div>
                      <h3 className="font-bold text-sm sm:text-base neon-glow truncate">{collection.name}</h3>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">{collection.symbol}</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ImageIcon className="w-3 h-3" />
                        <span>{collection.minted_count || 0} items</span>
                      </div>
                      {collection.floor_price && (
                        <div className="flex items-center gap-1 text-primary font-bold">
                          <TrendingUp className="w-3 h-3" />
                          <span>{collection.floor_price.toFixed(2)} KTA</span>
                        </div>
                      )}
                    </div>

                    {/* Volume */}
                    {collection.volume_traded > 0 && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex justify-between text-[10px] sm:text-xs">
                          <span className="text-muted-foreground">Volume</span>
                          <span className="font-bold">{collection.volume_traded.toFixed(2)} KTA</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* Stats Section */}
        {!isLoading && collections.length > 0 && (
          <div className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <Card className="pixel-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary neon-glow">
                {collections.length}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-2">TOTAL COLLECTIONS</div>
            </Card>
            <Card className="pixel-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-accent">
                {collections.reduce((sum, c) => sum + (c.minted_count || 0), 0).toLocaleString()}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-2">TOTAL ITEMS</div>
            </Card>
            <Card className="pixel-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-secondary">
                {collections.reduce((sum, c) => sum + (c.volume_traded || 0), 0).toFixed(2)}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-2">TOTAL VOLUME (KTA)</div>
            </Card>
            <Card className="pixel-border p-4 sm:p-6 text-center">
              <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-primary">
                {collections.filter(c => c.is_verified).length}
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-2">VERIFIED</div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Collections;
