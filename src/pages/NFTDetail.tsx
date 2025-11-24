import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, MessageSquare, Share2, ShoppingCart } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import nft1 from "@/assets/nft1.png";
import { Textarea } from "@/components/ui/textarea";

const NFTDetail = () => {
  const { id } = useParams();

  return (
    <div className="relative min-h-screen pt-24 pb-16 px-4">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-x-0 bottom-0 top-24 z-50 flex items-center justify-center backdrop-blur-sm bg-background/60">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold neon-glow">COMING SOON</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            THIS PAGE IS UNDER CONSTRUCTION
          </p>
        </div>
      </div>

      {/* Preview Content (blurred underneath) */}
      <div className="container mx-auto">
        <Link to="/collection" className="text-xs text-primary hover:underline mb-6 md:mb-8 inline-block">
          ← BACK TO COLLECTION
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* Image Section */}
          <div className="space-y-4">
            <div className="aspect-square bg-muted pixel-border-thick overflow-hidden">
              <img 
                src={nft1} 
                alt="NFT"
                className="w-full h-full object-cover"
                style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>

          {/* Details Section */}
          <div className="space-y-4 md:space-y-6">
            <div>
              <div className="inline-block pixel-border bg-secondary/20 px-3 py-1 mb-3 md:mb-4">
                <span className="text-xs neon-glow-secondary">GENESIS COLLECTION</span>
              </div>
              <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold neon-glow mb-3 md:mb-4">
                CYBER ROBOT #{id}
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Owned by <span className="text-primary">0xDEGEN...4f2a</span>
              </p>
            </div>

            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-4 md:p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">CURRENT PRICE</span>
                  <div className="text-right">
                    <div className="text-xl md:text-2xl font-bold neon-glow">0.5 KTA</div>
                    <div className="text-xs text-muted-foreground">$125 USD</div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button className="flex-1 pixel-border bg-primary hover:bg-primary/80 gap-2 text-xs">
                    <ShoppingCart className="w-4 h-4" />
                    BUY NOW
                  </Button>
                  <Button variant="outline" className="pixel-border text-xs">
                    MAKE OFFER
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 pixel-border gap-1 text-xs">
                    <Heart className="w-3 h-3" />
                    42
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 pixel-border gap-1 text-xs">
                    <MessageSquare className="w-3 h-3" />
                    12
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 pixel-border gap-1 text-xs">
                    <Share2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-4 md:p-6 space-y-4">
                <h3 className="font-bold text-xs md:text-sm">PROPERTIES</h3>
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div className="pixel-border bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">TYPE</div>
                    <div className="font-bold text-xs mt-1">ROBOT</div>
                  </div>
                  <div className="pixel-border bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">RARITY</div>
                    <div className="font-bold text-xs mt-1 text-secondary">RARE</div>
                  </div>
                  <div className="pixel-border bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">EDITION</div>
                    <div className="font-bold text-xs mt-1">1/100</div>
                  </div>
                  <div className="pixel-border bg-muted p-3 text-center">
                    <div className="text-xs text-muted-foreground">POWER</div>
                    <div className="font-bold text-xs mt-1 text-accent">9000+</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-4 md:p-6 space-y-4">
                <h3 className="font-bold text-xs md:text-sm">ABOUT</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A legendary cyber robot from the genesis collection. Equipped with advanced 
                  neon circuitry and unmatched digital prowess. Only 100 exist in the metaverse.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Comments Section */}
        <div className="mt-8 md:mt-12 max-w-4xl">
          <Card className="pixel-border-thick bg-card">
            <CardContent className="p-4 md:p-6 space-y-4 md:space-y-6">
              <h3 className="font-bold text-base md:text-lg">COMMENTS (12)</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Textarea 
                    placeholder="DROP A COMMENT..." 
                    className="pixel-border bg-muted text-xs resize-none"
                    rows={3}
                  />
                  <Button size="sm" className="pixel-border text-xs">
                    POST COMMENT
                  </Button>
                </div>

                <div className="space-y-4 pt-4 border-t-2 border-muted">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-primary pixel-border flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">👾</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">0xWHALE</span>
                        <span className="text-xs text-muted-foreground">2h ago</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This is fire! Just copped one 🔥
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="w-10 h-10 bg-secondary pixel-border flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">🚀</span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs">0xMOON</span>
                        <span className="text-xs text-muted-foreground">5h ago</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Floor price going to the moon 🌙
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default NFTDetail;
