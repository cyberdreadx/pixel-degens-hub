import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare, Share2, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { useFeedActivities } from "@/hooks/useFeedActivities";
import { useWallet } from "@/contexts/WalletContext";
import { ipfsToHttp } from "@/utils/nftUtils";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

const Feed = () => {
  const { network } = useWallet();
  const { activities, isLoading, error, refetch } = useFeedActivities(network);

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

        {!isLoading && !error && activities.length === 0 && (
          <Card className="pixel-border-thick bg-card">
            <CardContent className="p-12 text-center">
              <div className="text-6xl mb-4">📭</div>
              <h3 className="text-xl font-bold mb-2">NO ACTIVITY YET</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Be the first to mint or trade on {network === 'test' ? 'testnet' : 'mainnet'}!
              </p>
              <div className="flex gap-2 justify-center">
                <Link to="/mint">
                  <Button variant="default" className="pixel-border-thick text-xs">
                    MINT NFT
                  </Button>
                </Link>
                <Link to="/swap">
                  <Button variant="outline" className="pixel-border text-xs">
                    SWAP TOKENS
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {activities.map((activity) => {
            if (activity.type === 'swap') {
              return (
                <Card key={activity.id} className="pixel-border-thick bg-card">
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
              );
            }

            return (
              <Card key={activity.id} className="pixel-border-thick bg-card">
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
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Feed;
