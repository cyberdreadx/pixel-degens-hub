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
    <div className="flex min-h-screen items-center justify-center pt-24 pb-16">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-bold neon-glow">COMING SOON</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          THIS PAGE IS UNDER CONSTRUCTION
        </p>
      </div>
    </div>
  );
};

export default Feed;
