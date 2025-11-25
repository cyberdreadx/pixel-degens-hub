import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Heart, MessageSquare, Share2, Loader2, RefreshCw, TrendingUp, Image } from "lucide-react";
import { useFeedActivities } from "@/hooks/useFeedActivities";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { debugFeedData } from "@/utils/debugFeed";

const Feed = () => {
  const { network } = useWallet();
  // Default to 'test' network if not connected
  const { activities, isLoading, error, refetch } = useFeedActivities(network || 'test');
  const [filter, setFilter] = useState<'all' | 'nfts' | 'swaps'>('all');

  // Filter activities based on selected tab
  const filteredActivities = activities.filter(activity => {
    if (filter === 'nfts') return activity.type === 'listing' || activity.type === 'sale';
    if (filter === 'swaps') return activity.type === 'swap';
    return true; // 'all'
  });

  const nftCount = activities.filter(a => a.type === 'listing' || a.type === 'sale').length;
  const swapCount = activities.filter(a => a.type === 'swap').length;

  // Debug on mount
  useEffect(() => {
    debugFeedData(network);
  }, [network]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'listing':
        return '📦';
      case 'sale':
        return '💰';
      case 'swap':
        return '🔄';
      default:
        return '🎯';
    }
  };

  const getActivityAction = (type: string) => {
    switch (type) {
      case 'listing':
        return 'listed';
      case 'sale':
        return 'purchased';
      case 'swap':
        return 'swapped';
      default:
        return 'interacted with';
    }
  };

  const formatAddress = (address: string) => {
    if (!address || address === 'Anonymous Trader') return address;
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };
  return (
    <div className="relative min-h-screen pt-24 pb-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl md:text-5xl font-bold neon-glow">ACTIVITY FEED</h1>
              <p className="text-xs md:text-sm text-muted-foreground mt-2">
                LATEST DROPS & MOVES FROM THE COMMUNITY ({network === 'test' ? 'TESTNET' : 'MAINNET'})
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refetch}
              disabled={isLoading}
              className="pixel-border text-xs"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Filter Tabs */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3 pixel-border">
              <TabsTrigger value="all" className="text-xs">
                ALL ({activities.length})
              </TabsTrigger>
              <TabsTrigger value="nfts" className="text-xs">
                <Image className="w-3 h-3 mr-1" />
                NFTS ({nftCount})
              </TabsTrigger>
              <TabsTrigger value="swaps" className="text-xs">
                <TrendingUp className="w-3 h-3 mr-1" />
                SWAPS ({swapCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Debug Info (remove after fixing) */}
          {!isLoading && (
            <Card className="pixel-border bg-yellow-500/10 border-yellow-500">
              <CardContent className="p-4">
                <p className="text-xs font-bold mb-2">🐛 DEBUG INFO:</p>
                <div className="text-xs space-y-1 font-mono">
                  <div>Network: <span className="text-primary">{network}</span></div>
                  <div>Total Activities: <span className="text-primary">{activities.length}</span></div>
                  <div>NFT Activities: <span className="text-primary">{nftCount}</span></div>
                  <div>Swap Activities: <span className="text-primary">{swapCount}</span></div>
                  <div className="text-yellow-600 mt-2">
                    👉 Check browser console for detailed logs
                  </div>
                  <div className="text-yellow-600">
                    👉 Look for [useFeedActivities] and [DEBUG] messages
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {isLoading && activities.length === 0 && (
          <div className="text-center py-20">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
            <p className="text-sm text-muted-foreground">LOADING ACTIVITIES...</p>
          </div>
        )}

        {error && (
          <Card className="pixel-border-thick bg-destructive/10 border-destructive">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-destructive">Failed to load activities: {error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={refetch}
                className="mt-4 pixel-border text-xs"
              >
                TRY AGAIN
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && filteredActivities.length === 0 && activities.length > 0 && (
          <Card className="pixel-border-thick bg-card">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-bold mb-2">NO {filter.toUpperCase()} FOUND</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Try selecting a different filter
              </p>
              <Button 
                variant="outline" 
                onClick={() => setFilter('all')}
                className="pixel-border text-xs"
              >
                SHOW ALL
              </Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && !error && activities.length === 0 && (
          <Card className="pixel-border-thick bg-card">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">🏪</div>
              <h3 className="text-xl font-bold mb-2">NO MARKETPLACE ACTIVITY YET</h3>
              <div className="max-w-md mx-auto space-y-3 mb-6">
                <p className="text-sm text-muted-foreground">
                  <strong>This feed shows marketplace activity:</strong>
                </p>
                <div className="text-xs text-muted-foreground space-y-1 text-left bg-muted/50 p-3 pixel-border">
                  <div>✅ NFTs <strong>listed for sale</strong></div>
                  <div>✅ NFTs <strong>sold</strong></div>
                  <div>✅ Token <strong>swaps</strong></div>
                  <div className="mt-2 pt-2 border-t border-border">
                    <div>❌ Minted NFTs (until listed)</div>
                    <div>❌ NFTs in wallets (until listed)</div>
                  </div>
                </div>
                <p className="text-xs text-primary font-bold">
                  💡 Have NFTs? List them for sale to see them here!
                </p>
              </div>
              <div className="space-y-3">
                <div className="text-xs text-muted-foreground font-bold">GET STARTED:</div>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <Link to="/profile">
                    <Button variant="default" className="pixel-border-thick text-xs w-full sm:w-auto gap-1">
                      📦 LIST YOUR NFTs
                    </Button>
                  </Link>
                  <Link to="/mint">
                    <Button variant="outline" className="pixel-border text-xs w-full sm:w-auto gap-1">
                      🎨 MINT NEW NFT
                    </Button>
                  </Link>
                  <Link to="/swap">
                    <Button variant="outline" className="pixel-border text-xs w-full sm:w-auto gap-1">
                      🔄 SWAP TOKENS
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {/* Show section headers when both types exist and filter is 'all' */}
          {filter === 'all' && 
           filteredActivities.some(a => a.type === 'listing' || a.type === 'sale') && 
           filteredActivities.some(a => a.type === 'swap') && (
            <div className="sticky top-20 z-10 bg-background/80 backdrop-blur-sm p-2 rounded pixel-border">
              <p className="text-xs text-muted-foreground text-center">
                ⬇️ NFT ACTIVITIES SHOWN FIRST ⬇️
              </p>
            </div>
          )}
          
          {filteredActivities.map((activity, index) => {
            // Add separator between NFTs and swaps (only in 'all' view)
            const isLastNFT = filter === 'all' && 
              (activity.type === 'listing' || activity.type === 'sale') &&
              filteredActivities[index + 1]?.type === 'swap';
            const separator = isLastNFT ? (
              <div key={`separator-nft-${index}`} className="py-4">
                <div className="border-t-2 border-dashed border-muted relative">
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 py-1 pixel-border text-xs text-muted-foreground">
                    TOKEN SWAPS
                  </div>
                </div>
              </div>
            ) : null;
            
            if (activity.type === 'swap') {
              return (
                <div key={`swap-${activity.id}`}>
                  {separator}
                  <Card className="pixel-border-thick bg-card opacity-80">
                  <CardHeader className="p-4 border-b-2 border-muted">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-accent pixel-border flex items-center justify-center">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs">{formatAddress(activity.userAddress)}</span>
                          <span className="text-xs text-muted-foreground">swapped</span>
                          <span className="font-bold text-xs text-accent">
                            {activity.volume?.toFixed(4)} {activity.fromToken}
                          </span>
                          <span className="text-xs text-muted-foreground">→</span>
                          <span className="font-bold text-xs text-accent">{activity.toToken}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Rate: 1 {activity.fromToken} = {activity.rate?.toFixed(6)} {activity.toToken}
                          {' • '}
                          {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
                </div>
              );
            }

            return (
              <div key={`nft-${activity.id}`}>
              <Card className="pixel-border-thick bg-card">
                <CardHeader className="p-4 border-b-2 border-muted">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary pixel-border flex items-center justify-center">
                      <span className="text-lg">{getActivityIcon(activity.type)}</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link 
                          to={`/profile/${activity.userAddress}`}
                          className="font-bold text-xs hover:text-primary transition-colors"
                        >
                          {formatAddress(activity.userAddress)}
                        </Link>
                        <span className="text-xs text-muted-foreground">{getActivityAction(activity.type)}</span>
                        <Link 
                          to={`/nft/${activity.tokenAddress}`}
                          className="font-bold text-xs text-primary hover:underline"
                        >
                          {activity.tokenName || 'NFT'}
                        </Link>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {activity.price && (
                          <>
                            <span className="text-primary font-bold">{activity.price} {activity.currency}</span>
                            {' • '}
                          </>
                        )}
                        {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {activity.tokenImage && (
                  <CardContent className="p-0">
                    <Link to={`/nft/${activity.tokenAddress}`}>
                      <div className="aspect-square bg-muted hover:opacity-90 transition-opacity">
                        <img 
                          src={ipfsToHttp(activity.tokenImage)} 
                          alt={activity.tokenName || 'NFT'}
                          className="w-full h-full object-cover"
                          style={{ imageRendering: "pixelated" }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23666" font-size="40"%3E🎨%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      </div>
                    </Link>

                    <div className="p-4 flex gap-2">
                      <Link to={`/nft/${activity.tokenAddress}`} className="flex-1">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full pixel-border text-xs"
                        >
                          VIEW DETAILS
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                )}
              </Card>
              {separator}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Feed;
