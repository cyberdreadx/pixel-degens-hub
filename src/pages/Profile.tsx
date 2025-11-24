import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Share2 } from "lucide-react";
import NFTCard from "@/components/NFTCard";
import nft1 from "@/assets/nft1.png";
import nft4 from "@/assets/nft4.png";
import nft6 from "@/assets/nft6.png";

const ownedNFTs = [
  {
    id: "1",
    title: "CYBER ROBOT #001",
    creator: "0xDEGEN",
    price: "0.5",
    image: nft1,
    likes: 42,
    comments: 12,
  },
  {
    id: "4",
    title: "PIXEL CAT #777",
    creator: "0xWHALE",
    price: "2.1",
    image: nft4,
    likes: 234,
    comments: 67,
  },
  {
    id: "6",
    title: "ASTRO VOYAGER #888",
    creator: "0xSTAR",
    price: "0.9",
    image: nft6,
    likes: 167,
    comments: 52,
  },
];

const Profile = () => {
  return (
    <div className="relative min-h-screen pt-24 pb-16">
      {/* Coming Soon Overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-background/60">
        <div className="text-center space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold neon-glow">COMING SOON</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            THIS PAGE IS UNDER CONSTRUCTION
          </p>
        </div>
      </div>

      {/* Preview Content (blurred underneath) */}
      <div className="container mx-auto px-4">
        {/* Profile Header */}
        <Card className="pixel-border-thick bg-card mb-8">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <div className="w-24 h-24 bg-gradient-to-br from-primary to-secondary pixel-border-thick flex items-center justify-center flex-shrink-0">
                <span className="text-5xl">🎮</span>
              </div>

              <div className="flex-1 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                  <div>
                    <h1 className="text-2xl md:text-4xl font-bold neon-glow">0xDEGEN</h1>
                    <p className="text-xs text-muted-foreground mt-2">
                      0x742d...4f2a
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="pixel-border gap-2 text-xs"
                    >
                      <Share2 className="w-3 h-3" />
                      SHARE
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="pixel-border gap-2 text-xs"
                    >
                      <Settings className="w-3 h-3" />
                      EDIT
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground max-w-2xl">
                  Pixel art collector & DEGEN enthusiast. Building on Keeta Chain. 
                  To the moon! 🚀
                </p>

                <div className="grid grid-cols-3 gap-4 pt-4">
                  <div className="text-center pixel-border bg-muted p-3">
                    <div className="text-xl font-bold neon-glow">3</div>
                    <div className="text-xs text-muted-foreground">OWNED</div>
                  </div>
                  <div className="text-center pixel-border bg-muted p-3">
                    <div className="text-xl font-bold neon-glow-secondary">12</div>
                    <div className="text-xs text-muted-foreground">CREATED</div>
                  </div>
                  <div className="text-center pixel-border bg-muted p-3">
                    <div className="text-xl font-bold text-accent">8.5</div>
                    <div className="text-xs text-muted-foreground">KTA VOL</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="owned" className="w-full">
          <TabsList className="w-full sm:w-auto pixel-border bg-card mb-8 grid grid-cols-3 text-xs">
            <TabsTrigger value="owned" className="text-xs">OWNED</TabsTrigger>
            <TabsTrigger value="created" className="text-xs">CREATED</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">ACTIVITY</TabsTrigger>
          </TabsList>

          <TabsContent value="owned" className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {ownedNFTs.map((nft) => (
                <NFTCard key={nft.id} {...nft} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="created" className="space-y-6">
            <div className="text-center py-16 space-y-4">
              <div className="text-6xl">🎨</div>
              <h3 className="text-xl font-bold">NO CREATIONS YET</h3>
              <p className="text-sm text-muted-foreground">
                Start creating your own 8-bit masterpieces
              </p>
              <Button className="pixel-border text-xs mt-4">
                CREATE NFT
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="activity" className="space-y-6">
            <Card className="pixel-border-thick bg-card">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-4 text-xs">
                  <div className="w-2 h-2 bg-accent rounded-full" />
                  <span className="text-muted-foreground">Purchased</span>
                  <span className="font-bold">PIXEL CAT #777</span>
                  <span className="ml-auto text-muted-foreground">2h ago</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span className="text-muted-foreground">Listed</span>
                  <span className="font-bold">CYBER ROBOT #001</span>
                  <span className="ml-auto text-muted-foreground">1d ago</span>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="w-2 h-2 bg-secondary rounded-full" />
                  <span className="text-muted-foreground">Minted</span>
                  <span className="font-bold">ASTRO VOYAGER #888</span>
                  <span className="ml-auto text-muted-foreground">3d ago</span>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
