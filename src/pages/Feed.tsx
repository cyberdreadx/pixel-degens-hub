import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, MessageSquare, Share2 } from "lucide-react";
import nft1 from "@/assets/nft1.png";
import nft2 from "@/assets/nft2.png";
import nft3 from "@/assets/nft3.png";

const mockActivities = [
  {
    id: 1,
    user: "0xDEGEN",
    avatar: "🎮",
    action: "minted",
    nft: "CYBER ROBOT #001",
    image: nft1,
    time: "2 hours ago",
    likes: 42,
    comments: 8,
  },
  {
    id: 2,
    user: "0xVIBE",
    avatar: "👾",
    action: "purchased",
    nft: "ALIEN SUPREME #069",
    image: nft2,
    time: "5 hours ago",
    likes: 88,
    comments: 15,
  },
  {
    id: 3,
    user: "0xMOON",
    avatar: "🚀",
    action: "listed",
    nft: "SPACE WARRIOR #420",
    image: nft3,
    time: "1 day ago",
    likes: 156,
    comments: 23,
  },
];

const Feed = () => {
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
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 space-y-4">
          <h1 className="text-3xl md:text-5xl font-bold neon-glow">ACTIVITY FEED</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            LATEST DROPS & MOVES FROM THE COMMUNITY
          </p>
        </div>

        <div className="space-y-6">
          {mockActivities.map((activity) => (
            <Card key={activity.id} className="pixel-border-thick bg-card">
              <CardHeader className="p-4 border-b-2 border-muted">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary pixel-border flex items-center justify-center">
                    <span className="text-lg">{activity.avatar}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs">{activity.user}</span>
                      <span className="text-xs text-muted-foreground">{activity.action}</span>
                      <span className="font-bold text-xs text-primary">{activity.nft}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{activity.time}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                <div className="aspect-square bg-muted">
                  <img 
                    src={activity.image} 
                    alt={activity.nft}
                    className="w-full h-full object-cover"
                    style={{ imageRendering: "pixelated" }}
                  />
                </div>

                <div className="p-4 flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 pixel-border gap-1 text-xs"
                  >
                    <Heart className="w-3 h-3" />
                    {activity.likes}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 pixel-border gap-1 text-xs"
                  >
                    <MessageSquare className="w-3 h-3" />
                    {activity.comments}
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="pixel-border text-xs"
                  >
                    <Share2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button 
            variant="outline" 
            size="lg"
            className="pixel-border-thick text-xs"
          >
            LOAD MORE
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Feed;
